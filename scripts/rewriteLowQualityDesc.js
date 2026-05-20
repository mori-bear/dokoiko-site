#!/usr/bin/env node
/**
 * rewriteLowQualityDesc.js
 * 紋切り型表現を含む description を Claude API でリライト。
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
const destinations = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));

const LOW_PAT = /楽しめます|楽しめる|お楽しみください|有名な観光地|有名です|人気スポット|人気の観光|ぜひお|魅力満載|観光客でにぎわう|絶景を堪能|お越しください|親しまれて|多くの観光客|定番の|オススメ|名物の|歴史と文化を|味わうことができ|体験することができ|心癒され|憩いの場|世代を問わ|どこにでも|スポット情報|向かえば、日常から少し離れた/;

const targets = destinations.filter(d => d.description && LOW_PAT.test(d.description));
console.log(`📝 紋切り型リライト対象: ${targets.length}件`);

const SYSTEM = `あなたは日本の旅情を伝えるベテラン観光記事ライターです。
出力する説明文は必ず220字以上280字以下に収め、以下を守ってください:
- 「楽しめます」「有名です」「人気の」など紋切り型は絶対禁止
- 「その場所ならではの体験・感覚・情景」が伝わるよう、五感の描写・固有名詞を含める
- 季節・歴史・地形などの具体性を必ず1つ以上盛り込む
- 体言止めや短文を交えてテンポを作る
- 純粋なJSONのみ出力、マークダウン禁止`;

async function callBatch(batch) {
  const userMsg = `以下の目的地について、それぞれ220-280字の体験的な説明文を書いてください。

${batch.map(d => `- id: ${d.id}, 名前: ${d.name}（${d.prefecture}）, タグ: ${(d.tags||[]).slice(0,4).join('・')}, spots: ${(d.spots||[]).map(s=>s.name).slice(0,3).join('・')}`).join('\n')}

応答形式（JSONのみ、マークダウン禁止）:
[{"id":"...","description":"..."},...]`;

  const res = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4000,
    system: SYSTEM,
    messages: [{ role: 'user', content: userMsg }],
  });
  const text = res.content[0].text.trim();
  const m = text.match(/\[[\s\S]*\]/);
  if (!m) throw new Error('JSON not found');
  return JSON.parse(m[0]);
}

const BATCH = 5;
let success = 0, fail = 0;
for (let i = 0; i < targets.length; i += BATCH) {
  const batch = targets.slice(i, i + BATCH);
  try {
    const results = await callBatch(batch);
    for (const r of results) {
      const d = destinations.find(x => x.id === r.id);
      if (d && r.description && r.description.length >= 200 && !LOW_PAT.test(r.description)) {
        d.description = r.description;
        success++;
      } else fail++;
    }
  } catch (e) {
    fail += batch.length;
    console.log(`  ✗ batch ${i}: ${e.message}`);
  }
  console.log(`  [${Math.min(i+BATCH, targets.length)}/${targets.length}] ✓${success} ✗${fail}`);
  fs.writeFileSync(DEST_FILE, JSON.stringify(destinations, null, 2));
  await new Promise(r => setTimeout(r, 1500));
}
fs.writeFileSync(DEST_FILE, JSON.stringify(destinations, null, 2));
const remaining = destinations.filter(d => d.description && LOW_PAT.test(d.description)).length;
console.log(`\n=== 完了 ===`);
console.log(`  リライト成功: ${success}`);
console.log(`  失敗: ${fail}`);
console.log(`  残存紋切り型: ${remaining}件`);
