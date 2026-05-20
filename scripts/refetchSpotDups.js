#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import https from 'https';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEST_FILE = path.join(__dirname, '../src/data/destinations.json');
const SPOT_DIR = path.join(__dirname, '../public/images/spots');
const PIXABAY_KEY = '55917935-4c63d9c4d75af8f3d831e21a6';
const UA = 'Mozilla/5.0';
const dests = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));
const targets = JSON.parse(fs.readFileSync('/tmp/spot_dups.json', 'utf-8'));

// 既存全spot画像のmd5
console.log('既存spot画像md5記録中...');
const existing = new Set();
for (const x of dests) {
  if (!x.spots) continue;
  for (let i = 0; i < x.spots.length; i++) {
    const p = path.join(SPOT_DIR, x.id, `${i}.jpg`);
    if (fs.existsSync(p)) existing.add(crypto.createHash('md5').update(fs.readFileSync(p)).digest('hex'));
  }
}
console.log(`既存ユニーク: ${existing.size}件`);

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

async function findUnique(name, prefecture) {
  const prefShort = (prefecture || '').replace(/[県府都]$/, '');
  const queries = [name, `${name} ${prefShort}`, `${name} 風景`];
  for (const q of queries) {
    if (!q.trim()) continue;
    for (let page = 1; page <= 3; page++) {
      try {
        const url = `https://pixabay.com/api/?key=${PIXABAY_KEY}&q=${encodeURIComponent(q)}&image_type=photo&lang=ja&per_page=20&page=${page}&safesearch=true`;
        const body = await get(url);
        const j = JSON.parse(body);
        for (const hit of j?.hits || []) {
          const imgUrl = hit.largeImageURL || hit.webformatURL;
          if (!imgUrl) continue;
          try {
            const buf = await downloadBuffer(imgUrl);
            if (buf.length < 5000) continue;
            const md5 = crypto.createHash('md5').update(buf).digest('hex');
            if (existing.has(md5)) continue;
            return { buf, md5 };
          } catch {}
        }
      } catch {}
      await new Promise(r => setTimeout(r, 600));
    }
  }
  return null;
}

let success = 0, cleared = 0;
for (let i = 0; i < targets.length; i++) {
  const t = targets[i];
  const d = dests.find(x => x.id === t.destId);
  if (!d?.spots?.[t.idx]) continue;
  // 既存削除
  const folder = path.join(SPOT_DIR, t.destId);
  const dst = path.join(folder, `${t.idx}.jpg`);
  let oldMd5 = null;
  if (fs.existsSync(dst)) {
    oldMd5 = crypto.createHash('md5').update(fs.readFileSync(dst)).digest('hex');
    existing.delete(oldMd5);
    fs.unlinkSync(dst);
  }
  const result = await findUnique(t.spotName, t.pref);
  if (result) {
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(dst, result.buf);
    existing.add(result.md5);
    d.spots[t.idx].imageUrl = `/images/spots/${t.destId}/${t.idx}.jpg`;
    success++;
  } else {
    // 取得失敗 → imageUrl削除
    if (d.spots[t.idx].imageUrl && d.spots[t.idx].imageUrl.includes(`/spots/${t.destId}/${t.idx}.jpg`)) {
      d.spots[t.idx].imageUrl = null;
    }
    cleared++;
  }
  if ((i+1) % 30 === 0 || i+1 === targets.length) {
    console.log(`  [${i+1}/${targets.length}] ✓${success} clear${cleared}`);
    fs.writeFileSync(DEST_FILE, JSON.stringify(dests, null, 2));
  }
}
fs.writeFileSync(DEST_FILE, JSON.stringify(dests, null, 2));
console.log(`\n=== 完了 === ✓${success} clear${cleared}`);
