#!/usr/bin/env node
/**
 * scanImages.js
 * 指定 destination id の画像フォルダをスキャンし、destinations.json との差分を検出。
 *
 * 使い方:
 *   node scripts/scanImages.js matsuyama
 *   node scripts/scanImages.js --all   # 全件チェック
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEST_FILE = path.join(__dirname, '../src/data/destinations.json');
const IMAGES_DIR = path.join(__dirname, '../public/images');

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('使い方: node scripts/scanImages.js <destination-id> | --all');
  process.exit(1);
}

const destinations = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));

function scanOne(id) {
  const dest = destinations.find(d => d.id === id);
  if (!dest) {
    console.error(`✗ 目的地未発見: ${id}`);
    return { added: 0, removed: 0 };
  }

  const folder = path.join(IMAGES_DIR, id);
  if (!fs.existsSync(folder)) {
    console.log(`  📁 ${id}: フォルダなし`);
    return { added: 0, removed: 0 };
  }

  // フォルダ内画像
  const folderFiles = fs.readdirSync(folder)
    .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
    .sort();
  const folderPaths = folderFiles.map(f => `/images/${id}/${f}`);
  const jsonPaths = (dest.images || []);

  const folderSet = new Set(folderPaths);
  const jsonSet = new Set(jsonPaths);

  const added = folderPaths.filter(p => !jsonSet.has(p));    // フォルダにあるがJSONにない
  const removed = jsonPaths.filter(p => !folderSet.has(p));   // JSONにあるがフォルダにない

  if (added.length === 0 && removed.length === 0) {
    console.log(`  ✓ ${id} (${dest.name}): 差分なし (${folderPaths.length}枚)`);
    return { added: 0, removed: 0 };
  }

  console.log(`\n📍 ${id} (${dest.name}):`);
  console.log(`   現在の images: ${jsonPaths.length}件`);
  console.log(`   フォルダ内: ${folderPaths.length}件`);

  if (added.length > 0) {
    console.log(`   🆕 追加候補 (${added.length}件):`);
    added.forEach(p => console.log(`      + ${p}`));
  }
  if (removed.length > 0) {
    console.log(`   🗑  消失 (${removed.length}件):`);
    removed.forEach(p => console.log(`      - ${p}`));
  }

  // 反映用プロンプト出力
  console.log(`\n   反映プロンプト:`);
  console.log(`   destinations.json で id="${id}" の "images" を以下に更新:`);
  console.log('   ' + JSON.stringify(folderPaths, null, 2).split('\n').join('\n   '));

  return { added: added.length, removed: removed.length };
}

if (args[0] === '--all') {
  let totalAdded = 0, totalRemoved = 0, count = 0;
  for (const d of destinations) {
    const r = scanOne(d.id);
    totalAdded += r.added;
    totalRemoved += r.removed;
    if (r.added > 0 || r.removed > 0) count++;
  }
  console.log('\n' + '='.repeat(50));
  console.log(`全件スキャン完了`);
  console.log('='.repeat(50));
  console.log(`  差分あり: ${count} 件`);
  console.log(`  追加候補合計: ${totalAdded} 件`);
  console.log(`  消失合計: ${totalRemoved} 件`);
} else {
  scanOne(args[0]);
}
