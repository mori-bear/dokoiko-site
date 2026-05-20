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

const SYSTEM = `あなたは日本の旅情を伝える熟練観光ライター。
4基準すべてを必ず満たす説明文を書く:
1. 固有名詞(地名/施設名/季節/歴史人物)を異なる5種類以上
2. 五感表現を1つ以上 (見える/聞こえる/香る/匂い/香り/触れ/味/音/光/風/肌/湿った/冷たい/温かい/甘い/塩辛い/静寂/静か のいずれか)
3. 「できます」「です。」「ます。」の合計3回以下 (体言止め・「だ」「である」体を活用)
4. 必ず220字以上280字以下

紋切り型・「楽しめます」「有名です」「人気の」禁止。
出力: 純粋なJSON配列のみ。`;

const targets = JSON.parse(fs.readFileSync('/tmp/last10.json', 'utf-8'));
console.log(`📝 残り: ${targets.length}件`);

async function rewriteOne(item, attempt) {
  const d = dests.find(x => x.id === item.id);
  const userMsg = `次の目的地について、4基準を全て満たす220-280字の説明文を書いてください。
${attempt > 1 ? `（前回${attempt-1}回目で4基準を満たせませんでした。今度は必ず4基準すべて満たすこと）\n` : ''}
- id: ${d.id}
- 名前: ${d.name}（${d.prefecture}）
- 既存description: ${(d.description || '').slice(0,200)}
- タグ: ${(d.tags||[]).slice(0,4).join('・')}
- spots: ${(d.spots||[]).map(s=>s.name).slice(0,3).join('・')}

形式: [{"id":"${d.id}","description":"..."}]`;

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: SYSTEM,
    messages: [{ role: 'user', content: userMsg }],
  });
  const text = res.content[0].text.trim();
  const m = text.match(/\[[\s\S]*\]/);
  if (!m) throw new Error('JSON not found');
  return JSON.parse(m[0])[0]?.description;
}

const MAX_RETRY = 3;
let success = 0;
const reports = [];

for (const item of targets) {
  const d = dests.find(x => x.id === item.id);
  const oldDesc = d.description || '';
  let best = oldDesc;
  let bestScore = score(oldDesc);
  let achieved = false;
  for (let r = 1; r <= MAX_RETRY; r++) {
    try {
      const newDesc = await rewriteOne(item, r);
      const ns = score(newDesc);
      if (ns >= 4) {
        d.description = newDesc;
        success++;
        achieved = true;
        reports.push(`✓ ${item.id} (attempt${r})`);
        break;
      }
      if (ns > bestScore) {
        best = newDesc;
        bestScore = ns;
      }
    } catch (e) {
      reports.push(`✗ ${item.id} attempt${r}: ${e.message.slice(0,60)}`);
    }
    await new Promise(r => setTimeout(r, 1500));
  }
  if (!achieved) {
    // ベストスコア > 元なら採用、そうでなければ現状維持
    if (bestScore > score(oldDesc)) {
      d.description = best;
      reports.push(`◐ ${item.id} 部分改善 score=${bestScore}`);
    } else {
      reports.push(`= ${item.id} 4点不達・現状維持 score=${bestScore}`);
    }
  }
  fs.writeFileSync(DEST_FILE, JSON.stringify(dests, null, 2));
}

console.log(`\n=== 完了 === 4点達成 ${success}/${targets.length}`);
for (const r of reports) console.log('  ' + r);

const finalUnder = dests.filter(d => score(d.description || '') < 4).length;
console.log(`\n最終 4点未満: ${finalUnder} / ${dests.length}件`);
