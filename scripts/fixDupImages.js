#!/usr/bin/env node
/**
 * fixDupImages.js
 * md5重複の汎用画像を削除 + Pixabay再取得
 * - destination: 3件以上重複 → 全削除
 * - spots: 4件以上重複 → 全削除
 * 削除後、より具体的クエリで再取得 ({name} {prefecture} {tag})
 */
import fs from 'fs';
import path from 'path';
import https from 'https';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEST_FILE = path.join(__dirname, '../src/data/destinations.json');
const IMG_DIR = path.join(__dirname, '../public/images');
const SPOT_DIR = path.join(IMG_DIR, 'spots');
const PIXABAY_KEY = '55917935-4c63d9c4d75af8f3d831e21a6';
const UA = 'Mozilla/5.0';

const dests = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));

function md5(p) {
  return crypto.createHash('md5').update(fs.readFileSync(p)).digest('hex');
}

// 重複検出
const destMd5 = {}; const spotMd5 = {};
for (const x of dests) {
  const dp = path.join(IMG_DIR, x.id, 'main.jpg');
  if (fs.existsSync(dp)) {
    const h = md5(dp);
    (destMd5[h] = destMd5[h] || []).push({ id: x.id, name: x.name, prefecture: x.prefecture, path: dp });
  }
  if (x.spots) for (let i = 0; i < x.spots.length; i++) {
    const sp = path.join(SPOT_DIR, x.id, `${i}.jpg`);
    if (fs.existsSync(sp)) {
      const h = md5(sp);
      (spotMd5[h] = spotMd5[h] || []).push({ destId: x.id, idx: i, spotName: x.spots[i].name, prefecture: x.prefecture, path: sp });
    }
  }
}

// 削除対象
const destToDelete = Object.values(destMd5).filter(g => g.length >= 3).flat();
const spotToDelete = Object.values(spotMd5).filter(g => g.length >= 4).flat();
console.log(`dest削除: ${destToDelete.length}件 / spot削除: ${spotToDelete.length}件`);

// ファイル削除 + spot.imageUrl クリア
for (const d of destToDelete) {
  fs.unlinkSync(d.path);
  const idx = dests.findIndex(x => x.id === d.id);
  if (idx >= 0 && dests[idx].images) {
    dests[idx].images = dests[idx].images.filter(p => !p.includes(`${d.id}/main.jpg`));
  }
}
for (const s of spotToDelete) {
  fs.unlinkSync(s.path);
  const d = dests.find(x => x.id === s.destId);
  if (d?.spots?.[s.idx]) {
    const url = d.spots[s.idx].imageUrl;
    if (url && url.includes(`/spots/${s.destId}/${s.idx}.jpg`)) {
      d.spots[s.idx].imageUrl = null;
    }
  }
}
fs.writeFileSync(DEST_FILE, JSON.stringify(dests, null, 2));
console.log(`✓ ファイル削除完了`);

// Pixabay取得関数
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

async function pixabaySpecific(name, prefecture, tag) {
  // より具体的なクエリで取得 (汎用画像回避)
  const prefShort = (prefecture || '').replace(/[県府都]$/, '');
  const queries = [
    `${name} ${prefShort}`,
    `${name} 観光`,
    `${name} ${tag || ''}`.trim(),
    name,
  ].filter(q => q.length > 1);
  // 過去取得済みURL記録（同一画像回避）
  for (const q of queries) {
    try {
      const url = `https://pixabay.com/api/?key=${PIXABAY_KEY}&q=${encodeURIComponent(q)}&image_type=photo&lang=ja&per_page=5&safesearch=true&order=popular`;
      const body = await get(url);
      const j = JSON.parse(body);
      // 最上位を取得（既存と異なる結果を期待）
      if (j?.hits?.[0]?.largeImageURL) return j.hits[0].largeImageURL;
    } catch {}
    await new Promise(r => setTimeout(r, 700));
  }
  return null;
}

// 再取得: destination
let destRefetch = 0;
for (const d of destToDelete) {
  const destObj = dests.find(x => x.id === d.id);
  const tag = (destObj?.tags || [])[0] || '';
  const img = await pixabaySpecific(d.name, d.prefecture, tag);
  if (img) {
    const folder = path.join(IMG_DIR, d.id);
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
    const dst = path.join(folder, 'main.jpg');
    try {
      await download(img, dst);
      const size = fs.statSync(dst).size;
      if (size > 5000) {
        if (!destObj.images) destObj.images = [];
        if (!destObj.images.some(p => p === `/images/${d.id}/main.jpg`)) {
          destObj.images.unshift(`/images/${d.id}/main.jpg`);
        }
        destRefetch++;
      } else fs.unlinkSync(dst);
    } catch {}
  }
  if (destRefetch % 20 === 0 && destRefetch > 0) console.log(`  dest再取得 ${destRefetch}/${destToDelete.length}`);
}
console.log(`✓ dest再取得: ${destRefetch}件`);

// 再取得: spots
let spotRefetch = 0;
for (const s of spotToDelete) {
  const d = dests.find(x => x.id === s.destId);
  if (!d || !d.spots?.[s.idx]) continue;
  const tag = (d.tags || [])[0] || '';
  const img = await pixabaySpecific(s.spotName, s.prefecture, tag);
  if (img) {
    const folder = path.join(SPOT_DIR, s.destId);
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
    const dst = path.join(folder, `${s.idx}.jpg`);
    try {
      await download(img, dst);
      const size = fs.statSync(dst).size;
      if (size > 5000) {
        d.spots[s.idx].imageUrl = `/images/spots/${s.destId}/${s.idx}.jpg`;
        spotRefetch++;
      } else fs.unlinkSync(dst);
    } catch {}
  }
  if (spotRefetch % 100 === 0 && spotRefetch > 0) {
    console.log(`  spot再取得 ${spotRefetch}/${spotToDelete.length}`);
    fs.writeFileSync(DEST_FILE, JSON.stringify(dests, null, 2));
  }
}
fs.writeFileSync(DEST_FILE, JSON.stringify(dests, null, 2));
console.log(`\n=== 完了 ===`);
console.log(`  dest削除→再取得: ${destToDelete.length}→✓${destRefetch}`);
console.log(`  spot削除→再取得: ${spotToDelete.length}→✓${spotRefetch}`);
