#!/usr/bin/env node
/** qaHitouDestinations.mjs — 全国に追加した秘湯destinationの機械チェック（九州版と同じ観点）。 */
import fs from 'fs';

const NEW = ['namari-onsen', 'geto-onsen', 'matsukawa-iwate', 'gaga-onsen', 'kuroyu', 'doroyu',
  'tokusa', 'kaikake', 'nakabusa', 'kuronagi', 'nigorigo', 'nishiyama-yama', 'umegashima',
  // 第2バッチ
  'horoka', 'osawa-onsen', 'yubama', 'kanigasaki', 'utto', 'seorasou', 'yunohana-fk',
  'tsubame-onsen', 'yumata', 'kamikitayama', 'iwai-tottori', 'misasa2', 'yuki-hiroshima'];
const d = JSON.parse(fs.readFileSync('src/data/destinations.json', 'utf8'));
const byId = Object.fromEntries(d.map((x) => [x.id, x]));

// [南限,北限,西限,東限]
const PREF_BOX = {
  '岩手県': [38.7, 40.5, 140.6, 142.1], '宮城県': [37.7, 39.0, 140.2, 141.7],
  '秋田県': [38.8, 40.6, 139.6, 141.1], '福島県': [36.7, 38.0, 139.1, 141.1],
  '新潟県': [36.7, 38.6, 137.6, 139.9], '長野県': [35.1, 37.1, 137.3, 138.8],
  '富山県': [36.2, 36.99, 136.7, 137.8], '岐阜県': [35.1, 36.5, 136.2, 137.7],
  '山梨県': [35.1, 35.98, 138.2, 139.2], '静岡県': [34.5, 35.7, 137.4, 139.2],
  '北海道': [41.3, 45.6, 139.3, 146.0], '山形県': [37.7, 39.2, 139.5, 140.7],
  '奈良県': [33.8, 34.8, 135.6, 136.2], '鳥取県': [35.0, 35.7, 133.1, 134.5],
  '広島県': [34.0, 35.1, 132.0, 133.5],
};

let ng = 0;
const fail = (id, m) => { console.log(`  ❌ ${byId[id]?.name ?? id}: ${m}`); ng++; };

console.log(`■ 全国秘湯 新規${NEW.length}件のQA`);
for (const id of NEW) {
  const x = byId[id];
  if (!x) { fail(id, 'destinations.json に存在しない'); continue; }
  if (d.filter((v) => v.id === id).length > 1) fail(id, 'id重複');
  if (!fs.existsSync(`public/images/${id}/main.jpg`)) fail(id, 'main.jpg が無い');
  for (const p of x.images || []) if (!fs.existsSync('public' + p)) fail(id, `画像ファイル欠損 ${p}`);

  const b = PREF_BOX[x.prefecture];
  if (!b) fail(id, `想定外の都道府県 ${x.prefecture}`);
  else if (!(x.lat >= b[0] && x.lat <= b[1] && x.lng >= b[2] && x.lng <= b[3])) fail(id, `座標が県の範囲外 ${x.lat},${x.lng}`);

  for (const k of ['name', 'description', 'tags', 'spots', 'prefecture', 'lat', 'lng', 'railGateway',
    'hotelSearch', 'travelTime', 'hotelLinks', 'imageCredit', 'catch', 'mainSpot', 'city'])
    if (x[k] == null || (Array.isArray(x[k]) && !x[k].length)) fail(id, `${k} が空`);

  if (x.description.length < 200 || x.description.length > 300) fail(id, `description ${x.description.length}字`);
  (x.spots || []).forEach((s) => {
    if (s.description.length < 40 || s.description.length > 80) fail(id, `spot「${s.name}」${s.description.length}字`);
  });
  if ((x.spots || []).length !== 3) fail(id, `spots ${x.spots?.length}件`);

  const sib = d.find((v) => v.prefecture === x.prefecture && !NEW.includes(v.id) && v.hotelLinks?.jalan);
  if (sib && sib.hotelLinks.jalan !== x.hotelLinks.jalan) fail(id, `jalanリンクが同県既存と不一致`);

  if (!x.imageCredit?.url?.startsWith('https://commons.wikimedia.org/')) fail(id, 'imageCredit.url が Commons でない');
  if (!x.imageCredit?.license || x.imageCredit.license === 'unknown') fail(id, `ライセンス不明 (${x.imageCredit?.license})`);
  if (Object.keys(x.travelTime || {}).length < 5) fail(id, `travelTime が ${Object.keys(x.travelTime || {}).length}都市しかない`);
}
console.log(ng ? `\nNG ${ng}件` : '\n✅ 全項目パス');
console.log(`\n総件数 ${d.length}`);
process.exit(ng ? 1 : 0);
