/**
 * checkImageDimensionsBatch.mjs
 * public/images 全画像の寸法チェック（Vision API不使用・機械的基準のみ）。
 *   - 横幅 1000px 未満
 *   - 縦長（height > width）
 * を JSON レポートに出力する。
 *
 * 使い方: node scripts/checkImageDimensionsBatch.mjs <出力レポートパス>
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMAGES_DIR = path.join(__dirname, '../public/images');
const OUT = process.argv[2] || path.join(__dirname, '../.image-dimension-report.json');

const exts = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (exts.has(path.extname(e.name).toLowerCase())) files.push(p);
  }
})(IMAGES_DIR);

const narrow = [];   // 幅1000未満
const portrait = []; // 縦長
const errors = [];
let checked = 0;

for (const f of files) {
  try {
    const meta = await sharp(f).metadata();
    let { width: w, height: h, orientation } = meta;
    // EXIF orientation 5-8 は 90度回転 → 縦横入れ替え
    if (orientation >= 5) [w, h] = [h, w];
    const rel = path.relative(IMAGES_DIR, f);
    if (w < 1000) narrow.push({ file: rel, width: w, height: h });
    if (h > w) portrait.push({ file: rel, width: w, height: h });
    checked++;
  } catch (err) {
    errors.push({ file: path.relative(IMAGES_DIR, f), error: String(err.message || err) });
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  total: files.length,
  checked,
  narrowCount: narrow.length,
  portraitCount: portrait.length,
  errorCount: errors.length,
  narrow,
  portrait,
  errors,
};
fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
console.log(`✅ 寸法チェック完了: 総数=${files.length} 検査=${checked}`);
console.log(`   幅1000未満: ${narrow.length}`);
console.log(`   縦長: ${portrait.length}`);
console.log(`   読取エラー: ${errors.length}`);
console.log(`   レポート: ${OUT}`);
