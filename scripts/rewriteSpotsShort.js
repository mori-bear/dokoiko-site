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

const targets = [];
for (const d of dests) {
  if (!d.spots) continue;
  for (let i = 0; i < d.spots.length; i++) {
    const s = d.spots[i];
    if ((s.description || '').length > 0 && s.description.length < 50) {
      targets.push({ destId: d.id, destName: d.name, prefecture: d.prefecture, spotIdx: i, spotName: s.name, current: s.description });
    }
  }
}
console.log(`📝 リライト対象: ${targets.length}件`);

const SYSTEM = `あなたは観光記事ライターです。各観光スポットの説明文を80〜120字でリライト。
- 固有名詞 (建物・地形・季節・歴史)
- 五感表現 (見える・聞こえる・香る・触れ・音・光・風など) 1つ以上
- 紋切り型禁止 (「楽しめます」「有名」「人気の」)
- 体言止め・短文活用
出力: 純粋なJSONのみ`;

async function batch(items) {
  const userMsg = `次の各スポットを80-120字でリライト。

${items.map((it, i) => `[${i+1}] spot: ${it.spotName} (${it.destName}/${it.prefecture})
現在: ${it.current}`).join('\n\n')}

形式: [{"i":1,"description":"..."},...]`;
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

const BATCH = 8;
let success = 0, fail = 0;
for (let i = 0; i < targets.length; i += BATCH) {
  const items = targets.slice(i, i + BATCH);
  try {
    const r = await batch(items);
    for (const x of r) {
      const idx = x.i - 1;
      const t = items[idx];
      if (!t || !x.description || x.description.length < 50) { fail++; continue; }
      const d = dests.find(y => y.id === t.destId);
      if (d?.spots?.[t.spotIdx]) {
        d.spots[t.spotIdx].description = x.description.slice(0, 200);
        success++;
      }
    }
  } catch (e) {
    fail += items.length;
    console.log(`  batch ${i}: ${e.message}`);
  }
  if ((i / BATCH + 1) % 5 === 0 || i + BATCH >= targets.length) {
    console.log(`  [${Math.min(i+BATCH, targets.length)}/${targets.length}] ✓${success} ✗${fail}`);
    fs.writeFileSync(DEST_FILE, JSON.stringify(dests, null, 2));
  }
  await new Promise(r => setTimeout(r, 1200));
}
fs.writeFileSync(DEST_FILE, JSON.stringify(dests, null, 2));
console.log(`\n=== 完了 === ✓${success} ✗${fail}`);
