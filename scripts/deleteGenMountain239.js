#!/usr/bin/env node
/**
 * deleteGenMountain239.js
 * gen_ かつ tags[0]==='山' の destination を全削除。
 * 画像フォルダも削除。
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
  x.id.startsWith('gen_') && (x.tags || [])[0] === '山'
);

console.log(`削除対象: ${toDelete.length}件`);
for (const x of toDelete) {
  const folder = path.join(IMG_DIR, x.id);
  if (fs.existsSync(folder)) {
    fs.rmSync(folder, { recursive: true, force: true });
  }
}
const ids = new Set(toDelete.map(x => x.id));
const remaining = destinations.filter(x => !ids.has(x.id));
fs.writeFileSync(DEST_FILE, JSON.stringify(remaining, null, 2));
console.log(`✓ ${before} → ${remaining.length} (-${toDelete.length})`);
