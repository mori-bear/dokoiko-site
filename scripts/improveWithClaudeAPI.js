#!/usr/bin/env node
/**
 * improveWithClaudeAPI.js
 * Anthropic API で description < 200字 の全destination を高品質化。
 * バッチ処理（5件まとめて1回のAPI呼び出し）でコスト削減。
 *
 * 環境変数: ANTHROPIC_API_KEY (.env)
 * 使い方: node scripts/improveWithClaudeAPI.js [--limit=N] [--start=N]
 */
import fs from 'fs';
import Anthropic from '@anthropic-ai/sdk';

// .env ロード
const envContent = fs.readFileSync('./.env', 'utf-8');
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.+)$/);
  if (m) process.env[m[1]] = m[2].trim();
}

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error('❌ ANTHROPIC_API_KEY が設定されていません');
  process.exit(1);
}

const client = new Anthropic({ apiKey });
const DEST_FILE = './src/data/destinations.json';
const BATCH_SIZE = 5;
const RATE_MS = 1500;

// オプション解析
const args = process.argv.slice(2);
let limit = Infinity;
let start = 0;
for (const a of args) {
  if (a.startsWith('--limit=')) limit = parseInt(a.slice(8));
  if (a.startsWith('--start=')) start = parseInt(a.slice(8));
}

const destinations = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));
const targets = destinations.filter(d => !d.description || d.description.length < 200).slice(start, start + limit);
console.log(`📝 改善対象: ${targets.length}件（start=${start}, limit=${limit}）`);
console.log(`🤖 Model: claude-haiku-4-5-20251001 (安価で高速)`);

const SYSTEM_PROMPT = `あなたは日本の旅情を伝える観光記事ライターです。各目的地について、小豆島・鎌倉の参考例レベルの体験的・文学的な説明文を書いてください。

参考スタイル（小豆島）：
「フェリーに乗って、海を渡る。その時点で、もう旅が始まっている。小豆島は、瀬戸内の島の中でもちょっと「欲張り」な島だ。断崖の絶景、砂の道、オリーブの丘。全部、ひとつの島に詰まっている。」

要件：
- 各説明文は **必ず220〜280字** （短すぎはNG）
- 五感（光・音・匂い・触感）を1つは含める
- 具体的固有名詞（建物・人物・時代）を含める
- 「そんな街」「時間がここにある」など余韻のある締め
- テンプレ的な「○○県の代表的な観光地」は禁止
- JSON形式で返答（マークダウンコードブロック禁止）`;

async function callBatch(batch) {
  const userMsg = `以下の目的地それぞれに、200〜300字の体験的な説明文を書いてください。

${batch.map(d => `- id: ${d.id}, 名前: ${d.name}（${d.prefecture}）, タグ: ${(d.tags||[]).slice(0,4).join('・')}, スポット: ${(d.spots||[]).map(s=>s.name).slice(0,3).join('・')}`).join('\n')}

応答形式（JSONのみ、マークダウン禁止）:
[{"id":"...","description":"..."},...]`;

  const res = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMsg }],
  });
  const text = res.content[0].text.trim();
  // JSON抽出
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('JSON not found in response');
  return JSON.parse(jsonMatch[0]);
}

let processed = 0;
let success = 0;
let failed = 0;
let totalCost = 0;  // 概算

for (let i = 0; i < targets.length; i += BATCH_SIZE) {
  const batch = targets.slice(i, i + BATCH_SIZE);
  const ids = batch.map(d => d.id).join(', ');
  try {
    const results = await callBatch(batch);
    for (const r of results) {
      const d = destinations.find(x => x.id === r.id);
      if (d && r.description && r.description.length >= 200) {
        d.description = r.description;
        success++;
      } else if (d && r.description && r.description.length > (d.description?.length || 0)) {
        // 200字未満でも、現状より長ければ採用
        d.description = r.description;
        success++;
      }
    }
    processed += batch.length;
    if ((i / BATCH_SIZE + 1) % 5 === 0 || i + BATCH_SIZE >= targets.length) {
      console.log(`  [${processed}/${targets.length}] 成功${success} 失敗${failed}`);
      fs.writeFileSync(DEST_FILE, JSON.stringify(destinations, null, 2));
    }
  } catch (e) {
    failed += batch.length;
    console.log(`  ✗ ${ids}: ${e.message}`);
  }
  await new Promise(r => setTimeout(r, RATE_MS));
}

fs.writeFileSync(DEST_FILE, JSON.stringify(destinations, null, 2));

const descLens = destinations.map(d => d.description?.length || 0);
const short = descLens.filter(L => L < 200).length;
const long_ = descLens.filter(L => L >= 200).length;

console.log('\n' + '='.repeat(60));
console.log('完了');
console.log('='.repeat(60));
console.log(`  成功: ${success}件`);
console.log(`  失敗: ${failed}件`);
console.log(`  description 200字+: ${long_} / 200字未満: ${short}`);
