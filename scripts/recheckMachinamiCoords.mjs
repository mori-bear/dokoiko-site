#!/usr/bin/env node
/**
 * recheckMachinamiCoords.mjs — 街並みバッチと若桜町商店街の座標を引き直して、
 * 登録値がどれだけずれているかを測る。
 *   ・4ソース（wikipedia / wikidata / OSM厳密 / 国土地理院）で座標を取り直す
 *   ・独立2ソースが一致した点を「正」とし、登録値との距離を出す
 *   ・登録値を逆ジオコーディングして、市町村が合っているかも見る
 */
const UA = { 'User-Agent': 'DokoIko-DataAudit/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const km = (a, b, c, d) => Math.hypot((a - c) * 111, (b - d) * 111 * Math.cos((a * Math.PI) / 180));
import fs from 'fs';

const all = JSON.parse(fs.readFileSync('src/data/destinations.json', 'utf8'));
const byId = Object.fromEntries(all.map((d) => [d.id, d]));

// [id, wikipedia記事候補[], OSMトークン[], GSI検索語]
const TARGETS = [
  ['niche_鳥取_2', ['若桜駅', '若桜町'], ['若桜駅'], '若桜駅'],
  ['imajo',        ['今庄宿', '今庄駅'], ['今庄宿', '今庄駅'], '今庄駅'],
  ['mitarai',      ['御手洗 (呉市)'],    ['御手洗'],           '御手洗'],
  ['unomachi',     ['卯之町', '卯之町駅'], ['卯之町'],         '卯之町駅'],
  ['murata-miyagi',['村田町'],           ['村田町'],           '村田町'],
  ['akaiwa-gunma', ['赤岩 (群馬県)', '中之条町'], ['赤岩集落'], '赤岩'],
  ['inariyama',    ['稲荷山宿', '稲荷山駅'], ['稲荷山宿'],     '稲荷山駅'],
];

async function wiki(titles) {
  for (const t of titles) {
    const url = `https://ja.wikipedia.org/w/api.php?action=query&prop=coordinates&colimit=max`
      + `&titles=${encodeURIComponent(t)}&format=json&formatversion=2&redirects=1`;
    try {
      const p = (await (await fetch(url, { headers: UA })).json())?.query?.pages?.[0];
      const c = p?.coordinates?.[0];
      if (c) return { src: 'wikipedia', lat: c.lat, lng: c.lon, note: p.title };
    } catch { /* 次へ */ }
    await sleep(300);
  }
  return null;
}
async function wikidata(label) {
  try {
    const s = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(label)}`
      + `&language=ja&uselang=ja&format=json&limit=4&origin=*`;
    for (const hit of (await (await fetch(s, { headers: UA })).json()).search || []) {
      await sleep(220);
      const e = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${hit.id}&props=claims&format=json&origin=*`;
      const c = (await (await fetch(e, { headers: UA })).json()).entities?.[hit.id]?.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
      if (c) return { src: 'wikidata', lat: c.latitude, lng: c.longitude, note: hit.id };
    }
  } catch { /* なし */ }
  return null;
}
async function osm(tokens, pref) {
  for (const token of tokens) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(token)}`
        + `&format=json&limit=10&countrycodes=jp&addressdetails=1&namedetails=1`;
      const rows = await (await fetch(url, { headers: UA })).json();
      await sleep(1100);
      for (const x of rows) {
        const nm = [x.namedetails?.name, x.namedetails?.['name:ja'], (x.display_name || '').split(',')[0]].filter(Boolean).join(' ');
        const p = x.address?.province || x.address?.state || '';
        if (!nm.includes(token) || p !== pref) continue;
        return { src: 'osm', lat: +x.lat, lng: +x.lon, note: nm.slice(0, 30) };
      }
    } catch { await sleep(1100); }
  }
  return null;
}
async function gsi(name) {
  try {
    const j = await (await fetch(`https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(name)}`, { headers: UA })).json();
    await sleep(400);
    for (const x of Array.isArray(j) ? j : []) {
      const [lng, lat] = x.geometry?.coordinates ?? [];
      if (lat == null) continue;
      return { src: 'gsi', lat, lng, note: (x.properties?.title || '').slice(0, 30) };
    }
  } catch { /* なし */ }
  return null;
}
async function reverse(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=14&addressdetails=1&accept-language=ja`;
    const j = await (await fetch(url, { headers: UA })).json();
    await sleep(1100);
    const a = j.address || {};
    return [a.city, a.town, a.village, a.county, a.province || a.state].filter(Boolean).join(' / ');
  } catch { return '取得できず'; }
}

for (const [id, titles, tokens, gsiName] of TARGETS) {
  const d = byId[id];
  if (!d) { console.log(`■ ${id}: destinationが無い`); continue; }
  const srcs = [];
  for (const f of [() => wiki(titles), () => wikidata(titles[0]), () => osm(tokens, d.prefecture), () => gsi(gsiName)]) {
    const r = await f(); if (r) srcs.push(r);
  }
  let best = null;
  for (let i = 0; i < srcs.length; i++) for (let k = i + 1; k < srcs.length; k++) {
    const dist = km(srcs[i].lat, srcs[i].lng, srcs[k].lat, srcs[k].lng);
    if (dist <= 5 && (!best || dist < best.d)) best = { a: srcs[i], b: srcs[k], d: dist };
  }
  const place = await reverse(d.lat, d.lng);
  console.log(`\n■ ${d.name}（${id}）`);
  console.log(`   登録値      ${d.lat}, ${d.lng}   → 逆引き: ${place}`);
  for (const s of srcs) console.log(`   ${s.src.padEnd(10)} ${s.lat.toFixed(6)}, ${s.lng.toFixed(6)}  ${s.note}`);
  if (!best) { console.log('   ⚠️ 2ソース一致なし'); continue; }
  const lat = +((best.a.lat + best.b.lat) / 2).toFixed(6);
  const lng = +((best.a.lng + best.b.lng) / 2).toFixed(6);
  const gap = km(d.lat, d.lng, lat, lng) * 1000;
  console.log(`   一致点      ${lat}, ${lng}  (${best.a.src}×${best.b.src} ${(best.d * 1000).toFixed(0)}m)`);
  console.log(`   ${gap > 300 ? '❌' : '✅'} 登録値とのずれ ${gap.toFixed(0)}m`);
}
