#!/usr/bin/env node
/**
 * gsiGeocodeTest.mjs — 国土地理院の地名検索APIが第2ソースとして使えるか試す。
 *
 * 動機: 無名な一軒宿の秘湯ほど ja.Wikipedia に座標が無く、2ソース照合ゲートで
 *   機械的に全滅する（九州回で判明した逆選抜）。Wikidataでも埋まらない穴が残った。
 *   国土地理院は日本の地名・施設名の公的な出典なので、これが引けるなら
 *   「Wikipedia任せ」をやめられる。
 * エンドポイント: https://msearch.gsi.go.jp/address-search/AddressSearch?q=<地名>
 *   GeoJSON風の配列を返し、geometry.coordinates は [経度, 緯度]。
 */
const UA = { 'User-Agent': 'DokoIko-DataAudit/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const QUERIES = [
  '柿木温泉', '島根県鹿足郡吉賀町柿木村柿木', 'はとの湯荘',
  '壁湯温泉', '川底温泉', '七里田温泉', '満願寺温泉', '湯川内温泉', '妙見温泉',
  '青荷温泉', '谷地温泉', '鶴の湯温泉',
];

for (const q of QUERIES) {
  try {
    const url = `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(q)}`;
    const r = await fetch(url, { headers: UA });
    if (!r.ok) { console.log(`✗ ${q.padEnd(24)} HTTP ${r.status}`); await sleep(400); continue; }
    const j = await r.json();
    if (!Array.isArray(j) || !j.length) { console.log(`✗ ${q.padEnd(24)} ヒットなし`); await sleep(400); continue; }
    const top = j.slice(0, 2).map((x) => {
      const [lng, lat] = x.geometry?.coordinates ?? [];
      return `${lat?.toFixed(5)},${lng?.toFixed(5)} 「${x.properties?.title}」`;
    });
    console.log(`✓ ${q.padEnd(24)} ${top.join('  |  ')}`);
  } catch (e) {
    console.log(`✗ ${q.padEnd(24)} ${String(e).slice(0, 50)}`);
  }
  await sleep(400);
}
