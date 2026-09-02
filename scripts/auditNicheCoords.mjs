#!/usr/bin/env node
/**
 * auditNicheCoords.mjs — 自動生成されたエントリの座標が、その主題からずれていないか調べる。
 *
 * 若桜町商店街は、国土地理院の地名検索が返す「町名の代表点」が入っており、
 * 実際の見どころ（若桜駅前の商店街）から639m離れていた。市町村としては合って
 * いるので逆ジオコーディングでは検出できない。
 * そこで mapPoint（地図リンクが指す見どころの名前）を Nominatim と wikidata で
 * 引き直し、登録座標との距離を測る。
 *
 * Nominatim は1秒1リクエストの制限があるので、間隔を空けて回す。
 */
import fs from 'fs';
const UA = { 'User-Agent': 'DokoIko-DataAudit/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const km = (a, b, c, d) => Math.hypot((a - c) * 111, (b - d) * 111 * Math.cos((a * Math.PI) / 180));

const all = JSON.parse(fs.readFileSync('src/data/destinations.json', 'utf8'));
const PREFIX = process.argv[2] || 'niche_';
const targets = all.filter((d) => d.id.startsWith(PREFIX) && typeof d.lat === 'number' && d.mapPoint);

const OUT = `logs/coord_audit_${PREFIX.replace(/_$/, '')}.json`;
const report = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : [];
const done = new Set(report.map((x) => x.id));

async function osm(q, pref) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}`
      + `&format=json&limit=8&countrycodes=jp&addressdetails=1&namedetails=1`;
    const rows = await (await fetch(url, { headers: UA })).json();
    await sleep(1150);
    for (const x of rows) {
      const nm = [x.namedetails?.name, x.namedetails?.['name:ja'], (x.display_name || '').split(',')[0]].filter(Boolean).join(' ');
      const p = x.address?.province || x.address?.state || '';
      if (p !== pref) continue;
      if (!nm.includes(q) && !q.includes(nm)) continue;
      return { lat: +x.lat, lng: +x.lon, name: nm.slice(0, 30) };
    }
  } catch { await sleep(1150); }
  return null;
}

console.log(`■ ${PREFIX} の座標検査 ${targets.length}件（mapPointをOSMで引いて登録値と比べる）`);
for (const d of targets) {
  if (done.has(d.id)) continue;
  const q = String(d.mapPoint).replace(/[（(].*$/, '').trim();
  const r = q.length >= 2 ? await osm(q, d.prefecture) : null;
  const rec = { id: d.id, name: d.name, mapPoint: d.mapPoint, lat: d.lat, lng: d.lng };
  if (r) {
    rec.osm = r; rec.gapM = Math.round(km(d.lat, d.lng, r.lat, r.lng) * 1000);
    if (rec.gapM > 400) console.log(`   ❌ ${rec.gapM.toString().padStart(6)}m ${d.name.padEnd(18)} mapPoint=${d.mapPoint} → OSM ${r.name}`);
  } else rec.osm = null;
  report.push(rec);
  fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
}
const measured = report.filter((x) => x.osm);
const bad = measured.filter((x) => x.gapM > 400).sort((a, b) => b.gapM - a.gapM);
console.log(`\n   照合できた ${measured.length} / ${report.length}件`);
console.log(`   400m超のずれ ${bad.length}件`);
for (const x of bad) console.log(`     ${String(x.gapM).padStart(6)}m ${x.id.padEnd(18)} ${x.name}`);
