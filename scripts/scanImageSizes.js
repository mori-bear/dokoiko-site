#!/usr/bin/env node
/**
 * scanImageSizes.js
 * public/images/{id}/main.jpg を全件スキャンし寸法・容量の不良を検出。
 *  - 横幅 < 1000px
 *  - 縦 > 横 (ポートレート)
 *  - ファイルサイズ < 50KB
 * 結果を JSON (logs/imageScan.json) に保存し、サマリ＋ワースト10を表示。
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const IMG_DIR = 'public/images';
const MIN_W = 1000;
const MIN_BYTES = 50 * 1024;

const dirs = fs.readdirSync(IMG_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name);

const results = [];
let scanned = 0, missing = 0, errored = 0;

for (const id of dirs) {
  const fp = path.join(IMG_DIR, id, 'main.jpg');
  if (!fs.existsSync(fp)) { missing++; continue; }
  let w = 0, h = 0, bytes = 0;
  try {
    bytes = fs.statSync(fp).size;
    const meta = await sharp(fp).metadata();
    w = meta.width || 0;
    h = meta.height || 0;
  } catch (e) {
    errored++;
    results.push({ id, w: 0, h: 0, bytes, error: e.message, tooSmall: true, portrait: false, lowSize: true });
    continue;
  }
  scanned++;
  const tooSmall = w < MIN_W;
  const portrait = h > w;
  const lowSize = bytes < MIN_BYTES;
  if (tooSmall || portrait || lowSize) {
    results.push({ id, w, h, bytes, tooSmall, portrait, lowSize });
  }
}

const small = results.filter(r => r.tooSmall).length;
const port = results.filter(r => r.portrait).length;
const low = results.filter(r => r.lowSize).length;

fs.mkdirSync('logs', { recursive: true });
fs.writeFileSync('logs/imageScan.json', JSON.stringify(results, null, 2));

console.log(`=== 画像寸法スキャン結果 ===`);
console.log(`スキャン: ${scanned} / main.jpg欠落: ${missing} / 読込エラー: ${errored}`);
console.log(`不良(いずれか該当): ${results.length} 件`);
console.log(`  横幅<1000px : ${small}`);
console.log(`  縦長(縦>横) : ${port}`);
console.log(`  容量<50KB   : ${low}`);
console.log(`\n--- ワースト10 (幅昇順→容量昇順) ---`);
const worst = [...results].sort((a, b) => (a.w - b.w) || (a.bytes - b.bytes)).slice(0, 10);
for (const r of worst) {
  const flags = [r.tooSmall && '小', r.portrait && '縦', r.lowSize && '軽'].filter(Boolean).join('');
  console.log(`${r.id.padEnd(28)} ${String(r.w).padStart(5)}x${String(r.h).padStart(5)}  ${(r.bytes/1024).toFixed(0).padStart(5)}KB  [${flags}]${r.error?(' '+r.error):''}`);
}
