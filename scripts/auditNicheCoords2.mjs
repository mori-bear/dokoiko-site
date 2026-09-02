#!/usr/bin/env node
/**
 * auditNicheCoords2.mjs — 1回目の検査で照合できなかったエントリを、検索語を変えて追う。
 *
 * 1回目は mapPoint の名前だけで Nominatim を引いたため、
 * 「〇〇公園」「〇〇の町並み」のような一般名や、施設名が登録されていない場所で
 * 一致が取れなかった。ここでは
 *   ・mapPoint + 市町村名
 *   ・mapPoint + 県名
 *   ・spots の各名前 + 市町村名
 * の順に試し、県が一致するものだけ採る。
 */
import fs from 'fs';
const UA = { 'User-Agent': 'DokoIko-DataAudit/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const km = (a, b, c, d) => Math.hypot((a - c) * 111, (b - d) * 111 * Math.cos((a * Math.PI) / 180));

const all = JSON.parse(fs.readFileSync('src/data/destinations.json', 'utf8'));
const byId = Object.fromEntries(all.map((d) => [d.id, d]));
const first = JSON.parse(fs.readFileSync('logs/coord_audit_niche.json', 'utf8'));
const unmatched = first.filter((x) => !x.osm).map((x) => x.id);

const OUT = 'logs/coord_audit_niche2.json';
const report = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : [];
const done = new Set(report.map((x) => x.id));

async function osm(q, pref) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}`
      + `&format=json&limit=8&countrycodes=jp&addressdetails=1&namedetails=1`;
    const rows = await (await fetch(url, { headers: UA })).json();
    await sleep(1150);
    for (const x of rows) {
      const p = x.address?.province || x.address?.state || '';
      if (p !== pref) continue;
      const nm = [x.namedetails?.name, x.namedetails?.['name:ja'], (x.display_name || '').split(',')[0]].filter(Boolean).join(' ');
      return { lat: +x.lat, lng: +x.lon, name: nm.slice(0, 30), q };
    }
  } catch { await sleep(1150); }
  return null;
}

console.log(`■ 1回目で照合できなかった ${unmatched.length}件を、検索語を足して追う`);
for (const id of unmatched) {
  if (done.has(id)) continue;
  const d = byId[id];
  if (!d) continue;
  const city = String(d.city || '').replace(/[市町村区]$/, '');
  const mp = String(d.mapPoint || '').replace(/[（(].*$/, '').trim();
  const spots = (d.spots || []).filter((s) => s && s.name).map((s) => String(s.name).replace(/[（(].*$/, '').trim());
  const queries = [mp && city ? `${mp} ${city}` : null, mp ? `${mp} ${d.prefecture}` : null,
    ...spots.map((s) => (city ? `${s} ${city}` : `${s} ${d.prefecture}`))].filter(Boolean);

  let hit = null;
  for (const q of queries) { hit = await osm(q, d.prefecture); if (hit) break; }
  const rec = { id, name: d.name, mapPoint: d.mapPoint, lat: d.lat, lng: d.lng, osm: hit };
  if (hit) {
    rec.gapM = Math.round(km(d.lat, d.lng, hit.lat, hit.lng) * 1000);
    if (rec.gapM > 400) console.log(`   ❌ ${String(rec.gapM).padStart(6)}m ${d.name.padEnd(20)} 「${hit.q}」→ ${hit.name}`);
  }
  report.push(rec);
  fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
}
const m = report.filter((x) => x.osm);
const bad = m.filter((x) => x.gapM > 400).sort((a, b) => b.gapM - a.gapM);
console.log(`\n   照合できた ${m.length} / ${report.length}件 / 400m超 ${bad.length}件`);
for (const x of bad) console.log(`     ${String(x.gapM).padStart(6)}m ${x.id.padEnd(18)} ${x.name}`);
