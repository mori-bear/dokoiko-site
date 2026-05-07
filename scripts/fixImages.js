import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UNSPLASH_KEY = 'nDJVqw9sUkOprnPMFGOFud44i_bhpCEAZdWSRXT_0Xo';
const imageDir = path.join(__dirname, '../public/images');

const TARGETS = [
  { id: 'kusatsu-onsen',  query: 'kusatsu onsen hot spring japan' },
  { id: 'minakami-onsen', query: 'minakami onsen japan river valley' },
  { id: 'kawagoe',        query: 'kawagoe little edo old town japan' },
];

async function get(url, opts = {}) {
  return new Promise(resolve => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout: 10000, ...opts }, res => {
      if ([301, 302].includes(res.statusCode) && res.headers.location)
        return resolve(get(res.headers.location, opts));
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, data }));
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

async function download(url, filepath) {
  return new Promise(async resolve => {
    try {
      const client = url.startsWith('https') ? https : http;
      const file = fs.createWriteStream(filepath);
      client.get(url, { headers: { 'User-Agent': 'DokoIko/1.0' }, timeout: 15000 }, res => {
        if ([301, 302].includes(res.statusCode) && res.headers.location) {
          file.close(); fs.unlink(filepath, () => {});
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
for (const { id, query } of TARGETS) {
  const filepath = path.join(imageDir, `${id}.jpg`);
  const imgUrl = await fetchUnsplash(query);
  if (imgUrl) {
    const success = await download(imgUrl, filepath);
    if (success) { ok++; console.log(`✅ ${id}`); }
    else { ng++; console.log(`❌ DL失敗: ${id}`); }
  } else {
    ng++; console.log(`⚠  取得失敗: ${id}`);
  }
  await new Promise(r => setTimeout(r, 1500));
}
console.log(`\n完了: 成功${ok}件 / 失敗${ng}件`);
