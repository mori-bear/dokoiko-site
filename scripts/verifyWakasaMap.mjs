#!/usr/bin/env node
/**
 * verifyWakasaMap.mjs — 本番の若桜町商店街ページで、地図リンクの着地点を確かめる。
 *   ・ページ内の地図リンクから座標を取り出す
 *   ・その座標を逆ジオコーディングして、若桜駅前を指しているか見る
 *   ・修正前の座標が何を指していたかも並べて比べる
 */
const UA = { 'User-Agent': 'DokoIko-Verify/1.0 (tabidokoiko.com)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const km = (a, b, c, d) => Math.hypot((a - c) * 111, (b - d) * 111 * Math.cos((a * Math.PI) / 180));

const html = await (await fetch('https://tabidokoiko.com/destinations/' + encodeURIComponent('niche_鳥取_2') + '/', { headers: UA })).text();
const links = [...html.matchAll(/https:\/\/www\.google\.com\/maps\/[^"]*/g)].map((m) => m[0].replace(/&#38;/g, '&'));
const coords = new Set();
for (const l of links) {
  const a = decodeURIComponent(l).match(/@(-?[\d.]+),(-?[\d.]+)/);
  const b = decodeURIComponent(l).match(/query=(-?[\d.]+)[, ](-?[\d.]+)/);
  const c = decodeURIComponent(l).match(/destination=(-?[\d.]+)[, ](-?[\d.]+)/);
  for (const m of [a, b, c]) if (m) coords.add(`${m[1]},${m[2]}`);
}
console.log(`■ 本番ページの地図リンク ${links.length}本 / 座標 ${coords.size}種`);
for (const c of coords) console.log(`   ${c}`);

async function rev(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=18&addressdetails=1&accept-language=ja`;
  const j = await (await fetch(url, { headers: UA })).json();
  await sleep(1200);
  return j.display_name || '取得できず';
}
async function near(lat, lng) {
  // その座標の周囲200mにある名前つき地物を拾う
  const d = 0.0018;
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=8&accept-language=ja`
    + `&viewbox=${lng - d},${lat + d},${lng + d},${lat - d}&bounded=1&q=*`;
  try {
    const rows = await (await fetch(url, { headers: UA })).json();
    await sleep(1200);
    return rows.map((x) => (x.display_name || '').split(',')[0]).filter(Boolean).slice(0, 6);
  } catch { return []; }
}

const OLD = [35.339962, 134.4010412];
const NEW = [35.345211, 134.398136];
console.log(`\n■ 修正前 ${OLD.join(', ')}`);
console.log(`   逆引き: ${await rev(...OLD)}`);
console.log(`\n■ 修正後 ${NEW.join(', ')}`);
console.log(`   逆引き: ${await rev(...NEW)}`);
console.log(`\n   2点の距離: ${(km(OLD[0], OLD[1], NEW[0], NEW[1]) * 1000).toFixed(0)}m`);

const shown = [...coords][0]?.split(',').map(Number);
if (shown) {
  const gap = km(shown[0], shown[1], NEW[0], NEW[1]) * 1000;
  console.log(`\n   ${gap < 10 ? '✅' : '❌'} 本番のリンク座標は修正後の値と ${gap.toFixed(0)}m 差`);
}
