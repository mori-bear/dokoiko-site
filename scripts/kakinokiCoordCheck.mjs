#!/usr/bin/env node
/**
 * kakinokiCoordCheck.mjs — 柿木温泉（島根県吉賀町）の座標を2ソースで確定する。
 *
 * 九州回の教訓を反映:
 *   ・Wikipedia は colimit=max（既定10で黙って落ちる）
 *   ・ja.wiki に座標が無い場合に備え Wikidata P625 も引く
 *   ・Nominatim はフリーテキストだと別地点を掴むので、
 *     ①返却名に候補名を含む ②県が一致 の2条件で絞る
 *   ・最後に確定座標を逆ジオコーディングして市町村まで照合する
 */
const UA = { 'User-Agent': 'DokoIko-DataAudit/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const kmBetween = (a, b, c, d) => Math.hypot((a - c) * 111, (b - d) * 111 * Math.cos((a * Math.PI) / 180));

const NAME = '柿木温泉';
const PREF = '島根県';
const CITY = '吉賀町';
// 中国地方のbbox（left,top,right,bottom）
const VIEWBOX = '130.8,35.8,134.5,33.7';

async function wikiCoords(title) {
  const url = `https://ja.wikipedia.org/w/api.php?action=query&prop=coordinates&colimit=max`
    + `&titles=${encodeURIComponent(title)}&format=json&formatversion=2&redirects=1`;
  const p = (await (await fetch(url, { headers: UA })).json())?.query?.pages?.[0];
  if (!p || p.missing) return { exists: false };
  const c = p.coordinates?.[0];
  return { exists: true, title: p.title, coords: c ? { lat: c.lat, lng: c.lon } : null };
}

async function wikidataCoords(label) {
  const s = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(label)}`
    + `&language=ja&uselang=ja&format=json&limit=5&origin=*`;
  const sj = await (await fetch(s, { headers: UA })).json();
  for (const hit of sj.search || []) {
    await sleep(250);
    const e = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${hit.id}&props=claims|labels&format=json&origin=*`;
    const ent = (await (await fetch(e, { headers: UA })).json()).entities?.[hit.id];
    const c = ent?.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
    if (c) return { qid: hit.id, label: ent.labels?.ja?.value, lat: c.latitude, lng: c.longitude, desc: hit.description };
  }
  return null;
}

async function osmStrict(tokens, prefecture) {
  for (const token of tokens) {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(token)}`
      + `&format=json&limit=10&countrycodes=jp&viewbox=${VIEWBOX}&bounded=1&addressdetails=1&namedetails=1`;
    const rows = await (await fetch(url, { headers: UA })).json();
    await sleep(1100);
    for (const x of rows) {
      const nm = [x.namedetails?.name, x.namedetails?.['name:ja'], (x.display_name || '').split(',')[0]]
        .filter(Boolean).join(' ');
      const pref = x.address?.province || x.address?.state || '';
      if (!nm.includes(token) || pref !== prefecture) continue;
      return { lat: +x.lat, lng: +x.lon, matched: nm.slice(0, 50), token, full: x.display_name?.slice(0, 90) };
    }
  }
  return null;
}

console.log(`■ ${NAME}（${PREF}${CITY}）の座標確定\n`);

for (const t of ['柿木温泉', '柿木村', '吉賀町']) {
  const w = await wikiCoords(t); await sleep(350);
  console.log(`  wiki  ${t.padEnd(8)} 記事=${w.exists ? w.title : 'なし'} 座標=${w.coords ? `${w.coords.lat},${w.coords.lng}` : 'なし'}`);
}
const wd = await wikidataCoords(NAME);
console.log(`  wikidata ${wd ? `${wd.qid} ${wd.lat.toFixed(5)},${wd.lng.toFixed(5)} (${wd.label} / ${wd.desc ?? ''})` : '座標なし'}`);

const osm = await osmStrict(['柿木温泉', 'はとの湯荘', '柿木村'], PREF);
console.log(`  osm      ${osm ? `${osm.lat.toFixed(5)},${osm.lng.toFixed(5)} [${osm.token}] ${osm.matched}\n           ${osm.full}` : '取得不可'}`);

// 2ソース照合
const sources = [];
if (wd) sources.push(['wikidata', wd.lat, wd.lng]);
if (osm) sources.push(['osm', osm.lat, osm.lng]);
const wt = await wikiCoords('柿木温泉');
if (wt.coords) sources.unshift(['wikipedia', wt.coords.lat, wt.coords.lng]);

console.log('');
if (sources.length < 2) {
  console.log(`❌ 2ソースに満たない（取得できたのは ${sources.map((s) => s[0]).join(',') || 'なし'}）`);
} else {
  const [a, b] = sources;
  const d = kmBetween(a[1], a[2], b[1], b[2]);
  console.log(`${d <= 5 ? '✅' : '❌'} ${a[0]} × ${b[0]} = ${d.toFixed(2)}km`);
  if (d <= 5) {
    const lat = +((a[1] + b[1]) / 2).toFixed(5), lng = +((a[2] + b[2]) / 2).toFixed(5);
    const rev = await (await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=12&addressdetails=1`, { headers: UA })).json();
    const ad = rev.address || {};
    const city = ad.city || ad.town || ad.village || ad.county || ad.municipality || '?';
    const pref = ad.province || ad.state || '?';
    console.log(`   確定座標 ${lat},${lng}`);
    console.log(`   逆引き   ${pref}${city}  期待=${PREF}${CITY}  ${pref === PREF && city.includes('吉賀') ? '✅一致' : '⚠️要確認'}`);
  }
}
