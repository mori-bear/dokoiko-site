#!/usr/bin/env node
/**
 * kyushuWikidataCoords.mjs — ja.Wikipedia が座標プロパティを持たない秘湯候補について、
 * Wikidata の P625（座標）を第2ソース候補として引く。
 *
 * 背景: 一軒宿クラスの秘湯ほど ja.wiki 記事に {{Coord}} が無く、
 *   2ソース照合ゲートで機械的に全滅する。無名だから落ちるという逆選抜になっていた。
 *   Wikidata P625 は出典付きの独立した座標データなので、Wikipedia の代わりに使える。
 * 判定は変えない: Wikidata と OSM(厳格Nominatim) が5km以内で一致した場合のみ通す。
 */
const UA = { 'User-Agent': 'DokoIko-DataAudit/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const NAMES = [
  ['壁湯温泉', '大分県'], ['川底温泉', '大分県'], ['七里田温泉', '大分県'],
  ['赤川温泉', '大分県'], ['法華院温泉', '大分県'], ['湯坪温泉', '大分県'],
  ['満願寺温泉', '熊本県'], ['田の原温泉', '熊本県'], ['栃木温泉', '熊本県'],
  ['湯川内温泉', '鹿児島県'], ['紫尾温泉', '鹿児島県'], ['妙見温泉', '鹿児島県'],
  ['川内高城温泉', '鹿児島県'], ['湯之尾温泉', '鹿児島県'],
  ['京町温泉', '宮崎県'], ['祝子川温泉', '宮崎県'],
];

async function wikidataCoords(label) {
  // ja ラベル/別名から検索 → P625 を持つ最初の項目
  const s = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(label)}`
    + `&language=ja&uselang=ja&format=json&limit=5&origin=*`;
  const sj = await (await fetch(s, { headers: UA })).json();
  for (const hit of sj.search || []) {
    await sleep(250);
    const e = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${hit.id}&props=claims|labels&format=json&origin=*`;
    const ej = await (await fetch(e, { headers: UA })).json();
    const ent = ej.entities?.[hit.id];
    const c = ent?.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
    if (c) return { qid: hit.id, label: ent.labels?.ja?.value || hit.label, lat: c.latitude, lng: c.longitude, desc: hit.description };
  }
  return null;
}

for (const [name, pref] of NAMES) {
  const w = await wikidataCoords(name);
  await sleep(400);
  console.log(w
    ? `✓ ${name.padEnd(12)} ${w.qid.padEnd(10)} ${w.lat.toFixed(5)},${w.lng.toFixed(5)}  ${w.label} / ${w.desc ?? ''}`
    : `✗ ${name.padEnd(12)} Wikidataに座標なし`);
}
