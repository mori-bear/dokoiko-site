#!/usr/bin/env node
/**
 * reorganizeImages.js
 * public/images/{id}.jpg → public/images/{id}/main.jpg に再編成
 * destinations.json の各エントリに images: ['/images/{id}/main.jpg'] を追加
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEST_FILE = path.join(__dirname, '../src/data/destinations.json');
const IMAGES_DIR = path.join(__dirname, '../public/images');

const destinations = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));

let moved = 0;
let already = 0;
let noImage = 0;
let updated = 0;

for (const d of destinations) {
  const id = d.id;
  const flat = path.join(IMAGES_DIR, `${id}.jpg`);
  const folder = path.join(IMAGES_DIR, id);
  const mainPath = path.join(folder, 'main.jpg');

  // 既存フォルダ確認・新規作成
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }

  if (fs.existsSync(mainPath)) {
    already++;
  } else if (fs.existsSync(flat)) {
    // フラットファイルをフォルダ内 main.jpg に移動
    fs.renameSync(flat, mainPath);
    moved++;
  } else {
    noImage++;
  }

  // destinations.json の images フィールド更新
  const folderFiles = fs.existsSync(folder)
    ? fs.readdirSync(folder).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f)).sort()
    : [];
  if (folderFiles.length > 0) {
    const imagePaths = folderFiles.map(f => `/images/${id}/${f}`);
    // 既存と異なれば更新
    if (JSON.stringify(d.images) !== JSON.stringify(imagePaths)) {
      d.images = imagePaths;
      updated++;
    }
  }
}

// バックアップファイル削除（.bak など）も整理
const trashFiles = fs.readdirSync(IMAGES_DIR).filter(f => f.endsWith('.bak'));
console.log(`\nバックアップファイル: ${trashFiles.length}件（自動削除はしない）`);

fs.writeFileSync(DEST_FILE, JSON.stringify(destinations, null, 2));

console.log('='.repeat(50));
console.log('画像フォルダ再編成完了');
console.log('='.repeat(50));
console.log(`  移動: ${moved} 件（{id}.jpg → {id}/main.jpg）`);
console.log(`  既存フォルダ済: ${already} 件`);
console.log(`  画像なし: ${noImage} 件`);
console.log(`  destinations.json更新: ${updated} 件`);
