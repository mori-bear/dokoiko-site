#!/usr/bin/env node
/**
 * pixabayFetchAll.js
 * Pixabay APIで destination本体 + spots の画像を取得
 * フォールバック: Openverse → Wikipedia
 */
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEST_FILE = path.join(__dirname, '../src/data/destinations.json');
const IMG_DIR = path.join(__dirname, '../public/images');
const SPOT_DIR = path.join(__dirname, '../public/images/spots');

const PIXABAY_KEY = '55917935-4c63d9c4d75af8f3d831e21a6';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 Safari/605.1.15';

const dests = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));

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

async function pixabay(q) {
  try {
    const url = `https://pixabay.com/api/?key=${PIXABAY_KEY}&q=${encodeURIComponent(q)}&image_type=photo&lang=ja&per_page=3&safesearch=true`;
    const body = await get(url);
    const j = JSON.parse(body);
    return j?.hits?.[0]?.largeImageURL || j?.hits?.[0]?.webformatURL || null;
  } catch { return null; }
}
async function openverse(q) {
  try {
    const body = await get(`https://api.openverse.engineering/v1/images/?q=${encodeURIComponent(q)}&page_size=3&aspect_ratio=wide&license_type=commercial`);
    const j = JSON.parse(body);
    return j?.results?.[0]?.url || null;
  } catch { return null; }
}
async function wikiSummary(title) {
  try {
    const body = await get(`https://ja.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
    const j = JSON.parse(body);
    return j?.originalimage?.source || j?.thumbnail?.source || null;
  } catch { return null; }
}

async function resolveImage(name, prefecture) {
  const prefShort = (prefecture || '').replace(/[県府都]$/, '');
  const queries = [name, prefShort ? `${name} ${prefShort}` : null].filter(Boolean);
  // 1. Pixabay
  for (const q of queries) {
    const img = await pixabay(q);
    if (img) return [img, 'pixabay'];
    await new Promise(r => setTimeout(r, 600));
  }
  // 2. Openverse
  for (const q of queries) {
    const img = await openverse(q);
    if (img) return [img, 'openverse'];
    await new Promise(r => setTimeout(r, 600));
  }
  // 3. Wikipedia
  for (const q of queries) {
    const img = await wikiSummary(q);
    if (img) return [img, 'wiki'];
    await new Promise(r => setTimeout(r, 600));
  }
  return [null, null];
}

// ====== STEP1: destination本体 ======
const missingDest = dests.filter(d => !fs.existsSync(path.join(IMG_DIR, d.id, 'main.jpg')));
console.log(`📷 STEP1 destination: ${missingDest.length}件`);

let destSuccess = 0, destFail = 0;
const destStats = { pixabay:0, openverse:0, wiki:0 };
for (let i = 0; i < missingDest.length; i++) {
  const d = missingDest[i];
  const [img, src] = await resolveImage(d.name, d.prefecture);
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
        destSuccess++; destStats[src]++;
      } else { fs.unlinkSync(dst); destFail++; }
    } catch { destFail++; }
  } else destFail++;
  if ((i+1) % 10 === 0 || i+1 === missingDest.length) {
    console.log(`  dest[${i+1}/${missingDest.length}] ✓${destSuccess} ✗${destFail} (px=${destStats.pixabay} ov=${destStats.openverse} wk=${destStats.wiki})`);
    fs.writeFileSync(DEST_FILE, JSON.stringify(dests, null, 2));
  }
}
fs.writeFileSync(DEST_FILE, JSON.stringify(dests, null, 2));
console.log(`STEP1 完了: ✓${destSuccess} / ${missingDest.length}`);

// ====== STEP2: spots ======
const missingSpots = [];
for (const d of dests) {
  if (!d.spots) continue;
  for (let i = 0; i < d.spots.length; i++) {
    const s = d.spots[i];
    const localPath = path.join(SPOT_DIR, d.id, `${i}.jpg`);
    const hasLocal = fs.existsSync(localPath);
    const hasUrl = s.image || s.imageUrl || s.photo;
    if (!hasLocal && !hasUrl) {
      missingSpots.push({ destId: d.id, spotIdx: i, spotName: s.name, prefecture: d.prefecture });
    }
  }
}
console.log(`\n📷 STEP2 spots: ${missingSpots.length}件`);

let spotSuccess = 0, spotFail = 0;
const spotStats = { pixabay:0, openverse:0, wiki:0 };
const updates = {};

for (let i = 0; i < missingSpots.length; i++) {
  const t = missingSpots[i];
  const [img, src] = await resolveImage(t.spotName, t.prefecture);
  if (img) {
    const folder = path.join(SPOT_DIR, t.destId);
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
    const dst = path.join(folder, `${t.spotIdx}.jpg`);
    try {
      await download(img, dst);
      const size = fs.statSync(dst).size;
      if (size > 5000) {
        updates[t.destId] = updates[t.destId] || [];
        updates[t.destId].push({ idx: t.spotIdx, url: `/images/spots/${t.destId}/${t.spotIdx}.jpg` });
        spotSuccess++; spotStats[src]++;
      } else { fs.unlinkSync(dst); spotFail++; }
    } catch { spotFail++; }
  } else spotFail++;
  if ((i+1) % 30 === 0 || i+1 === missingSpots.length) {
    console.log(`  spot[${i+1}/${missingSpots.length}] ✓${spotSuccess} ✗${spotFail} (px=${spotStats.pixabay} ov=${spotStats.openverse} wk=${spotStats.wiki})`);
    // 中間保存
    for (const [destId, list] of Object.entries(updates)) {
      const d = dests.find(x => x.id === destId);
      if (d?.spots) for (const u of list) if (d.spots[u.idx] && !d.spots[u.idx].imageUrl) d.spots[u.idx].imageUrl = u.url;
    }
    fs.writeFileSync(DEST_FILE, JSON.stringify(dests, null, 2));
  }
}
for (const [destId, list] of Object.entries(updates)) {
  const d = dests.find(x => x.id === destId);
  if (d?.spots) for (const u of list) if (d.spots[u.idx] && !d.spots[u.idx].imageUrl) d.spots[u.idx].imageUrl = u.url;
}
fs.writeFileSync(DEST_FILE, JSON.stringify(dests, null, 2));
console.log(`\n=== 完了 ===`);
console.log(`  STEP1 dest: ✓${destSuccess} / ${missingDest.length}`);
console.log(`  STEP2 spots: ✓${spotSuccess} / ${missingSpots.length}`);
console.log(`  Pixabay: dest=${destStats.pixabay} spot=${spotStats.pixabay}`);
console.log(`  Openverse: dest=${destStats.openverse} spot=${spotStats.openverse}`);
console.log(`  Wikipedia: dest=${destStats.wiki} spot=${spotStats.wiki}`);
