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

const niches = dests.filter(d => d.id.startsWith('niche_'));
console.log(`📋 評価対象: ${niches.length}件`);

const SYSTEM = `あなたは日本の旅先の「観光地としての成立性」を評価する専門家です。

【削除基準】（どれか1つでも該当 → "delete"）
- 政令市・大都市のベッドタウン（独自の観光要素なし）
- 工業都市・港湾工業地帯
- 観光・自然・歴史・食文化・風景のどれも特筆点がない市街地

【残す基準】（どれか1つでも該当 → "keep"）
- 漁村・農村・里山（日本の原風景）
- 温泉地
- 古い港町・城下町・宿場町
- 独特の食文化・産業文化
- 自然景観（渓谷・岬・湿原など）
- 離島・半島の小集落

判断に迷ったら "keep" を優先。出力は純粋なJSONのみ。`;

async function evalBatch(items) {
  const userMsg = `次の各旅先について、削除基準/残す基準で評価してください。

${items.map((d, i) => `[${i+1}] id: ${d.id}
名前: ${d.name}（${d.prefecture}）
タグ: ${(d.tags||[]).slice(0,4).join('・')}
description: ${(d.description||'').slice(0,150)}`).join('\n\n')}

形式: [{"id":"...","verdict":"keep|delete","reason":"15字以内"},...]`;

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM,
    messages: [{ role: 'user', content: userMsg }],
  });
  const text = res.content[0].text.trim();
  const m = text.match(/\[[\s\S]*\]/);
  if (!m) throw new Error('JSON not found');
  return JSON.parse(m[0]);
}

const verdicts = {};
const BATCH = 8;
for (let i = 0; i < niches.length; i += BATCH) {
  const batch = niches.slice(i, i + BATCH);
  try {
    const r = await evalBatch(batch);
    for (const x of r) verdicts[x.id] = { verdict: x.verdict, reason: x.reason };
  } catch (e) {
    console.log(`  batch ${i}: ${e.message}`);
  }
  if ((i / BATCH + 1) % 5 === 0 || i + BATCH >= niches.length) {
    const kept = Object.values(verdicts).filter(v => v.verdict === 'keep').length;
    const del = Object.values(verdicts).filter(v => v.verdict === 'delete').length;
    console.log(`  [${Math.min(i+BATCH, niches.length)}/${niches.length}] keep=${kept} delete=${del}`);
  }
  await new Promise(r => setTimeout(r, 1500));
}

const kept = niches.filter(d => verdicts[d.id]?.verdict === 'keep');
const del = niches.filter(d => verdicts[d.id]?.verdict === 'delete');

fs.writeFileSync('/tmp/niche_verdicts.json', JSON.stringify({
  keep: kept.map(d => ({id:d.id,name:d.name})),
  delete: del.map(d => ({id:d.id,name:d.name,pref:d.prefecture,reason:verdicts[d.id]?.reason})),
}, null, 2));

console.log(`\n=== 評価完了 ===`);
console.log(`  残す: ${kept.length}件`);
console.log(`  削除候補: ${del.length}件`);
console.log(`\n削除候補(先頭30件):`);
for (const d of del.slice(0, 30)) {
  console.log(`  - ${d.id} (${d.name}, ${d.prefecture}) ${verdicts[d.id]?.reason || ''}`);
}
console.log(`\n→ /tmp/niche_verdicts.json`);
