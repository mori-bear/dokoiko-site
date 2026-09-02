#!/usr/bin/env node
/**
 * fixAwaraCoord.mjs — あわら温泉(niche_福井_3)の座標を温泉街の中心に直す。
 *
 * 統合作業のときに 36.2146, 136.2351 を採ったが、これは誤りだった。
 * 当時「wikipediaの点だけが西にずれており、OSMの厳密一致点が既存値に近い」と
 * 判断したが、逆だった。
 *
 *   元の登録値 36.2113858, 136.2291611
 *     → 国土地理院の「福井県あわら市」代表点(36.211388, 136.228897)とほぼ同じ。
 *       市の代表点であって温泉街ではない。温泉街から3.4km。
 *   統合時に入れた値 36.2146, 136.2351
 *     → OSMが「芦原温泉」で返した点。温泉街から約3.5km。
 *   正しい値 36.225, 136.194444
 *     → wikipedia「芦原温泉」とwikidata Q11614796 が0m一致。
 *       OSMの「芦湯(足湯)」36.223834,136.192625 とも208m。
 *       あわら湯のまち駅前の温泉街そのもの。
 *
 * このエントリの mapPoint は「芦湯」なので、駅前を指すのが正しい。
 */
import fs from 'fs';
const DATA = ['src/data/destinations.json', 'public/data/destinations.json'];
const ID = 'niche_福井_3';
const LAT = 36.225, LNG = 136.194444;

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
