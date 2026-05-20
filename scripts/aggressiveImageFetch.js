#!/usr/bin/env node
/**
 * aggressiveImageFetch.js
 * 画像なし全件に対し、多パターンクエリで再取得。
 * クエリ生成: 日本語名・英語名(romaji)・地域名+名前・地域名+特性
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
const destinations = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));

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
async function summary(lang, title) {
  try {
    const body = await get(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
    const j = JSON.parse(body);
    return j?.originalimage?.source || j?.thumbnail?.source || null;
  } catch { return null; }
}
async function pageImages(lang, query) {
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
async function commonsSearch(query) {
  try {
    const body = await get(`https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=3&gsrsearch=${encodeURIComponent(query)}&prop=imageinfo&iiprop=url&iiurlwidth=1200&origin=*`);
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
async function unsplashSearch(query) {
  try {
    const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`,
      { headers: { Authorization: `Client-ID ${UNSPLASH}` } });
    if (!res.ok) return null;
    const j = await res.json();
    return j?.results?.[0]?.urls?.regular || null;
  } catch { return null; }
}

function buildQueries(d) {
  const queries = [];
  // 1) 日本語: 名前
  queries.push(['ja-name', d.name]);
  // 2) 日本語: 名前+都道府県
  if (d.prefecture) queries.push(['ja-name-pref', `${d.name} ${d.prefecture}`]);
  // 3) 日本語: 都市・市町村名 (id から推定)
  if (d.city) queries.push(['ja-city', d.city]);
  // 4) 日本語: 最初のspot名
  const sp = (d.spots || [])[0];
  if (sp?.name) queries.push(['ja-spot1', sp.name]);
  // 5) 日本語: spot + 都道府県
  if (sp?.name && d.prefecture) queries.push(['ja-spot1-pref', `${sp.name} ${d.prefecture}`]);
  // 6) 都道府県観光
  if (d.prefecture) queries.push(['ja-pref-tourism', `${d.prefecture} 観光`]);
  // 7) 英語/汎用: tags系
  const tagsEn = { '温泉':'onsen', '神社':'shrine', '城':'castle', '海':'beach', '山':'mountain',
                   '滝':'waterfall', '紅葉':'autumn leaves japan', '桜':'cherry blossom',
                   '夜景':'night view', '街':'town', '渓谷':'gorge', '湖':'lake', '島':'island' };
  for (const t of (d.tags || []).slice(0, 3)) {
    const en = tagsEn[t];
    if (en) queries.push([`unsplash-tag`, `${en} japan`]);
  }
  return queries;
}

const targets = destinations.filter(d => !d.images || d.images.length === 0);
console.log(`📷 画像取得対象: ${targets.length}件`);

let success = 0, fail = 0;
for (let i = 0; i < targets.length; i++) {
  const d = targets[i];
  const queries = buildQueries(d);
  let img = null, source = null;
  // Wikipedia 系優先
  for (const [tag, q] of queries) {
    if (!tag.startsWith('unsplash')) {
      img = await summary('ja', q);
      if (img) { source = `wiki-summary-ja:${q}`; break; }
      await new Promise(r => setTimeout(r, 500));
      img = await pageImages('ja', q);
      if (img) { source = `wiki-pi-ja:${q}`; break; }
      await new Promise(r => setTimeout(r, 500));
    }
  }
  // Commons
  if (!img) {
    for (const [tag, q] of queries.slice(0, 3)) {
      img = await commonsSearch(q);
      if (img) { source = `commons:${q}`; break; }
      await new Promise(r => setTimeout(r, 500));
    }
  }
  // Unsplash 最後の砦
  if (!img) {
    for (const [tag, q] of queries) {
      img = await unsplashSearch(q);
      if (img) { source = `unsplash:${q}`; break; }
      await new Promise(r => setTimeout(r, 1000));
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
        d.images = [`/images/${d.id}/main.jpg`];
        success++;
      } else {
        fs.unlinkSync(dst);
        fail++;
      }
    } catch { fail++; }
  } else fail++;

  if ((i+1) % 10 === 0 || i+1 === targets.length) {
    console.log(`  [${i+1}/${targets.length}] ✓${success} ✗${fail}`);
    fs.writeFileSync(DEST_FILE, JSON.stringify(destinations, null, 2));
  }
  await new Promise(r => setTimeout(r, 1500));
}
fs.writeFileSync(DEST_FILE, JSON.stringify(destinations, null, 2));
const remaining = destinations.filter(d => !d.images || d.images.length === 0).length;
console.log(`\n=== 完了 ===`);
console.log(`  成功: ${success} / 失敗: ${fail}`);
console.log(`  最終画像なし: ${remaining}件 (${destinations.length}件中, ${((destinations.length-remaining)/destinations.length*100).toFixed(1)}%)`);
