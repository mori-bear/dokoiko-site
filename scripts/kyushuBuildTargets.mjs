#!/usr/bin/env node
/**
 * kyushuBuildTargets.mjs — 座標ゲートを通った候補(logs/kyushu_candidates3.json の pass)に
 * 画像検索クエリと地名キーワードを付けて logs/kyushu_targets.json を作る。
 * localityWords は commonsPlaceCheck が「自県の言及がなくても地名で裏が取れる」判定に使う。
 */
import fs from 'fs';

const META = {
  'sujiyu-onsen':     { imageQuery: 'Sujiyu Onsen Kokonoe',        localityWords: ['筋湯', '九重', 'Kokonoe', 'Sujiyu'] },
  'hosenji-onsen':    { imageQuery: 'Hosenji Onsen Kokonoe Oita',  localityWords: ['宝泉寺', '九重', 'Kokonoe', 'Hosenji'] },
  'yunohira-onsen':   { imageQuery: 'Yunohira Onsen Yufu',         localityWords: ['湯平', '由布', 'Yufu', 'Yunohira'] },
  'hagenoyu-onsen':   { imageQuery: 'Hagenoyu Onsen Oguni Kumamoto', localityWords: ['はげの湯', '峐の湯', 'わいた', '小国', 'Oguni', 'Waita'] },
  'hinagu-onsen':     { imageQuery: 'Hinagu Onsen Yatsushiro',     localityWords: ['日奈久', '八代', 'Yatsushiro', 'Hinagu'] },
  'yunotsuru-onsen':  { imageQuery: 'Yunotsuru Onsen Minamata',    localityWords: ['湯の鶴', '水俣', 'Minamata', 'Yunotsuru'] },
  'tsuetate-onsen':   { imageQuery: 'Tsuetate Onsen',              localityWords: ['杖立', '小国', 'Oguni', 'Tsuetate'] },
  'funagoya-onsen':   { imageQuery: 'Funagoya Onsen Chikugo',      localityWords: ['船小屋', '筑後', 'Chikugo', 'Funagoya'] },
  'kumanokawa-onsen': { imageQuery: 'Kumanokawa Onsen Saga',       localityWords: ['熊の川', '富士町', '佐賀', 'Kumanokawa'] },
  'furuyu-onsen':     { imageQuery: 'Furuyu Onsen Saga',           localityWords: ['古湯', '富士町', '佐賀', 'Furuyu'] },
  'hinokage-onsen':   { imageQuery: 'Hinokage Onsen Station Miyazaki', localityWords: ['日之影', 'Hinokage'] },
};

const cands = JSON.parse(fs.readFileSync('logs/kyushu_candidates3.json', 'utf8'));
const targets = cands.filter((c) => c.pass).map((c) => {
  const m = META[c.id];
  if (!m) throw new Error(`META未定義: ${c.id}`);
  return { id: c.id, name: c.name, prefecture: c.prefecture, lat: c.lat, lng: c.lng, ...m };
});
fs.writeFileSync('logs/kyushu_targets.json', JSON.stringify(targets, null, 2));
console.log(`targets ${targets.length}件 → logs/kyushu_targets.json`);
for (const t of targets) console.log(`  ${t.id.padEnd(20)} ${t.name} (${t.prefecture}) ${t.lat},${t.lng}`);
