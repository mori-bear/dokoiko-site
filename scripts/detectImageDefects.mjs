/**
 * detectImageDefects.mjs
 * 全画像の機械的な品質チェック（sharp のみ・API課金なし）。
 *   1. 極端なアスペクト比（横/縦 > 2.6 または < 0.9）
 *   2. 焼き込みレターボックス（上下端に均一色の帯：白/黒帯）
 *      → object-fit: cover でも消えない「画像内の白帯」を検出する
 *
 * 使い方: node scripts/detectImageDefects.mjs <出力レポートパス>
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMAGES_DIR = path.join(__dirname, '../public/images');
const OUT = process.argv[2] || path.join(__dirname, '../.image-defects.json');

const exts = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (exts.has(path.extname(e.name).toLowerCase())) files.push(p);
  }
})(IMAGES_DIR);

const extremeAspect = [];
const letterbox = [];
const errors = [];
let checked = 0;

/** 行ピクセル群が「均一な白/黒帯」か判定 */
function isUniformBand(data, width, channels, rowStart, rowCount) {
  let sum = 0, sumSq = 0, n = 0;
  for (let r = 0; r < rowCount; r++) {
    const off = (rowStart + r) * width * channels;
    for (let x = 0; x < width; x += 4) {           // 4px間引き
      const i = off + x * channels;
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      sum += lum; sumSq += lum * lum; n++;
    }
  }
  const mean = sum / n;
  const varc = sumSq / n - mean * mean;
  // 分散が小さく（均一）、かつ 白帯(>=235) or 黒帯(<=20)
  return varc < 40 && (mean >= 235 || mean <= 20);
}

for (const f of files) {
  try {
    const img = sharp(f);
    const meta = await img.metadata();
    let { width: w, height: h, orientation } = meta;
    if (orientation >= 5) [w, h] = [h, w];
    const rel = path.relative(IMAGES_DIR, f);
    const ratio = w / h;
    if (ratio > 2.6 || ratio < 0.9) {
      extremeAspect.push({ file: rel, width: w, height: h, ratio: +ratio.toFixed(2) });
    }

    // レターボックス検出: 縮小してから上下端 8% の帯を検査（高速化）
    const targetW = 160;
    const { data, info } = await img
      .resize(targetW, null, { fit: 'inside' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const rows = Math.max(3, Math.floor(info.height * 0.08));
    const top = isUniformBand(data, info.width, info.channels, 0, rows);
    const bottom = isUniformBand(data, info.width, info.channels, info.height - rows, rows);
    if (top && bottom) {
      letterbox.push({ file: rel, width: w, height: h });
    }
    checked++;
  } catch (err) {
    errors.push({ file: path.relative(IMAGES_DIR, f), error: String(err.message || err) });
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  total: files.length, checked,
  extremeAspectCount: extremeAspect.length,
  letterboxCount: letterbox.length,
  errorCount: errors.length,
  extremeAspect, letterbox, errors,
};
fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
console.log(`✅ 機械チェック完了: ${checked}/${files.length}`);
console.log(`   極端アスペクト比: ${extremeAspect.length}`);
console.log(`   焼き込みレターボックス(上下均一帯): ${letterbox.length}`);
console.log(`   エラー: ${errors.length}`);
console.log(`   レポート: ${OUT}`);
