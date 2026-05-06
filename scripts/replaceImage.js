import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ACCESS_KEY = 'nDJVqw9sUkOprnPMFGOFud44i_bhpCEAZdWSRXT_0Xo';

const DEST_ID = process.argv[2] || 'naoshima';
const QUERY   = process.argv[3] || 'naoshima japan art island';

async function searchUnsplash(query) {
  return new Promise((resolve) => {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape`;
    https.get(url, { headers: { 'Authorization': `Client-ID ${ACCESS_KEY}`, 'Accept-Version': 'v1' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(null); }
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

const result = await searchUnsplash(QUERY);
if (!result?.results?.length) {
  console.log('❌ 検索結果なし');
  process.exit(1);
}

console.log(`\n🔍 「${QUERY}」の検索結果 ${result.results.length}件:\n`);
result.results.forEach((photo, i) => {
  console.log(`[${i}] ${photo.urls.regular}`);
  console.log(`    by ${photo.user.name} | ${photo.description || photo.alt_description || '(no description)'}`);
  console.log(`    likes: ${photo.likes}\n`);
});

// 最もlikesが多い写真をダウンロード
const best = result.results.reduce((a, b) => a.likes > b.likes ? a : b);
console.log(`✅ ベスト選択: likes ${best.likes} (by ${best.user.name})`);

const filepath = path.join(__dirname, `../public/images/${DEST_ID}.jpg`);
const ok = await downloadImage(best.urls.regular, filepath);
console.log(ok ? `✅ 保存: ${filepath}` : '❌ ダウンロード失敗');
