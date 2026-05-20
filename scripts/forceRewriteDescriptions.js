#!/usr/bin/env node
/**
 * forceRewriteDescriptions.js
 * description<200字の残り全件を、より厳格なプロンプトで強制リライト。
 * 200字未満が返ったら最大3回までリトライ。1件ずつ処理（バッチなし）で確実性を優先。
 */
import fs from 'fs';
import Anthropic from '@anthropic-ai/sdk';

const envContent = fs.readFileSync('./.env', 'utf-8');
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.+)$/);
  if (m) process.env[m[1]] = m[2].trim();
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const DEST_FILE = './src/data/destinations.json';
const MIN_LEN = 220;
const MAX_RETRIES = 3;

const destinations = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));
const targets = destinations.filter(d => !d.description || d.description.length < 200);
console.log(`🎯 強制リライト対象: ${targets.length}件 (min=${MIN_LEN}字)`);

const SYSTEM = `あなたは日本の旅情を伝えるベテラン観光記事ライターです。
**最重要ルール: 出力する説明文は必ず${MIN_LEN}字以上にすること。199字以下は厳禁。**
複数の文を組み合わせ、五感の描写・固有名詞・季節感・歴史を盛り込んで、220-280字に収めること。
テンプレ的な「○○の代表的な観光地」「日常から離れた時間」などの汎用フレーズは使わない。
余韻のある締めで終わる。マークダウンコードブロック禁止、純粋なJSONのみ出力。`;

async function callOne(d, attempt) {
  const userMsg = `次の目的地について、${MIN_LEN}字以上280字以下の体験的な説明文を1つ書いてください。

- 名前: ${d.name}（${d.prefecture}）
- タグ: ${(d.tags||[]).slice(0,4).join('・')}
- スポット: ${(d.spots||[]).map(s=>s.name).slice(0,3).join('・')}
${attempt > 1 ? `\n前回の出力は短すぎました。今度は必ず${MIN_LEN}字以上で書いてください。` : ''}

応答形式（JSONのみ、マークダウン禁止）:
{"description":"..."}`;

  const res = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1000,
    system: SYSTEM,
    messages: [{ role: 'user', content: userMsg }],
  });
  const text = res.content[0].text.trim();
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('JSON not found');
  return JSON.parse(m[0]).description;
}

let success = 0, kept = 0, failed = 0;
for (let i = 0; i < targets.length; i++) {
  const d = targets[i];
  let bestDesc = d.description || '';
  let resolved = false;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const newDesc = await callOne(d, attempt);
      if (newDesc && newDesc.length >= MIN_LEN) {
        d.description = newDesc;
        success++;
        resolved = true;
        break;
      }
      // 既存より長ければ更新
      if (newDesc && newDesc.length > bestDesc.length) {
        bestDesc = newDesc;
      }
    } catch (e) {
      console.log(`    ✗ attempt ${attempt}: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 800));
  }
  if (!resolved) {
    if (bestDesc.length > (d.description || '').length) {
      d.description = bestDesc;
      kept++;
    } else {
      failed++;
    }
  }
  if ((i + 1) % 10 === 0 || i + 1 === targets.length) {
    console.log(`  [${i+1}/${targets.length}] 成功${success} 既存超${kept} 失敗${failed}`);
    fs.writeFileSync(DEST_FILE, JSON.stringify(destinations, null, 2));
  }
  await new Promise(r => setTimeout(r, 1200));
}

fs.writeFileSync(DEST_FILE, JSON.stringify(destinations, null, 2));
const long = destinations.filter(d => d.description && d.description.length >= 200).length;
const short = destinations.length - long;
console.log(`\n=== 完了 ===`);
console.log(`  ${MIN_LEN}字以上達成: ${success}件`);
console.log(`  既存より長く更新: ${kept}件`);
console.log(`  失敗: ${failed}件`);
console.log(`  最終 200字+: ${long} / 200未満: ${short}`);
