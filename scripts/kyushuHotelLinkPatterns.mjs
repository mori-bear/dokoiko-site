#!/usr/bin/env node
/**
 * kyushuHotelLinkPatterns.mjs — 九州7県の既存エントリが使っている hotelLinks / hotelArea /
 * jalanPath の実パターンを集計する（調査のみ）。
 * 新規エントリのアフィリIDや県コードを自作しないため、必ずここからコピーする。
 */
import fs from 'fs';
const KYUSHU = ['福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県'];
const all = JSON.parse(fs.readFileSync('src/data/destinations.json', 'utf8'));

for (const pref of KYUSHU) {
  const rows = all.filter((d) => d.prefecture === pref);
  const rk = new Map(), jl = new Map(), area = new Map();
  for (const d of rows) {
    const r = d.hotelLinks?.rakuten, j = d.hotelLinks?.jalan;
    if (r) rk.set(r, (rk.get(r) || 0) + 1);
    if (j) jl.set(j, (jl.get(j) || 0) + 1);
    if (d.hotelArea) area.set(d.hotelArea, (area.get(d.hotelArea) || 0) + 1);
  }
  const top = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([k, v]) => `${k} (${v}件)`).join('\n      ');
  console.log(`--- ${pref} (${rows.length}件) ---`);
  console.log(`  rakuten: ${top(rk) || 'なし'}`);
  console.log(`  jalan  : ${top(jl) || 'なし'}`);
  console.log(`  area   : ${[...area.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}(${v})`).join(', ') || 'なし'}`);
  console.log('');
}
