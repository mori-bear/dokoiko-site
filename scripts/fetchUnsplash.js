import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ACCESS_KEY = 'nDJVqw9sUkOprnPMFGOFud44i_bhpCEAZdWSRXT_0Xo';
const imageDir = path.join(__dirname, '../public/images');
const destinations = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../src/data/destinations.json'), 'utf8')
);

const TAG_QUERY = {
  '島': 'japan island sea',
  '温泉': 'japan onsen hot spring',
  '山': 'japan mountain landscape',
  '海': 'japan sea coast',
  '城': 'japan castle',
  '寺社': 'japan shrine temple',
  '絶景': 'japan scenic landscape',
  '歴史': 'japan historic town',
  '自然': 'japan nature',
  '秘境': 'japan hidden nature',
  'アート': 'japan art',
  'グルメ': 'japan food',
  '街歩き': 'japan street town',
  '雪': 'japan snow winter',
  '花': 'japan flowers',
};

async function fetchUnsplashImage(query) {
  return new Promise((resolve) => {
    const url = `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=landscape`;
    https.get(url, { headers: { 'Authorization': `Client-ID ${ACCESS_KEY}`, 'Accept-Version': 'v1' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.urls?.regular || null);
        } catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

async function downloadImage(url, filepath) {
  return new Promise((resolve) => {
    const file = fs.createWriteStream(filepath);
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        https.get(res.headers.location, (res2) => {
          res2.pipe(file);
          file.on('finish', () => { file.close(); resolve(true); });
        });
      } else {
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(true); });
      }
    }).on('error', () => resolve(false));
  });
}

function getQuery(dest) {
  for (const tag of (dest.tags || [])) {
    if (TAG_QUERY[tag]) return TAG_QUERY[tag];
  }
  return 'japan travel landscape';
}

let found = 0;
let errors = 0;

for (const dest of destinations) {
  const filepath = path.join(imageDir, `${dest.id}.jpg`);
  if (fs.existsSync(filepath)) continue;

  const query = getQuery(dest);
  const imageUrl = await fetchUnsplashImage(query);

  if (imageUrl) {
    const ok = await downloadImage(imageUrl, filepath);
    if (ok) {
      found++;
      console.log(`✅ ${dest.name} (${query})`);
    } else {
      errors++;
      console.log(`❌ DL失敗: ${dest.name}`);
    }
  } else {
    errors++;
    console.log(`⚠️  API失敗: ${dest.name}`);
  }

  await new Promise(r => setTimeout(r, 1500));
}

console.log(`\n📊 取得: ${found}件 / エラー: ${errors}件`);
