#!/usr/bin/env node
/** verifyProdCoordFixes.mjs — 本番ページの地図リンク座標が、修正後の値になっているか確かめる。 */
import fs from 'fs';
const UA = { 'User-Agent': 'DokoIko-Verify/1.0 (tabidokoiko.com)' };
const km = (a, b, c, d) => Math.hypot((a - c) * 111, (b - d) * 111 * Math.cos((a * Math.PI) / 180));
const all = JSON.parse(fs.readFileSync('src/data/destinations.json', 'utf8'));
const byId = Object.fromEntries(all.map((d) => [d.id, d]));
const ids = process.argv.slice(2);
let ng = 0;
for (const id of ids) {
  const d = byId[id];
  const html = await (await fetch(`https://tabidokoiko.com/destinations/${encodeURIComponent(id)}/`, { headers: UA })).text();
  const links = [...html.matchAll(/https:\/\/www\.google\.com\/maps\/[^"]+/g)].map((x) => x[0]);
  let m = null;
  for (const l of links) {
    let u = l;
    try { u = decodeURIComponent(l.replace(/&#38;/g, '&')); } catch { /* 生のまま */ }
    m = u.match(/query=(-?[\d.]+)[,\s]+(-?[\d.]+)/) || u.match(/@(-?[\d.]+),(-?[\d.]+)/);
    if (m) break;
  }
  const gap = m ? km(+m[1], +m[2], d.lat, d.lng) * 1000 : null;
  const ok = m && gap < 10;
  if (!ok) ng++;
  console.log(`${ok ? 'OK  ' : '❌  '} ${id.padEnd(18)} ${String(d.name).padEnd(20)} 本番=${m ? `${m[1]},${m[2]}` : 'なし'} データ=${d.lat},${d.lng}`);
}
console.log(ng ? `\nNG ${ng}件` : `\n✅ ${ids.length}件すべて本番の地図リンクが最新の座標を指している`);
process.exit(ng ? 1 : 0);
