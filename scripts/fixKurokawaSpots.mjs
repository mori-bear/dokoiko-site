#!/usr/bin/env node
/**
 * fixKurokawaSpots.mjs — 黒川温泉(kurokawa-k)の spot 画像とクレジットを直す。
 *
 * 直す前の状態:
 *   ・「山みず木」の画像が Benthamidia_florida7.jpg（ハナミズキの花）＝完全な誤採用
 *   ・「山河」の画像が /images/spots/kurokawa-k/2.jpg（フサスグリの実）＝これも誤採用
 *   ・「入湯手形」「山みず木」の imageCredit.url が、実際に使っている画像とは
 *     別のファイル（黒川温泉_(268553622).jpg）を指していた
 *   ・「九重夢大吊橋」は CC BY-SA 3.0 なのに imageCredit 自体が無かった
 *
 * 山みず木・山河はどちらも実在の宿だが、Commons に該当する写真が無い
 * （Category:Kurokawa Onsen (Kumamoto) 全33件を確認済み。山みず木はバナー画像
 *  2100x300 が1枚あるだけで、spot画像の比率に耐えない）。
 * 宿名の見出しに別の宿の写真を当てるのは誤表示なので、見出しを写真の被写体に
 * 合わせて改め、宿名は本文に残す。
 *
 * クレジットは Commons API から実ファイルの extmetadata を取り直して埋める。
 */
import fs from 'fs';

const UA = { 'User-Agent': 'DokoIko-DataAudit/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const DATA = ['src/data/destinations.json', 'public/data/destinations.json'];

// 使うファイル（すべて2段階Vision通過＋目視確認済み）
const FILES = {
  token:  'File:入湯手形 - flickr 4114375901 52b8e4aec0 o.jpg',   // 入湯手形の実物
  roten:  'File:Kurokawa-onsen.jpg',                              // 茅葺きの湯小屋と岩風呂
  akari:  'File:Kurokawa-Onsen Light-up.jpg',                     // 田の原川の湯あかり
  bridge: 'File:Kokonoe Dream Big Suspension Bridge Oita,JAPAN.jpg',
};

const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json`
  + `&titles=${encodeURIComponent(Object.values(FILES).join('|'))}`
  + `&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=500`;
const j = await (await fetch(api, { headers: UA })).json();

const info = {};
for (const p of Object.values(j.query.pages)) {
  const ii = p.imageinfo?.[0];
  if (!ii) throw new Error(`Commonsに存在しない: ${p.title}`);
  const em = ii.extmetadata || {};
  // thumburl は thumb.wikimedia.org + utm付きで返ることがある。既存データに合わせて
  // upload.wikimedia.org の素のURLに正規化する。
  const thumb = String(ii.thumburl).split('?')[0].replace('//thumb.wikimedia.org/', '//upload.wikimedia.org/');
  info[p.title] = {
    url: thumb,
    credit: {
      // Artist に撮影機材の注記が続くことがあるので、著作者名の部分だけ取る。
      author: (em.Artist?.value || '').replace(/<[^>]*>/g, '').split(/\n|This photo was taken/)[0]
        .replace(/\s+/g, ' ').trim() || 'unknown',
      license: em.LicenseShortName?.value || 'unknown',
      url: ii.descriptionurl,                         // 実際に使っているファイルのページを指す
      attributionRequired: !/^(CC0|Public domain)/i.test(em.LicenseShortName?.value || ''),
    },
  };
}
const pick = (k) => info[FILES[k]];

// spot名は src/data/articles/kurokawa-k.json のセクション見出しと突き合わせて
// 画像を出す作りなので、見出しに使われている宿名のまま据え置く。
// 山みず木・山河は Category:Kurokawa Onsen (Kumamoto) 全33件を見ても写真が無く
// （山みず木は 2100x300 のバナーが1枚あるだけで spot の比率に耐えない）、
// 別の宿の湯を宿名の見出しに当てるのは誤表示になるため、画像なしにする。
const SPOTS = [
  {
    name: '入湯手形',
    description: '湯の香りが染みた木札を手に、山里の湯三か所をめぐれる黒川温泉名物。手のひらの木の温もりが旅の記憶になる。',
    ...pick('token'),
  },
  {
    name: '山みず木',
    description: '川沿いの露天風呂が名物の宿。岩の間から湯が湧き、すぐ横を田の原川が流れる。川との距離は2メートルもない。',
    url: null, credit: null,
  },
  {
    name: '山河',
    description: '阿蘇外輪山の深い緑に抱かれた宿。谷を渡る風と木立に溶ける湯気、山と川の景色そのものを名に持つ湯を楽しめる。',
    url: null, credit: null,
  },
  {
    name: '九重夢大吊橋',
    description: '黒川温泉から車で約30分。長さ390m・高さ173m、日本一の高さを誇る歩行者専用の吊り橋を渡れる。',
    ...pick('bridge'),
  },
];
const toSpot = (s) => s.url
  ? { name: s.name, description: s.description, imageUrl: s.url, imageCredit: s.credit }
  : { name: s.name, description: s.description };

for (const f of DATA) {
  const all = JSON.parse(fs.readFileSync(f, 'utf8'));
  const d = all.find((x) => x.id === 'kurokawa-k');
  if (!d) throw new Error(`kurokawa-k が無い: ${f}`);
  d.spots = SPOTS.map(toSpot);
  fs.writeFileSync(f, JSON.stringify(all, null, 2));
  console.log(`更新 ${f}`);
}

console.log('\n■ 差し替え後の spot');
for (const s of SPOTS) {
  console.log(`  ${s.name}`);
  if (!s.url) { console.log('     画像なし（Commonsに該当写真が存在しない）'); continue; }
  console.log(`     ${s.url}`);
  console.log(`     ${s.credit.author} / ${s.credit.license} / 表示義務=${s.credit.attributionRequired}`);
  console.log(`     ${s.credit.url}`);
}
