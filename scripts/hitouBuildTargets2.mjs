#!/usr/bin/env node
/**
 * hitouBuildTargets2.mjs — 第2バッチの通過候補に画像クエリを付け、逆ジオコーディングで裏取りする。
 * 候補同士が近接したペアの敗者と、照合が緩い候補・命名を誤った候補はここで落とす。
 */
import fs from 'fs';
const UA = { 'User-Agent': 'DokoIko-DataAudit/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const DROP = new Set([
  'ougama',      // 蟹場温泉と0.68km（乳頭温泉郷内）
  'nakanosawa',  // 沼尻温泉と1.47km
  'kutsukake',   // 田沢温泉と2.24km
  'iyagawa',     // 4.72kmと照合が緩い（祖谷温泉と新祖谷温泉の取り違えの疑い）
  'fudoki',      // 候補名「不忘閣」に対しWikipediaは青根温泉。名称の対応が取れていない
]);

const META = {
  'horoka':       { q: 'Horoka Onsen Kamishihoro',   w: ['幌加', '上士幌', 'Horoka'] },
  'sugo':         { q: 'Sugo Onsen Nishiwaga',       w: ['巣郷', '西和賀', 'Sugo'] },
  'osawa-onsen':  { q: 'Osawa Onsen Hanamaki',       w: ['大沢温泉', '花巻', 'Osawa', 'Hanamaki'] },
  'yubama':       { q: 'Yubama Onsen Kurihara',      w: ['湯浜', '栗原', 'Yubama'] },
  'kanigasaki':   { q: 'Kanibaonsen Nyuto',          w: ['蟹場', '乳頭', '仙北', 'Kaniba', 'Nyuto'] },
  'utto':         { q: 'Uttou Onsen Kitaakita',      w: ['打当', '北秋田', '阿仁', 'Uttou'] },
  'tainai':       { q: 'Yunosawa Onsen Nishikawa',   w: ['湯の沢', '西川', 'Yunosawa'] },
  'seorasou':     { q: 'Semi Onsen Mogami',          w: ['瀬見', '最上', 'Semi'] },
  'numajiri':     { q: 'Numajiri Onsen Inawashiro',  w: ['沼尻', '猪苗代', 'Numajiri'] },
  'tsuchiyu':     { q: 'Tsuchiyu Onsen Fukushima',   w: ['土湯', '福島', 'Tsuchiyu'] },
  'yunohana-fk':  { q: 'Yunohana Onsen Minamiaizu',  w: ['湯ノ花', '南会津', 'Yunohana'] },
  'teshirosawa':  { q: 'Teshirosawa Onsen Nikko',    w: ['手白沢', '奥鬼怒', '日光', 'Teshirosawa'] },
  'nishizawa':    { q: 'Nishizawa Valley Yamanashi', w: ['西沢渓谷', '山梨', 'Nishizawa'] },
  'tsukiyono':    { q: 'Yujuku Onsen Minakami',      w: ['湯宿', 'みなかみ', 'Yujuku'] },
  'kawaura':      { q: 'Kawaura Onsen Yamanashi',    w: ['川浦', '三富', '山梨', 'Kawaura'] },
  'kusatsu-sainokawara': { q: 'Outoku Onsen Nakanojo', w: ['応徳', '中之条', '六合', 'Outoku'] },
  'tsubame-onsen':{ q: 'Tsubame Onsen Myoko',        w: ['燕温泉', '妙高', 'Tsubame', 'Myoko'] },
  'tazawa-nagano':{ q: 'Tazawa Onsen Aoki Nagano',   w: ['田沢温泉', '青木村', 'Tazawa', 'Aoki'] },
  'hirayu':       { q: 'Shinhotaka Onsen Okuhida',   w: ['新穂高', '奥飛騨', '高山', 'Shinhotaka'] },
  'tochio':       { q: 'Tochio Onsen Okuhida',       w: ['栃尾', '奥飛騨', 'Tochio'] },
  'shimobe':      { q: 'Shimobe Onsen Minobu',       w: ['下部', '身延', 'Shimobe', 'Minobu'] },
  'yumata':       { q: 'Yumata Onsen Omachi',        w: ['湯俣', '大町', 'Yumata', 'Omachi'] },
  'kamikitayama': { q: 'Shionoha Onsen Kawakami Nara', w: ['入之波', '川上村', '奈良', 'Shionoha'] },
  'iwai-tottori': { q: 'Iwai Onsen Iwami Tottori',   w: ['岩井温泉', '岩美', '鳥取', 'Iwai'] },
  'misasa2':      { q: 'Sekigane Onsen Kurayoshi',   w: ['関金', '倉吉', 'Sekigane'] },
  'yuki-hiroshima': { q: 'Yuki Onsen Hiroshima',     w: ['湯来', '広島', 'Yuki'] },
  'motoyu-shikoku': { q: 'Hontani Onsen Saijo Ehime', w: ['本谷', '西条', '愛媛', 'Hontani'] },
};

const cands = JSON.parse(fs.readFileSync('logs/hitou_candidates2.json', 'utf8'));
const passed = cands.filter((c) => c.pass && !DROP.has(c.id));
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
fs.writeFileSync('logs/hitou_targets2.json', JSON.stringify(targets, null, 2));
console.log(`\n逆引き通過 ${targets.length} / ${passed.length}件 → logs/hitou_targets2.json`);
