#!/usr/bin/env node
import fs from 'fs';
const bad = JSON.parse(fs.readFileSync('/tmp/hotel_link_bad.json','utf-8'));
const dests = JSON.parse(fs.readFileSync('./src/data/destinations.json','utf-8'));
const ids = bad.slice(0, 10).map(b => b.id);
console.log('サンプル10件検証:');
for (const id of ids) {
  const d = dests.find(x => x.id === id);
  if (!d) continue;
  const url = d.hotelLinks.rakuten;
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0' } });
    console.log(`  ${res.status} ${d.id} (${d.name}) ${url.slice(0,100)}`);
  } catch (e) {
    console.log(`  ERR ${d.id}: ${e.message}`);
  }
}
