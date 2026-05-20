#!/usr/bin/env node
/**
 * rewriteSpotsTemplates.js
 * spots[].description が「必見の場所です」「代表するスポット」を含むものを
 * Claude API で 50〜100字の具体的な説明文にリライト。
 * バッチ8件/API call、destinations.json は10件ごとに保存。
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

const PAT = /必見の場所です|代表するスポット/;

// {destId, spotIdx, spotName, destName, prefecture, tags, oldDesc}
const targets = [];
for (let di = 0; di < destinations.length; di++) {
  const d = destinations[di];
  if (!d.spots) continue;
  for (let si = 0; si < d.spots.length; si++) {
    const s = d.spots[si];
    if (typeof s.description === 'string' && PAT.test(s.description)) {
      targets.push({
        destId: d.id, spotIdx: si,
        spotName: s.name,
        destName: d.name,
        prefecture: d.prefecture,
        tags: (d.tags || []).slice(0, 3),
      });
    }
  }
}
console.log(`📝 リライト対象: ${targets.length}件`);

const SYSTEM = `あなたは日本の旅情を伝える観光記事ライターです。
各観光スポットについて、50〜100字の具体的で体験的な短文を1つ書きます。
- 「必見の場所」「代表するスポット」など汎用フレーズは禁止
- 五感（光・音・匂い・触感）か固有の特徴（建築・季節・歴史）を1つ含める
- 体言止めや短文の連続でテンポよく
- 純粋なJSONのみ出力、マークダウン禁止`;

const BATCH = 8;
const RATE = 1500;

async function callBatch(batch) {
  const userMsg = `次の各観光スポットに、その地名・特徴に即した50〜100字の短文を書いてください。

${batch.map((t, i) => `${i+1}. ${t.spotName}（${t.destName}/${t.prefecture}, タグ:${t.tags.join('・')}）`).join('\n')}

応答形式（JSONのみ）:
[{"i":1,"description":"..."},{"i":2,"description":"..."},...]`;

  const res = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 3000,
    system: SYSTEM,
    messages: [{ role: 'user', content: userMsg }],
  });
  const text = res.content[0].text.trim();
  const m = text.match(/\[[\s\S]*\]/);
  if (!m) throw new Error('JSON not found');
  return JSON.parse(m[0]);
}

let success = 0, failed = 0;
for (let i = 0; i < targets.length; i += BATCH) {
  const batch = targets.slice(i, i + BATCH);
  try {
    const results = await callBatch(batch);
    for (const r of results) {
      const idx = r.i - 1;
      const t = batch[idx];
      if (!t) continue;
      const desc = (r.description || '').trim();
      if (desc && desc.length >= 30 && desc.length <= 200) {
        const d = destinations.find(x => x.id === t.destId);
        if (d && d.spots && d.spots[t.spotIdx]) {
          d.spots[t.spotIdx].description = desc;
          success++;
        }
      } else {
        failed++;
      }
    }
  } catch (e) {
    failed += batch.length;
    console.log(`  ✗ batch ${i}: ${e.message}`);
  }
  if ((i / BATCH + 1) % 5 === 0 || i + BATCH >= targets.length) {
    console.log(`  [${Math.min(i + BATCH, targets.length)}/${targets.length}] ✓${success} ✗${failed}`);
    fs.writeFileSync(DEST_FILE, JSON.stringify(destinations, null, 2));
  }
  await new Promise(r => setTimeout(r, RATE));
}

fs.writeFileSync(DEST_FILE, JSON.stringify(destinations, null, 2));

let remaining = 0;
for (const d of destinations) {
  for (const s of d.spots || []) {
    if (typeof s.description === 'string' && PAT.test(s.description)) remaining++;
  }
}
console.log(`\n=== 完了 ===`);
console.log(`  リライト成功: ${success}`);
console.log(`  失敗: ${failed}`);
console.log(`  残存テンプレ文: ${remaining}件`);
