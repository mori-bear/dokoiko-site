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
const targets = JSON.parse(fs.readFileSync('/tmp/niche_walk.json', 'utf-8'));
console.log(`📝 リライト: ${targets.length}件`);

const SYSTEM = `あなたは日本の街歩き旅を伝える熟練ライターです。
各destinationの説明文を220-280字でリライト:
- 「その街の空気感・路地の雰囲気・歩いた感覚」が伝わる
- 五感(光・音・匂い・足音・触感)を必ず1つ以上
- 固有名詞(地名・建物・季節・歴史)を5つ以上
- 紋切り型禁止(「楽しめます」「有名」「人気」)
- 体言止め・余韻のある締め
出力: 純粋なJSONのみ`;

async function batch(items) {
  const userMsg = `次の各街歩き目的地を220-280字でリライト。

${items.map(t => {
  const d = dests.find(x => x.id === t.id);
  return `- id:${t.id}, 名前:${t.name}（${t.pref}）, tags:${(t.tags||[]).join('・')}, 既存:${(d?.description||'').slice(0,80)}`;
}).join('\n')}

形式: [{"id":"...","description":"..."},...]`;
  const res = await client.messages.create({ model: MODEL, max_tokens: 5000, system: SYSTEM, messages: [{role:'user', content:userMsg}] });
  const t = res.content[0].text.trim();
  const m = t.match(/\[[\s\S]*\]/);
  if (!m) throw new Error('JSON not found');
  return JSON.parse(m[0]);
}

const BATCH = 5;
let success = 0, fail = 0;
for (let i = 0; i < targets.length; i += BATCH) {
  const items = targets.slice(i, i + BATCH);
  try {
    const r = await batch(items);
    for (const x of r) {
      const d = dests.find(y => y.id === x.id);
      if (d && x.description && x.description.length >= 200) {
        d.description = x.description.slice(0, 320);
        success++;
      } else fail++;
    }
  } catch (e) {
    fail += items.length;
    console.log(`  batch ${i}: ${e.message}`);
  }
  console.log(`  [${Math.min(i+BATCH, targets.length)}/${targets.length}] ✓${success} ✗${fail}`);
  fs.writeFileSync(DEST_FILE, JSON.stringify(dests, null, 2));
  await new Promise(r => setTimeout(r, 1500));
}
fs.writeFileSync(DEST_FILE, JSON.stringify(dests, null, 2));
console.log(`\n=== 完了 === ✓${success} ✗${fail}`);
