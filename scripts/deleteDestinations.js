#!/usr/bin/env node
/**
 * deleteDestinations.js
 * logs/final_delete_ids.json のidを destinations.json から削除し、
 * 対応する public/images/{id}/ を削除、リダイレクト用 src/data/deletedIds.json を更新する。
 */
import fs from 'fs';
import path from 'path';

const DEST = 'src/data/destinations.json';
const DELETED_IDS = 'src/data/deletedIds.json';
const IMG = 'public/images';

const targetIds = new Set(JSON.parse(fs.readFileSync('logs/final_delete_ids.json', 'utf8')));
const all = JSON.parse(fs.readFileSync(DEST, 'utf8'));

const before = all.length;
const kept = all.filter(d => !targetIds.has(d.id));
const removed = all.filter(d => targetIds.has(d.id));

// destinations.json 書き戻し（2スペース・末尾改行なし）
fs.writeFileSync(DEST, JSON.stringify(kept, null, 2));

// 画像ディレクトリ削除
let imgDeleted = 0, imgMissing = 0;
for (const id of targetIds) {
  const dir = path.join(IMG, id);
  if (fs.existsSync(dir)) { fs.rmSync(dir, { recursive: true, force: true }); imgDeleted++; }
  else imgMissing++;
}

// リダイレクト用 deletedIds.json（既存とマージ・重複排除）
let prev = [];
if (fs.existsSync(DELETED_IDS)) { try { prev = JSON.parse(fs.readFileSync(DELETED_IDS, 'utf8')); } catch {} }
const merged = [...new Set([...prev, ...targetIds])];
fs.writeFileSync(DELETED_IDS, JSON.stringify(merged, null, 2));

console.log(`destinations: ${before} → ${kept.length} (削除 ${removed.length})`);
console.log(`画像削除: ${imgDeleted} / 画像なし: ${imgMissing}`);
console.log(`deletedIds.json: ${merged.length} 件（リダイレクト用）`);
if (removed.length !== targetIds.size) console.log(`⚠ 一致しないid: 期待${targetIds.size} 実削除${removed.length}`);
