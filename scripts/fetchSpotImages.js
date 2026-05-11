#!/usr/bin/env node
/**
 * fetchSpotImages.js
 * Wikipedia Commons API を使って、各目的地の spots[n] に imageUrl を追加。
 *
 * 流れ:
 * 1. spots[n].name で日本語Wikipedia の記事を検索 (action=query, generator=search)
 * 2. 記事の代表画像URL (page.thumbnail.source) を取得
 * 3. spots[n].imageUrl に保存
 * 4. 既に imageUrl がある場合はスキップ
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEST_FILE = path.join(__dirname, '../src/data/destinations.json');
const RATE_MS   = 500;

const data = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));

// 取得対象: spots[n] が {name, imageUrl?} 形式かつ imageUrl 未設定
const targets = [];
for (const d of data) {
  const spots = d.spots || [];
  for (const s of spots) {
    if (typeof s === 'string') continue;
    if (s.imageUrl) continue;
    if (!s.name) continue;
    targets.push({ dest: d, spot: s });
  }
}

console.log(`🔍 Wikipedia Commons 画像取得開始: ${targets.length} スポット (合計${data.length}目的地)\n`);

async function fetchWikipediaImage(name) {
  // ja.wikipedia.org の API でページ検索 + 代表画像取得
  const url = `https://ja.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&piprop=thumbnail&pithumbsize=400&generator=search&gsrsearch=${encodeURIComponent(name)}&gsrlimit=1&origin=*`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'dokoiko-spot-fetcher/1.0 (https://tabidokoiko.com)' }
    });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const json = await res.json();
    const pages = json?.query?.pages;
    if (!pages) return { error: 'no results' };
    const firstPage = Object.values(pages)[0];
    const thumb = firstPage?.thumbnail?.source;
    if (!thumb) return { error: 'no thumbnail' };
    return { imageUrl: thumb, title: firstPage.title };
  } catch (e) {
    return { error: e.message };
  }
}

let fetched = 0, failed = 0, idx = 0;
for (const { dest, spot } of targets) {
  idx++;
  const result = await fetchWikipediaImage(spot.name);
  if (result.imageUrl) {
    spot.imageUrl = result.imageUrl;
    fetched++;
    if (idx % 50 === 0 || fetched <= 20) {
      console.log(`✓ [${idx}/${targets.length}] ${dest.name} / ${spot.name} → ${result.imageUrl.slice(0, 70)}...`);
    }
  } else {
    failed++;
    if (idx % 200 === 0) {
      console.log(`✗ [${idx}/${targets.length}] ${dest.name} / ${spot.name}: ${result.error}`);
    }
  }

  // 50件ごとに途中保存（クラッシュ対策）
  if (idx % 50 === 0) {
    fs.writeFileSync(DEST_FILE, JSON.stringify(data, null, 2));
  }

  await new Promise(r => setTimeout(r, RATE_MS));
}

// 最終保存
fs.writeFileSync(DEST_FILE, JSON.stringify(data, null, 2));
console.log(`\n完了: ${fetched} 件取得 / ${failed} 件失敗 / 合計${targets.length}スポット処理`);
