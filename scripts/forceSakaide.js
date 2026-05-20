#!/usr/bin/env node
/**
 * forceSakaide.js
 * sakaide の main.jpg を「瀬戸大橋 坂出」で強制差し替え
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

const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 Version/17.4 Safari/605.1.15';

function get(url) {
  return new Promise((resolve, reject) => {
    let hops = 0;
    function go(u) {
      hops++;
      if (hops > 5) return reject(new Error('redirects'));
      https.get(u, { headers: { 'User-Agent': BROWSER_UA, 'Accept': 'application/json' } }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return go(res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, u).toString());
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
      https.get(u, { headers: { 'User-Agent': BROWSER_UA } }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return go(res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, u).toString());
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

async function trySummary(lang, title) {
  try {
    const body = await get(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
    const j = JSON.parse(body);
    return j?.originalimage?.source || j?.thumbnail?.source || null;
  } catch { return null; }
}
async function tryPageImages(lang, query) {
  try {
    const body = await get(`https://${lang}.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&piprop=thumbnail|original&pithumbsize=1200&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=3&origin=*`);
    const j = JSON.parse(body);
    const pages = j?.query?.pages;
    if (!pages) return null;
    for (const p of Object.values(pages)) {
      if (p?.original?.source) return p.original.source;
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

const QUERIES_JA = ['瀬戸大橋', '瀬戸大橋 坂出', '坂出市'];
const QUERIES_EN = ['Great Seto Bridge', 'Seto Ohashi Bridge', 'Sakaide Kagawa'];

let img = null, source = null;
for (const q of QUERIES_JA) {
  img = await trySummary('ja', q);
  if (img) { source = `wiki-ja:${q}`; break; }
  await new Promise(r => setTimeout(r, 1500));
}
if (!img) {
  for (const q of QUERIES_EN) {
    img = await trySummary('en', q);
    if (img) { source = `wiki-en:${q}`; break; }
    await new Promise(r => setTimeout(r, 1500));
  }
}
if (!img) {
  for (const q of QUERIES_JA) {
    img = await tryPageImages('ja', q);
    if (img) { source = `wiki-pi:${q}`; break; }
    await new Promise(r => setTimeout(r, 1500));
  }
}
if (!img) {
  for (const q of QUERIES_EN) {
    img = await tryUnsplash(q);
    if (img) { source = `unsplash:${q}`; break; }
    await new Promise(r => setTimeout(r, 1500));
  }
}

if (!img) {
  console.log('✗ sakaide: 全API失敗');
  process.exit(1);
}

const folder = path.join(IMG_DIR, 'sakaide');
if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
const dst = path.join(folder, 'main.jpg');
await download(img, dst);
const size = fs.statSync(dst).size;
console.log(`✓ sakaide [${source}] ${size}B`);

if (size > 5000) {
  const destinations = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));
  const d = destinations.find(x => x.id === 'sakaide');
  if (d) {
    // 既存images先頭をmain.jpgに、その他はspot画像なので維持
    if (!d.images) d.images = [];
    d.images[0] = '/images/sakaide/main.jpg';
    fs.writeFileSync(DEST_FILE, JSON.stringify(destinations, null, 2));
    console.log('✓ destinations.json更新');
  }
} else {
  console.log('✗ size<5KB → 採用せず');
  fs.unlinkSync(dst);
}
