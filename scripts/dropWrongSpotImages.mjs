#!/usr/bin/env node
/**
 * dropWrongSpotImages.mjs — 黒川温泉の修正中に見つかった、明らかに中身が違う
 * spot 画像の imageUrl を外す。差し替え先が決まるまで、誤った写真を出し続けない
 * ことを優先する（画像なしの spot はレイアウトが対応済み）。
 *
 *   takayama-2 / 新穂高ロープウェイ  ロゴのSVG（風景でない）
 *   takayama-2 / 福地温泉          岐阜県の起伏図（地図・図表）
 *   kochi-ino  / 仁淀川カヌー体験    四万十川と岩間橋の写真。仁淀川ではない別の川
 */
import fs from 'fs';
const DATA = ['src/data/destinations.json', 'public/data/destinations.json'];
const DROP = [
  ['takayama-2', '新穂高ロープウェイ'],
  ['takayama-2', '福地温泉'],
  ['kochi-ino', '仁淀川カヌー体験'],
];
for (const f of DATA) {
  const all = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const [id, name] of DROP) {
    const d = all.find((x) => x.id === id);
    const s = (d?.spots || []).find((x) => x && x.name === name);
    if (!s) { console.log(`⚠️ 見つからない ${id}/${name}`); continue; }
    delete s.imageUrl; delete s.imageCredit;
    if (f === DATA[0]) console.log(`外した ${id}/${name}`);
  }
  fs.writeFileSync(f, JSON.stringify(all, null, 2));
}
