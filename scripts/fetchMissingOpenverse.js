#!/usr/bin/env node
/**
 * fetchMissingOpenverse.js
 * 画像なし全件に対し以下の優先順位で取得:
 *   1. Openverse API (api.openverse.engineering) - キー不要・CC画像横断検索
 *   2. Wikipedia summary (ja/en) - 前回429された可能性のあるものを再試行
 *   3. Unsplash
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
const dests = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));

const missing = dests.filter(d => !fs.existsSync(path.join(IMG_DIR, d.id, 'main.jpg')) || fs.statSync(path.join(IMG_DIR, d.id, 'main.jpg')).size < 5000);
console.log(`📷 取得対象: ${missing.length}件`);

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

async function openverse(query) {
  try {
    const url = `https://api.openverse.engineering/v1/images/?q=${encodeURIComponent(query)}&page_size=3&aspect_ratio=wide&license_type=commercial`;
    const body = await get(url);
    const j = JSON.parse(body);
    const r = j?.results?.find(x => x?.url) || j?.results?.[0];
    return r?.url || null;
  } catch { return null; }
}
async function wikiSummary(lang, title) {
  try {
    const body = await get(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
    const j = JSON.parse(body);
    return j?.originalimage?.source || j?.thumbnail?.source || null;
  } catch { return null; }
}
async function unsplash(q) {
  try {
    const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=1&orientation=landscape`,
      { headers: { Authorization: `Client-ID ${UNSPLASH}` } });
    if (!res.ok) return null;
    const j = await res.json();
    return j?.results?.[0]?.urls?.regular || null;
  } catch { return null; }
}

let success = 0, fail = 0;
const stats = { openverse: 0, wiki: 0, unsplash: 0 };

for (let i = 0; i < missing.length; i++) {
  const d = missing[i];
  const queries = [
    `${d.name} ${d.prefecture || ''}`.trim(),
    d.name,
    `${d.prefecture || ''} ${(d.tags || [])[0] || ''}`.trim(),
  ].filter(q => q.length > 1);

  let img = null, src = null;
  // 1. Openverse
  for (const q of queries.slice(0, 2)) {
    img = await openverse(q);
    if (img) { src = 'openverse'; break; }
    await new Promise(r => setTimeout(r, 1500));
  }
  // 2. Wikipedia
  if (!img) {
    for (const q of queries.slice(0, 2)) {
      img = await wikiSummary('ja', q);
      if (img) { src = 'wiki'; break; }
      await new Promise(r => setTimeout(r, 1500));
    }
  }
  // 3. Unsplash
  if (!img) {
    for (const q of queries) {
      img = await unsplash(q + ' japan');
      if (img) { src = 'unsplash'; break; }
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  if (img) {
    const folder = path.join(IMG_DIR, d.id);
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
    const dst = path.join(folder, 'main.jpg');
    try {
      await download(img, dst);
      const size = fs.statSync(dst).size;
      if (size > 5000) {
        d.images = d.images || [];
        if (!d.images.some(p => p === `/images/${d.id}/main.jpg`)) d.images.unshift(`/images/${d.id}/main.jpg`);
        success++;
        stats[src]++;
      } else {
        fs.unlinkSync(dst);
        fail++;
      }
    } catch { fail++; }
  } else fail++;

  if ((i+1) % 20 === 0 || i+1 === missing.length) {
    console.log(`  [${i+1}/${missing.length}] ✓${success} ✗${fail} (ov=${stats.openverse} wiki=${stats.wiki} un=${stats.unsplash})`);
    fs.writeFileSync(DEST_FILE, JSON.stringify(dests, null, 2));
  }
}
fs.writeFileSync(DEST_FILE, JSON.stringify(dests, null, 2));
console.log(`\n=== 完了 ===`);
console.log(`  ✓ ${success}件 / ✗ ${fail}件`);
console.log(`  ソース内訳: Openverse=${stats.openverse}, Wikipedia=${stats.wiki}, Unsplash=${stats.unsplash}`);
