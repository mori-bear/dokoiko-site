#!/usr/bin/env node
/**
 * fixNicheCoords2.mjs — 2回目の照合で誤りが確定した座標を直す。
 *
 * 奥大井湖上駅(niche_静岡_6)  16.2km
 *   登録値は川根本町上長尾（町の中心部）。駅はダム湖に架かる橋の上にあり、
 *   wikipedia と wikidata Q7082786 が19m一致した 35.167874, 138.180856 が正しい。
 *
 * 藍住町(niche_徳島_4)  1.5km
 *   登録値は藍住町奥野。mapPointは「藍の館」で、
 *   wikipedia と wikidata Q11622548 が0m一致した 34.115611, 134.482278 が正しい。
 *
 * 湯村温泉・荒湯地獄(niche_兵庫_2)  8.1km
 *   登録値は新温泉町浜坂で、これは海沿いの別地区。湯村温泉は内陸の「湯」地区。
 *   OSMの「荒湯」34.554868… ではなく 35.554868, 134.488098 が正しく、
 *   別途追加済みの湯村温泉(yumura-hyogo 35.55245, 134.489)とも270m。
 *   ※ 直すと湯村温泉と近接するが、niche_系は tier=spot で area エントリと
 *     共存する設計（琴平とこんぴら温泉と同じ関係）なので併存させる。
 *
 * 武庫川渓谷(niche_兵庫_1)  8.2km
 *   登録値は三田市中央町で、これは武庫川の上流の市街地。
 *   渓谷（廃線敷ハイキングコース）の起点は武田尾駅で、
 *   wikipedia と wikidata Q856446 が115m一致した 34.855582, 135.306031。
 *
 * 手を付けなかったもの（裏が取れなかった／登録値が妥当）:
 *   磯原漁港    登録値は磯原町本町。磯原駅から1.4kmで市街地の中。致命的でない
 *   寄居町の荒川渓谷 登録値は玉淀河原付近で妥当。玉淀ダムは上流の別地点
 *   能勢白滝    能勢町の代表点。白滝の位置を裏付ける情報が得られなかった
 *   南部町・湯船温泉 南部町の代表点。湯船温泉の位置を裏付ける情報が得られなかった
 */
import fs from 'fs';
const DATA = ['src/data/destinations.json', 'public/data/destinations.json'];
const km = (a, b, c, d) => Math.hypot((a - c) * 111, (b - d) * 111 * Math.cos((a * Math.PI) / 180));

const FIX = {
  'niche_静岡_6': { lat: 35.167874, lng: 138.180856, why: '奥大井湖上駅（wikipedia×wikidata 19m）' },
  'niche_徳島_4': { lat: 34.115611, lng: 134.482278, why: '藍の館（wikipedia×wikidata 0m）' },
  'niche_兵庫_2': { lat: 35.554868, lng: 134.488098, why: '荒湯（OSM／湯村温泉エントリとも270m）' },
  'niche_兵庫_1': { lat: 34.855582, lng: 135.306031, why: '武田尾駅＝廃線敷の起点（wikipedia×wikidata 115m）' },
};

const base = JSON.parse(fs.readFileSync(DATA[0], 'utf8'));
for (const file of DATA) {
  const all = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const [id, f] of Object.entries(FIX)) {
    const d = all.find((x) => x.id === id);
    if (!d) { console.log(`⚠️ ${id} が無い`); continue; }
    if (file === DATA[0]) {
      const moved = km(d.lat, d.lng, f.lat, f.lng);
      const near = base.filter((x) => x.id !== id && typeof x.lat === 'number')
        .map((x) => ({ name: x.name, km: km(f.lat, f.lng, x.lat, x.lng) }))
        .filter((x) => x.km < 3).sort((a, b) => a.km - b.km);
      console.log(`${d.name}: ${d.lat}, ${d.lng} → ${f.lat}, ${f.lng}  (${moved.toFixed(2)}km移動)`);
      console.log(`   代表点: ${f.why}`);
      console.log(`   移動後3km以内: ${near.length ? near.map((x) => `${x.name}(${x.km.toFixed(2)}km)`).join(', ') : 'なし'}`);
    }
    d.lat = f.lat; d.lng = f.lng;
  }
  fs.writeFileSync(file, JSON.stringify(all, null, 2) + '\n');
}
