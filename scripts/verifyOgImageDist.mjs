#!/usr/bin/env node
/**
 * verifyOgImageDist.mjs — ビルド済み全HTMLの og:image を検査する。
 *   ① og:image が必ずあるか（無いとSNSカードに画像が出ない）
 *   ② 絶対URLか（OGPは絶対URLが前提）
 *   ③ 指す先が dist に実在するか（404だとカードが空になる）
 *   ④ 宣言している width/height が実寸と一致するか
 */
import fs from 'fs';
import path from 'path';

const DIST = 'dist';
const SITE = 'https://tabidokoiko.com';

function readSize(file) {
  const b = fs.readFileSync(file);
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length - 9) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
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
    else if (e.name.endsWith('.html')) htmls.push(p);
  }
})(DIST);

let missing = 0, relative = 0, broken = 0, sizeMismatch = 0, external = 0;
const brokenList = [], mismatchList = [];

for (const f of htmls) {
  const html = fs.readFileSync(f, 'utf8');
  const g = (k) => (html.match(new RegExp(`<meta (?:property|name)="${k}" content="([^"]*)"`)) || [])[1] ?? null;
  const img = g('og:image');
  if (!img) { missing++; continue; }
  if (!/^https?:\/\//.test(img)) { relative++; continue; }
  if (!img.startsWith(SITE)) { external++; continue; }   // Unsplash等は実在確認の対象外
  const local = path.join(DIST, decodeURIComponent(img.slice(SITE.length)));
  if (!fs.existsSync(local)) { broken++; brokenList.push([f, img]); continue; }
  const s = readSize(local);
  const w = Number(g('og:image:width')), h = Number(g('og:image:height'));
  if (s && (s.w !== w || s.h !== h)) { sizeMismatch++; mismatchList.push([f, `${w}x${h}`, `${s.w}x${s.h}`]); }
}

console.log(`■ og:image 検査（${htmls.length}ページ）`);
console.log(`  og:image なし        ${missing}`);
console.log(`  相対URL             ${relative}`);
console.log(`  参照先が存在しない     ${broken}`);
console.log(`  宣言サイズと実寸の不一致 ${sizeMismatch}`);
console.log(`  外部URL（実在確認対象外）${external}`);
for (const [f, u] of brokenList.slice(0, 8)) console.log(`    ❌ ${f} → ${u}`);
for (const [f, d, a] of mismatchList.slice(0, 8)) console.log(`    ❌ ${f} 宣言${d} 実寸${a}`);

const ng = missing + relative + broken + sizeMismatch;
console.log(ng ? `\nNG ${ng}件` : '\n✅ 全ページ健全（画像あり・絶対URL・実在・サイズ一致）');
process.exit(ng ? 1 : 0);
