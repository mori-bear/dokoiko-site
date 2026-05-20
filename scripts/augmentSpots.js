#!/usr/bin/env node
/**
 * augmentSpots.js
 * spots ≤ 1件のdestinationに、Claude APIで2〜4件のspotを追加。
 * 各spot: name / description (50-100字) / googleMapsQuery
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

const targets = destinations.filter(d => (d.spots || []).length <= 1);
console.log(`📍 spots補完対象: ${targets.length}件`);

const SYSTEM = `あなたは日本の旅情を伝える観光記事ライターです。
各目的地について、その地ならではの観光スポット情報を生成します。
- 既存spotと重複しない、別の代表的な周辺spot
- 各spot: name (日本語), description (50-100字, 五感や具体的特徴含む), googleMapsQuery (検索用クエリ)
- 紋切り型表現禁止 (「楽しめます」「有名です」など)
- ハルシネーション禁止: 実在しないspotは作らない。確信が持てない場合はspot数を減らす
- 純粋なJSONのみ出力`;

async function callBatch(batch) {
  const userMsg = `以下の各目的地について、その地の代表的な観光spot を2〜3件ずつ生成してください。
既存spotと異なる、周辺の実在する観光地・施設・名所を挙げてください。

${batch.map(d => {
  const existing = (d.spots || []).map(s => s.name).join('・');
  return `- id:"${d.id}", 名前:"${d.name}", 都道府県:"${d.prefecture}", タグ:[${(d.tags||[]).slice(0,4).join('・')}], 既存spot:[${existing}]`;
}).join('\n')}

応答形式（JSONのみ、マークダウン禁止）:
[
  {"id":"...","spots":[
    {"name":"...","description":"50-100字","googleMapsQuery":"検索用クエリ"}
  ]}
]`;

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

const BATCH = 4;
let added = 0, fail = 0;
for (let i = 0; i < targets.length; i += BATCH) {
  const batch = targets.slice(i, i + BATCH);
  try {
    const results = await callBatch(batch);
    for (const r of results) {
      const d = destinations.find(x => x.id === r.id);
      if (!d || !Array.isArray(r.spots)) { fail++; continue; }
      const existingNames = new Set((d.spots || []).map(s => s.name));
      const newSpots = r.spots
        .filter(s => s?.name && !existingNames.has(s.name))
        .map(s => ({
          name: s.name,
          description: (s.description || '').slice(0, 200),
          googleMapsQuery: s.googleMapsQuery || s.name,
        }));
      if (newSpots.length > 0) {
        d.spots = [...(d.spots || []), ...newSpots];
        added += newSpots.length;
      } else fail++;
    }
  } catch (e) {
    fail += batch.length;
    console.log(`  ✗ batch ${i}: ${e.message}`);
  }
  if ((i / BATCH + 1) % 5 === 0 || i + BATCH >= targets.length) {
    console.log(`  [${Math.min(i+BATCH, targets.length)}/${targets.length}] +${added}spots fail=${fail}`);
    fs.writeFileSync(DEST_FILE, JSON.stringify(destinations, null, 2));
  }
  await new Promise(r => setTimeout(r, 1500));
}
fs.writeFileSync(DEST_FILE, JSON.stringify(destinations, null, 2));
const remaining = destinations.filter(d => (d.spots || []).length <= 1).length;
console.log(`\n=== 完了 ===`);
console.log(`  追加spots: ${added}`);
console.log(`  バッチ失敗: ${fail}`);
console.log(`  残り spots≤1: ${remaining}件`);
