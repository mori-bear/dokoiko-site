#!/usr/bin/env node
/**
 * refillAllMissing.js
 * 画像なしdestination全件を Wikipedia + Unsplash hybrid で再取得。
 * 特別ルール: sakaide は「瀬戸大橋 坂出」で取得。
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
const UNSPLASH = process.env.UNSPLASH_ACCESS_KEY;

const destinations = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));

const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';

function get(url, headers = {}) {
  return new Promise((resolve, reject) => {
    let hops = 0;
    function go(u) {
      hops++;
      if (hops > 5) return reject(new Error('redirects'));
      https.get(u, { headers: { 'User-Agent': BROWSER_UA, 'Accept': 'application/json', ...headers } }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return go(res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, u).toString());
        }
        if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
        let body = '';
        res.setEncoding('utf-8');
        res.on('data', c => body += c);
        res.on('end', () => resolve(body));
      }).on('error', reject);
    }
    go(url);
  });
}

function download(url, dest, hostHeaders = {}) {
  return new Promise((resolve, reject) => {
    let hops = 0;
    function go(u) {
      hops++;
      if (hops > 5) return reject(new Error('redirects'));
      https.get(u, { headers: { 'User-Agent': BROWSER_UA, ...hostHeaders } }, res => {
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

async function trySummary(lang, title) {
  try {
    const body = await get(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
    const j = JSON.parse(body);
    return j?.thumbnail?.source || j?.originalimage?.source || null;
  } catch { return null; }
}

async function tryPageImages(lang, query) {
  try {
    const body = await get(`https://${lang}.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&piprop=thumbnail&pithumbsize=800&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=1&origin=*`);
    const j = JSON.parse(body);
    const pages = j?.query?.pages;
    if (!pages) return null;
    for (const p of Object.values(pages)) {
      if (p?.thumbnail?.source) return p.thumbnail.source;
    }
    return null;
  } catch { return null; }
}

async function tryUnsplash(query) {
  try {
    const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`,
      { headers: { Authorization: `Client-ID ${UNSPLASH}` } });
    if (!res.ok) return null;
    const j = await res.json();
    return j?.results?.[0]?.urls?.regular || null;
  } catch { return null; }
}

// 特別ルール: 坂出は「瀬戸大橋 坂出」で取得
const SPECIAL = {
  'sakaide': ['瀬戸大橋', '瀬戸大橋 坂出', 'Seto Ohashi Bridge'],
};

async function resolveImage(d) {
  const id = d.id;
  if (SPECIAL[id]) {
    for (const q of SPECIAL[id]) {
      let img = await trySummary('ja', q);
      if (img) return [img, `wiki-ja:${q}`];
      img = await trySummary('en', q);
      if (img) return [img, `wiki-en:${q}`];
      img = await tryPageImages('ja', q);
      if (img) return [img, `wiki-pi:${q}`];
      img = await tryUnsplash(q);
      if (img) return [img, `unsplash:${q}`];
      await new Promise(r => setTimeout(r, 1200));
    }
    return [null, null];
  }
  const queries = [
    d.name,
    `${d.name} ${d.prefecture || ''}`.trim(),
    (d.spots || []).map(s => s.name)[0] || '',
  ].filter(q => q && q.length > 1);

  for (const q of queries) {
    let img = await trySummary('ja', q);
    if (img) return [img, `wiki-ja:${q}`];
    await new Promise(r => setTimeout(r, 600));
  }
  // Wikipedia全敗ならUnsplash
  for (const q of queries) {
    const img = await tryUnsplash(q);
    if (img) return [img, `unsplash:${q}`];
    await new Promise(r => setTimeout(r, 1200));
  }
  // 最終: prefecture + tag
  if (d.prefecture && (d.tags || []).length > 0) {
    const img = await tryUnsplash(`${d.prefecture} ${d.tags[0]}`);
    if (img) return [img, `unsplash-fallback`];
  }
  return [null, null];
}

const targets = destinations.filter(d => !d.images || d.images.length === 0);
console.log(`再取得対象: ${targets.length}件`);

let success = 0, fail = 0;
for (let i = 0; i < targets.length; i++) {
  const d = targets[i];
  try {
    const [img, source] = await resolveImage(d);
    if (img) {
      const folder = path.join(IMG_DIR, d.id);
      if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
      const dst = path.join(folder, 'main.jpg');
      await download(img, dst);
      const size = fs.statSync(dst).size;
      if (size > 5000) {
        d.images = [`/images/${d.id}/main.jpg`];
        success++;
      } else {
        fs.unlinkSync(dst);
        fail++;
      }
    } else {
      fail++;
    }
  } catch (e) {
    fail++;
  }

  if ((i + 1) % 10 === 0 || i + 1 === targets.length) {
    console.log(`  [${i+1}/${targets.length}] ✓${success} ✗${fail}`);
    fs.writeFileSync(DEST_FILE, JSON.stringify(destinations, null, 2));
  }
  await new Promise(r => setTimeout(r, 1500));
}

fs.writeFileSync(DEST_FILE, JSON.stringify(destinations, null, 2));
const final_missing = destinations.filter(d => !d.images || d.images.length === 0).length;
console.log(`\n=== 完了 ===`);
console.log(`  成功: ${success} / 失敗: ${fail}`);
console.log(`  最終画像なし: ${final_missing}件 / 全${destinations.length}件`);
