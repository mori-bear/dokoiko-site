/**
 * kyushuInventory.mjs
 * 九州7県の既存destinationを棚卸しする（調査のみ・データ変更なし）。
 * 九州ふっこう応援割 特設ページの構成検討と、新規候補の重複除外に使う。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', 'src', 'data', 'destinations.json');

const KYUSHU = ['福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県'];

const all = JSON.parse(fs.readFileSync(DATA, 'utf-8'));
const list = Array.isArray(all) ? all : all.destinations;
console.log(`総件数: ${list.length}`);
console.log(`キー: ${Object.keys(list[0]).join(', ')}\n`);

const byPref = new Map(KYUSHU.map((p) => [p, []]));
for (const d of list) {
  const pref = d.prefecture || d.pref || '';
  if (byPref.has(pref)) byPref.get(pref).push(d);
}

let total = 0;
let withStay = 0;
for (const pref of KYUSHU) {
  const rows = byPref.get(pref);
  total += rows.length;
  console.log(`--- ${pref} (${rows.length}件) ---`);
  for (const d of rows) {
    const stay = d.featured_stay ? ` [stay:${d.featured_stay.name || 'あり'}]` : '';
    if (d.featured_stay) withStay++;
    const lat = d.lat ?? d.latitude ?? '?';
    const lng = d.lng ?? d.longitude ?? '?';
    console.log(`  ${d.id.padEnd(28)} ${d.name}  (${lat},${lng})${stay}`);
  }
  console.log('');
}
console.log(`九州合計: ${total}件 / featured_stay付き: ${withStay}件`);
