#!/usr/bin/env node
/**
 * dumpSampleEntries.mjs — 新規destination作成の雛形にする既存エントリを丸ごと出す（調査のみ）。
 * 同県の hotelLinks・travelTime・featured_stay の書式をそのまま流用するため。
 */
import fs from 'fs';
const all = JSON.parse(fs.readFileSync('src/data/destinations.json', 'utf8'));
const ids = process.argv.slice(2);
if (!ids.length) { console.error('usage: node scripts/dumpSampleEntries.mjs <id> [<id>...]'); process.exit(1); }
for (const id of ids) {
  const d = all.find((x) => x.id === id);
  if (!d) { console.log(`--- ${id}: 見つからない ---`); continue; }
  console.log(`=== ${id} (${d.name} / ${d.prefecture}) ===`);
  console.log(JSON.stringify(d, null, 2));
  console.log('');
}
