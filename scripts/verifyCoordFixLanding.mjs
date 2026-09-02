#!/usr/bin/env node
/**
 * verifyCoordFixLanding.mjs — 座標を直したページで、地図リンクの着地点を実測する。
 *   ・ビルド済みHTMLから地図リンクの座標を取り出す（データではなく出力を見る）
 *   ・修正前と修正後の座標をそれぞれ逆ジオコーディングして並べる
 * Nominatim は1秒1リクエストなので間隔を空ける。
 */
import fs from 'fs';
const UA = { 'User-Agent': 'DokoIko-Verify/1.0 (tabidokoiko.com)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const km = (a, b, c, d) => Math.hypot((a - c) * 111, (b - d) * 111 * Math.cos((a * Math.PI) / 180));

const verify = JSON.parse(fs.readFileSync('logs/niche_gap_verify.json', 'utf8'));
const fixes = verify.filter((x) => x.fix && x.gapM > 400);

async function rev(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=16&addressdetails=1&accept-language=ja`;
  try {
    const j = await (await fetch(url, { headers: UA })).json();
    await sleep(1200);
    const a = j.address || {};
    const head = (j.display_name || '').split(',').slice(0, 2).map((s) => s.trim()).join(' ');
    const admin = [a.city, a.town, a.village, a.county, a.province || a.state].filter(Boolean).join('/');
    return `${head} … ${admin}`;
  } catch { await sleep(1200); return '取得できず'; }
}

let ng = 0;
for (const f of fixes) {
  const html = fs.readFileSync(`dist/destinations/${f.id}/index.html`, 'utf8');
  // HTML全体をdecodeURIComponentすると壊れた%列で落ちるので、リンクを1本ずつ扱う
  const links = [...html.matchAll(/https:\/\/www\.google\.com\/maps\/[^"]+/g)].map((x) => x[0]);
  let m = null;
  for (const l of links) {
    let u = l;
    try { u = decodeURIComponent(l.replace(/&#38;/g, '&')); } catch { /* 生のまま見る */ }
    m = u.match(/query=(-?[\d.]+)[,\s]+(-?[\d.]+)/) || u.match(/@(-?[\d.]+),(-?[\d.]+)/);
    if (m) break;
  }
  const shown = m ? [Number(m[1]), Number(m[2])] : null;
  const gap = shown ? km(shown[0], shown[1], f.fix[0], f.fix[1]) * 1000 : null;
  const ok = shown && gap < 10;
  if (!ok) ng++;
  console.log(`\n■ ${f.name}（${f.id}）  ${ok ? '✅' : '❌'} リンク座標=${shown ? shown.join(', ') : 'なし'}`);
  console.log(`   修正前 ${f.cur[0]}, ${f.cur[1]}`);
  console.log(`      → ${await rev(f.cur[0], f.cur[1])}`);
  console.log(`   修正後 ${f.fix[0]}, ${f.fix[1]}`);
  console.log(`      → ${await rev(f.fix[0], f.fix[1])}`);
}
console.log(ng ? `\nNG ${ng}件` : `\n✅ ${fixes.length}件すべて、地図リンクが修正後の座標を指している`);
process.exit(ng ? 1 : 0);
