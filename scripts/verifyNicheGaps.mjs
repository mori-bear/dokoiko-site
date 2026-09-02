#!/usr/bin/env node
/**
 * verifyNicheGaps.mjs — 横断検査で「ずれ」と出たものを4ソースで引き直し、
 * 本当に登録値が誤っているのかを判定する。
 *
 * OSMの1件目が同名の別の場所であることも多いので、
 * wikipedia / wikidata / OSM / 国土地理院 のうち独立2ソースが5km以内で
 * 一致した点を「正」とし、登録値との距離を測る。
 */
import fs from 'fs';
const UA = { 'User-Agent': 'DokoIko-DataAudit/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const km = (a, b, c, d) => Math.hypot((a - c) * 111, (b - d) * 111 * Math.cos((a * Math.PI) / 180));

const all = JSON.parse(fs.readFileSync('src/data/destinations.json', 'utf8'));
const byId = Object.fromEntries(all.map((d) => [d.id, d]));
const audit = JSON.parse(fs.readFileSync('logs/coord_audit_niche.json', 'utf8'));
const targets = audit.filter((x) => x.osm && x.gapM > 400).sort((a, b) => b.gapM - a.gapM);

const OUT = 'logs/niche_gap_verify.json';
const done = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : [];
const seen = new Set(done.map((x) => x.id));

async function wiki(t) {
  const url = `https://ja.wikipedia.org/w/api.php?action=query&prop=coordinates&colimit=max`
    + `&titles=${encodeURIComponent(t)}&format=json&formatversion=2&redirects=1`;
  try {
    const p = (await (await fetch(url, { headers: UA })).json())?.query?.pages?.[0];
    const c = p?.coordinates?.[0];
    await sleep(320);
    if (c) return { src: 'wikipedia', lat: c.lat, lng: c.lon, note: p.title };
  } catch { /* なし */ }
  return null;
}
async function wd(q) {
  try {
    const s = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(q)}`
      + `&language=ja&uselang=ja&format=json&limit=4&origin=*`;
    for (const h of (await (await fetch(s, { headers: UA })).json()).search || []) {
      await sleep(220);
      const e = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${h.id}&props=claims&format=json&origin=*`;
      const c = (await (await fetch(e, { headers: UA })).json()).entities?.[h.id]?.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
      if (c) return { src: 'wikidata', lat: c.latitude, lng: c.longitude, note: `${h.id} ${h.label}` };
    }
  } catch { /* なし */ }
  return null;
}
async function osm(q, pref) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}`
      + `&format=json&limit=10&countrycodes=jp&addressdetails=1&namedetails=1`;
    const rows = await (await fetch(url, { headers: UA })).json();
    await sleep(1150);
    for (const x of rows) {
      const nm = [x.namedetails?.name, x.namedetails?.['name:ja'], (x.display_name || '').split(',')[0]].filter(Boolean).join(' ');
      const p = x.address?.province || x.address?.state || '';
      if (p !== pref) continue;
      if (!nm.includes(q) && !q.includes(nm)) continue;
      return { src: 'osm', lat: +x.lat, lng: +x.lon, note: nm.slice(0, 30) };
    }
  } catch { await sleep(1150); }
  return null;
}
async function gsi(q, pref) {
  try {
    const j = await (await fetch(`https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(q)}`, { headers: UA })).json();
    await sleep(400);
    for (const x of Array.isArray(j) ? j : []) {
      const title = x.properties?.title || '';
      const [lng, lat] = x.geometry?.coordinates ?? [];
      if (lat == null) continue;
      if (!title.includes(pref.replace(/[都道府県]$/, ''))) continue;   // 県名が入るものだけ採る
      return { src: 'gsi', lat, lng, note: title.slice(0, 30) };
    }
  } catch { /* なし */ }
  return null;
}

for (const t of targets) {
  if (seen.has(t.id)) continue;
  const d = byId[t.id];
  const q = String(d.mapPoint).replace(/[（(].*$/, '').trim();
  const srcs = [];
  for (const f of [() => wiki(q), () => wd(q), () => osm(q, d.prefecture), () => gsi(q, d.prefecture)]) {
    const r = await f(); if (r) srcs.push(r);
  }
  let best = null;
  for (let i = 0; i < srcs.length; i++) for (let k = i + 1; k < srcs.length; k++) {
    const dist = km(srcs[i].lat, srcs[i].lng, srcs[k].lat, srcs[k].lng);
    if (dist <= 5 && (!best || dist < best.d)) best = { a: srcs[i], b: srcs[k], d: dist };
  }
  const rec = { id: t.id, name: d.name, mapPoint: d.mapPoint, pref: d.prefecture,
    cur: [d.lat, d.lng], srcs: srcs.map((s) => [s.src, +s.lat.toFixed(5), +s.lng.toFixed(5), s.note]) };
  if (best) {
    rec.fix = [+((best.a.lat + best.b.lat) / 2).toFixed(6), +((best.a.lng + best.b.lng) / 2).toFixed(6)];
    rec.agree = `${best.a.src}×${best.b.src} ${(best.d * 1000).toFixed(0)}m`;
    rec.gapM = Math.round(km(d.lat, d.lng, rec.fix[0], rec.fix[1]) * 1000);
  }
  done.push(rec);
  fs.writeFileSync(OUT, JSON.stringify(done, null, 1));
  const mark = !rec.fix ? '？' : rec.gapM > 400 ? '❌' : '✅';
  console.log(`${mark} ${String(rec.gapM ?? '-').padStart(6)}m ${t.id.padEnd(16)} ${d.name.padEnd(20)} ${rec.agree ?? '2ソース一致なし'}`);
}
const fixable = done.filter((x) => x.fix && x.gapM > 400);
console.log(`\n検証 ${done.length}件 / 修正すべき ${fixable.length}件 / 判定できず ${done.filter((x) => !x.fix).length}件`);
