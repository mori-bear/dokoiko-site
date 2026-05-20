#!/usr/bin/env node
/**
 * fetchSpotImages.js (v2)
 * 全destinationのspotsで画像なしのものを Commons → Openverse → Wikipedia で取得
 * 保存先: public/images/spots/{destId}/{spotIdx}.jpg
 * 並列8で実行
 */
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEST_FILE = path.join(__dirname, '../src/data/destinations.json');
const IMG_DIR = path.join(__dirname, '../public/images/spots');
const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf-8');
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.+)$/);
  if (m) process.env[m[1]] = m[2].trim();
}
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 Safari/605.1.15';

const dests = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));

const queue = [];
for (const d of dests) {
  if (!d.spots) continue;
  for (let i = 0; i < d.spots.length; i++) {
    const s = d.spots[i];
    if (s.imageUrl || s.image) continue;
    queue.push({ destId: d.id, destName: d.name, prefecture: d.prefecture, spotIdx: i, spotName: s.name });
  }
}
const TOTAL = queue.length;
console.log(`📷 spot画像取得: ${TOTAL}件 (並列8)`);

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
function download(url, dest) {
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
        const f = fs.createWriteStream(dest);
        res.pipe(f);
        f.on('finish', () => f.close(resolve));
      }).on('error', reject);
    }
    go(url);
  });
}
async function commons(q) {
  try {
    const body = await get(`https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=3&gsrsearch=${encodeURIComponent(q)}&prop=imageinfo&iiprop=url&iiurlwidth=1000&origin=*`);
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
async function openverse(q) {
  try {
    const body = await get(`https://api.openverse.engineering/v1/images/?q=${encodeURIComponent(q)}&page_size=3&aspect_ratio=wide&license_type=commercial`);
    const j = JSON.parse(body);
    return j?.results?.[0]?.url || null;
  } catch { return null; }
}
async function wikiSum(title) {
  try {
    const body = await get(`https://ja.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
    const j = JSON.parse(body);
    return j?.originalimage?.source || j?.thumbnail?.source || null;
  } catch { return null; }
}

let processed = 0, success = 0, fail = 0;
const updates = {};

async function worker() {
  while (queue.length) {
    const t = queue.shift();
    if (!t) break;
    const prefShort = (t.prefecture || '').replace(/[県府都]$/, '');
    const q1 = `${t.spotName} ${prefShort}`;
    const q2 = t.spotName;

    let img = await commons(q1) || await commons(q2);
    if (!img) img = await openverse(q1) || await openverse(q2);
    if (!img) img = await wikiSum(t.spotName);

    if (img) {
      const folder = path.join(IMG_DIR, t.destId);
      if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
      const dst = path.join(folder, `${t.spotIdx}.jpg`);
      try {
        await download(img, dst);
        const size = fs.statSync(dst).size;
        if (size > 5000) {
          updates[t.destId] = updates[t.destId] || [];
          updates[t.destId].push({ idx: t.spotIdx, url: `/images/spots/${t.destId}/${t.spotIdx}.jpg` });
          success++;
        } else { fs.unlinkSync(dst); fail++; }
      } catch { fail++; }
    } else fail++;
    processed++;
    if (processed % 100 === 0) {
      console.log(`  ${processed}/${TOTAL} ✓${success} ✗${fail}`);
      for (const [destId, list] of Object.entries(updates)) {
        const d = dests.find(x => x.id === destId);
        if (d?.spots) for (const u of list) if (d.spots[u.idx]) d.spots[u.idx].imageUrl = u.url;
      }
      fs.writeFileSync(DEST_FILE, JSON.stringify(dests, null, 2));
    }
  }
}

await Promise.all(Array.from({length:8}, () => worker()));
for (const [destId, list] of Object.entries(updates)) {
  const d = dests.find(x => x.id === destId);
  if (d?.spots) for (const u of list) if (d.spots[u.idx]) d.spots[u.idx].imageUrl = u.url;
}
fs.writeFileSync(DEST_FILE, JSON.stringify(dests, null, 2));
console.log(`\n=== 完了 === ✓${success} ✗${fail}`);
