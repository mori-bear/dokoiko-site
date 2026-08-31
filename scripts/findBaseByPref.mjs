#!/usr/bin/env node
/** findBaseByPref.mjs — 指定県で travelTime が充実した既存エントリを探す（土台選定用）。 */
import fs from 'fs';
const all = JSON.parse(fs.readFileSync('src/data/destinations.json', 'utf8'));
for (const pref of process.argv.slice(2)) {
  const rows = all.filter((d) => (d.prefecture || '').includes(pref) && d.travelTime)
    .map((d) => ({ id: d.id, name: d.name, n: Object.keys(d.travelTime).length, city: d.city }))
    .sort((a, b) => b.n - a.n).slice(0, 8);
  console.log(`■ ${pref}`);
  for (const r of rows) console.log(`   ${r.id.padEnd(22)} ${String(r.name).padEnd(14)} ${String(r.city ?? '').padEnd(10)} tt=${r.n}`);
}
