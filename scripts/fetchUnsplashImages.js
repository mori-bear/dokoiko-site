#!/usr/bin/env node
/**
 * fetchUnsplashImages.js
 *
 * ローカル画像がない目的地に Unsplash 画像URLを付与して destinations.json を更新する。
 *
 * 使い方: node scripts/fetchUnsplashImages.js
 * 前提: .env に UNSPLASH_ACCESS_KEY=<your_key> を設定
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// .env を手動ロード（dotenv 未使用のため）
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m) process.env[m[1]] = m[2].trim();
  }
}

const KEY = process.env.UNSPLASH_ACCESS_KEY;
if (!KEY) {
  console.warn('⚠️  UNSPLASH_ACCESS_KEY が未設定のため Unsplash 画像取得をスキップします。');
  console.warn('   .env に UNSPLASH_ACCESS_KEY=<your_key> を追加してください。');
  process.exit(0);
}

const IMAGES_DIR = path.join(__dirname, '../public/images');
const DEST_FILE  = path.join(__dirname, '../src/data/destinations.json');
const RATE_MS    = 1200; // Unsplash Free: ~50 req/hr

const dests = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));
const targets = dests.filter(d => {
  if (d.unsplashUrl) return false;                                 // 取得済み
  if (fs.existsSync(path.join(IMAGES_DIR, `${d.id}.jpg`))) return false; // ローカル画像あり
  return true;
});

console.log(`🔍 Unsplash 画像取得開始: ${targets.length} 件 (スキップ: ${dests.length - targets.length} 件)\n`);

let fetched = 0;
let failed  = 0;

for (const dest of targets) {
  const query = `${dest.name} ${dest.prefecture} 風景`;
  const url   = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`;

  try {
    const res  = await fetch(url, { headers: { Authorization: `Client-ID ${KEY}` } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data  = await res.json();
    const photo = data.results?.[0];

    if (photo) {
      // Unsplash利用規約: UTMパラメータ付きリンクを保持する
      const entry = dests.find(d => d.id === dest.id);
      entry.unsplashUrl        = photo.urls.regular;
      entry.unsplashThumbUrl   = photo.urls.small;
      entry.unsplashCredit     = photo.user.name;
      entry.unsplashCreditUrl  = `${photo.user.links.html}?utm_source=dokoiko&utm_medium=referral`;
      entry.unsplashPhotoUrl   = `${photo.links.html}?utm_source=dokoiko&utm_medium=referral`;
      fetched++;
      console.log(`✓ ${dest.name.padEnd(10)} ${photo.urls.regular.slice(0, 60)}...`);
    } else {
      console.log(`✗ ${dest.name.padEnd(10)} 検索結果なし`);
      failed++;
    }
  } catch (e) {
    console.error(`✗ ${dest.name.padEnd(10)} エラー: ${e.message}`);
    failed++;
  }

  await new Promise(r => setTimeout(r, RATE_MS));
}

fs.writeFileSync(DEST_FILE, JSON.stringify(dests, null, 2));
console.log(`\n完了: ${fetched} 件取得 / ${failed} 件失敗`);
