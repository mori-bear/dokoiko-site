#!/usr/bin/env node
/**
 * measureImageSizes.mjs — public/images 全画像の寸法とファイルサイズの分布を測る。
 * 再圧縮の対象を決めるための事前測定（書き換えは一切しない）。
 *
 * 判定の基準:
 *   ・幅1600pxを超える → 縮小の余地あり
 *   ・幅1600px以下でもファイルサイズが大きい → 再エンコードの余地あり
 *   ・幅1000px未満 → 既存QA(checkImageDimensionsBatch.mjs)が欠陥として扱う。触らない
 *   ・縦長(height>width) → 同上。幅基準の縮小をかけると意図とずれるので別扱い
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const DIR = 'public/images';
const exts = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (exts.has(path.extname(e.name).toLowerCase())) files.push(p);
  }
})(DIR);

const rows = [];
let done = 0;
for (const f of files) {
  const bytes = fs.statSync(f).size;
  let w = null, h = null, fmt = null;
  try { const m = await sharp(f).metadata(); w = m.width; h = m.height; fmt = m.format; }
  catch { /* 壊れた画像は別枠で数える */ }
  rows.push({ f, bytes, w, h, fmt });
  if (++done % 1000 === 0) process.stderr.write(`  ${done}/${files.length}\n`);
}
fs.writeFileSync('logs/image_sizes.json', JSON.stringify(rows, null, 0));

const sum = (a) => a.reduce((s, x) => s + x.bytes, 0);
const mb = (b) => (b / 1024 / 1024).toFixed(0) + 'MB';
const kb = (b) => Math.round(b / 1024) + 'KB';
const pct = (n) => (n / rows.length * 100).toFixed(1) + '%';

const broken   = rows.filter(r => !r.w);
const ok       = rows.filter(r => r.w);
const portrait = ok.filter(r => r.h > r.w);
const narrow   = ok.filter(r => r.w < 1000);
const wide     = ok.filter(r => r.w > 1600);
const inRange  = ok.filter(r => r.w >= 1000 && r.w <= 1600 && r.h <= r.w);

console.log('■ public/images 全体');
console.log(`  ファイル数 ${rows.length} / 合計 ${mb(sum(rows))} / 平均 ${kb(sum(rows) / rows.length)}`);
console.log(`  読めない画像 ${broken.length}`);
console.log('');
console.log('■ 幅の分布');
for (const [lo, hi] of [[0,999],[1000,1279],[1280,1599],[1600,1600],[1601,1919],[1920,2559],[2560,1e9]]) {
  const g = ok.filter(r => r.w >= lo && r.w <= hi);
  if (!g.length) continue;
  console.log(`  ${String(lo).padStart(5)}-${hi>1e8?'∞':String(hi).padStart(5)}px : ${String(g.length).padStart(5)}枚 ${pct(g.length).padStart(6)} 合計${mb(sum(g)).padStart(6)} 平均${kb(sum(g)/g.length).padStart(7)}`);
}
console.log('');
console.log('■ ファイルサイズの分布');
for (const [lo, hi] of [[0,99],[100,199],[200,399],[400,699],[700,999],[1000,1999],[2000,1e9]]) {
  const g = rows.filter(r => r.bytes/1024 >= lo && r.bytes/1024 <= hi);
  if (!g.length) continue;
  console.log(`  ${String(lo).padStart(4)}-${hi>1e8?'∞':String(hi).padStart(4)}KB : ${String(g.length).padStart(5)}枚 ${pct(g.length).padStart(6)} 合計${mb(sum(g)).padStart(6)}`);
}
console.log('');
console.log('■ 再圧縮の対象仕分け');
console.log(`  幅1600px超（縮小対象）        ${String(wide.length).padStart(5)}枚 合計${mb(sum(wide))}`);
console.log(`  幅1000-1600・横長（再エンコード対象）${String(inRange.length).padStart(5)}枚 合計${mb(sum(inRange))}`);
console.log(`  縦長（別扱い・長辺基準で処理）   ${String(portrait.length).padStart(5)}枚 合計${mb(sum(portrait))}`);
console.log(`  幅1000px未満（既存QAが欠陥扱い・触らない）${String(narrow.length).padStart(4)}枚 合計${mb(sum(narrow))}`);
console.log('');
const target = [...wide, ...inRange, ...portrait];
console.log(`  → 処理対象 ${target.length}枚 / ${mb(sum(target))}（全体の${pct(target.length)}・容量の${(sum(target)/sum(rows)*100).toFixed(0)}%）`);
