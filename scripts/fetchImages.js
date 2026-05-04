import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function fetchWikimediaImage(name) {
  return new Promise((resolve) => {
    const url = `https://ja.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`;
    https.get(url, { headers: { 'User-Agent': 'DokoIko/1.0 (tabidokoiko.com)' } }, (res) => {
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
  return new Promise((resolve) => {
    const file = fs.createWriteStream(filepath);
    const get = (u) => https.get(u, { headers: { 'User-Agent': 'DokoIko/1.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        get(res.headers.location);
      } else {
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(true); });
      }
    }).on('error', () => resolve(false));
    get(url);
  });
}

const destinations = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../src/data/destinations.json'), 'utf8')
);

const imageDir = path.join(__dirname, '../public/images');
fs.mkdirSync(imageDir, { recursive: true });

let found = 0;
let notFound = 0;

for (const dest of destinations) {
  const filepath = path.join(imageDir, `${dest.id}.jpg`);
  if (fs.existsSync(filepath)) {
    console.log(`⏭️  スキップ: ${dest.name}`);
    continue;
  }
  const imageUrl = await fetchWikimediaImage(dest.name);
  if (imageUrl) {
    const ok = await downloadImage(imageUrl, filepath);
    if (ok) { found++; console.log(`✅ ${dest.name}`); }
    else { notFound++; console.log(`❌ DL失敗: ${dest.name}`); }
  } else {
    notFound++;
    console.log(`⚠️  画像なし: ${dest.name}`);
  }
  await new Promise(r => setTimeout(r, 300));
}

console.log(`\n📊 取得: ${found}件 / 未取得: ${notFound}件`);
