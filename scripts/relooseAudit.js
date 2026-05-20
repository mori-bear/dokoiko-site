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
const candidates = JSON.parse(fs.readFileSync('/tmp/audit_delete_candidates.json', 'utf-8'));
const candIds = new Set(candidates.map(c => c.id));

const items = dests.filter(d => candIds.has(d.id));
console.log(`📋 再評価対象: ${items.length}件`);

const SYSTEM = `あなたは日本の旅先評価の専門家です。
以下の「残す基準」のいずれか1つでも該当すれば必ず "keep" を返してください:

【残す基準（厳格適用）】
- 温泉地・温泉郷
- 祭り・文化行事で全国区の知名度 (例: 岸和田だんじり)
- 独自の食文化・グルメ (例: 佐野ラーメン)
- 城・神社・寺・歴史的建造物
- 自然景観 (海・山・湖・渓谷・滝)
- 離島・半島
- 地域固有の産業文化 (芭蕉布・焼き物・漁業等)
- 空港・新幹線駅があり交通拠点
- 全国区の観光施設 (水族館・テーマパーク・大型施設)

【削除するもの (delete)】
- 観光要素が本当に何もないベッドタウン
- 工業地帯のみで観光要素ゼロ
- 実在が確認できない

判定に少しでも迷ったら "keep"。確実に観光要素なしの場合のみ "delete"。
純粋なJSONのみ出力。`;

async function evalBatch(batch) {
  const userMsg = `次のdestinationを再評価。

${batch.map((d, i) => `[${i+1}] id: ${d.id}
名前: ${d.name}
prefecture: ${d.prefecture}
tags: ${(d.tags || []).slice(0,4).join('・')}
description: ${(d.description || '').slice(0,180)}`).join('\n\n')}

形式: [{"id":"...","verdict":"keep|delete","reason":"15字"},...]`;

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
  if ((i / BATCH + 1) % 3 === 0 || i + BATCH >= items.length) {
    const c = { keep:0, delete:0 };
    for (const v of Object.values(verdicts)) c[v.verdict] = (c[v.verdict] || 0) + 1;
    console.log(`  [${Math.min(i+BATCH, items.length)}/${items.length}] keep=${c.keep} delete=${c.delete}`);
  }
  await new Promise(r => setTimeout(r, 1500));
}

const stillDelete = items.filter(d => verdicts[d.id]?.verdict === 'delete');
const saved = items.filter(d => verdicts[d.id]?.verdict === 'keep');

fs.writeFileSync('/tmp/looser_delete.json', JSON.stringify(stillDelete.map(d => ({ id:d.id, name:d.name, pref:d.prefecture, reason:verdicts[d.id]?.reason })), null, 2));

console.log(`\n=== 再評価完了 ===`);
console.log(`  残す(救済): ${saved.length}件`);
console.log(`  削除候補: ${stillDelete.length}件`);

if (stillDelete.length <= 50) {
  console.log(`\n削除候補 ${stillDelete.length}件 (50件以下なので自動削除実行可能):`);
  for (const d of stillDelete) console.log(`  - ${d.id}: ${d.name} (${d.prefecture}) - ${verdicts[d.id]?.reason}`);
} else {
  console.log(`\n削除候補が ${stillDelete.length}件 > 50件 → 再確認必要`);
  for (const d of stillDelete.slice(0, 50)) console.log(`  - ${d.id}: ${d.name} (${d.prefecture}) - ${verdicts[d.id]?.reason}`);
}
