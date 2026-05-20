#!/usr/bin/env node
/**
 * clearPlaceholderImages.js
 * main.jpg が 5KB未満 = Wikipedia/Unsplash の壊れたプレースホルダ
 * → ファイル削除 + destinations.json の images フィールドを空に
 * これで verifyAndFillImages.js による再取得対象になる
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEST_FILE = path.join(__dirname, '../src/data/destinations.json');
const IMG_DIR = path.join(__dirname, '../public/images');

const destinations = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));

let cleared = 0;
const cleared_ids = [];
for (const d of destinations) {
  const imgs = d.images || [];
  if (imgs.length === 0) continue;
  const main = imgs[0];
  if (!main.startsWith('/')) continue;
  const p = path.join(__dirname, '../public' + main);
  if (!fs.existsSync(p)) continue;
  const size = fs.statSync(p).size;
  if (size < 5 * 1024) {
    fs.unlinkSync(p);
    d.images = [];
    cleared++;
    cleared_ids.push(d.id);
  }
}
fs.writeFileSync(DEST_FILE, JSON.stringify(destinations, null, 2));
console.log(`✓ プレースホルダ画像クリア: ${cleared}件`);
console.log(`  対象ID: ${cleared_ids.slice(0, 30).join(', ')}${cleared_ids.length > 30 ? ` ...他${cleared_ids.length-30}` : ''}`);
