#!/usr/bin/env node
/**
 * recompressImages.mjs — public/images を 幅1600px上限・JPEG quality 80 に統一する。
 *
 * 配信サイズが 2.6GB あり GitHub Pages の推奨上限1GBを大きく超えていて、
 * ビルドが通常4〜6分のところ57分かかるようになったため。
 *
 * 触らないもの:
 *   ・幅1000px未満 … 既存QA(checkImageDimensionsBatch.mjs)が「欠陥」として扱う領域。
 *     これ以上小さくしないし、再エンコードで画質を削るのも避ける。
 *   ・再圧縮しても小さくならなかったファイル … 元のまま残す（無駄に画質だけ落とさない）。
 *
 * 縦長画像は幅ではなく長辺を1600pxに収める（幅基準だと縦がさらに伸びるため）。
 * mozjpeg を使う。同じ見た目でファイルサイズが1〜2割小さくなる標準JPEGのまま。
 *
 * 使い方:
 *   node scripts/recompressImages.mjs --sample 20 --out /tmp/recompress_sample  # 試算のみ
 *   node scripts/recompressImages.mjs --dry                                     # 全件試算
 *   node scripts/recompressImages.mjs --apply                                   # 実書き換え
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const MAX_EDGE = 1600;
const QUALITY = 80;
const MIN_WIDTH = 1000;   // これ未満は対象外

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const SAMPLE = args.includes('--sample') ? Number(args[args.indexOf('--sample') + 1]) : 0;
const OUTDIR = args.includes('--out') ? args[args.indexOf('--out') + 1] : null;

const rows = JSON.parse(fs.readFileSync('logs/image_sizes.json', 'utf8'));
let targets = rows.filter(r => r.w && r.w >= MIN_WIDTH);

if (SAMPLE) {
  // 幅の帯ごとに万遍なく拾う（大きいものだけ見て判断しないため）
  const bands = [[1000,1279],[1280,1599],[1600,1919],[1920,2559],[2560,1e9]];
  const per = Math.max(1, Math.ceil(SAMPLE / bands.length));
  targets = bands.flatMap(([lo,hi]) => targets.filter(r=>r.w>=lo&&r.w<=hi).slice(0, per)).slice(0, SAMPLE);
}

const kb = (b) => Math.round(b / 1024) + 'KB';
let before = 0, after = 0, changed = 0, kept = 0, failed = 0;
const detail = [];

for (const r of targets) {
  const src = r.f;
  try {
    const long = Math.max(r.w, r.h);
    let pipe = sharp(src);
    if (long > MAX_EDGE) {
      // 縦長は長辺、横長は幅で 1600 に収める。拡大はしない。
      pipe = r.h > r.w ? pipe.resize({ height: MAX_EDGE, withoutEnlargement: true })
                       : pipe.resize({ width: MAX_EDGE, withoutEnlargement: true });
    }
    const buf = await pipe.jpeg({ quality: QUALITY, mozjpeg: true, progressive: true }).toBuffer();
    const meta = await sharp(buf).metadata();
    before += r.bytes;

    // 縮まなかったものは元を残す（画質だけ落とすのは損）
    if (buf.length >= r.bytes) { after += r.bytes; kept++; detail.push({ f: src, from: r.bytes, to: r.bytes, kept: true }); continue; }
    // 幅が下限を割るような結果は採らない（既存QAの欠陥条件に触れさせない）
    if (meta.width < MIN_WIDTH && r.w >= MIN_WIDTH) { after += r.bytes; kept++; detail.push({ f: src, from: r.bytes, to: r.bytes, kept: true, why: 'width<1000' }); continue; }

    after += buf.length; changed++;
    detail.push({ f: src, from: r.bytes, to: buf.length, w: [r.w, meta.width], h: [r.h, meta.height] });

    if (OUTDIR) {
      const dst = path.join(OUTDIR, src.replace(/^public\/images\//, ''));
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.writeFileSync(dst, buf);
    } else if (APPLY) {
      const tmp = src + '.tmp';
      fs.writeFileSync(tmp, buf);
      fs.renameSync(tmp, src);   // 書き込み途中のファイルを残さない
    }
  } catch (e) {
    failed++; after += r.bytes;
    detail.push({ f: src, error: String(e).slice(0, 60) });
  }
  if ((changed + kept + failed) % 500 === 0) process.stderr.write(`  ${changed + kept + failed}/${targets.length}\n`);
}

fs.writeFileSync(SAMPLE ? 'logs/recompress_sample.json' : 'logs/recompress_result.json', JSON.stringify(detail, null, 0));
const mb = (b) => (b / 1024 / 1024).toFixed(0) + 'MB';
console.log(`対象 ${targets.length}枚（圧縮 ${changed} / 据え置き ${kept} / 失敗 ${failed}）`);
console.log(`  ${mb(before)} → ${mb(after)}  削減 ${mb(before - after)}（${((1 - after / before) * 100).toFixed(0)}%）`);
console.log(`  平均 ${kb(before / targets.length)} → ${kb(after / targets.length)}`);
if (!APPLY && !OUTDIR) console.log('  ※ --dry のため書き換えていません');
if (OUTDIR) console.log(`  出力: ${OUTDIR}`);
