#!/usr/bin/env node
/**
 * refetchPageRetry.js
 * 重複画像286件を別アプローチで取得:
 *  1. Pixabay page=1〜5 で重複回避
 *  2. 英語クエリ (romaji + descriptive English) で試行
 *  3. Wikimedia Commons (ja/en)
 *  4. Openverse
 * 全既存画像のmd5をSetに記録、新規取得後md5重複ならリトライ
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
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 Safari/605.1.15';

const dests = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));
const issues = JSON.parse(fs.readFileSync('/tmp/review_img/issues.json', 'utf-8')).issues;

// 全既存画像のmd5
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
function downloadBuffer(url) {
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
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      }).on('error', reject);
    }
    go(url);
  });
}

async function pixabaySearch(q, page) {
  try {
    const url = `https://pixabay.com/api/?key=${PIXABAY_KEY}&q=${encodeURIComponent(q)}&image_type=photo&lang=ja&per_page=20&page=${page}&safesearch=true`;
    const body = await get(url);
    const j = JSON.parse(body);
    return j?.hits || [];
  } catch { return []; }
}
async function commonsSearch(q) {
  try {
    const body = await get(`https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=5&gsrsearch=${encodeURIComponent(q)}&prop=imageinfo&iiprop=url&iiurlwidth=1200&origin=*`);
    const j = JSON.parse(body);
    const pages = j?.query?.pages;
    if (!pages) return [];
    return Object.values(pages).map(p => p?.imageinfo?.[0]?.thumburl || p?.imageinfo?.[0]?.url).filter(Boolean);
  } catch { return []; }
}
async function openverse(q) {
  try {
    const body = await get(`https://api.openverse.engineering/v1/images/?q=${encodeURIComponent(q)}&page_size=5&aspect_ratio=wide&license_type=commercial`);
    const j = JSON.parse(body);
    return (j?.results || []).map(r => r.url).filter(Boolean);
  } catch { return []; }
}

// 名前→英語簡易マップ (汎用語彙)
function toEnglishQuery(name, prefecture) {
  const prefShort = (prefecture || '').replace(/[県府都]$/, '');
  const TAGS = {
    '温泉': 'onsen hot spring japan',
    '神社': 'shrine japan',
    '城': 'castle japan',
    '島': 'island japan',
    '海': 'beach japan',
    '滝': 'waterfall japan',
    '渓谷': 'gorge japan',
    '峠': 'mountain pass japan',
    '岬': 'cape japan',
    '湖': 'lake japan',
    '湿原': 'wetland japan',
  };
  for (const [k, en] of Object.entries(TAGS)) {
    if (name.includes(k)) return `${en} ${prefShort}`;
  }
  return `${prefShort} japan landscape`;
}

async function findUnique(d) {
  const prefShort = (d.prefecture || '').replace(/[県府都]$/, '');
  // 1. Pixabay page 1-5 で日本語クエリ
  const queries = [
    `${d.name}`,
    `${d.name} ${prefShort}`,
    `${d.name} 風景`,
    `${prefShort} ${(d.tags || [])[0] || ''}`.trim(),
  ];
  for (const q of queries) {
    if (!q.trim()) continue;
    for (let page = 1; page <= 5; page++) {
      const hits = await pixabaySearch(q, page);
      for (const hit of hits) {
        const imgUrl = hit.largeImageURL || hit.webformatURL;
        if (!imgUrl) continue;
        try {
          const buf = await downloadBuffer(imgUrl);
          if (buf.length < 5000) continue;
          const md5 = crypto.createHash('md5').update(buf).digest('hex');
          if (existingMd5.has(md5)) continue;
          return { buf, md5, source: `pixabay-p${page}` };
        } catch {}
      }
      await new Promise(r => setTimeout(r, 600));
    }
  }
  // 2. 英語クエリ
  const enQ = toEnglishQuery(d.name, d.prefecture);
  for (let page = 1; page <= 3; page++) {
    const hits = await pixabaySearch(enQ, page);
    for (const hit of hits) {
      const imgUrl = hit.largeImageURL || hit.webformatURL;
      if (!imgUrl) continue;
      try {
        const buf = await downloadBuffer(imgUrl);
        if (buf.length < 5000) continue;
        const md5 = crypto.createHash('md5').update(buf).digest('hex');
        if (existingMd5.has(md5)) continue;
        return { buf, md5, source: `pixabay-en-p${page}` };
      } catch {}
    }
    await new Promise(r => setTimeout(r, 600));
  }
  // 3. Wikimedia Commons (ja → en)
  for (const q of [d.name, `${d.name} ${prefShort}`, enQ]) {
    const urls = await commonsSearch(q);
    for (const imgUrl of urls) {
      try {
        const buf = await downloadBuffer(imgUrl);
        if (buf.length < 5000) continue;
        const md5 = crypto.createHash('md5').update(buf).digest('hex');
        if (existingMd5.has(md5)) continue;
        return { buf, md5, source: `commons` };
      } catch {}
    }
    await new Promise(r => setTimeout(r, 600));
  }
  // 4. Openverse
  for (const q of [d.name, enQ]) {
    const urls = await openverse(q);
    for (const imgUrl of urls) {
      try {
        const buf = await downloadBuffer(imgUrl);
        if (buf.length < 5000) continue;
        const md5 = crypto.createHash('md5').update(buf).digest('hex');
        if (existingMd5.has(md5)) continue;
        return { buf, md5, source: `openverse` };
      } catch {}
    }
    await new Promise(r => setTimeout(r, 600));
  }
  return null;
}

const targets = issues.map(i => i.id);
console.log(`📷 再取得対象: ${targets.length}件`);

let success = 0, fail = 0;
const stats = {};
for (let i = 0; i < targets.length; i++) {
  const id = targets[i];
  const d = dests.find(x => x.id === id);
  if (!d) { fail++; continue; }
  // 既存ファイルmd5を取得元から削除（差し替え可能に）
  const folder = path.join(IMG_DIR, id);
  const dst = path.join(folder, 'main.jpg');
  let oldMd5 = null;
  if (fs.existsSync(dst)) {
    oldMd5 = crypto.createHash('md5').update(fs.readFileSync(dst)).digest('hex');
    existingMd5.delete(oldMd5);
  }
  const result = await findUnique(d);
  if (result) {
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(dst, result.buf);
    existingMd5.add(result.md5);
    if (!d.images) d.images = [];
    if (!d.images.some(p => p === `/images/${id}/main.jpg`)) d.images.unshift(`/images/${id}/main.jpg`);
    success++;
    stats[result.source] = (stats[result.source] || 0) + 1;
  } else {
    // 失敗 → 旧画像を復元 (oldMd5 もセットに戻す)
    if (oldMd5) existingMd5.add(oldMd5);
    fail++;
  }
  if ((i+1) % 20 === 0 || i+1 === targets.length) {
    console.log(`  [${i+1}/${targets.length}] ✓${success} ✗${fail}`);
    fs.writeFileSync(DEST_FILE, JSON.stringify(dests, null, 2));
  }
}
fs.writeFileSync(DEST_FILE, JSON.stringify(dests, null, 2));
console.log(`\n=== 完了 === ✓${success} ✗${fail}`);
console.log('ソース内訳:', stats);
