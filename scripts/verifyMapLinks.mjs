#!/usr/bin/env node
/**
 * verifyMapLinks.mjs — ビルド済みHTMLのGoogleマップリンクを検査する。
 *
 * 見るのは3点。
 *   ① 目的地を指すリンクが座標になっているか（テキストだと宿泊検索に化ける）
 *   ② 座標がdestinations.jsonの値と一致しているか
 *   ③ 旧形式 maps/search/<名前>+<県> や maps/dir/<city>/<name>/ が残っていないか
 */
import fs from 'fs';
import path from 'path';

const DIST = 'dist/destinations';
const all = JSON.parse(fs.readFileSync('src/data/destinations.json', 'utf8'));
const SAMPLE = ['yunotsuru-onsen', 'ubayu-onsen', 'kannojigoku', 'kuroyu', 'yumata',
  'kamikitayama', 'hakone', 'naoshima'];

let ng = 0;
console.log('■ 代表destinationの地図リンク\n');
for (const id of SAMPLE) {
  const f = path.join(DIST, id, 'index.html');
  if (!fs.existsSync(f)) { console.log(`  ⚠️  ${id}: ページなし`); continue; }
  const html = fs.readFileSync(f, 'utf8');
  const d = all.find((x) => x.id === id);
  const coord = `${d.lat},${d.lng}`;
  const enc = encodeURIComponent(coord);

  // Astroは属性中の & を &#38; に変換するので、エスケープ違いを吸収して見る
  const amp = '(?:&|&amp;|&#38;)';
  const place = new RegExp(`maps/search/\\?api=1${amp}query=${enc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(html);
  const dir = html.includes(`destination=${enc}`);
  const oldSearch = /maps\/search\/[^"?]*%[0-9A-F]{2}[^"]*\+/.test(html);
  const oldDir = /maps\/dir\/%[0-9A-F]/.test(html);
  const bad = !place || !dir || oldSearch || oldDir;
  if (bad) ng++;
  console.log(`  ${bad ? '❌' : '✅'} ${d.name.padEnd(12)} 座標=${coord}`);
  console.log(`       ピン=${place ? '座標' : '❌テキスト'}  経路destination=${dir ? '座標' : '❌テキスト'}  旧形式残存=${oldSearch || oldDir ? '❌あり' : 'なし'}`);
}

// 全ページ集計
let coordPin = 0, coordDir = 0, oldFmt = 0, total = 0;
for (const d of all) {
  const f = path.join(DIST, d.id, 'index.html');
  if (!fs.existsSync(f)) continue;
  total++;
  const html = fs.readFileSync(f, 'utf8');
  const enc = encodeURIComponent(`${d.lat},${d.lng}`);
  if (html.includes(`query=${enc}`)) coordPin++;
  if (html.includes(`destination=${enc}`)) coordDir++;
  if (/maps\/dir\/%[0-9A-F]/.test(html)) oldFmt++;
}
console.log(`\n■ 全ページ集計（${total}ページ）`);
console.log(`  ピンが座標         ${coordPin} / ${total}`);
console.log(`  経路destinationが座標 ${coordDir} / ${total}`);
console.log(`  旧 maps/dir/ 形式の残存 ${oldFmt}件`);
if (coordPin !== total || coordDir !== total || oldFmt) ng++;

console.log(ng ? `\nNG ${ng}件` : '\n✅ すべて座標ベース');
process.exit(ng ? 1 : 0);
