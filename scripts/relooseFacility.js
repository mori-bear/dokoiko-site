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
const cand = JSON.parse(fs.readFileSync('/tmp/facility_only.json', 'utf-8'));
const candIds = new Set(cand.map(c => c.id));
const items = dests.filter(d => candIds.has(d.id));
console.log(`📋 再評価: ${items.length}件`);

const SYSTEM = `日本の旅先評価。以下のいずれか1つでも該当すれば "keep"。それ以外を "delete"。

【keep (緩く判定・迷ったら keep)】
- 門前町・参道がある神社仏閣 (琴平・善光寺・伊勢神宮等)
- 世界的・全国的に知名度がある場所 (地獄谷野猿公苑・吉野ヶ里・松島等)
- 国営・県営の大型公園・遺跡 (吉野ヶ里・三内丸山等)
- 温泉地として複数の宿が集まる (草津・有馬・登別・湯布院等)
- 街歩き・散策できる町並み (城下町・宿場町・古い商店街)
- 漁村・港町
- 地域代表の景勝地 (青島・三保の松原等)
- 県庁所在地・交通拠点都市
- 周辺spotsを含む観光エリア
- 自然景観 (湖・滝・峡谷・島・岬で歩ける範囲)

【delete】
- gen_系の小規模神社単体 (参道・門前町なし、地域住民向け)
- gen_系の温泉一軒宿 (周辺に他の宿なし)
- 城跡のみ (石垣・土塁のみ残存、観光整備なし)
- 小規模な体験施設・牧場 (敷地一施設のみ)
- スケール小さい単一スポット

確信なければkeep。純粋なJSONのみ。`;

async function evalBatch(batch) {
  const userMsg = `各destinationを評価。

${batch.map((d, i) => `[${i+1}] id: ${d.id}
名前: ${d.name}
prefecture: ${d.prefecture}
tags: ${(d.tags||[]).slice(0,4).join('・')}
description: ${(d.description||'').slice(0,200)}`).join('\n\n')}

形式: [{"id":"...","verdict":"keep|delete","reason":"15字"},...]`;

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 4500,
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
for (let i = 0; i < items.length; i += BATCH) {
  const batch = items.slice(i, i + BATCH);
  try {
    const r = await evalBatch(batch);
    for (const x of r) verdicts[x.id] = x;
  } catch (e) {
    console.log(`  batch ${i}: ${e.message}`);
  }
  if ((i / BATCH + 1) % 5 === 0 || i + BATCH >= items.length) {
    const c = { keep:0, delete:0 };
    for (const v of Object.values(verdicts)) c[v.verdict] = (c[v.verdict] || 0) + 1;
    console.log(`  [${Math.min(i+BATCH, items.length)}/${items.length}] keep=${c.keep} delete=${c.delete}`);
  }
  await new Promise(r => setTimeout(r, 1500));
}

const stillDelete = items.filter(d => verdicts[d.id]?.verdict === 'delete');
fs.writeFileSync('/tmp/facility_final_delete.json', JSON.stringify(
  stillDelete.map(d => ({ id:d.id, name:d.name, pref:d.prefecture, reason:verdicts[d.id]?.reason })), null, 2));

console.log(`\n=== 完了 ===`);
console.log(`  救済(keep): ${items.length - stillDelete.length}件`);
console.log(`  削除候補: ${stillDelete.length}件`);

if (stillDelete.length <= 100) {
  console.log(`\n削除候補(${stillDelete.length}件) 100件以下なので全リスト出力:`);
  for (const d of stillDelete) console.log(`  - ${d.id}: ${d.name} (${d.prefecture}) - ${verdicts[d.id]?.reason}`);
} else {
  console.log(`\n削除候補が ${stillDelete.length}件 > 100 → 件数のみ報告 (絞り込み再要)`);
  // 内訳
  const prefCounter = {};
  for (const d of stillDelete) prefCounter[d.prefecture] = (prefCounter[d.prefecture] || 0) + 1;
  console.log('\n都道府県別:');
  for (const [p, c] of Object.entries(prefCounter).sort((a,b) => b[1]-a[1]).slice(0, 15)) {
    console.log(`  ${p}: ${c}件`);
  }
}
