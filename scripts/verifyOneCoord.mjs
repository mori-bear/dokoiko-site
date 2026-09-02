#!/usr/bin/env node
/**
 * verifyOneCoord.mjs — ひとつの地点の座標を4ソースで引き直す。
 * usage: node scripts/verifyOneCoord.mjs "<wikipedia記事名>" "<OSMトークン>" "<県名>" "<GSI検索語>"
 */
const UA = { 'User-Agent': 'DokoIko-DataAudit/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const [wikiTitle, osmToken, pref, gsiName] = process.argv.slice(2);

const out = [];
{
  const url = `https://ja.wikipedia.org/w/api.php?action=query&prop=coordinates&colimit=max`
    + `&titles=${encodeURIComponent(wikiTitle)}&format=json&formatversion=2&redirects=1`;
  const p = (await (await fetch(url, { headers: UA })).json())?.query?.pages?.[0];
  const c = p?.coordinates?.[0];
  if (c) out.push({ src: 'wikipedia', lat: c.lat, lng: c.lon, note: p.title });
  else console.log(`  wikipedia: 座標なし（${p?.title ?? wikiTitle}）`);
}
await sleep(300);
{
  const s = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(wikiTitle)}`
    + `&language=ja&uselang=ja&format=json&limit=4&origin=*`;
  const sj = await (await fetch(s, { headers: UA })).json();
  let found = false;
  for (const hit of sj.search || []) {
    await sleep(220);
    const e = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${hit.id}&props=claims|labels&format=json&origin=*`;
    const ent = (await (await fetch(e, { headers: UA })).json()).entities?.[hit.id];
    const c = ent?.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
    if (c) { out.push({ src: 'wikidata', lat: c.latitude, lng: c.longitude, note: `${hit.id} ${hit.label}` }); found = true; break; }
  }
  if (!found) console.log('  wikidata: 座標なし');
}
{
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(osmToken)}`
    + `&format=json&limit=10&countrycodes=jp&addressdetails=1&namedetails=1`;
  const rows = await (await fetch(url, { headers: UA })).json();
  await sleep(1100);
  let found = false;
  for (const x of rows) {
    const nm = [x.namedetails?.name, x.namedetails?.['name:ja'], (x.display_name || '').split(',')[0]].filter(Boolean).join(' ');
    const p = x.address?.province || x.address?.state || '';
    if (!nm.includes(osmToken) || p !== pref) continue;
    out.push({ src: 'osm', lat: +x.lat, lng: +x.lon, note: nm.slice(0, 40) }); found = true; break;
  }
  if (!found) console.log(`  osm: 一致なし（${rows.length}件中）`);
}
{
  const j = await (await fetch(`https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(gsiName || wikiTitle)}`, { headers: UA })).json();
  let found = false;
  for (const x of Array.isArray(j) ? j : []) {
    const title = x.properties?.title || '';
    const [lng, lat] = x.geometry?.coordinates ?? [];
    if (lat == null) continue;
    out.push({ src: 'gsi', lat, lng, note: title.slice(0, 40) }); found = true; break;
  }
  if (!found) console.log('  gsi: 一致なし');
}

console.log(`\n■ ${wikiTitle} の座標`);
for (const s of out) console.log(`   ${s.src.padEnd(10)} ${s.lat.toFixed(6)}, ${s.lng.toFixed(6)}   ${s.note}`);
const km = (a, b, c, d) => Math.hypot((a - c) * 111, (b - d) * 111 * Math.cos((a * Math.PI) / 180));
console.log('\n   ソース間の距離');
for (let i = 0; i < out.length; i++) for (let k = i + 1; k < out.length; k++) {
  console.log(`     ${out[i].src}×${out[k].src}  ${(km(out[i].lat, out[i].lng, out[k].lat, out[k].lng) * 1000).toFixed(0)}m`);
}
