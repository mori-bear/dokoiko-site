#!/usr/bin/env node
/**
 * kyushuWikiCoordScan.mjs — 九州の秘湯・一軒宿の候補名を広めに並べ、
 * ja.Wikipedia が座標プロパティを持つものだけを絞り込む（調査のみ）。
 *
 * titles= は最大50件までまとめて投げられるので1〜2コールで済む。
 * ここで座標が取れた候補だけを、次段(Overpass)のOSM照合にかける。
 */
const UA = { 'User-Agent': 'DokoIko-DataAudit/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };

const NAMES = [
  // 大分県
  '筋湯温泉', '寒の地獄温泉', '川底温泉', '壁湯温泉', '法華院温泉', '赤川温泉', '七里田温泉',
  '宝泉寺温泉', '天ヶ瀬温泉', '塚原温泉', '湯坪温泉', '白水鉱泉', '九酔渓', '長湯温泉',
  // 熊本県
  '垂玉温泉', '峐の湯温泉', '満願寺温泉', '田の原温泉', '小田温泉', '栃木温泉', '湯山温泉',
  '日奈久温泉', 'planned_dummy_kumamoto',
  // 鹿児島県
  '妙見温泉', '紫尾温泉', '湯川内温泉', '川内高城温泉', '新湯温泉', '湯之尾温泉', '二月田温泉',
  '栗野岳温泉', '吹上温泉 (鹿児島県)',
  // 宮崎県
  '京町温泉', '祝子川温泉', '日之影温泉', '北郷温泉', '青島 (宮崎県)',
  // 佐賀県
  '熊の川温泉', '古湯温泉', '嬉野温泉',
  // 福岡県
  '脇田温泉', '星野村', '船小屋温泉', '筑後川温泉',
  // 長崎県
  '小地獄温泉', '雲仙温泉',
];

// colimit の既定値は10。指定しないと11件目以降の座標が黙って落ちる（実測で踏んだ）。
const url = 'https://ja.wikipedia.org/w/api.php?action=query&prop=coordinates|info&format=json&formatversion=2&redirects=1&colimit=max&titles='
  + encodeURIComponent(NAMES.join('|'));
const j = await (await fetch(url, { headers: UA })).json();

const redirects = Object.fromEntries((j.query?.redirects || []).map((r) => [r.to, r.from]));
const withCoords = [];
const noCoords = [];
const missing = [];

for (const p of j.query?.pages || []) {
  const from = redirects[p.title];
  const label = from ? `${p.title} (←${from})` : p.title;
  if (p.missing) { missing.push(label); continue; }
  const c = p.coordinates?.[0];
  if (c) withCoords.push({ title: p.title, from: from ?? null, lat: c.lat, lng: c.lon, label });
  else noCoords.push(label);
}

console.log(`■ 座標あり (${withCoords.length}件) — OSM照合へ進める`);
for (const w of withCoords) console.log(`  ${w.label.padEnd(28)} ${w.lat.toFixed(5)},${w.lng.toFixed(5)}`);
console.log(`\n■ 記事はあるが座標なし (${noCoords.length}件) — 2ソース照合不可なので不採用`);
console.log('  ' + noCoords.join(' / '));
console.log(`\n■ 記事なし (${missing.length}件)`);
console.log('  ' + missing.join(' / '));
