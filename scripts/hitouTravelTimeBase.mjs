#!/usr/bin/env node
/**
 * hitouTravelTimeBase.mjs — 秘湯14件の travelTime の土台にする最寄り既存エントリを出す。
 * travelTime は捏造せず、近い既存エントリの値をそのまま使う（山中の秘湯は
 * 最寄り観光地からの所要差が小さいため、平行移動の必要も薄い）。
 */
import fs from 'fs';
const kmBetween = (a, b, c, d) => Math.hypot((a - c) * 111, (b - d) * 111 * Math.cos((a * Math.PI) / 180));
const all = JSON.parse(fs.readFileSync('src/data/destinations.json', 'utf8'));
const adopted = new Set(JSON.parse(fs.readFileSync('logs/hitou_images.json', 'utf8')).adopted.map((a) => a.id));
const targets = JSON.parse(fs.readFileSync('logs/hitou_targets.json', 'utf8')).filter((t) => adopted.has(t.id));

for (const t of targets) {
  const near = all
    .filter((d) => typeof d.lat === 'number' && d.travelTime && Object.keys(d.travelTime).length >= 5)
    .map((d) => ({ id: d.id, name: d.name, pref: d.prefecture, km: kmBetween(t.lat, t.lng, d.lat, d.lng), n: Object.keys(d.travelTime).length }))
    .sort((a, b) => a.km - b.km).slice(0, 3);
  console.log(`■ ${t.name} (${t.id}) ${t.prefecture}${t.city}`);
  for (const c of near) console.log(`   ${c.km.toFixed(1).padStart(6)}km  ${c.id.padEnd(22)} ${c.name.padEnd(14)} ${c.pref} tt=${c.n}都市`);
}
console.log(`\n対象 ${targets.length}件`);
