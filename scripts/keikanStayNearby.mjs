#!/usr/bin/env node
/**
 * keikanStayNearby.mjs — 絶景候補の近くにある「既存destinationのfeatured_stay」を出す。
 * WebSearchの枠が尽きたため、宿の実在確認はすでに検証済みの既存データから引く。
 * 車で1時間ほどの目安として50km以内を見る。1軒も見つからない候補は、宿と結びつかないものとして落とす。
 */
import fs from 'fs';
const km = (a, b, c, d) => Math.hypot((a - c) * 111, (b - d) * 111 * Math.cos((a * Math.PI) / 180));
const all = JSON.parse(fs.readFileSync('src/data/destinations.json', 'utf8'));
const targets = JSON.parse(fs.readFileSync('logs/keikan_pass.json', 'utf8'));


const stays = all.filter((d) => d.featured_stay?.name && typeof d.lat === 'number');
for (const t of targets) {
  const near = stays.map((d) => ({ d, k: km(t.lat, t.lng, d.lat, d.lng) }))
    .filter((x) => x.k <= 50).sort((a, b) => a.k - b.k).slice(0, 3);
  console.log(`■ ${t.name}（${t.prefecture}${t.city}）`);
  if (!near.length) { console.log('   50km以内に検証済みの宿なし'); continue; }
  for (const n of near) {
    console.log(`   ${n.k.toFixed(1).padStart(5)}km ${n.d.name.padEnd(12)} → ${n.d.featured_stay.name}`);
  }
}
