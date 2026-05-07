import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UNSPLASH_KEY = 'nDJVqw9sUkOprnPMFGOFud44i_bhpCEAZdWSRXT_0Xo';
const imageDir = path.join(__dirname, '../public/images');

// 問題のある画像ID → 差し替えクエリ
const TARGETS = [
  { id: 'nara',           query: 'nara deer japan temple' },
  { id: 'kumano',         query: 'kumano kodo forest japan pilgrimage' },
  { id: 'kyoto',          query: 'kyoto japan temple garden' },
  { id: 'hiroshima',      query: 'hiroshima peace japan city' },
  { id: 'kanazawa',       query: 'kanazawa japan castle garden' },
  { id: 'takayama',       query: 'takayama old town japan' },
  { id: 'shirakawago',    query: 'shirakawago gassho village snow japan' },
  { id: 'koyasan',        query: 'koyasan temple forest japan' },
  { id: 'okinawa-honto',  query: 'okinawa ocean beach japan' },
  { id: 'zamami',         query: 'zamami island okinawa japan sea' },
  { id: 'okinawa-north',  query: 'okinawa north sea japan' },
  { id: 'kochi-city',     query: 'kochi castle japan' },
  { id: 'naoshima',       query: 'naoshima art island japan sea' },
  { id: 'shodoshima',     query: 'shodoshima olive japan island' },
  { id: 'nikko',          query: 'nikko toshogu shrine japan forest' },
  { id: 'kamakura',       query: 'kamakura great buddha japan' },
  { id: 'hakone',         query: 'hakone fuji mountain japan' },
  { id: 'matsushima',     query: 'matsushima pine islands japan sea' },
  { id: 'miyajima',       query: 'miyajima torii gate japan sea' },
  { id: 'yakushima',      query: 'yakushima cedar forest japan' },
  { id: 'ishigaki',       query: 'ishigaki coral sea japan' },
  { id: 'miyakojima',     query: 'miyakojima beach turquoise japan' },
  { id: 'iriomote',       query: 'iriomote jungle mangrove japan' },
  { id: 'amami',          query: 'amami island jungle ocean japan' },
];

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

async function download(url, filepath) {
  return new Promise(async resolve => {
    try {
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
console.log(`問題画像の差し替え: ${TARGETS.length}件`);

for (const { id, query } of TARGETS) {
  const filepath = path.join(imageDir, `${id}.jpg`);
  const imgUrl = await fetchUnsplash(query);
  if (imgUrl) {
    const success = await download(imgUrl, filepath);
    if (success) {
      ok++;
      console.log(`✅ [${ok+ng}/${TARGETS.length}] ${id} ("${query}")`);
    } else {
      ng++;
      console.log(`❌ DL失敗: ${id}`);
    }
  } else {
    ng++;
    console.log(`⚠  取得失敗: ${id} ("${query}")`);
  }
  await new Promise(r => setTimeout(r, 1300));
}

console.log(`\n完了: 成功${ok}件 / 失敗${ng}件`);
