#!/usr/bin/env node
/**
 * auditOgAspect.mjs — ビルド済み全ページの og:image の縦横比とサイズを集計する。
 *
 * Xの summary_large_image は横長（2:1前後）の枠に中央合わせで表示し、
 * はみ出した分は上下または左右が切られる。カードが出ないわけではないが、
 * 4:3のような比率だと上下が大きく削られる。どれくらい影響があるかを測る。
 */
import fs from 'fs';
import path from 'path';

const SITE = 'https://tabidokoiko.com';
function sizeOf(file) {
  const b = fs.readFileSync(file);
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return { type: 'PNG', w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length - 9) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        return { type: 'JPEG', h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
      }
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  return null;
}

const htmls = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name === 'index.html') htmls.push(p);
  }
})('dist');

const buckets = { '2:1前後 (1.7-2.1)': 0, '16:9前後 (1.6-1.7)': 0, '3:2前後 (1.4-1.6)': 0, '4:3前後 (1.2-1.4)': 0, 'それ以外': 0 };
const narrow = [];
let over5MB = 0, badType = 0, noImg = 0;
const seen = new Map();

for (const f of htmls) {
  const html = fs.readFileSync(f, 'utf8');
  const img = (html.match(/<meta property="og:image" content="([^"]*)"/) || [])[1];
  if (!img) { noImg++; continue; }
  if (!img.startsWith(SITE)) continue;
  const local = path.join('dist', decodeURIComponent(img.slice(SITE.length)));
  if (!fs.existsSync(local)) continue;
  if (!seen.has(local)) {
    const s = sizeOf(local);
    const bytes = fs.statSync(local).size;
    seen.set(local, { ...s, bytes });
  }
  const s = seen.get(local);
  if (!s || !s.w) { badType++; continue; }
  if (s.bytes > 5 * 1024 * 1024) over5MB++;
  const r = s.w / s.h;
  if (r >= 1.7 && r <= 2.1) buckets['2:1前後 (1.7-2.1)']++;
  else if (r >= 1.6) buckets['16:9前後 (1.6-1.7)']++;
  else if (r >= 1.4) buckets['3:2前後 (1.4-1.6)']++;
  else if (r >= 1.2) { buckets['4:3前後 (1.2-1.4)']++; narrow.push([f, s.w, s.h, r]); }
  else { buckets['それ以外']++; narrow.push([f, s.w, s.h, r]); }
}

console.log(`■ og:image の縦横比（${htmls.length}ページ / 実画像${seen.size}種）`);
for (const [k, v] of Object.entries(buckets)) console.log(`   ${k.padEnd(22)} ${String(v).padStart(5)}ページ`);
console.log(`\n   og:image が無い       ${noImg}`);
console.log(`   サイズを読めない形式    ${badType}`);
console.log(`   5MBを超える          ${over5MB}`);
console.log(`\n■ 上下が大きく切られる比率のページ（先頭20件）`);
for (const [f, w, h, r] of narrow.slice(0, 20)) console.log(`   ${r.toFixed(2)} ${String(w)}x${h}  ${f}`);
console.log(`   … 計 ${narrow.length}ページ`);
