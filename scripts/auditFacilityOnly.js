#!/usr/bin/env node
import fs from 'fs';
import Anthropic from '@anthropic-ai/sdk';

const envContent = fs.readFileSync('./.env', 'utf-8');
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.+)$/);
  if (m) process.env[m[1]] = m[2].trim();
}
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-4-6';
const DEST_FILE = './src/data/destinations.json';
const dests = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));
console.log(`📋 評価対象: ${dests.length}件`);

const SYSTEM = `あなたは日本の旅先データを精査する専門家です。
各destinationについて「独立した旅先として成立するか」を判定:

【削除候補 (facility) — どれか該当】
- 施設・建物単体の名前 (神社単体・城跡単体・展望台単体・公園施設)
- テーマパーク・水族館・動物園・牧場
- 近隣hub都市/エリア destinationのspotsとして十分
- 単体で「ここに旅行しよう」とは言えない規模

【残す (keep) — 判断迷ったらこちら】
- エリア・温泉地・島・峠などの広域目的地
- 観光地として独立したスケールを持つ
- 中尊寺・平等院・東大寺など全国区の単一施設は残す (世界遺産・重文級)
- 確信が持てない場合

出力: 純粋なJSONのみ`;

async function evalBatch(batch) {
  const userMsg = `各destinationを評価してください。

${batch.map((d, i) => `[${i+1}] id: ${d.id}
名前: ${d.name}
prefecture: ${d.prefecture}
tags: ${(d.tags||[]).slice(0,3).join('・')}
description: ${(d.description||'').slice(0,100)}`).join('\n\n')}

形式: [{"id":"...","verdict":"keep|facility","reason":"15字以内"},...]`;

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 5000,
    system: SYSTEM,
    messages: [{ role: 'user', content: userMsg }],
  });
  const text = res.content[0].text.trim();
  const m = text.match(/\[[\s\S]*\]/);
  if (!m) throw new Error('JSON not found');
  return JSON.parse(m[0]);
}

const BATCH = 10;
const verdicts = {};
for (let i = 0; i < dests.length; i += BATCH) {
  const batch = dests.slice(i, i + BATCH);
  try {
    const r = await evalBatch(batch);
    for (const x of r) verdicts[x.id] = x;
  } catch (e) {
    console.log(`  batch ${i}: ${e.message}`);
  }
  if ((i / BATCH + 1) % 10 === 0 || i + BATCH >= dests.length) {
    const c = { keep:0, facility:0 };
    for (const v of Object.values(verdicts)) c[v.verdict] = (c[v.verdict] || 0) + 1;
    console.log(`  [${Math.min(i+BATCH, dests.length)}/${dests.length}] keep=${c.keep} facility=${c.facility}`);
  }
  await new Promise(r => setTimeout(r, 1200));
}

const facilities = dests.filter(d => verdicts[d.id]?.verdict === 'facility');
fs.writeFileSync('/tmp/facility_only.json', JSON.stringify(facilities.map(d => ({
  id: d.id, name: d.name, pref: d.prefecture, reason: verdicts[d.id]?.reason
})), null, 2));

console.log(`\n=== 完了 ===`);
console.log(`  keep: ${dests.length - facilities.length}件`);
console.log(`  facility候補: ${facilities.length}件`);
console.log(`\n候補(先頭50件):`);
for (const d of facilities.slice(0, 50)) console.log(`  - ${d.id}: ${d.name} (${d.prefecture}) - ${verdicts[d.id]?.reason}`);
console.log(`\n→ /tmp/facility_only.json`);
