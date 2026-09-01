#!/usr/bin/env node
/** hitouTravelTimeBase3.mjs — 第3バッチ16件の travelTime/icCard の土台にする最寄り既存エントリを出す。 */
import fs from 'fs';
const kmBetween = (a, b, c, d) => Math.hypot((a - c) * 111, (b - d) * 111 * Math.cos((a * Math.PI) / 180));
const all = JSON.parse(fs.readFileSync('src/data/destinations.json', 'utf8'));
const IDS = ['yunoyama', 'yumura-hyogo', 'shioda', 'sumoto-onsen', 'arifuku', 'izumoyumura',
  'shikano', 'togo', 'yoshioka', 'nagatoyumoto', 'tawarayama', 'yuno-yamaguchi',
  'miyahama', 'nibukawa', 'yunoura', 'chugu'];
const targets = JSON.parse(fs.readFileSync('logs/hitou_targets3.json', 'utf8')).filter((t) => IDS.includes(t.id));
for (const t of targets) {
  const near = all
    .filter((d) => typeof d.lat === 'number' && d.travelTime && Object.keys(d.travelTime).length >= 5)
    .map((d) => ({ id: d.id, name: d.name, km: kmBetween(t.lat, t.lng, d.lat, d.lng), n: Object.keys(d.travelTime).length, ic: d.icCard }))
    .sort((a, b) => a.km - b.km).slice(0, 2);
  console.log(`■ ${t.name} (${t.id}) ${t.prefecture}${t.city}`);
  for (const c of near) console.log(`   ${c.km.toFixed(1).padStart(6)}km ${c.id.padEnd(22)} ${String(c.name).padEnd(13)} tt=${c.n} ic=${c.ic}`);
}
console.log(`\n対象 ${targets.length}件`);
