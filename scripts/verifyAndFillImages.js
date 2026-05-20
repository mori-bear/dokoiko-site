#!/usr/bin/env node
/**
 * verifyAndFillImages.js
 * 1) destinations.json各件の images[0] が実在するか確認
 * 2) imagesフィールドなしも検出
 * 3) 不在のものをWikipedia Commons経由で再取得
 * 4) 最終的に画像なし件数を報告
 */
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEST_FILE = path.join(__dirname, '../src/data/destinations.json');
const IMAGES_DIR = path.join(__dirname, '../public/images');

const destinations = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));

function existsLocalImage(d) {
  const imgs = d.images || [];
  if (imgs.length === 0) return false;
  const main = imgs[0];
  if (!main.startsWith('/')) return true; // 外部URL
  const p = path.join(__dirname, '../public' + main);
  return fs.existsSync(p) && fs.statSync(p).size > 0;
}

async function fetchWikipediaImage(query) {
  const url = `https://ja.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&piprop=thumbnail&pithumbsize=800&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=1&origin=*`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'dokoiko/1.0' } });
    if (!res.ok) return null;
    const j = await res.json();
    const pages = j?.query?.pages;
    if (!pages) return null;
    const page = Object.values(pages)[0];
    return page?.thumbnail?.source || null;
  } catch { return null; }
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const opts = { headers: { 'User-Agent': 'dokoiko/1.0' } };
    let hops = 0;
    function go(u) {
      hops++;
      if (hops > 5) return reject(new Error('redirects'));
      https.get(u, opts, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return go(res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, u).toString());
        }
        if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
      }).on('error', reject);
    }
    go(url);
  });
}

// Step 1: 検証
const missing = [];
for (const d of destinations) {
  if (!existsLocalImage(d)) missing.push(d);
}
console.log(`📷 画像未保有: ${missing.length}件 / 全${destinations.length}件`);

// Step 2: Wikipedia取得試行
let success = 0, fail = 0;
for (let i = 0; i < missing.length; i++) {
  const d = missing[i];
  const folder = path.join(IMAGES_DIR, d.id);
  if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
  const mainPath = path.join(folder, 'main.jpg');

  const queries = [
    d.name,
    `${d.name} ${d.prefecture || ''}`.trim(),
    `${(d.spots||[]).map(s=>s.name)[0]||''} ${d.prefecture || ''}`.trim(),
  ].filter(q => q && q.length > 1);

  let img = null;
  for (const q of queries) {
    img = await fetchWikipediaImage(q);
    if (img) break;
    await new Promise(r => setTimeout(r, 300));
  }

  if (img) {
    try {
      await download(img, mainPath);
      d.images = [`/images/${d.id}/main.jpg`];
      success++;
    } catch { fail++; }
  } else fail++;

  if ((i+1) % 10 === 0 || i+1 === missing.length) {
    console.log(`  ${i+1}/${missing.length}: ✓${success} ✗${fail}`);
    fs.writeFileSync(DEST_FILE, JSON.stringify(destinations, null, 2));
  }
  await new Promise(r => setTimeout(r, 200));
}
fs.writeFileSync(DEST_FILE, JSON.stringify(destinations, null, 2));

// 最終確認
const final_missing = destinations.filter(d => !existsLocalImage(d));
console.log(`\n=== 完了 ===`);
console.log(`  取得成功: ${success}件 / 失敗: ${fail}件`);
console.log(`  最終画像なし: ${final_missing.length}件 (${destinations.length}件中)`);
console.log(`  カバレッジ: ${((destinations.length - final_missing.length) / destinations.length * 100).toFixed(1)}%`);
if (final_missing.length > 0 && final_missing.length <= 30) {
  console.log(`  残: ${final_missing.map(d => d.id).join(', ')}`);
}
