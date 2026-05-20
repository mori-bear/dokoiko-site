#!/usr/bin/env node
/**
 * fillMissing8Unsplash.js
 * Wikipedia 429 でブロックされた残り8件を Unsplash で取得。
 * 落ちたものは Pixabay (key不要のため使えないので) しばらく後に再Wiki試行。
 */
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEST_FILE = path.join(__dirname, '../src/data/destinations.json');
const IMG_DIR = path.join(__dirname, '../public/images');

const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf-8');
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.+)$/);
  if (m) process.env[m[1]] = m[2].trim();
}
const KEY = process.env.UNSPLASH_ACCESS_KEY;

const destinations = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));

const QUERIES = {
  'izumi': ['cranes winter Japan', 'red crowned crane Japan', 'Japanese crane flock', 'wetland Kagoshima'],
  'kurobe-gorge': ['gorge Japan train', 'mountain valley Japan', 'Japan alps gorge', 'Kurobe dam Toyama'],
  'shisui': ['outlet mall', 'shopping mall Japan', 'premium outlets'],
  'ryugado': ['limestone cave Japan', 'cave stalactite Japan', 'underground cave Japan', 'Japan cave tourism'],
};

function downloadHttps(url, dest) {
  return new Promise((resolve, reject) => {
    let hops = 0;
    function go(u) {
      hops++;
      if (hops > 5) return reject(new Error('redirects'));
      https.get(u, { headers: { 'User-Agent': 'dokoiko/1.0' } }, res => {
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

async function searchUnsplash(query) {
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`;
  try {
    const res = await fetch(url, { headers: { Authorization: `Client-ID ${KEY}` } });
    if (!res.ok) return null;
    const j = await res.json();
    return j?.results?.[0]?.urls?.regular || null;
  } catch { return null; }
}

let success = 0, fail = 0;
for (const [id, queries] of Object.entries(QUERIES)) {
  let img = null, hit = null;
  for (const q of queries) {
    img = await searchUnsplash(q);
    if (img) { hit = q; break; }
    await new Promise(r => setTimeout(r, 1500));
  }
  if (img) {
    const folder = path.join(IMG_DIR, id);
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
    const dst = path.join(folder, 'main.jpg');
    try {
      await downloadHttps(img, dst);
      const size = fs.statSync(dst).size;
      if (size > 0) {
        const d = destinations.find(x => x.id === id);
        if (d) d.images = [`/images/${id}/main.jpg`];
        success++;
        console.log(`✓ ${id} [Unsplash: "${hit}"] ${size}B`);
      } else {
        fs.unlinkSync(dst);
        fail++;
        console.log(`✗ ${id}: 0-byte`);
      }
    } catch (e) {
      fail++;
      console.log(`✗ ${id}: ${e.message}`);
    }
  } else {
    fail++;
    console.log(`✗ ${id}: Unsplash 0 results`);
  }
  // Unsplash free tier: 50/hr → 72秒/件で安全だが、8件なら速くてもOK
  await new Promise(r => setTimeout(r, 2000));
}

fs.writeFileSync(DEST_FILE, JSON.stringify(destinations, null, 2));
console.log(`\n=== 完了 ===`);
console.log(`  成功: ${success} / 失敗: ${fail}`);
