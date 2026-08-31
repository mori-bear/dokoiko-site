#!/usr/bin/env node
/** prefCoverage.mjs — 都道府県別のdestination件数と温泉(destType=onsen)件数を出す（手薄な県の特定用）。 */
import fs from 'fs';
const all = JSON.parse(fs.readFileSync('src/data/destinations.json', 'utf8'));
const PREFS = ['北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県','茨城県','栃木県','群馬県',
'埼玉県','千葉県','東京都','神奈川県','新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県',
'静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県','鳥取県','島根県',
'岡山県','広島県','山口県','徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県','熊本県',
'大分県','宮崎県','鹿児島県','沖縄県'];
const rows = PREFS.map((p) => {
  const list = all.filter((d) => (d.prefecture || '') === p);
  return { p, n: list.length, onsen: list.filter((d) => d.destType === 'onsen').length };
}).sort((a, b) => a.n - b.n);
console.log('■ 件数の少ない順');
for (const r of rows) console.log(`  ${r.p.padEnd(5)} ${String(r.n).padStart(3)}件 (温泉${r.onsen})`);
console.log(`\n合計 ${all.length}件 / 温泉 ${all.filter((d) => d.destType === 'onsen').length}件`);
