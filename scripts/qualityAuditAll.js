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

console.log(`📋 監査対象: ${dests.length}件`);

const SYSTEM = `あなたは日本の観光地データを精査する専門家です。
各destinationを4観点で評価:

1. **名前**: 長すぎる/わかりにくい/「・」「（」残存 → "fix_name"
2. **旅先成立性**: ベッドタウン・工業地帯・実在疑問・スケール小すぎ → "delete"
3. **prefecture妥当性**: 場所と県が不一致 → "fix_pref"
4. **問題なし** → "ok"

判定に迷ったら "ok"。複数該当時は最も重要なものを優先 (delete > fix_pref > fix_name > ok)。
出力: 純粋なJSONのみ。`;

async function evalBatch(items) {
  const userMsg = `次の各destinationを精査してください。

${items.map((d, i) => `[${i+1}] id: ${d.id}
名前: ${d.name}
prefecture: ${d.prefecture}`).join('\n\n')}

形式: [{"id":"...","verdict":"ok|fix_name|fix_pref|delete","newName":"...","newPref":"...","reason":"15字"},...]`;

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

const BATCH = 10;
const verdicts = {};
for (let i = 0; i < dests.length; i += BATCH) {
  const batch = dests.slice(i, i + BATCH);
  try {
    const r = await evalBatch(batch);
    for (const x of r) verdicts[x.id] = x;
  } catch (e) {
    console.log(`  batch ${i}: ${e.message}`);
  }
  if ((i / BATCH + 1) % 10 === 0 || i + BATCH >= dests.length) {
    const c = { ok:0, fix_name:0, fix_pref:0, delete:0 };
    for (const v of Object.values(verdicts)) c[v.verdict] = (c[v.verdict] || 0) + 1;
    console.log(`  [${Math.min(i+BATCH, dests.length)}/${dests.length}] ok=${c.ok} fix_name=${c.fix_name} fix_pref=${c.fix_pref} delete=${c.delete}`);
  }
  await new Promise(r => setTimeout(r, 1200));
}

// 修正適用
let nameFixed = 0, prefFixed = 0;
const toDelete = [];
for (const d of dests) {
  const v = verdicts[d.id];
  if (!v) continue;
  if (v.verdict === 'fix_name' && v.newName && v.newName.length <= 15 && v.newName !== d.name) {
    d.name = v.newName;
    nameFixed++;
  } else if (v.verdict === 'fix_pref' && v.newPref && v.newPref !== d.prefecture) {
    d.prefecture = v.newPref;
    prefFixed++;
  } else if (v.verdict === 'delete') {
    toDelete.push({ id: d.id, name: d.name, pref: d.prefecture, reason: v.reason });
  }
}

fs.writeFileSync(DEST_FILE, JSON.stringify(dests, null, 2));
fs.writeFileSync('/tmp/audit_delete_candidates.json', JSON.stringify(toDelete, null, 2));

console.log(`\n=== 監査完了 ===`);
console.log(`  name修正: ${nameFixed}件`);
console.log(`  prefecture修正: ${prefFixed}件`);
console.log(`  削除候補: ${toDelete.length}件 (報告のみ・未削除)`);
console.log(`\n削除候補(先頭30件):`);
for (const x of toDelete.slice(0, 30)) {
  console.log(`  - ${x.id}: ${x.name} (${x.pref}) - ${x.reason}`);
}
