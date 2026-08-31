#!/usr/bin/env node
/**
 * kyushuCoordDiag.mjs — 座標が取れなかった九州候補の原因切り分け（調査のみ）。
 *  - Wikipedia: 記事の存在／リダイレクト先／座標プロパティの有無を出す
 *  - OSM: 九州のbboxで bounded 検索し、県内に落ちる候補が拾えるか見る
 * これは診断であって採否判定ではない。判定は kyushuDestCandidates3.mjs で行う。
 */
const UA = { 'User-Agent': 'DokoIko-DataAudit/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 九州本土＋周辺のbbox（left,top,right,bottom）
const KYUSHU_VIEWBOX = '128.3,34.1,132.2,30.8';

const NAMES = [
  ['壁湯温泉', '大分県'], ['川底温泉', '大分県'], ['法華院温泉', '大分県'],
  ['赤川温泉', '大分県'], ['七里田温泉', '大分県'], ['筋湯温泉', '大分県'],
  ['垂玉温泉', '熊本県'], ['満願寺温泉', '熊本県'], ['はげの湯温泉', '熊本県'],
  ['岳の湯温泉', '熊本県'],
  ['湯川内温泉', '鹿児島県'], ['紫尾温泉', '鹿児島県'], ['妙見温泉', '鹿児島県'],
  ['川内高城温泉', '鹿児島県'], ['京町温泉', '宮崎県'],
  ['脇田温泉', '福岡県'], ['星野村', '福岡県'],
];

async function wikiInfo(title) {
  const url = `https://ja.wikipedia.org/w/api.php?action=query&prop=coordinates|info&titles=${encodeURIComponent(title)}&format=json&formatversion=2&redirects=1`;
  const j = await (await fetch(url, { headers: UA })).json();
  const p = j?.query?.pages?.[0] || {};
  return {
    exists: !p.missing,
    resolved: p.title,
    redirectedFrom: j?.query?.redirects?.[0]?.from ?? null,
    coords: p.coordinates?.[0] ? { lat: p.coordinates[0].lat, lng: p.coordinates[0].lon } : null,
  };
}

async function osmBounded(q) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}` +
    `&format=json&limit=3&countrycodes=jp&viewbox=${KYUSHU_VIEWBOX}&bounded=1&addressdetails=1`;
  const j = await (await fetch(url, { headers: UA })).json();
  return (j || []).map((x) => ({
    lat: +x.lat, lng: +x.lon,
    pref: x.address?.province || x.address?.state || '?',
    name: x.display_name?.slice(0, 60),
  }));
}

for (const [name, pref] of NAMES) {
  const w = await wikiInfo(name); await sleep(350);
  const o = await osmBounded(name); await sleep(1100);
  const wStr = !w.exists ? '記事なし'
    : `${w.resolved}${w.redirectedFrom ? `(←${w.redirectedFrom})` : ''} 座標:${w.coords ? `${w.coords.lat},${w.coords.lng}` : 'なし'}`;
  console.log(`\n■ ${name} / ${pref}`);
  console.log(`  wiki: ${wStr}`);
  if (!o.length) console.log('  osm : 九州bbox内ヒットなし');
  for (const r of o) console.log(`  osm : ${r.lat.toFixed(4)},${r.lng.toFixed(4)} [${r.pref}] ${r.name}`);
}
