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

function score(desc) {
  if (!desc) return 0;
  let s = 0;
  const proper = new Set([...desc.matchAll(/[一-龥]{2,}/g)].map(m=>m[0]));
  if (proper.size >= 5) s++;
  if (/見える|聞こえる|香る|匂い|香り|触れ|聞く|味|音|光|風|肌|湿った|冷たい|温かい|甘い|塩辛い|静寂|静か/.test(desc)) s++;
  if ((desc.match(/できます|です。|ます。/g) || []).length <= 3) s++;
  if (desc.length >= 200) s++;
  return s;
}

const targets = JSON.parse(fs.readFileSync('/tmp/under4_desc.json', 'utf-8'));
console.log(`📝 4点未満: ${targets.length}件`);

const SYSTEM = `日本の旅情ライター。各目的地の説明文を220-280字でリライト。
必須:
- 地名・施設名など固有名詞を5つ以上
- 五感表現を1つ以上 (見える/聞こえる/香る/触れる/音/光/風/温かい/冷たい/静寂など)
- 「できます」「です。」「ます。」連続を3回以下に
- 200字以上、280字以下
- 紋切り型・「楽しめます」「有名です」禁止
出力: JSONのみ`;

async function batchCall(items) {
  const userMsg = `次の各目的地を220-280字でリライト。

${items.map(({id}) => {
  const d = dests.find(x => x.id === id);
  return `- id: ${id}, 名前: ${d.name}（${d.prefecture}）, タグ: ${(d.tags||[]).slice(0,4).join('・')}, spots: ${(d.spots||[]).map(s=>s.name).slice(0,3).join('・')}`;
}).join('\n')}

形式: [{"id":"...","description":"..."},...]`;
  const res = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 5000,
    system: SYSTEM,
    messages: [{ role: 'user', content: userMsg }],
  });
  const text = res.content[0].text.trim();
  const m = text.match(/\[[\s\S]*\]/);
  if (!m) throw new Error('JSON not found');
  return JSON.parse(m[0]);
}

let success = 0, fail = 0, kept = 0;
const BATCH = 5;
for (let i = 0; i < targets.length; i += BATCH) {
  const batch = targets.slice(i, i + BATCH);
  try {
    const r = await batchCall(batch);
    for (const x of r) {
      const d = dests.find(y => y.id === x.id);
      if (!d || !x.description) { fail++; continue; }
      const newScore = score(x.description);
      const oldScore = score(d.description || '');
      if (newScore >= 4) {
        d.description = x.description;
        success++;
      } else if (newScore > oldScore) {
        d.description = x.description;
        kept++;
      } else fail++;
    }
  } catch (e) {
    fail += batch.length;
    console.log(`  batch ${i}: ${e.message}`);
  }
  if ((i / BATCH + 1) % 5 === 0 || i + BATCH >= targets.length) {
    console.log(`  [${Math.min(i+BATCH, targets.length)}/${targets.length}] ✓${success} 部分↑${kept} ✗${fail}`);
    fs.writeFileSync(DEST_FILE, JSON.stringify(dests, null, 2));
  }
  await new Promise(r => setTimeout(r, 1500));
}
fs.writeFileSync(DEST_FILE, JSON.stringify(dests, null, 2));

let remaining4 = 0;
for (const d of dests) if (score(d.description||'') < 4) remaining4++;
console.log(`\n=== 完了 === ✓${success} 部分↑${kept} ✗${fail}`);
console.log(`残り4点未満: ${remaining4}件 / 全${dests.length}件`);
