#!/usr/bin/env node
/**
 * makeBrandShareJpg.mjs — ブランドのシェア画像をJPEGでも用意する。
 *
 * brand_share.png は写真ベースなのに可逆圧縮のPNGで857KBある。
 * Xの5MB制限には収まるが、クローラが取得に失敗した場合の再試行や
 * タイムライン上の読み込みで不利になるため、JPEGを正とする。
 * PNGは既存の参照が残っていても壊れないよう残す。
 *
 * 副次的に og:image のURLが変わるので、Xが持っている古いカード情報の
 * キャッシュを迂回できる（Card Validatorが廃止された今、URLを変えるのが
 * 再取得を促す確実な方法になっている）。
 */
import sharp from 'sharp';
import fs from 'fs';

const SRC = 'public/images/brand_share.png';
const OUT = 'public/images/brand_share.jpg';
const before = fs.statSync(SRC).size;
await sharp(SRC).jpeg({ quality: 88, mozjpeg: true, progressive: true, chromaSubsampling: '4:4:4' }).toFile(OUT);
const after = fs.statSync(OUT).size;
const m = await sharp(OUT).metadata();
console.log(`PNG  ${(before / 1024).toFixed(0)}KB → JPEG ${(after / 1024).toFixed(0)}KB  (${m.width}x${m.height})`);
console.log(`削減 ${(100 - after / before * 100).toFixed(0)}%`);
