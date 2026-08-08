#!/usr/bin/env node
/**
 * resolveCoords.mjs — 座標未設定/誤りの destination について
 * Wikipedia(ja) と OpenStreetMap Nominatim の2ソースで座標を取得し、
 * 両者が5km以内で一致した場合のみ採用候補として出力する（APIキー不要）。
 *
 * 出力: logs/resolved_coords.json（--apply で destinations.json に反映）
 */
import fs from 'fs';

const APPLY = process.argv.includes('--apply');
const UA = { 'User-Agent': 'DokoIko-DataAudit/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const km = (a, b, c, d) => Math.hypot((a - c) * 111, (b - d) * 111 * Math.cos(a * Math.PI / 180));

// id → [Wikipedia記事名, OSM検索語]
const TARGETS = {
  'niche_千葉_2':   ['養老渓谷', '養老渓谷 千葉県市原市'],
  'niche_東京_4':   ['奥多摩湖', '奥多摩湖 東京都奥多摩町'],
  'niche_富山_6':   ['五箇山', '五箇山 富山県南砺市'],
  'niche_長野_2':   ['馬籠宿', '馬籠宿 岐阜県中津川市'],
  'niche_滋賀_3':   ['永源寺', '永源寺 滋賀県東近江市'],
  'niche_滋賀_4':   ['五個荘町', '五個荘 滋賀県東近江市'],
  'niche_滋賀_6':   ['賤ヶ岳', '賤ヶ岳 滋賀県長浜市'],
  'niche_奈良_3':   ['月ヶ瀬梅林', '月ヶ瀬 奈良県奈良市'],
  'niche_山口_6':   ['須佐ホルンフェルス', '須佐ホルンフェルス 山口県萩市'],
  'niche_大分_3':   ['長湯温泉', '長湯温泉 大分県竹田市'],
  'niche_鹿児島_5': ['栗野岳温泉', '栗野岳 鹿児島県湧水町'],
  'niche_鹿児島_2': ['関之尾滝', '関之尾滝 宮崎県都城市'],
  'fukushima':      ['福島駅 (福島県)', '福島駅 福島県福島市'],
  'yamaguchi':      ['山口駅 (山口県)', '山口市 山口県'],
  'oita':           ['大分駅', '大分駅 大分県大分市'],
  'wakimachi':      ['脇町', 'うだつの町並み 徳島県美馬市'],
  'arimatsu':       ['有松 (名古屋市)', '有松 名古屋市緑区'],
  'asuke':          ['香嵐渓', '足助 愛知県豊田市'],
  'unno-juku':      ['海野宿', '海野宿 長野県東御市'],
  'yame':           ['八女市', '八女市 福岡県'],
  'takatori':       ['高取城', '高取町 奈良県'],
  'seki-juku':      ['関宿 (三重県)', '関宿 三重県亀山市'],
  'hiketa':         ['引田 (東かがわ市)', '引田 香川県東かがわ市'],
};

async function wiki(title) {
  try {
    const u = `https://ja.wikipedia.org/w/api.php?action=query&format=json&prop=coordinates&titles=${encodeURIComponent(title)}&redirects=1`;
    const j = await (await fetch(u, { headers: UA })).json();
    const c = Object.values(j.query?.pages || {})[0]?.coordinates?.[0];
    return c ? { lat: c.lat, lng: c.lon } : null;
  } catch { return null; }
}
async function osm(q) {
  try {
    const u = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&accept-language=ja&countrycodes=jp`;
    const j = await (await fetch(u, { headers: UA })).json();
    return j?.length ? { lat: +j[0].lat, lng: +j[0].lon, name: (j[0].display_name || '').slice(0, 60) } : null;
  } catch { return null; }
}

const D = JSON.parse(fs.readFileSync('src/data/destinations.json', 'utf8'));
const results = [];
for (const [id, [wt, oq]] of Object.entries(TARGETS)) {
  const d = D.find(x => x.id === id);
  if (!d) { console.log(`[${id}] ❌ destination なし`); continue; }
  const w = await wiki(wt); await sleep(350);
  const o = await osm(oq);  await sleep(1150);   // Nominatim は 1req/s

  let adopt = null, note = '';
  if (w && o) {
    const gap = km(w.lat, w.lng, o.lat, o.lng);
    if (gap <= 5) { adopt = { lat: +((w.lat + o.lat) / 2).toFixed(6), lng: +((w.lng + o.lng) / 2).toFixed(6) }; note = `2ソース一致(${gap.toFixed(1)}km)`; }
    else note = `⚠️ 2ソース乖離 ${gap.toFixed(1)}km（Wiki ${w.lat.toFixed(4)},${w.lng.toFixed(4)} / OSM ${o.lat.toFixed(4)},${o.lng.toFixed(4)}）`;
  } else if (w) { adopt = { lat: w.lat, lng: w.lng }; note = 'Wikipediaのみ'; }
  else if (o)   { adopt = { lat: o.lat, lng: o.lng }; note = 'OSMのみ'; }
  else note = '❌ 両ソース取得不可';

  const cur = (typeof d.lat === 'number') ? `${d.lat}, ${d.lng}` : 'null';
  const moved = (adopt && typeof d.lat === 'number') ? ` / 現在値と${Math.round(km(adopt.lat, adopt.lng, d.lat, d.lng))}km` : '';
  console.log(`[${id}] ${d.name}  現在:${cur}`);
  console.log(`     → ${adopt ? `${adopt.lat}, ${adopt.lng}` : '採用なし'}  ${note}${moved}`);
  results.push({ id, name: d.name, current: cur, adopt, note });
}

fs.mkdirSync('logs', { recursive: true });
fs.writeFileSync('logs/resolved_coords.json', JSON.stringify(results, null, 2));
const okCount = results.filter(r => r.adopt).length;
console.log(`\n採用可能 ${okCount} / ${results.length} 件`);

if (APPLY) {
  let n = 0;
  for (const r of results) {
    if (!r.adopt) continue;
    const d = D.find(x => x.id === r.id);
    d.lat = r.adopt.lat; d.lng = r.adopt.lng; n++;
  }
  fs.writeFileSync('src/data/destinations.json', JSON.stringify(D, null, 2));
  console.log(`✅ ${n}件を destinations.json に反映`);
}
