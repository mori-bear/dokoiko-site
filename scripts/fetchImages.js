import fs from 'fs';
import https from 'https';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const imageDir = path.join(__dirname, '../public/images');
fs.mkdirSync(imageDir, { recursive: true });

const destinations = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../src/data/destinations.json'), 'utf8')
);

async function fetchWithRedirect(url, maxRedirects = 5) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, {
      headers: { 'User-Agent': 'DokoIko/1.0 (tabidokoiko.com)' },
      timeout: 10000
    }, (res) => {
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location && maxRedirects > 0) {
        resolve(fetchWithRedirect(res.headers.location, maxRedirects - 1));
      } else {
        resolve(res);
      }
    }).on('error', () => resolve(null));
  });
}

async function fetchWikimediaImage(name) {
  return new Promise((resolve) => {
    const url = `https://ja.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`;
    https.get(url, { headers: { 'User-Agent': 'DokoIko/1.0' }, timeout: 8000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.originalimage?.source || json.thumbnail?.source || null);
        } catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

async function fetchEnWikimediaImage(name) {
  return new Promise((resolve) => {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`;
    https.get(url, { headers: { 'User-Agent': 'DokoIko/1.0' }, timeout: 8000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.originalimage?.source || json.thumbnail?.source || null);
        } catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

async function downloadImage(url, filepath) {
  return new Promise(async (resolve) => {
    try {
      const res = await fetchWithRedirect(url);
      if (!res || res.statusCode !== 200) { resolve(false); return; }
      const file = fs.createWriteStream(filepath);
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(true); });
      file.on('error', () => resolve(false));
    } catch { resolve(false); }
  });
}

let found = 0;
let notFound = 0;
const missing = [];

for (const dest of destinations) {
  const filepath = path.join(imageDir, `${dest.id}.jpg`);
  if (fs.existsSync(filepath)) continue;

  // 日本語Wikipedia → 英語Wikipedia の順で試みる
  let imageUrl = await fetchWikimediaImage(dest.name);
  if (!imageUrl) imageUrl = await fetchEnWikimediaImage(dest.name);
  if (!imageUrl && dest.prefecture) {
    imageUrl = await fetchWikimediaImage(`${dest.name} ${dest.prefecture}`);
  }

  if (imageUrl) {
    const ok = await downloadImage(imageUrl, filepath);
    if (ok) {
      found++;
      console.log(`✅ ${dest.name}`);
    } else {
      notFound++;
      missing.push(dest.name);
    }
  } else {
    notFound++;
    missing.push(dest.name);
  }

  await new Promise(r => setTimeout(r, 400));
}

console.log(`\n📊 新規取得: ${found}件 / 未取得: ${notFound}件`);
if (missing.length > 0) {
  console.log('未取得リスト:', missing.slice(0, 20).join('、'));
  fs.writeFileSync(path.join(__dirname, '../missing_images.txt'), missing.join('\n'), 'utf8');
}
