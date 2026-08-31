#!/usr/bin/env node
/**
 * hitouBuildTargets3.mjs — 第3バッチの通過候補に画像クエリを付け、逆ジオコーディングで裏取りする。
 * wikipedia×wikidata は出典が同根なので、OSMの行政界で市町村まで照合してから採用する。
 */
import fs from 'fs';
const UA = { 'User-Agent': 'DokoIko-DataAudit/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const META = {
  'sakakibara':   { q: 'Sakakibara Onsen Tsu Mie',        w: ['榊原', '津市', '三重', 'Sakakibara'] },
  'yunoyama':     { q: 'Yunoyama Onsen Komono Mie',       w: ['湯の山', '菰野', '御在所', 'Yunoyama', 'Komono'] },
  'ogoto':        { q: 'Ogoto Onsen Otsu Shiga',          w: ['雄琴', 'おごと', '大津', 'Ogoto', 'Otsu'] },
  'kutsukake-kyo':{ q: 'Yuhigaura Onsen Kyotango',        w: ['夕日ヶ浦', '京丹後', 'Yuhigaura', 'Kyotango'] },
  'inunakiyama':  { q: 'Inunakiyama Onsen Izumisano',     w: ['犬鳴', '泉佐野', 'Inunaki', 'Izumisano'] },
  'yumura-hyogo': { q: 'Yumura Onsen Shinonsen Hyogo',    w: ['湯村', '新温泉町', '荒湯', 'Yumura'] },
  'shioda':       { q: 'Shioda Onsen Himeji',             w: ['塩田', '姫路', 'Shioda', 'Himeji'] },
  'sumoto-onsen': { q: 'Sumoto Onsen Awaji',              w: ['洲本', '淡路', 'Sumoto', 'Awaji'] },
  'shikano':      { q: 'Shikano Onsen Tottori',           w: ['鹿野', '鳥取', 'Shikano'] },
  'togo':         { q: 'Togo Onsen Yurihama Tottori',     w: ['東郷', '湯梨浜', 'Togo', 'Yurihama'] },
  'yoshioka':     { q: 'Yoshioka Onsen Tottori',          w: ['吉岡', '鳥取', 'Yoshioka'] },
  'arifuku':      { q: 'Arifuku Onsen Gotsu Shimane',     w: ['有福', '江津', 'Arifuku', 'Gotsu'] },
  'yunokawa-shim':{ q: 'Yunokawa Onsen Izumo Shimane',    w: ['湯の川', '出雲', 'Yunokawa', 'Izumo'] },
  'sanbe':        { q: 'Sanbe Onsen Oda Shimane',         w: ['三瓶', '大田', 'Sanbe', 'Oda'] },
  'izumoyumura':  { q: 'Izumo Yumura Onsen Unnan',        w: ['湯村', '雲南', '木次', 'Yumura', 'Unnan'] },
  'yano-onsen':   { q: 'Yano Onsen Fuchu Hiroshima',      w: ['矢野', '府中', 'Yano', 'Fuchu'] },
  'ushiobara':    { q: 'Ushiobara Onsen Hatsukaichi',     w: ['潮原', '吉和', '廿日市', 'Ushiobara'] },
  'miyahama':     { q: 'Miyahama Onsen Hatsukaichi',      w: ['宮浜', '廿日市', 'Miyahama'] },
  'nagatoyumoto': { q: 'Nagato Yumoto Onsen',             w: ['長門湯本', '音信川', '長門', 'Yumoto', 'Nagato'] },
  'tawarayama':   { q: 'Tawarayama Onsen Nagato',         w: ['俵山', '長門', 'Tawarayama'] },
  'kawatana':     { q: 'Kawatana Onsen Shimonoseki',      w: ['川棚', '下関', 'Kawatana'] },
  'yumen':        { q: 'Yumen Onsen Nagato Yamaguchi',    w: ['湯免', '長門', '三隅', 'Yumen'] },
  'yuno-yamaguchi':{ q: 'Yuno Onsen Shunan Yamaguchi',    w: ['湯野', '周南', '徳山', 'Yuno'] },
  'tsukigatani':  { q: 'Tsukigatani Onsen Kamikatsu',     w: ['月ヶ谷', '上勝', 'Tsukigatani', 'Kamikatsu'] },
  'nibukawa':     { q: 'Nibukawa Onsen Imabari',          w: ['鈍川', '今治', 'Nibukawa', 'Imabari'] },
  'yunoura':      { q: 'Yunoura Onsen Imabari',           w: ['湯ノ浦', '今治', 'Yunoura', 'Imabari'] },
  'hatogayu':     { q: 'Hatogayu Onsen Ono Fukui',        w: ['鳩ヶ湯', '大野', '打波', 'Hatogayu'] },
  'chugu':        { q: 'Chugu Onsen Hakusan Ishikawa',    w: ['中宮', '白山', 'Chugu', 'Hakusan'] },
  'ichirino':     { q: 'Ichirino Onsen Hakusan Ishikawa', w: ['一里野', '白山', 'Ichirino', 'Hakusan'] },
  'tokigawa':     { q: 'Tokigawa Onsen Saitama',          w: ['都幾川', 'ときがわ', 'Tokigawa'] },
};

const cands = JSON.parse(fs.readFileSync('logs/hitou_candidates3.json', 'utf8'));
const passed = cands.filter((c) => c.pass);
const targets = [];
for (const c of passed) {
  const m = META[c.id];
  if (!m) { console.log(`⚠️ META未定義でスキップ: ${c.id} ${c.name}`); continue; }
  const j = await (await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${c.lat}&lon=${c.lng}&format=json&zoom=12&addressdetails=1`, { headers: UA })).json();
  await sleep(1200);
  const a = j.address || {};
  const city = a.city || a.town || a.village || a.county || a.municipality || '?';
  const pref = a.province || a.state || '?';
  const ok = pref === c.prefecture && city.includes(c.city.replace(/[市町村]$/, ''));
  console.log(`${ok ? '✅' : '⚠️ '} ${c.name.padEnd(12)} 逆引き=${pref}${city}  期待=${c.prefecture}${c.city}  ${c.verifiedBy.join('×')} ${c.distanceKm}km`);
  if (!ok) continue;
  targets.push({ id: c.id, name: c.name, prefecture: c.prefecture, city: c.city, lat: c.lat, lng: c.lng,
    verifiedBy: c.verifiedBy, distanceKm: c.distanceKm, imageQuery: m.q, localityWords: m.w });
}
fs.writeFileSync('logs/hitou_targets3.json', JSON.stringify(targets, null, 2));
console.log(`\n逆引き通過 ${targets.length} / ${passed.length}件 → logs/hitou_targets3.json`);
