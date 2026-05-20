#!/usr/bin/env node
/**
 * overnightImageFetch.js
 * 画像なしdestination全件に対し、5パターン×3手段で取得を試みる。
 * 順序: Wikipedia summary (ja/en) → Wikimedia Commons → Unsplash
 * リクエスト間隔: 2秒
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
const missing = JSON.parse(fs.readFileSync('/tmp/missing_images.json', 'utf-8'));
console.log(`📷 夜間取得: ${missing.length}件 (2秒間隔)`);

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

async function wikiSummary(lang, title) {
  try {
    const body = await get(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
    const j = JSON.parse(body);
    return j?.originalimage?.source || j?.thumbnail?.source || null;
  } catch { return null; }
}
async function wikiPageImages(lang, q) {
  try {
    const body = await get(`https://${lang}.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&piprop=thumbnail|original&pithumbsize=1200&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrlimit=3&origin=*`);
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
async function commonsSearch(q) {
  try {
    const body = await get(`https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=3&gsrsearch=${encodeURIComponent(q)}&prop=imageinfo&iiprop=url&iiurlwidth=1200&origin=*`);
    const j = JSON.parse(body);
    const pages = j?.query?.pages;
    if (!pages) return null;
    for (const p of Object.values(pages)) {
      const ii = p?.imageinfo?.[0];
      if (ii?.thumburl) return ii.thumburl;
      if (ii?.url) return ii.url;
    }
    return null;
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

const TAG_EN = {
  '温泉': 'onsen japan', '神社': 'shrine japan', '城': 'castle japan', '海': 'beach japan',
  '山': 'mountain japan', '滝': 'waterfall japan', '紅葉': 'autumn leaves japan',
  '桜': 'cherry blossom japan', '夜景': 'night view japan', '街': 'town japan',
  '渓谷': 'gorge japan', '湖': 'lake japan', '島': 'island japan', '温泉地': 'hot spring japan',
  '寺社': 'temple shrine japan', '街歩き': 'town japan', '自然': 'nature japan',
};

function buildQueries(d) {
  const queries = [];
  const prefShort = (d.pref || '').replace(/[県府都]$/, '');
  // 1. 名前+pref日本語
  if (d.name && prefShort) queries.push(['wiki-ja', `${d.name} ${prefShort}`]);
  // 2. 名前単独
  if (d.name) queries.push(['wiki-ja-name', d.name]);
  // 3. 英語ローマ字 (id ベース)
  const idEn = d.id.replace(/[^a-zA-Z0-9_\-]/g, ' ').replace(/_/g, ' ').trim();
  if (idEn) queries.push(['wiki-en', idEn]);
  // 4. Unsplash: prefecture + tag
  if (prefShort && d.tags?.[0]) {
    const en = TAG_EN[d.tags[0]];
    if (en) queries.push(['unsplash', `${en}`]);
    queries.push(['unsplash-pref', `${prefShort} japan`]);
  }
  // 5. Unsplash: 名前
  if (d.name) queries.push(['unsplash-name', `${d.name} japan`]);
  return queries.slice(0, 5);
}

async function resolveImage(d) {
  for (const [tag, q] of buildQueries(d)) {
    if (tag.startsWith('wiki-ja')) {
      let img = await wikiSummary('ja', q);
      if (img) return [img, `${tag}-summary:${q}`];
      await new Promise(r => setTimeout(r, 800));
      img = await wikiPageImages('ja', q);
      if (img) return [img, `${tag}-pi:${q}`];
    } else if (tag === 'wiki-en') {
      let img = await wikiSummary('en', q);
      if (img) return [img, `wiki-en-summary:${q}`];
      await new Promise(r => setTimeout(r, 800));
      img = await wikiPageImages('en', q);
      if (img) return [img, `wiki-en-pi:${q}`];
    } else if (tag.startsWith('unsplash')) {
      const img = await unsplash(q);
      if (img) return [img, `${tag}:${q}`];
    }
    await new Promise(r => setTimeout(r, 2000)); // 2秒間隔
  }
  // 最後: commons search
  for (const [, q] of buildQueries(d).slice(0, 3)) {
    const img = await commonsSearch(q);
    if (img) return [img, `commons:${q}`];
    await new Promise(r => setTimeout(r, 2000));
  }
  return [null, null];
}

let success = 0, fail = 0;
for (let i = 0; i < missing.length; i++) {
  const d = missing[i];
  try {
    const [img, source] = await resolveImage(d);
    if (img) {
      const folder = path.join(IMG_DIR, d.id);
      if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
      const dst = path.join(folder, 'main.jpg');
      await download(img, dst);
      const size = fs.statSync(dst).size;
      if (size > 5000) {
        const j = dests.find(x => x.id === d.id);
        if (j) {
          j.images = j.images || [];
          if (!j.images.some(p => p === `/images/${d.id}/main.jpg`)) {
            j.images.unshift(`/images/${d.id}/main.jpg`);
          }
        }
        success++;
      } else {
        fs.unlinkSync(dst);
        fail++;
      }
    } else fail++;
  } catch { fail++; }
  if ((i+1) % 20 === 0 || i+1 === missing.length) {
    console.log(`  [${i+1}/${missing.length}] ✓${success} ✗${fail}`);
    fs.writeFileSync(DEST_FILE, JSON.stringify(dests, null, 2));
  }
}
fs.writeFileSync(DEST_FILE, JSON.stringify(dests, null, 2));
console.log(`\n=== 完了 ===`);
console.log(`  ✓ ${success}件 / ✗ ${fail}件`);
