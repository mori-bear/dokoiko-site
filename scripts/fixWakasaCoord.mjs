#!/usr/bin/env node
/**
 * fixWakasaCoord.mjs — 若桜町商店街(niche_鳥取_2)の座標を若桜駅前に直す。
 *
 * 登録値 35.339962, 134.4010412 は国土地理院の地名検索が返す「鳥取県若桜」の
 * 代表点（35.340157, 134.401016）とほぼ同じで、商店街の中心である若桜駅から
 * 639m南東にずれていた。地図リンクがこの点を指すため、商店街とは無関係な
 * 施設の近くに着地していた。
 *
 * 正しい値は wikipedia(35.345222, 134.398272) と wikidata(35.345200, 134.398000)
 * が25m以内で一致した若桜駅。このエントリの mapPoint も「若桜鉄道旧駅舎・
 * 蒸気機関車」なので、駅前を指すのが妥当。
 */
import fs from 'fs';
const DATA = ['src/data/destinations.json', 'public/data/destinations.json'];
const ID = 'niche_鳥取_2';
const LAT = 35.345211, LNG = 134.398136;

for (const f of DATA) {
  const all = JSON.parse(fs.readFileSync(f, 'utf8'));
  const d = all.find((x) => x.id === ID);
  if (!d) throw new Error(`${ID} が無い: ${f}`);
  if (f === DATA[0]) {
    const km = Math.hypot((d.lat - LAT) * 111, (d.lng - LNG) * 111 * Math.cos((d.lat * Math.PI) / 180));
    console.log(`${d.name}: ${d.lat}, ${d.lng} → ${LAT}, ${LNG}（${(km * 1000).toFixed(0)}m 移動）`);
  }
  d.lat = LAT; d.lng = LNG;
  fs.writeFileSync(f, JSON.stringify(all, null, 2) + '\n');
}
