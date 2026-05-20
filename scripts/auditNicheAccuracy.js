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
console.log(`📋 精査対象: ${niches.length}件`);

const SYSTEM = `あなたは日本の観光地データを精査する専門家です。
各destinationについて以下を厳密に評価してください:

1. 実在確認: 名前・説明が実在する場所と一致しているか
2. 都道府県の正確さ: prefectureが正しいか（跨県・他県との混同なし）
3. description精度: 説明文に固有名詞・地名・距離感の誤りがないか
4. 旅先成立性: 実際に行ける・存在する観光地か

判定:
- "ok": 全て問題なし
- "fix_pref": prefectureが間違い → correctedPrefectureを返す
- "fix_desc": descriptionに事実誤認 → correctedDescriptionを返す (220-280字)
- "delete": 実在しない/存在不明/明らかに観光地でない

判断に確信が持てない場合は "ok"。出力は純粋なJSONのみ。`;

async function evalBatch(items) {
  const userMsg = `次の各destinationを精査してください。

${items.map((d, i) => `[${i+1}] id: ${d.id}
名前: ${d.name}
prefecture: ${d.prefecture}
description: ${(d.description || '').slice(0,250)}`).join('\n\n')}

形式: [{"id":"...","verdict":"ok|fix_pref|fix_desc|delete","correctedPrefecture":"...","correctedDescription":"...","reason":"15字"},...]
verdictがok/deleteの場合correctedフィールドは省略可。`;

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
const verdicts = {};
for (let i = 0; i < niches.length; i += BATCH) {
  const batch = niches.slice(i, i + BATCH);
  try {
    const r = await evalBatch(batch);
    for (const x of r) verdicts[x.id] = x;
  } catch (e) {
    console.log(`  batch ${i}: ${e.message}`);
  }
  if ((i / BATCH + 1) % 5 === 0 || i + BATCH >= niches.length) {
    const cnt = { ok:0, fix_pref:0, fix_desc:0, delete:0 };
    for (const v of Object.values(verdicts)) cnt[v.verdict] = (cnt[v.verdict] || 0) + 1;
    console.log(`  [${Math.min(i+BATCH, niches.length)}/${niches.length}] ok=${cnt.ok} fix_pref=${cnt.fix_pref} fix_desc=${cnt.fix_desc} delete=${cnt.delete}`);
  }
  await new Promise(r => setTimeout(r, 1500));
}

// 修正実行
let prefFixed = 0, descFixed = 0, deleted = 0;
const toDelete = new Set();
for (const d of niches) {
  const v = verdicts[d.id];
  if (!v) continue;
  if (v.verdict === 'fix_pref' && v.correctedPrefecture) {
    d.prefecture = v.correctedPrefecture;
    prefFixed++;
  } else if (v.verdict === 'fix_desc' && v.correctedDescription) {
    d.description = v.correctedDescription;
    descFixed++;
  } else if (v.verdict === 'delete') {
    toDelete.add(d.id);
    deleted++;
  }
}

import('fs').then(fsMod => {
  const remaining = dests.filter(x => !toDelete.has(x.id));
  fsMod.writeFileSync(DEST_FILE, JSON.stringify(remaining, null, 2));
});
const remaining = dests.filter(x => !toDelete.has(x.id));
fs.writeFileSync(DEST_FILE, JSON.stringify(remaining, null, 2));

// 画像フォルダ削除
import('path').then(pathMod => {
  for (const id of toDelete) {
    const folder = `public/images/${id}`;
    if (fs.existsSync(folder)) fs.rmSync(folder, { recursive: true, force: true });
  }
});

console.log(`\n=== 精査完了 ===`);
console.log(`  prefecture修正: ${prefFixed}件`);
console.log(`  description修正: ${descFixed}件`);
console.log(`  削除: ${deleted}件`);
console.log(`  destinations: ${dests.length} → ${remaining.length}`);

// 詳細出力
const issues = Object.entries(verdicts).filter(([_,v]) => v.verdict !== 'ok');
fs.writeFileSync('/tmp/niche_audit.json', JSON.stringify(issues, null, 2));
console.log(`\n問題件数: ${issues.length}件`);
console.log(`削除候補(${[...toDelete].length}件):`);
for (const id of [...toDelete].slice(0, 30)) {
  console.log(`  - ${id}: ${verdicts[id]?.reason || ''}`);
}
console.log(`\nprefecture修正(先頭10件):`);
for (const [id, v] of issues.filter(([_,v]) => v.verdict === 'fix_pref').slice(0, 10)) {
  const orig = niches.find(x => x.id === id);
  console.log(`  - ${id}: ${orig?.prefecture} → ${v.correctedPrefecture} (${v.reason})`);
}
