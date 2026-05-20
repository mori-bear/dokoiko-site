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

const targets = dests.filter(x => '・' in [...x.name] || '（' in [...x.name] || x.name.length > 12);
// 正しいフィルタ
const cand = dests.filter(x => x.name.includes('・') || x.name.includes('（') || x.name.length > 12);
console.log(`📝 候補: ${cand.length}件`);

const SYSTEM = `あなたは日本の地名・観光地名の表記を整理する専門家です。

【リネームのルール】
- 「・」区切りの複合名は最も特徴的な部分のみ残す (例: 「川根本町・奥大井湖上駅とアプト式鉄道」→「奥大井湖上駅」)
- カッコ書きは削除 (例: 「三崎（佐田岬）」→「佐田岬」)
- 10字以内が理想、最大15字
- 実在地名として検索できる名前にする
- 固有名詞 (神社名・温泉名・城名・駅名・地名) はそのまま
- 「佐野プレミアム・アウトレット」「香住・松葉ガニ」のような確立された固有名詞は変更不要
- prefecture・category などは省く

【判定】
- "keep": 現状維持 (既に十分シンプル / 固有名詞として確立)
- "rename": 新名前を提示

出力は純粋なJSONのみ。`;

async function batchCall(items) {
  const userMsg = `次の各destination名を判定してください。

${items.map((d, i) => `[${i+1}] id: ${d.id}
現在名: ${d.name}
prefecture: ${d.prefecture}`).join('\n\n')}

形式: [{"id":"...","verdict":"keep|rename","newName":"...","reason":"15字以内"},...]
verdictがkeepの場合newNameは省略可。`;

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
const updates = [];
let renamed = 0, kept = 0;
for (let i = 0; i < cand.length; i += BATCH) {
  const batch = cand.slice(i, i + BATCH);
  try {
    const r = await batchCall(batch);
    for (const x of r) {
      const d = dests.find(y => y.id === x.id);
      if (!d) continue;
      if (x.verdict === 'rename' && x.newName && x.newName !== d.name && x.newName.length <= 15) {
        updates.push({ id: d.id, before: d.name, after: x.newName, reason: x.reason });
        d.name = x.newName;
        renamed++;
      } else {
        kept++;
      }
    }
  } catch (e) {
    console.log(`  batch ${i}: ${e.message}`);
  }
  if ((i / BATCH + 1) % 5 === 0 || i + BATCH >= cand.length) {
    console.log(`  [${Math.min(i+BATCH, cand.length)}/${cand.length}] rename=${renamed} keep=${kept}`);
    fs.writeFileSync(DEST_FILE, JSON.stringify(dests, null, 2));
  }
  await new Promise(r => setTimeout(r, 1500));
}
fs.writeFileSync(DEST_FILE, JSON.stringify(dests, null, 2));
console.log(`\n=== 完了 === rename=${renamed} keep=${kept}`);
console.log(`\nリネーム例 (先頭15件):`);
for (const u of updates.slice(0, 15)) console.log(`  ${u.id}: 「${u.before}」→「${u.after}」 (${u.reason})`);
