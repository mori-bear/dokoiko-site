#!/usr/bin/env node
/**
 * qaKyushuDestinations.mjs — 九州に追加した新規destinationの機械チェック。
 * qaNewDestinations.mjs（首都圏版）と同じ観点を九州の県域に置き換えたもの。
 */
import fs from 'fs';

const NEW = ['kannojigoku', 'yunohira-onsen', 'hagenoyu-onsen', 'yunotsuru-onsen', 'tsuetate-onsen',
  'funagoya-onsen', 'kumanokawa-onsen', 'furuyu-onsen', 'hinokage-onsen'];
const d = JSON.parse(fs.readFileSync('src/data/destinations.json', 'utf8'));
const byId = Object.fromEntries(d.map((x) => [x.id, x]));

// [南限,北限,西限,東限] おおよその県域（座標が県外へ飛んでいないかの粗い確認）
const PREF_BOX = {
  '福岡県': [33.0, 34.0, 130.0, 131.2], '佐賀県': [32.9, 33.6, 129.7, 130.5],
  '長崎県': [32.5, 34.8, 128.5, 130.4], '熊本県': [32.1, 33.3, 129.9, 131.3],
  '大分県': [32.7, 33.8, 130.8, 132.1], '宮崎県': [31.3, 32.9, 130.7, 131.9],
  '鹿児島県': [27.0, 32.2, 128.3, 131.2],
};

let ng = 0;
const fail = (id, m) => { console.log(`  ❌ ${byId[id]?.name ?? id}: ${m}`); ng++; };

console.log(`■ 九州 新規${NEW.length}件のQA`);
for (const id of NEW) {
  const x = byId[id];
  if (!x) { fail(id, 'destinations.json に存在しない'); continue; }
  if (d.filter((v) => v.id === id).length > 1) fail(id, 'id重複');

  // 画像
  if (!fs.existsSync(`public/images/${id}/main.jpg`)) fail(id, 'main.jpg が無い');
  for (const p of x.images || []) if (!fs.existsSync('public' + p)) fail(id, `画像ファイル欠損 ${p}`);
  (x.spots || []).forEach((s, i) => {
    const has = !!s.imageUrl, file = fs.existsSync(`public/images/${id}/spot-${i + 1}.jpg`);
    if (has !== file) fail(id, `spot-${i + 1} の imageUrl とファイルが不一致 (url=${has} file=${file})`);
  });

  // 座標
  const b = PREF_BOX[x.prefecture];
  if (!b) fail(id, `想定外の都道府県 ${x.prefecture}`);
  else if (!(x.lat >= b[0] && x.lat <= b[1] && x.lng >= b[2] && x.lng <= b[3])) fail(id, `座標が県の範囲外 ${x.lat},${x.lng}`);

  // 必須フィールド
  for (const k of ['name', 'description', 'tags', 'spots', 'prefecture', 'lat', 'lng', 'railGateway',
    'hotelSearch', 'travelTime', 'hotelLinks', 'imageCredit', 'catch', 'mainSpot', 'featured_stay'])
    if (x[k] == null || (Array.isArray(x[k]) && !x[k].length)) fail(id, `${k} が空`);

  // 文字数
  if (x.description.length < 200 || x.description.length > 300) fail(id, `description ${x.description.length}字`);
  (x.spots || []).forEach((s) => {
    if (s.description.length < 40 || s.description.length > 80) fail(id, `spot「${s.name}」${s.description.length}字`);
  });
  if ((x.spots || []).length !== 3) fail(id, `spots ${x.spots?.length}件`);

  // 宿リンクは同県の既存と一致していること（アフィリIDや県コードの自作を防ぐ）
  const sib = d.find((v) => v.prefecture === x.prefecture && !NEW.includes(v.id) && v.hotelLinks?.jalan);
  if (sib && sib.hotelLinks.jalan !== x.hotelLinks.jalan) fail(id, `jalanリンクが同県既存と不一致 (${x.hotelLinks.jalan} vs ${sib.hotelLinks.jalan})`);

  // クレジット
  if (!x.imageCredit?.url?.startsWith('https://commons.wikimedia.org/')) fail(id, 'imageCredit.url が Commons でない');
  if (!x.imageCredit?.license || x.imageCredit.license === 'unknown') fail(id, `ライセンス不明 (${x.imageCredit?.license})`);

  // featured_stay は一軒宿/代表宿の実名であること（プレースホルダ混入の検出）
  if (/^(宿|旅館|ホテル)$/.test(x.featured_stay?.name || '')) fail(id, 'featured_stay.name が汎用語');
}

console.log(ng ? `\nNG ${ng}件` : '\n✅ 全項目パス');

console.log('\n■ 追加後の九州県別件数');
for (const p of ['福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県'])
  console.log(`  ${p} ${d.filter((v) => v.prefecture === p).length}件`);
console.log(`  総件数 ${d.length}`);
process.exit(ng ? 1 : 0);
