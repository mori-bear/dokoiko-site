#!/usr/bin/env node
/**
 * fillMissingImages.js
 * images未設定の destination に Wikipedia Commons から画像を取得して main.jpg として保存。
 * - Wikipedia 検索 → ヒットしたら画像取得
 * - 失敗時はprefecture画像のジェネリックフォールバック
 */
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEST_FILE = path.join(__dirname, '../src/data/destinations.json');
const IMAGES_DIR = path.join(__dirname, '../public/images');

const destinations = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));

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
  } catch (e) { return null; }
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const opts = { headers: { 'User-Agent': 'dokoiko/1.0 (https://tabidokoiko.com)' } };
    let hops = 0;
    function go(u) {
      hops++;
      if (hops > 5) return reject(new Error('redirects'));
      https.get(u, opts, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return go(res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, u).toString());
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
      }).on('error', reject);
    }
    go(url);
  });
}

const targets = destinations.filter(d => !d.images || d.images.length === 0);
console.log(`📷 画像補完対象: ${targets.length}件`);

let success = 0, fail = 0;
for (let i = 0; i < targets.length; i++) {
  const d = targets[i];
  const folder = path.join(IMAGES_DIR, d.id);
  if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
  const mainPath = path.join(folder, 'main.jpg');

  // 複数のクエリパターンを試す
  const queries = [
    `${d.name}`,
    `${d.name} ${d.prefecture}`,
    `${(d.spots||[]).map(s=>s.name)[0]||''} ${d.prefecture}`.trim(),
    `${d.prefecture} 観光`,
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
    } catch (e) {
      fail++;
    }
  } else {
    fail++;
  }

  if ((i + 1) % 25 === 0) {
    console.log(`  ${i+1}/${targets.length}: 成功${success} 失敗${fail}`);
    fs.writeFileSync(DEST_FILE, JSON.stringify(destinations, null, 2));
  }
  await new Promise(r => setTimeout(r, 200));
}

fs.writeFileSync(DEST_FILE, JSON.stringify(destinations, null, 2));
console.log(`\n完了: 成功${success}件 / 失敗${fail}件`);
