#!/usr/bin/env node
/**
 * kyushuTravelTimeBase.mjs — 新規destinationの travelTime を捏造しないため、
 * 最も近い「travelTimeを持つ既存エントリ」を土台候補として出す（調査のみ）。
 * 実際の値は、土台の値に現地アクセス差分を足して決める。
 */
import fs from 'fs';
const kmBetween = (a, b, c, d) => Math.hypot((a - c) * 111, (b - d) * 111 * Math.cos((a * Math.PI) / 180));
const all = JSON.parse(fs.readFileSync('src/data/destinations.json', 'utf8'));

const NEW = [
  ...JSON.parse(fs.readFileSync('logs/kyushu_targets.json', 'utf8')),
  ...JSON.parse(fs.readFileSync('logs/kyushu_secret_add.json', 'utf8')),
];
// 日奈久温泉は令和8年熊本地震(2026-07-28)で源泉配管が損傷し旅館の大半が営業不能。
// 「実在・営業中」の必須条件を満たさないため不採用（復旧後に再検討する）。
const ADOPTED = new Set(['yunohira-onsen', 'hagenoyu-onsen', 'yunotsuru-onsen',
  'tsuetate-onsen', 'funagoya-onsen', 'kumanokawa-onsen', 'furuyu-onsen', 'hinokage-onsen', 'kannojigoku']);

for (const n of NEW.filter((x) => ADOPTED.has(x.id))) {
  const near = all
    .filter((d) => typeof d.lat === 'number' && d.travelTime && Object.keys(d.travelTime).length >= 5)
    .map((d) => ({ id: d.id, name: d.name, pref: d.prefecture, km: kmBetween(n.lat, n.lng, d.lat, d.lng), tt: d.travelTime }))
    .sort((a, b) => a.km - b.km).slice(0, 3);
  console.log(`■ ${n.name} (${n.id}) ${n.prefecture}`);
  for (const c of near) {
    const keys = ['tokyo', 'osaka', 'fukuoka', 'oita', 'saga', 'shimonoseki'];
    const shown = keys.filter((k) => c.tt[k] != null).map((k) => `${k}:${c.tt[k]}`).join(' ');
    console.log(`   ${c.km.toFixed(1).padStart(5)}km  ${c.id.padEnd(20)} ${c.name.padEnd(12)} ${shown}`);
  }
  console.log('');
}
