#!/usr/bin/env node
/**
 * normalizeRefetched.js
 * 再取得した main.jpg のうち横幅が大きすぎる/重いものを 1920px・JPEG q82 へ正規化。
 * 1000px以上・横長は維持。logs/imageRefetch.json の OK 分のみ対象。
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const MAX_W = 1920;
const report = JSON.parse(fs.readFileSync('logs/imageRefetch.json', 'utf8'))
  .filter(r => r.result === 'OK');

let normalized = 0, kept = 0, savedKB = 0;
for (const r of report) {
  const fp = path.join('public/images', r.id, 'main.jpg');
  if (!fs.existsSync(fp)) continue;
  const before = fs.statSync(fp).size;
  const m = await sharp(fp).metadata();
  if ((m.width || 0) <= MAX_W && before <= 900 * 1024) { kept++; continue; }
  const buf = await sharp(fp)
    .resize({ width: MAX_W, withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
  // 正規化後も横幅>=1000を保証（元が1000-1920の横長はリサイズで縮まない）
  fs.writeFileSync(fp, buf);
  normalized++;
  savedKB += (before - buf.length) / 1024;
}
console.log(`正規化: ${normalized} 件 / 据え置き: ${kept} 件 / 削減: ${Math.round(savedKB / 1024)}MB`);
