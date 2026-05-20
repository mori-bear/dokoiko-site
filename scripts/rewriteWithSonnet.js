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

const SYSTEM = `あなたは日本の旅情を伝える熟練の観光ライターです。
各目的地の説明文を以下の厳格な4基準すべてを満たす形でリライトしてください。

【絶対要件・必ず4つすべて満たす】
1. 固有名詞（地名・施設名・季節・歴史人物など）を異なる5種類以上含める
2. 五感表現を必ず1つ以上含める: 見える、聞こえる、香る、匂い、香り、触れ、味、音、光、風、肌、湿った、冷たい、温かい、甘い、塩辛い、静寂、静か
3. 「できます」「です。」「ます。」の合計を3回以下に抑える（体言止め・「だ」「である」体も活用）
4. 200字以上280字以下

【禁止】
- 「楽しめます」「有名です」「人気の」など紋切り型
- マークダウン
- 抽象的すぎる「素晴らしい体験」など

出力: 純粋なJSON配列のみ`;

let targets = JSON.parse(fs.readFileSync('/tmp/under4_sonnet.json', 'utf-8'));
console.log(`📝 Sonnetリライト対象: ${targets.length}件`);

async function batchCall(items) {
  const userMsg = `以下の各目的地について、4基準すべてを満たす説明文(220-280字)を書いてください。

${items.map(({id}) => {
  const d = dests.find(x => x.id === id);
  return `- id: ${id}, 名前: ${d.name}（${d.prefecture}）, タグ: ${(d.tags||[]).slice(0,4).join('・')}, spots: ${(d.spots||[]).map(s=>s.name).slice(0,3).join('・')}`;
}).join('\n')}

形式: [{"id":"...","description":"..."},...]`;

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

const BATCH = 5;
const MAX_RETRY = 2;

async function processRound(roundN) {
  let success = 0, fail = 0, kept = 0;
  for (let i = 0; i < targets.length; i += BATCH) {
    const items = targets.slice(i, i + BATCH);
    try {
      const r = await batchCall(items);
      for (const x of r) {
        const d = dests.find(y => y.id === x.id);
        if (!d || !x.description) { fail++; continue; }
        const newSc = score(x.description);
        const oldSc = score(d.description || '');
        if (newSc >= 4) {
          d.description = x.description;
          success++;
        } else if (newSc > oldSc) {
          d.description = x.description;
          kept++;
        } else fail++;
      }
    } catch (e) {
      fail += items.length;
      console.log(`  Round${roundN} batch ${i}: ${e.message}`);
    }
    if ((i / BATCH + 1) % 3 === 0 || i + BATCH >= targets.length) {
      console.log(`  Round${roundN} [${Math.min(i+BATCH, targets.length)}/${targets.length}] ✓${success} 部分↑${kept} ✗${fail}`);
      fs.writeFileSync(DEST_FILE, JSON.stringify(dests, null, 2));
    }
    await new Promise(r => setTimeout(r, 1500));
  }
  return { success, kept, fail };
}

for (let r = 1; r <= MAX_RETRY; r++) {
  console.log(`\n=== Round ${r}: ${targets.length}件 ===`);
  await processRound(r);
  // 再判定
  targets = dests.filter(d => score(d.description || '') < 4).map(d => ({ id: d.id }));
  console.log(`Round${r}終了後 残り4点未満: ${targets.length}件`);
  if (targets.length === 0) break;
}

fs.writeFileSync(DEST_FILE, JSON.stringify(dests, null, 2));
const finalUnder = dests.filter(d => score(d.description || '') < 4).length;
console.log(`\n=== 完了 ===`);
console.log(`  最終 4点未満: ${finalUnder} / ${dests.length}`);
