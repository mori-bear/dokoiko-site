#!/usr/bin/env node
import fs from 'fs';
import Anthropic from '@anthropic-ai/sdk';

const envContent = fs.readFileSync('./.env', 'utf-8');
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.+)$/);
  if (m) process.env[m[1]] = m[2].trim();
}
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const DEST_FILE = './src/data/destinations.json';
const dests = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));
const low = JSON.parse(fs.readFileSync('/tmp/low_quality_desc.json', 'utf-8'));
console.log(`低品質description リライト: ${low.length}件`);

const SYSTEM = `日本の旅情ライター。各目的地の説明文を220-280字で、
- 五感の描写（見える/聞こえる/香る/触れる/音/光/風）
- 固有名詞（地名/施設名/季節/歴史人物）を3つ以上
- 「できます」「です」連続禁止
- 紋切り型禁止
出力: JSONのみ`;

async function batch(items) {
  const userMsg = `次の各目的地を220-280字でリライトしてください。

${items.map(it => {
  const d = dests.find(x => x.id === it.id);
  return `- id: ${it.id}, 名前: ${d.name}（${d.prefecture}）, タグ: ${(d.tags||[]).slice(0,4).join('・')}, spots: ${(d.spots||[]).map(s=>s.name).slice(0,3).join('・')}`;
}).join('\n')}

形式: [{"id":"...","description":"..."},...]`;
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

let success = 0, fail = 0;
const BATCH = 5;
for (let i = 0; i < low.length; i += BATCH) {
  const items = low.slice(i, i + BATCH);
  try {
    const r = await batch(items);
    for (const x of r) {
      const d = dests.find(y => y.id === x.id);
      if (d && x.description && x.description.length >= 200) {
        d.description = x.description;
        success++;
      } else fail++;
    }
  } catch (e) {
    fail += items.length;
    console.log(`  batch ${i}: ${e.message}`);
  }
  if ((i / BATCH + 1) % 3 === 0 || i + BATCH >= low.length) {
    console.log(`  [${Math.min(i+BATCH, low.length)}/${low.length}] ✓${success} ✗${fail}`);
    fs.writeFileSync(DEST_FILE, JSON.stringify(dests, null, 2));
  }
  await new Promise(r => setTimeout(r, 1500));
}
fs.writeFileSync(DEST_FILE, JSON.stringify(dests, null, 2));
console.log(`\n=== 完了 === ✓${success} ✗${fail}`);
