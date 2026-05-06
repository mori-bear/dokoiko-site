import fs from 'fs';
import https from 'https';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UNSPLASH_KEY = 'nDJVqw9sUkOprnPMFGOFud44i_bhpCEAZdWSRXT_0Xo';
const imageDir = path.join(__dirname, '../public/images');
const destinations = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../src/data/destinations.json'), 'utf8')
);

const missing = destinations.filter(d => !fs.existsSync(path.join(imageDir, `${d.id}.jpg`)));
console.log(`対象: ${missing.length}件`);

async function get(url, opts = {}) {
  return new Promise(resolve => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout: 10000, ...opts }, res => {
      if ([301, 302].includes(res.statusCode) && res.headers.location) {
        return resolve(get(res.headers.location, opts));
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, data, headers: res.headers }));
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

async function fetchUnsplash(query) {
  const url = `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=landscape&content_filter=high`;
  const r = await get(url, { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}`, 'Accept-Version': 'v1' } });
  if (!r || r.status !== 200) return null;
  try { return JSON.parse(r.data).urls?.regular || null; } catch { return null; }
}

async function fetchWiki(query) {
  for (const base of ['ja', 'en']) {
    const url = `https://${base}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
    const r = await get(url, { headers: { 'User-Agent': 'DokoIko/1.0 (tabidokoiko.com)' } });
    if (!r || r.status !== 200) continue;
    try {
      const j = JSON.parse(r.data);
      const src = j.originalimage?.source || j.thumbnail?.source;
      if (src) return src;
    } catch {}
  }
  return null;
}

async function download(url, filepath) {
  return new Promise(async resolve => {
    try {
      const r = await get(url, { headers: { 'User-Agent': 'DokoIko/1.0' } });
      if (!r || r.status !== 200 || !r.data) { resolve(false); return; }
      // バイナリダウンロード用に別処理
      const client = url.startsWith('https') ? https : http;
      const file = fs.createWriteStream(filepath);
      client.get(url, { headers: { 'User-Agent': 'DokoIko/1.0' }, timeout: 15000 }, res => {
        if ([301, 302].includes(res.statusCode) && res.headers.location) {
          file.close();
          fs.unlink(filepath, () => {});
          return resolve(download(res.headers.location, filepath));
        }
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(true); });
        file.on('error', () => { fs.unlink(filepath, () => {}); resolve(false); });
      }).on('error', () => { fs.unlink(filepath, () => {}); resolve(false); });
    } catch { resolve(false); }
  });
}

let ok = 0, ng = 0;
let unsplashCount = 0;
const UNSPLASH_LIMIT = 45; // 50/h の手前で止める

for (const dest of missing) {
  const filepath = path.join(imageDir, `${dest.id}.jpg`);
  let imgUrl = null;

  // 1. Unsplash（レート制限内であれば）
  if (unsplashCount < UNSPLASH_LIMIT) {
    const q = `${dest.name} ${dest.prefecture} Japan`;
    imgUrl = await fetchUnsplash(q);
    if (imgUrl) {
      unsplashCount++;
    } else {
      // 英語クエリにフォールバック
      const qEn = `${dest.name} Japan travel`;
      imgUrl = await fetchUnsplash(qEn);
      if (imgUrl) unsplashCount++;
    }
    await new Promise(r => setTimeout(r, 1200));
  }

  // 2. Wikimedia Commons（JA→EN Wikipedia）
  if (!imgUrl) {
    imgUrl = await fetchWiki(dest.name);
    if (!imgUrl && dest.prefecture) {
      imgUrl = await fetchWiki(`${dest.name} (${dest.prefecture})`);
    }
    if (imgUrl) await new Promise(r => setTimeout(r, 400));
  }

  if (imgUrl) {
    const success = await download(imgUrl, filepath);
    if (success) {
      ok++;
      process.stdout.write(`✅ [${ok+ng}/${missing.length}] ${dest.name}\n`);
    } else {
      ng++;
      process.stdout.write(`❌ DL失敗: ${dest.name}\n`);
    }
  } else {
    ng++;
    process.stdout.write(`⚠  スキップ: ${dest.name}\n`);
  }
}

console.log(`\n完了: 取得${ok}件 / 失敗・スキップ${ng}件`);
console.log(`Unsplash使用: ${unsplashCount}件`);
