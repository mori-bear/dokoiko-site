#!/usr/bin/env node
/**
 * verifyTransitButton.mjs — ビルド済みHTMLを実際に読んで、
 * Yahoo!乗換案内ボタン（booking-btn-navitime）が出ているかを数える。
 *
 * 判定ロジックを再実装して確かめると同じ間違いを二度書くだけなので、
 * dist の出来上がったHTMLを直接見る（症状で確かめる）。
 */
import fs from 'fs';
import path from 'path';

const DIST = 'dist/destinations';
const all = JSON.parse(fs.readFileSync('src/data/destinations.json', 'utf8'));
const NEW35 = ['kannojigoku', 'yunohira-onsen', 'hagenoyu-onsen', 'yunotsuru-onsen', 'tsuetate-onsen',
  'funagoya-onsen', 'kumanokawa-onsen', 'furuyu-onsen', 'hinokage-onsen',
  'namari-onsen', 'geto-onsen', 'matsukawa-iwate', 'gaga-onsen', 'kuroyu', 'doroyu',
  'tokusa', 'kaikake', 'nakabusa', 'kuronagi', 'nigorigo', 'nishiyama-yama', 'umegashima',
  'horoka', 'osawa-onsen', 'yubama', 'kanigasaki', 'utto', 'seorasou', 'yunohana-fk',
  'tsubame-onsen', 'yumata', 'kamikitayama', 'iwai-tottori', 'misasa2', 'yuki-hiroshima'];

const hasBtn = (id) => {
  const f = path.join(DIST, id, 'index.html');
  if (!fs.existsSync(f)) return null;
  return fs.readFileSync(f, 'utf8').includes('booking-btn-navitime');
};

let shown = 0, missing = 0, total = 0;
for (const d of all) {
  const r = hasBtn(d.id);
  if (r === null) continue;
  total++;
  if (r) shown++; else missing++;
}
console.log(`■ サイト全体（distの実HTML）`);
console.log(`  乗換案内ボタンあり ${shown} / ${total} (${(shown / total * 100).toFixed(1)}%)`);
console.log(`  なし               ${missing}件\n`);

console.log('■ 今回追加した35件');
let ng = 0;
for (const id of NEW35) {
  const r = hasBtn(id);
  const d = all.find((x) => x.id === id);
  if (r !== true) { ng++; console.log(`  ❌ ${d?.name ?? id} — ボタンなし`); }
}
console.log(ng ? `\n  NG ${ng}件` : `  ✅ 35件すべてでボタンを確認`);

// みどりの窓口が主だった3件を名指しで確認
console.log('\n■ みどりの窓口が主だった目的地');
for (const id of ['horoka', 'nigorigo', 'umegashima']) {
  const d = all.find((x) => x.id === id);
  const f = path.join(DIST, id, 'index.html');
  const html = fs.readFileSync(f, 'utf8');
  const btn = html.includes('booking-btn-navitime');
  const midori = html.includes('みどりの窓口での購入をおすすめします');
  const yahoo = (html.match(/transit\.yahoo\.co\.jp/g) || []).length;
  console.log(`  ${btn ? '✅' : '❌'} ${d.name.padEnd(10)} 乗換ボタン=${btn ? 'あり' : 'なし'} みどり案内=${midori ? 'あり' : 'なし'} Yahoo乗換リンク数=${yahoo}`);
}
process.exit(ng ? 1 : 0);
