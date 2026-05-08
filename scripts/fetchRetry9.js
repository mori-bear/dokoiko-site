import fs from 'fs';
import https from 'https';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UNSPLASH_KEY = 'nDJVqw9sUkOprnPMFGOFud44i_bhpCEAZdWSRXT_0Xo';
const imageDir = path.join(__dirname, '../public/images');

const TARGETS = [
  { id: 'takeo-onsen',         query: 'takeo onsen saga japan' },
  { id: 'echigo-yuzawa',       query: 'echigo yuzawa niigata snow japan' },
  { id: 'hateruma-island',     query: 'hateruma island okinawa japan' },
  { id: 'ginzan-onsen',        query: 'ginzan onsen yamagata japan' },
  { id: 'hakone',              query: 'hakone mt fuji japan' },
  { id: 'kamakura',            query: 'kamakura buddha japan' },
  { id: 'nyuto-onsen',         query: 'nyuto onsen akita japan' },
  { id: 'noboribetsu',         query: 'noboribetsu onsen hokkaido' },
  { id: 'ito',                 query: 'ito onsen shizuoka japan' },
];

async function get(url, opts = {}) {
  return new Promise(resolve => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout: 15000, ...opts }, res => {
      if ([301, 302].includes(res.statusCode) && res.headers.location) {
        return resolve(get(res.headers.location, opts));
      }
      let buf = [];
      res.on('data', c => buf.push(c));
      res.on('end', () => resolve({ status: res.statusCode, data: Buffer.concat(buf).toString(), headers: res.headers }));
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

async function fetchUnsplash(query) {
  const url = `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=landscape&content_filter=high`;
  const r = await get(url, { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}`, 'Accept-Version': 'v1' } });
  if (!r || r.status !== 200) { console.log(`  Unsplash HTTP ${r?.status}`); return null; }
  try { return JSON.parse(r.data).urls?.regular || null; } catch { return null; }
}

async function download(url, filepath) {
  return new Promise(resolve => {
    const client = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(filepath);
    client.get(url, { headers: { 'User-Agent': 'DokoIko/1.0' }, timeout: 20000 }, res => {
      if ([301, 302].includes(res.statusCode) && res.headers.location) {
        file.close(); fs.unlink(filepath, () => {});
        return resolve(download(res.headers.location, filepath));
      }
      if (res.statusCode !== 200) { file.close(); fs.unlink(filepath, () => {}); return resolve(false); }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(true); });
      file.on('error', () => { fs.unlink(filepath, () => {}); resolve(false); });
    }).on('error', () => { fs.unlink(filepath, () => {}); resolve(false); });
  });
}

let ok = 0, ng = 0;
for (const { id, query } of TARGETS) {
  const filepath = path.join(imageDir, `${id}.jpg`);
  console.log(`\n[${id}] query: "${query}"`);

  const imgUrl = await fetchUnsplash(query);
  if (!imgUrl) { console.log(`  ⚠  URL取得不可`); ng++; continue; }

  const success = await download(imgUrl, filepath);
  if (success) {
    const size = Math.round(fs.statSync(filepath).size / 1024);
    console.log(`  ✅ 取得成功 (${size}KB)`);
    ok++;
  } else {
    console.log(`  ❌ DL失敗`);
    ng++;
  }
  await new Promise(r => setTimeout(r, 1200));
}

console.log(`\n===== 完了: 取得${ok}件 / 失敗${ng}件 =====`);
