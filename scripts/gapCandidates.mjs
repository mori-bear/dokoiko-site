#!/usr/bin/env node
/**
 * gapCandidates.mjs — カバレッジの空白を埋める候補の座標検証。
 * 大阪17 / 埼玉18 / 徳島18 / 長崎18（中央値24件を大きく下回る）と、
 * 温泉が1件も無い埼玉・千葉・滋賀、絶景が1件も無い大阪・長崎・栃木・宮城・岡山を狙う。
 * （元の説明）keikanCandidates.mjs — 絶景（宿泊と結びつくもの）の座標検証。
 * 条件（ユーザー指定）:
 *   ・現地または車1時間圏内に実在の宿泊施設がある
 *   ・単なる展望台ではなく、周辺に滞在価値がある
 * ゲートは温泉・街並みと同一（4ソースから独立2ソースが5km以内で一致、既存3km以内は不合格）。
 *
 * 候補は国指定名勝536件を機械照合して未掲載125件に絞り、そこから
 * 「宿と結びつく（温泉地や城下町が近い）」ものを選んだ（keikanCandidates.mjsの第2版）。
 * 1回目は有名すぎる絶景ばかりで、12件中8件が既存エントリのspotとして収録済みだった。
 */
import fs from 'fs';

const UA = { 'User-Agent': 'DokoIko-DataAudit/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const kmBetween = (a, b, c, d) => Math.hypot((a - c) * 111, (b - d) * 111 * Math.cos((a * Math.PI) / 180));

// [id, 名前, 県, 市町村, Wikipedia記事候補[], OSM名称トークン[]]
const CANDIDATES = [
  // ── 大阪（絶景0・温泉1）──
  ['inunakiyama',   '犬鳴山温泉',   '大阪府', '泉佐野市', ['犬鳴山温泉', '犬鳴山'], ['犬鳴山温泉', '犬鳴山']],
  ['minoo-otaki',   '箕面大滝',     '大阪府', '箕面市',   ['箕面滝', '箕面大滝'],   ['箕面滝', '箕面大滝']],
  ['iwawaki',       '岩湧山',       '大阪府', '河内長野市',['岩湧山'],             ['岩湧山']],
  ['takihata',      '滝畑四十八滝', '大阪府', '河内長野市',['滝畑四十八滝'],       ['滝畑四十八滝']],
  // ── 埼玉（温泉0）──
  ['chichibu-onsen',  '秩父温泉',   '埼玉県', '皆野町',   ['秩父温泉'],           ['満願の湯', '秩父温泉']],
  ['naguri',          '名栗温泉',   '埼玉県', '飯能市',   ['名栗温泉'],           ['名栗温泉']],
  ['ryokami',         '両神温泉',   '埼玉県', '小鹿野町', ['両神温泉'],           ['両神温泉']],
  ['shiraku',         '白久温泉',   '埼玉県', '秩父市',   ['白久温泉'],           ['白久温泉']],
  // ── 千葉（温泉0）──
  ['yoro-onsen',      '養老渓谷温泉','千葉県', '大多喜町', ['養老渓谷温泉'],       ['養老渓谷温泉']],
  ['shirako-onsen',   '白子温泉',   '千葉県', '白子町',   ['白子温泉'],           ['白子温泉']],
  // ── 滋賀（温泉0）──
  ['ogoto',           'おごと温泉', '滋賀県', '大津市',   ['雄琴温泉'],           ['おごと温泉', '雄琴温泉']],
  ['sugatani',        '須賀谷温泉', '滋賀県', '長浜市',   ['須賀谷温泉'],         ['須賀谷温泉']],
  // ── 徳島 ──
  ['tsukigatani',     '月ヶ谷温泉', '徳島県', '上勝町',   ['月ヶ谷温泉'],         ['月ヶ谷温泉']],
  ['ohama-kaigan',    '大浜海岸',   '徳島県', '美波町',   ['大浜海岸'],           ['大浜海岸']],
  ['takagoya',        '高越山',     '徳島県', '吉野川市', ['高越山'],             ['高越山']],
  // ── 長崎（絶景0）──
  ['obama-nagasaki',  '小浜温泉',   '長崎県', '雲仙市',   ['小浜温泉'],           ['小浜温泉']],
  ['kujukushima',     '九十九島',   '長崎県', '佐世保市', ['九十九島'],           ['九十九島']],
  ['osezaki',         '大瀬崎',     '長崎県', '五島市',   ['大瀬崎 (長崎県)', '大瀬埼灯台'], ['大瀬埼灯台']],
  ['shimabara-onsen', '島原温泉',   '長崎県', '島原市',   ['島原温泉'],           ['島原温泉']],
  // ── 絶景0の県 ──
  ['ryuokyo',         '龍王峡',     '栃木県', '日光市',   ['龍王峡'],             ['龍王峡']],
  ['naruko-kyo',      '鳴子峡',     '宮城県', '大崎市',   ['鳴子峡'],             ['鳴子峡']],
  ['hiruzen',         '神庭の滝',   '岡山県', '真庭市',   ['神庭の滝'],           ['神庭の滝']],
  ['korankei',        '香嵐渓',     '愛知県', '豊田市',   ['香嵐渓'],             ['香嵐渓']],
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
fs.writeFileSync('logs/gap_candidates.json', JSON.stringify(out, null, 1));
console.log(`\n合格 ${passed.length} / ${out.length} 件 → logs/gap_candidates.json`);
