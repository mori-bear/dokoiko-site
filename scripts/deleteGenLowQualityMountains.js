#!/usr/bin/env node
/**
 * deleteGenLowQualityMountains.js
 * gen_プレフィックス・北海道・山岳・description<200 のdestinationを削除
 * 画像フォルダも削除
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEST_FILE = path.join(__dirname, '../src/data/destinations.json');
const IMG_DIR = path.join(__dirname, '../public/images');

const destinations = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));

const before = destinations.length;
const toDelete = destinations.filter(x =>
  x.id.startsWith('gen_')
  && x.prefecture === '北海道'
  && (x.tags || []).includes('山')
  && (x.description || '').length < 200
);

console.log(`削除対象: ${toDelete.length}件`);
for (const x of toDelete) {
  console.log(`  - ${x.id} (${x.name}, desc=${(x.description||'').length}字)`);
  // 画像フォルダ削除
  const folder = path.join(IMG_DIR, x.id);
  if (fs.existsSync(folder)) {
    fs.rmSync(folder, { recursive: true, force: true });
  }
}

// destinations.json から削除
const remaining = destinations.filter(x => !toDelete.includes(x));
fs.writeFileSync(DEST_FILE, JSON.stringify(remaining, null, 2));

console.log(`\n✓ 完了: ${before} → ${remaining.length}件 (-${toDelete.length})`);
