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
const RATE_MS    = 72000; // Unsplash Free: 50 req/hr → 72秒間隔

const dests = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));

// 同じphotoID(URL中のphoto-xxxxx)を使い回している件数 → 3件以上は低クオリティ扱いで再取得
function photoId(url) {
  const m = url && url.match(/photo-([0-9a-f-]+)/);
  return m ? m[1] : null;
}
const idCounts = {};
for (const d of dests) {
  const pid = photoId(d.unsplashUrl);
  if (pid) idCounts[pid] = (idCounts[pid] || 0) + 1;
}

const targets = dests.filter(d => {
  if (fs.existsSync(path.join(IMAGES_DIR, `${d.id}.jpg`))) return false; // ローカル画像あり
  if (!d.unsplashUrl) return true;                                       // 未取得
  const pid = photoId(d.unsplashUrl);
  if (pid && idCounts[pid] >= 3) return true;                            // 重複多 → 再取得
  return false;
});

// 代表スポット名 + name で検索（より特定の画像がヒットしやすい）
function buildQuery(d) {
  const spots = d.spots || [];
  if (spots.length > 0 && spots[0]) return `${spots[0]} ${d.name}`;
  return `${d.name} ${d.prefecture}`;
}

console.log(`🔍 Unsplash 画像取得開始: ${targets.length} 件 (スキップ: ${dests.length - targets.length} 件)\n`);

let fetched = 0;
let failed  = 0;

for (const dest of targets) {
  const query = buildQuery(dest);
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
