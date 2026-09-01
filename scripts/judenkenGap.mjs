#!/usr/bin/env node
/**
 * judenkenGap.mjs — 重伝建129地区のうち、既存destinationsに無いものを洗い出す。
 * 名前だけでなく、既存エントリのspot名・description本文まで見て取りこぼしを防ぐ。
 */
import fs from 'fs';
const rows = JSON.parse(fs.readFileSync('logs/judenken_rows.json', 'utf8'));
const all = JSON.parse(fs.readFileSync('src/data/destinations.json', 'utf8'));

const haystack = all.map((d) => ({
  id: d.id, name: d.name, pref: d.prefecture, lat: d.lat, lng: d.lng,
  text: [d.name, d.city, d.description, ...(d.spots || []).map((s) => (s && s.name) || ''),
    ...(d.spots || []).map((s) => (s && s.description) || '')].join(' '),
}));

const hit = [], miss = [];
for (const r of rows) {
  // 地区名（「元町末広町」等）と市町村名の両方で探す
  const keys = [r.name, r.name.replace(/地区$/, '')].filter((s) => s && s.length >= 2);
  const cityKey = r.city.replace(/[市区町村]$/, '');
  const byName = haystack.find((h) => keys.some((k) => h.name === k || h.name.includes(k)));
  const byText = haystack.find((h) => h.pref === r.prefecture && keys.some((k) => h.text.includes(k)));
  const byCity = haystack.find((h) => h.pref === r.prefecture && cityKey.length >= 2
    && (h.name === cityKey || h.name.includes(cityKey)));
  const m = byName || byText || byCity;
  if (m) hit.push({ ...r, via: byName ? '名前一致' : byText ? '本文に登場' : '同名の市町村', match: `${m.id}(${m.name})` });
  else miss.push(r);
}
console.log(`■ 既存でカバーされている ${hit.length}件`);
for (const h of hit) console.log(`  ○ ${h.prefecture.padEnd(5)} ${h.city.padEnd(8)} ${h.name.padEnd(14)} ${h.kind.padEnd(10)} ${h.via} → ${h.match}`);
console.log(`\n■ 未掲載 ${miss.length}件`);
for (const m of miss) console.log(`  ✗ ${m.prefecture.padEnd(5)} ${m.city.padEnd(8)} ${m.name.padEnd(16)} ${m.kind.padEnd(12)} ${m.areaHa}ha`);
fs.writeFileSync('logs/judenken_gap.json', JSON.stringify({ hit, miss }, null, 1));
