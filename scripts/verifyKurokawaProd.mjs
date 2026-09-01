#!/usr/bin/env node
/** verifyKurokawaProd.mjs — 本番の黒川温泉ページで、誤画像が消えクレジットが出ているか見る。 */
const SITE = 'https://tabidokoiko.com';
const get = async (p) => (await fetch(SITE + p, { headers: { 'User-Agent': 'DokoIko-Verify/1.0' } })).text();

const html = await get('/destinations/kurokawa-k/');
console.log('■ 黒川温泉（本番）');
console.log(`  ハナミズキ画像(Benthamidia) の残存 : ${html.includes('Benthamidia') ? '❌ まだある' : '✅ なし'}`);
console.log(`  フサスグリ画像(/spots/kurokawa-k/) : ${html.includes('/images/spots/kurokawa-k/') ? '❌ まだある' : '✅ なし'}`);
for (const m of html.match(/<figcaption class="spot-credit"[\s\S]*?<\/figcaption>/g) || []) {
  console.log(`  クレジット: ${m.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()}`);
}
for (const [label, path, needle] of [
  ['新穂高ロープウェイのロゴ', '/destinations/takayama-2/', 'Shinhotaka_Ropeway_logo'],
  ['福地温泉の起伏図',        '/destinations/takayama-2/', 'relief_location_map'],
  ['仁淀川に四万十川の写真',   '/destinations/kochi-ino/',  'Shimanto_River_And_Iwama'],
]) {
  const h = await get(path);
  console.log(`  ${label.padEnd(16)} : ${h.includes(needle) ? '❌ まだある' : '✅ なし'}`);
}
