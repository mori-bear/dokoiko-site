#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import https from 'https';
import crypto from 'crypto';
import struct from 'node:buffer';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEST_FILE = path.join(__dirname, '../src/data/destinations.json');
const IMG_DIR = path.join(__dirname, '../public/images');
const PIXABAY_KEY = '55917935-4c63d9c4d75af8f3d831e21a6';
const UA = 'Mozilla/5.0';

const dests = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));
const lowq = JSON.parse(fs.readFileSync('/tmp/lowq_images.json', 'utf-8'));
const allIds = new Set([...lowq.low_res.map(r => r[0]), ...lowq.low_size.map(r => r[0])]);
console.log(`📷 対象: ${allIds.size}件`);

// JPEG dimension reader
function jpegSize(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const m = buf[i+1];
    if (m >= 0xc0 && m <= 0xc3) {
      // SOF
      const h = (buf[i+5] << 8) | buf[i+6];
      const w = (buf[i+7] << 8) | buf[i+8];
      return { w, h };
    }
    const len = (buf[i+2] << 8) | buf[i+3];
    i += 2 + len;
  }
  return null;
}

// 既存md5
const existing = new Set();
for (const x of dests) {
  const p = path.join(IMG_DIR, x.id, 'main.jpg');
  if (fs.existsSync(p)) existing.add(crypto.createHash('md5').update(fs.readFileSync(p)).digest('hex'));
}

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

async function findHighQ(name, prefecture, currentSize, currentDim) {
  const prefShort = (prefecture || '').replace(/[県府都]$/, '');
  const queries = [`${name} ${prefShort}`, name, `${name} 風景`];
  for (const q of queries) {
    if (!q.trim()) continue;
    for (let page = 1; page <= 3; page++) {
      try {
        const url = `https://pixabay.com/api/?key=${PIXABAY_KEY}&q=${encodeURIComponent(q)}&image_type=photo&lang=ja&per_page=10&page=${page}&safesearch=true&min_width=800`;
        const body = await get(url);
        const j = JSON.parse(body);
        for (const hit of j?.hits || []) {
          const imgUrl = hit.largeImageURL || hit.webformatURL;
          if (!imgUrl) continue;
          try {
            const buf = await downloadBuffer(imgUrl);
            // サイズ check
            if (buf.length <= currentSize) continue;
            const dim = jpegSize(buf);
            if (dim && (dim.w < 800 || dim.h < 500)) continue;
            const md5 = crypto.createHash('md5').update(buf).digest('hex');
            if (existing.has(md5)) continue;
            return { buf, md5, dim };
          } catch {}
        }
      } catch {}
      await new Promise(r => setTimeout(r, 600));
    }
  }
  return null;
}

let upgraded = 0, kept = 0;
const ids = Array.from(allIds);
for (let i = 0; i < ids.length; i++) {
  const id = ids[i];
  const d = dests.find(x => x.id === id);
  if (!d) continue;
  const p = path.join(IMG_DIR, id, 'main.jpg');
  let currentSize = 0, currentDim = null;
  if (fs.existsSync(p)) {
    currentSize = fs.statSync(p).size;
    currentDim = jpegSize(fs.readFileSync(p));
  }
  const result = await findHighQ(d.name, d.prefecture, currentSize, currentDim);
  if (result) {
    // 旧画像のmd5を既存セットから削除
    if (fs.existsSync(p)) {
      const oldMd5 = crypto.createHash('md5').update(fs.readFileSync(p)).digest('hex');
      existing.delete(oldMd5);
    }
    const folder = path.join(IMG_DIR, id);
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(p, result.buf);
    existing.add(result.md5);
    if (!d.images) d.images = [];
    if (!d.images.some(x => x === `/images/${id}/main.jpg`)) d.images.unshift(`/images/${id}/main.jpg`);
    upgraded++;
  } else kept++;
  if ((i+1) % 10 === 0 || i+1 === ids.length) {
    console.log(`  [${i+1}/${ids.length}] upgrade=${upgraded} keep=${kept}`);
    fs.writeFileSync(DEST_FILE, JSON.stringify(dests, null, 2));
  }
}
fs.writeFileSync(DEST_FILE, JSON.stringify(dests, null, 2));
console.log(`\n=== 完了 === upgrade=${upgraded} keep=${kept}`);
