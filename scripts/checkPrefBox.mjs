#!/usr/bin/env node
/**
 * checkPrefBox.mjs — 候補の座標が、宣言した都道府県の範囲に入っているかを見る。
 *
 * 座標検証は「独立2ソースが5km以内で一致」を条件にしているが、
 * 同名の地物が別の県にあると、両ソースがそろって別県を指すことがある。
 * （実例: 長崎県五島の大瀬崎を狙ったのに、静岡県沼津の大瀬崎が返ってきた）
 * 逆ジオコーディングで実際の所在県を引いて突き合わせる。
 */
import fs from 'fs';
const UA = { 'User-Agent': 'DokoIko-DataAudit/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const targets = JSON.parse(fs.readFileSync(process.argv[2] || 'logs/gap_targets.json', 'utf8'));

let ng = 0;
for (const t of targets) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${t.lat}&lon=${t.lng}&format=json&zoom=10&addressdetails=1&accept-language=ja`;
  let actual = '取得できず';
  try {
    const j = await (await fetch(url, { headers: UA })).json();
    const a = j.address || {};
    actual = a.province || a.state || a.county || '不明';
  } catch { /* そのまま */ }
  await sleep(1200);
  const ok = actual === t.prefecture;
  if (!ok) ng++;
  console.log(`${ok ? 'OK  ' : '❌  '} ${t.id.padEnd(16)} ${t.name.padEnd(12)} 宣言=${t.prefecture.padEnd(5)} 実際=${actual}  (${t.lat}, ${t.lng})`);
}
console.log(ng ? `\nNG ${ng}件（宣言した県と実際の所在が違う）` : `\n✅ ${targets.length}件すべて県が一致`);
process.exit(ng ? 1 : 0);
