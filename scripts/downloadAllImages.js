#!/usr/bin/env node
/**
 * downloadAllImages.js
 * destinations.json の unsplashUrl・spots[n].imageUrl を実際のファイルとして
 * public/images/{id}/ にダウンロード保存し、destinations.json の images に反映。
 *
 * - {id}/main.jpg が既存なら Unsplash ダウンロードはスキップ
 * - 各 spot 画像は {id}/spot-{N}.jpg として保存
 * - destinations.json の images フィールドを最終状態に同期
 */
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEST_FILE = path.join(__dirname, '../src/data/destinations.json');
const IMAGES_DIR = path.join(__dirname, '../public/images');
const RATE_MS = 200;

const destinations = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));

function download(url, dest) {
  return new Promise((resolve, reject) => {
    let hops = 0;
    function go(u) {
      hops++;
      if (hops > 5) return reject(new Error('too many redirects'));
      const opts = {
        headers: {
          'User-Agent': 'dokoiko-image-downloader/1.0 (https://tabidokoiko.com; contact@tabidokoiko.com)',
          'Accept': 'image/jpeg,image/png,image/webp,image/*,*/*;q=0.5',
        },
      };
      https.get(u, opts, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          const nextUrl = res.headers.location.startsWith('http')
            ? res.headers.location
            : new URL(res.headers.location, u).toString();
          return go(nextUrl);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
        file.on('error', reject);
      }).on('error', reject);
    }
    go(url);
  });
}

let totalMain = 0, skipMain = 0, failMain = 0;
let totalSpot = 0, skipSpot = 0, failSpot = 0;
let updatedJson = 0;

const targets = destinations.filter(d =>
  (d.unsplashUrl) ||
  (Array.isArray(d.spots) && d.spots.some(s => typeof s === 'object' && s.imageUrl))
);
console.log(`📥 ダウンロード対象: ${targets.length} 件`);

let i = 0;
for (const d of targets) {
  i++;
  const id = d.id;
  const folder = path.join(IMAGES_DIR, id);
  if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });

  // main.jpg
  const mainPath = path.join(folder, 'main.jpg');
  if (d.unsplashUrl) {
    totalMain++;
    if (fs.existsSync(mainPath)) {
      skipMain++;
    } else {
      try {
        await download(d.unsplashUrl, mainPath);
        if (i % 50 === 0) console.log(`  ✓ [${i}/${targets.length}] ${d.name}: main.jpg 取得`);
      } catch (e) {
        failMain++;
        if (failMain <= 10) console.log(`  ✗ ${d.name}: main.jpg → ${e.message}`);
      }
      await new Promise(r => setTimeout(r, RATE_MS));
    }
  }

  // spot 画像
  const spots = d.spots || [];
  for (let j = 0; j < spots.length; j++) {
    const s = spots[j];
    if (typeof s !== 'object' || !s.imageUrl) continue;
    totalSpot++;
    const spotPath = path.join(folder, `spot-${j + 1}.jpg`);
    if (fs.existsSync(spotPath)) {
      skipSpot++;
      continue;
    }
    try {
      await download(s.imageUrl, spotPath);
    } catch (e) {
      failSpot++;
      if (failSpot <= 5) console.log(`  ✗ ${d.name}/${s.name}: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, RATE_MS));
  }

  // フォルダ内ファイルから images フィールド更新
  const folderFiles = fs.readdirSync(folder)
    .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
    .sort();
  const imagePaths = folderFiles.map(f => `/images/${id}/${f}`);
  if (JSON.stringify(d.images) !== JSON.stringify(imagePaths)) {
    d.images = imagePaths;
    updatedJson++;
  }

  if (i % 100 === 0) {
    fs.writeFileSync(DEST_FILE, JSON.stringify(destinations, null, 2));
    console.log(`  💾 進捗保存: ${i}/${targets.length}`);
  }
}

fs.writeFileSync(DEST_FILE, JSON.stringify(destinations, null, 2));

console.log('\n' + '='.repeat(60));
console.log('ダウンロード完了');
console.log('='.repeat(60));
console.log(`  main: 対象${totalMain} / 既存スキップ${skipMain} / 失敗${failMain}`);
console.log(`  spot: 対象${totalSpot} / 既存スキップ${skipSpot} / 失敗${failSpot}`);
console.log(`  destinations.json images更新: ${updatedJson} 件`);
