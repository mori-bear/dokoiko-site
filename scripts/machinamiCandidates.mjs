#!/usr/bin/env node
/**
 * machinamiCandidates.mjs — 重要伝統的建造物群保存地区129件のうち、既存destinationsに
 * 無かった16地区の座標検証。ゲートは温泉版と同一
 * （4ソースから独立2ソースが5km以内で一致、既存3km以内は近接として不合格）。
 *
 * 京都(産寧坂・祇園新橋・上賀茂・嵯峨鳥居本)・神戸(北野町)・宮島・萩(4地区)・
 * 脇町・石見銀山・美山は、すでに親エントリがあるため対象から外している。
 */
import fs from 'fs';

const UA = { 'User-Agent': 'DokoIko-DataAudit/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const kmBetween = (a, b, c, d) => Math.hypot((a - c) * 111, (b - d) * 111 * Math.cos((a * Math.PI) / 180));

// [id, 名前, 県, 市町村, Wikipedia記事候補[], OSM名称トークン[]]
const CANDIDATES = [
  ['kanegasaki',     '金ケ崎城内諏訪小路', '岩手県',   '金ケ崎町',   ['城内諏訪小路'],   ['城内諏訪小路']],
  ['murata-miyagi',  '村田商家町',       '宮城県',   '村田町',     ['村田町'],         ['村田町蔵の町並み', '村田商人町']],
  ['kaemon',         '栃木嘉右衛門町',   '栃木県',   '栃木市',     ['嘉右衛門町'],     ['嘉右衛門町']],
  ['akaiwa-gunma',   '六合赤岩',         '群馬県',   '中之条町',   ['赤岩 (中之条町)', '六合村'], ['赤岩集落']],
  ['imajo',          '今庄宿',           '福井県',   '南越前町',   ['今庄宿'],         ['今庄宿']],
  ['shioyama-kamijo','塩山下小田原上条',  '山梨県',   '甲州市',     ['下小田原上条'],   ['下小田原上条']],
  ['suzaka',         '須坂',             '長野県',   '須坂市',     ['須坂市'],         ['須坂', '須坂市']],
  ['inariyama',      '稲荷山',           '長野県',   '千曲市',     ['稲荷山 (千曲市)'], ['稲荷山宿']],
  ['gokasho-kondo',  '五個荘金堂',       '滋賀県',   '東近江市',   ['五個荘金堂町'],   ['五個荘金堂']],
  ['oya-osugi',      '大屋町大杉',       '兵庫県',   '養父市',     ['大杉 (養父市)'],  ['大杉']],
  ['mitarai',        '御手洗',           '広島県',   '呉市',       ['御手洗 (呉市)'],  ['御手洗']],
  ['tebajima',       '出羽島',           '徳島県',   '牟岐町',     ['出羽島'],         ['出羽島']],
  ['unomachi',       '卯之町',           '愛媛県',   '西予市',     ['卯之町'],         ['卯之町']],
  ['doikachu',       '土居廓中',         '高知県',   '安芸市',     ['土居廓中'],       ['土居廓中']],
  ['irikifumoto',    '入来麓',           '鹿児島県', '薩摩川内市', ['入来麓'],         ['入来麓']],
  ['kaseda-fumoto',  '加世田麓',         '鹿児島県', '南さつま市', ['加世田麓'],       ['加世田麓']],
];

const existing = JSON.parse(fs.readFileSync('src/data/destinations.json', 'utf8'));
const norm = (s) => String(s || '').replace(/[\s　・（）()「」【】]/g, '')
  .replace(/(市|町|村|区|駅|温泉|温泉郷|公園|神社|寺|大橋)$/g, '');

async function wikiCoords(titles) {
  for (const t of titles) {
    const url = `https://ja.wikipedia.org/w/api.php?action=query&prop=coordinates&colimit=max`
      + `&titles=${encodeURIComponent(t)}&format=json&formatversion=2&redirects=1`;
    try {
      const p = (await (await fetch(url, { headers: UA })).json())?.query?.pages?.[0];
      const c = p?.coordinates?.[0];
      if (c) return { src: 'wikipedia', lat: c.lat, lng: c.lon, note: p.title };
    } catch { /* 次へ */ }
    await sleep(320);
  }
  return null;
}
async function wikidataCoords(label) {
  try {
    const s = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(label)}`
      + `&language=ja&uselang=ja&format=json&limit=4&origin=*`;
    const sj = await (await fetch(s, { headers: UA })).json();
    for (const hit of sj.search || []) {
      await sleep(220);
      const e = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${hit.id}&props=claims|labels&format=json&origin=*`;
      const ent = (await (await fetch(e, { headers: UA })).json()).entities?.[hit.id];
      const c = ent?.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
      if (c) return { src: 'wikidata', lat: c.latitude, lng: c.longitude, note: hit.id };
    }
  } catch { /* なし */ }
  return null;
}
async function osmStrict(tokens, prefecture) {
  for (const token of tokens) {
    if (token === '__skip__') continue;
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(token)}`
        + `&format=json&limit=10&countrycodes=jp&addressdetails=1&namedetails=1`;
      const rows = await (await fetch(url, { headers: UA })).json();
      await sleep(1100);
      for (const x of rows) {
        const nm = [x.namedetails?.name, x.namedetails?.['name:ja'], (x.display_name || '').split(',')[0]]
          .filter(Boolean).join(' ');
        const pref = x.address?.province || x.address?.state || '';
        if (!nm.includes(token) || pref !== prefecture) continue;
        return { src: 'osm', lat: +x.lat, lng: +x.lon, note: nm.slice(0, 30) };
      }
    } catch { await sleep(1100); }
  }
  return null;
}
async function gsiStrict(name, prefecture) {
  try {
    const j = await (await fetch(`https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(name)}`, { headers: UA })).json();
    await sleep(400);
    for (const x of Array.isArray(j) ? j : []) {
      const title = x.properties?.title || '';
      const [lng, lat] = x.geometry?.coordinates ?? [];
      if (lat == null || !title.includes(name)) continue;
      return { src: 'gsi', lat, lng, note: title.slice(0, 30) };
    }
  } catch { /* なし */ }
  return null;
}

const out = [];
for (const [id, name, pref, city, wikiTitles, osmTokens] of CANDIDATES) {
  const rec = { id, name, prefecture: pref, city, checks: {} };
  const dupId = existing.find((d) => d.id === id);
  const dupName = existing.find((d) => d.name === name);
  const dupNorm = existing.filter((d) => norm(d.name) === norm(name) && d.name !== name);
  rec.checks.duplicate = dupId ? `id重複:${dupId.name}` : dupName ? `同名:${dupName.name}`
    : dupNorm.length ? `類似名:${dupNorm.map((d) => d.name).join(',')}` : 'なし';
  if (rec.checks.duplicate !== 'なし') {
    rec.pass = false; out.push(rec);
    console.log(`❌ ${name.padEnd(12)} ${pref.padEnd(5)} 重複=${rec.checks.duplicate}`);
    continue;
  }
  const srcs = [];
  for (const f of [() => wikiCoords(wikiTitles), () => wikidataCoords(name),
    () => osmStrict(osmTokens, pref), () => gsiStrict(name, pref)]) {
    const r = await f(); if (r) srcs.push(r);
  }
  rec.sources = srcs;
  let best = null;
  for (let i = 0; i < srcs.length; i++) for (let k = i + 1; k < srcs.length; k++) {
    const d = kmBetween(srcs[i].lat, srcs[i].lng, srcs[k].lat, srcs[k].lng);
    if (d <= 5 && (!best || d < best.d)) best = { a: srcs[i], b: srcs[k], d };
  }
  if (!best) {
    rec.checks.coords = srcs.length < 2 ? `2ソース未満 (${srcs.map((s) => s.src).join(',') || 'なし'})` : `一致なし (${srcs.map((s) => s.src).join(',')})`;
    rec.pass = false; out.push(rec);
    console.log(`❌ ${name.padEnd(12)} ${pref.padEnd(5)} 座標=${rec.checks.coords}`);
    continue;
  }
  rec.checks.coords = `一致 ${best.d.toFixed(2)}km (${best.a.src}×${best.b.src})`;
  rec.distanceKm = +best.d.toFixed(2);
  rec.verifiedBy = [best.a.src, best.b.src];
  rec.lat = +((best.a.lat + best.b.lat) / 2).toFixed(5);
  rec.lng = +((best.a.lng + best.b.lng) / 2).toFixed(5);
  const near = existing.filter((d) => typeof d.lat === 'number')
    .map((d) => ({ name: d.name, km: kmBetween(rec.lat, rec.lng, d.lat, d.lng) }))
    .filter((x) => x.km < 3).sort((a, b) => a.km - b.km);
  rec.checks.nearby = near.length ? near.map((x) => `${x.name}(${x.km.toFixed(1)}km)`).join(', ') : 'なし';
  rec.pass = rec.checks.nearby === 'なし';
  out.push(rec);
  console.log(`${rec.pass ? '✅' : '❌'} ${name.padEnd(12)} ${pref.padEnd(5)} 座標=${rec.checks.coords.padEnd(30)} 近接=${rec.checks.nearby}`);
}

const passed = out.filter((r) => r.pass);
for (let i = 0; i < passed.length; i++) for (let k = i + 1; k < passed.length; k++) {
  const d = kmBetween(passed[i].lat, passed[i].lng, passed[k].lat, passed[k].lng);
  if (d < 3) console.log(`⚠️ 候補同士が近接: ${passed[i].name} ↔ ${passed[k].name} ${d.toFixed(2)}km`);
}
fs.writeFileSync('logs/machinami_candidates.json', JSON.stringify(out, null, 2));
console.log(`\n合格 ${passed.length} / ${out.length} 件 → logs/machinami_candidates.json`);
