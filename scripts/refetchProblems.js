#!/usr/bin/env node
/**
 * refetchProblems.js
 * /tmp/review_img/issues.json の問題画像をPixabay別バリエーションで再取得
 * 既存ファイルmd5を記録して同一画像を避ける
 */
import fs from 'fs';
import path from 'path';
import https from 'https';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEST_FILE = path.join(__dirname, '../src/data/destinations.json');
const IMG_DIR = path.join(__dirname, '../public/images');
const PIXABAY_KEY = '55917935-4c63d9c4d75af8f3d831e21a6';
const UA = 'Mozilla/5.0';

const dests = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));
const issues = JSON.parse(fs.readFileSync('/tmp/review_img/issues.json', 'utf-8')).issues;

// 既存全画像のmd5記録（同一画像回避用）
console.log('既存md5記録中...');
const existingMd5 = new Set();
for (const x of dests) {
  const p = path.join(IMG_DIR, x.id, 'main.jpg');
  if (fs.existsSync(p)) {
    existingMd5.add(crypto.createHash('md5').update(fs.readFileSync(p)).digest('hex'));
  }
}
console.log(`既存ユニーク画像: ${existingMd5.size}件`);

function get(url) {
  return new Promise((resolve, reject) => {
    let hops = 0;
    function go(u) {
      hops++;
      if (hops > 5) return reject(new Error('redirects'));
      https.get(u, { headers: { 'User-Agent': UA, 'Accept': 'application/json' } }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume(); return go(res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, u).toString());
        }
        if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
        let body = ''; res.setEncoding('utf-8');
        res.on('data', c => body += c);
        res.on('end', () => resolve(body));
      }).on('error', reject);
    }
    go(url);
  });
}
function download(url, dest) {
  return new Promise((resolve, reject) => {
    let hops = 0;
    function go(u) {
      hops++;
      if (hops > 5) return reject(new Error('redirects'));
      https.get(u, { headers: { 'User-Agent': UA } }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume(); return go(res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, u).toString());
        }
        if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
        const f = fs.createWriteStream(dest);
        res.pipe(f);
        f.on('finish', () => f.close(resolve));
      }).on('error', reject);
    }
    go(url);
  });
}

async function pixabayMulti(name, prefecture, tags) {
  const prefShort = (prefecture || '').replace(/[県府都]$/, '');
  const tag1 = (tags || [])[0] || '';
  const tag2 = (tags || [])[1] || '';
  // 多様なクエリ (5パターン)
  const queries = [
    `${name} 風景`,
    `${name} ${prefShort} 観光`,
    `${name} ${tag1}`,
    `${prefShort} ${tag1} ${tag2}`,
    `${name} 自然`,
  ].map(q => q.trim()).filter(q => q.length > 1);

  // 各クエリで多様な orderで複数候補取得 → 既存md5と異なる画像を選ぶ
  for (const q of queries) {
    for (const order of ['latest', 'popular', 'ec']) {
      try {
        const url = `https://pixabay.com/api/?key=${PIXABAY_KEY}&q=${encodeURIComponent(q)}&image_type=photo&lang=ja&per_page=10&safesearch=true&order=${order}`;
        const body = await get(url);
        const j = JSON.parse(body);
        const hits = j?.hits || [];
        for (const hit of hits) {
          const imgUrl = hit?.largeImageURL || hit?.webformatURL;
          if (!imgUrl) continue;
          // PixabayURLから ID/サイズで重複判定（事前検出は不可、ダウンロードしてmd5取る）
          return imgUrl;
        }
      } catch {}
      await new Promise(r => setTimeout(r, 600));
    }
  }
  return null;
}

const targets = issues.map(i => i.id);
console.log(`📷 再取得対象: ${targets.length}件`);

let success = 0, skipped = 0, fail = 0;
for (let i = 0; i < targets.length; i++) {
  const id = targets[i];
  const d = dests.find(x => x.id === id);
  if (!d) { fail++; continue; }
  // 既存ファイル削除
  const folder = path.join(IMG_DIR, id);
  const dst = path.join(folder, 'main.jpg');
  if (fs.existsSync(dst)) {
    const oldMd5 = crypto.createHash('md5').update(fs.readFileSync(dst)).digest('hex');
    existingMd5.delete(oldMd5);
    fs.unlinkSync(dst);
  }
  // 再取得
  const img = await pixabayMulti(d.name, d.prefecture, d.tags);
  if (img) {
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
    try {
      await download(img, dst);
      const size = fs.statSync(dst).size;
      if (size > 5000) {
        const newMd5 = crypto.createHash('md5').update(fs.readFileSync(dst)).digest('hex');
        if (existingMd5.has(newMd5)) {
          // 重複 → skip (削除)
          fs.unlinkSync(dst);
          skipped++;
        } else {
          existingMd5.add(newMd5);
          if (!d.images) d.images = [];
          if (!d.images.some(p => p === `/images/${id}/main.jpg`)) d.images.unshift(`/images/${id}/main.jpg`);
          success++;
        }
      } else { fs.unlinkSync(dst); fail++; }
    } catch { fail++; }
  } else fail++;

  if ((i+1) % 20 === 0 || i+1 === targets.length) {
    console.log(`  [${i+1}/${targets.length}] ✓${success} skip(dup)${skipped} ✗${fail}`);
    fs.writeFileSync(DEST_FILE, JSON.stringify(dests, null, 2));
  }
}
fs.writeFileSync(DEST_FILE, JSON.stringify(dests, null, 2));
console.log(`\n=== 完了 === ✓${success} skip${skipped} ✗${fail}`);
