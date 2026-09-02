#!/usr/bin/env node
/** probeAkaiwa.mjs — 六合赤岩と御手洗の座標を、記事名を変えながら丁寧に引く。 */
const UA = { 'User-Agent': 'DokoIko-DataAudit/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const km = (a, b, c, d) => Math.hypot((a - c) * 111, (b - d) * 111 * Math.cos((a * Math.PI) / 180));

async function wikiCoord(t) {
  const url = `https://ja.wikipedia.org/w/api.php?action=query&prop=coordinates&colimit=max`
    + `&titles=${encodeURIComponent(t)}&format=json&formatversion=2&redirects=1`;
  const p = (await (await fetch(url, { headers: UA })).json())?.query?.pages?.[0];
  const c = p?.coordinates?.[0];
  await sleep(300);
  return c ? { title: p.title, lat: c.lat, lng: c.lon } : { title: p?.title ?? t, lat: null };
}
async function wdSearch(q) {
  const s = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(q)}`
    + `&language=ja&uselang=ja&format=json&limit=6&origin=*`;
  const hits = (await (await fetch(s, { headers: UA })).json()).search || [];
  const out = [];
  for (const h of hits) {
    await sleep(200);
    const e = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${h.id}&props=claims|labels|descriptions&format=json&origin=*`;
    const ent = (await (await fetch(e, { headers: UA })).json()).entities?.[h.id];
    const c = ent?.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
    out.push({ id: h.id, label: h.label, desc: (ent?.descriptions?.ja?.value || h.description || '').slice(0, 40),
      lat: c?.latitude ?? null, lng: c?.longitude ?? null });
  }
  return out;
}
async function osmAll(q) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}`
    + `&format=json&limit=10&countrycodes=jp&addressdetails=1&namedetails=1&accept-language=ja`;
  const rows = await (await fetch(url, { headers: UA })).json();
  await sleep(1100);
  return rows.map((x) => ({
    name: [x.namedetails?.name, x.namedetails?.['name:ja']].filter(Boolean).join('/'),
    pref: x.address?.province || x.address?.state || '',
    city: x.address?.city || x.address?.town || x.address?.village || x.address?.county || '',
    lat: +x.lat, lng: +x.lon,
  }));
}

console.log('■ 六合赤岩（登録値 36.57606, 138.62827）');
for (const t of ['赤岩 (中之条町)', '赤岩 (群馬県)', '六合村', '重要伝統的建造物群保存地区']) {
  const r = await wikiCoord(t);
  console.log(`   wiki「${t}」→ ${r.title}: ${r.lat ? `${r.lat}, ${r.lng}` : '座標なし'}`);
}
console.log('   wikidata検索「六合赤岩」:');
for (const x of await wdSearch('六合赤岩')) console.log(`     ${x.id} ${String(x.label).padEnd(12)} ${x.lat ? `${x.lat}, ${x.lng}` : '座標なし'}  ${x.desc}`);
console.log('   wikidata検索「赤岩 中之条」:');
for (const x of await wdSearch('赤岩 中之条')) console.log(`     ${x.id} ${String(x.label).padEnd(12)} ${x.lat ? `${x.lat}, ${x.lng}` : '座標なし'}  ${x.desc}`);
console.log('   OSM「赤岩集落」:');
for (const x of await osmAll('赤岩集落')) console.log(`     ${x.lat}, ${x.lng}  ${x.pref} ${x.city}  ${x.name}`);
console.log('   OSM「湯本家住宅」:');
for (const x of await osmAll('湯本家住宅')) console.log(`     ${x.lat}, ${x.lng}  ${x.pref} ${x.city}  ${x.name}`);

console.log('\n■ 御手洗（登録値 34.17934, 132.8668）');
for (const t of ['御手洗 (呉市)', '大崎下島']) {
  const r = await wikiCoord(t);
  console.log(`   wiki「${t}」→ ${r.title}: ${r.lat ? `${r.lat}, ${r.lng}` : '座標なし'}`);
}
console.log('   OSM「御手洗」:');
for (const x of await osmAll('御手洗')) console.log(`     ${x.lat}, ${x.lng}  ${x.pref} ${x.city}  ${x.name}`);
