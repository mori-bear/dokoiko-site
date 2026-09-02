#!/usr/bin/env node
/**
 * fixWideAreaCoords.mjs — 代表点が定まりにくかったエントリの座標を確定させる。
 *
 * 高野龍神スカイライン(niche_和歌山_6)
 *   登録値 34.333589, 135.546489 は逆引きすると橋本市高野口町上中。
 *   この道路は高野町から田辺市龍神へ抜ける全長42kmで、橋本市は通らない。
 *   起点からも約30km北で、道路上ですらなかった（cityも「上高野町」と誤記）。
 *   代表点は最大の見どころで中間地点でもある護摩壇山のごまさんスカイタワーとする。
 *   wikipedia と wikidata Q11641408 が0m一致した 34.061222, 135.564332。
 *   spots にも「ごまさんスカイタワー」があり、descriptionでも護摩壇山に触れている。
 *
 * 本山町(niche_高知_5)
 *   登録値 33.757972, 133.588844 は本山町の中心市街地。
 *   mapPoint と mainSpot は「早明浦ダム展望台」で、地図リンクはこの名前で
 *   検索するため、座標が3.5km離れていると別の範囲が映る。
 *   wikipedia と OSM が36m一致した早明浦ダム 33.756799, 133.550672 に合わせる。
 *
 * 触らないもの（調べた結果、登録値が妥当だった）:
 *   野迫川村   34.1667477, 135.6329753 → 北股上垣内。4ソースが5〜64mで一致
 *   月ヶ瀬     34.708483, 136.041699  → 月ヶ瀬尾山。wikipediaの梅林から240m
 *   あわら温泉  先に手作業で確定・修正済み
 */
import fs from 'fs';
const DATA = ['src/data/destinations.json', 'public/data/destinations.json'];
const km = (a, b, c, d) => Math.hypot((a - c) * 111, (b - d) * 111 * Math.cos((a * Math.PI) / 180));

const FIX = {
  'niche_和歌山_6': { lat: 34.061222, lng: 135.564332, why: 'ごまさんスカイタワー（護摩壇山）' },
  'niche_高知_5':   { lat: 33.756799, lng: 133.550672, why: '早明浦ダム' },
};

const base = JSON.parse(fs.readFileSync(DATA[0], 'utf8'));
for (const file of DATA) {
  const all = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const [id, f] of Object.entries(FIX)) {
    const d = all.find((x) => x.id === id);
    if (!d) { console.log(`⚠️ ${id} が無い`); continue; }
    if (file === DATA[0]) {
      const moved = km(d.lat, d.lng, f.lat, f.lng) * 1000;
      const near = base.filter((x) => x.id !== id && typeof x.lat === 'number')
        .map((x) => ({ name: x.name, km: km(f.lat, f.lng, x.lat, x.lng) }))
        .filter((x) => x.km < 3).sort((a, b) => a.km - b.km);
      console.log(`${d.name}: ${d.lat}, ${d.lng} → ${f.lat}, ${f.lng}`);
      console.log(`   ${(moved / 1000).toFixed(2)}km移動 / 代表点: ${f.why}`);
      console.log(`   移動後3km以内: ${near.length ? near.map((x) => `${x.name}(${x.km.toFixed(1)}km)`).join(', ') : 'なし'}`);
    }
    d.lat = f.lat; d.lng = f.lng;
  }
  fs.writeFileSync(file, JSON.stringify(all, null, 2) + '\n');
}
