#!/usr/bin/env node
/**
 * mergeIntoHubs.js
 * 寺社・商業施設の独立destinationを、近隣hubのspotsに統合する。
 * 元destinationは削除（画像フォルダは spot.imageUrl 参照のため残置）。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEST_FILE = path.join(__dirname, '../src/data/destinations.json');

const destinations = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));

// 統合マッピング (source → target)
const MERGES = [
  // STEP1: 寺社
  { src: 'koyasan-okuno', tgt: 'nara' },         // 春日大社
  { src: 'todaiji',       tgt: 'nara' },         // 東大寺
  { src: 'yakushiji',     tgt: 'nara' },
  { src: 'toshodaiji',    tgt: 'nara' },
  { src: 'uji-byodoin',   tgt: 'uji' },          // 平等院
  { src: 'aoshima-shrine-2', tgt: 'aoshima' },   // 青島神社
  { src: 'udo',           tgt: 'nichinan' },     // 鵜戸神宮
  { src: 'koyasan-okuno-in', tgt: 'koyasan' },   // 奥之院

  // STEP2: 商業施設
  { src: 'hakata-canal',     tgt: 'fukuoka' },   // キャナルシティ博多
  { src: 'kanazawa-omicho',  tgt: 'kanazawa' },  // 近江町市場
  { src: 'jiyugaoka',        tgt: 'tokyo' },
  { src: 'kichijoji',        tgt: 'tokyo' },
  { src: 'makuhari',         tgt: 'tokyo' },     // 千葉だが東京hub指定
  { src: 'odaiba',           tgt: 'tokyo' },
  { src: 'dotonbori',        tgt: 'osaka' },
  { src: 'shinsaibashi',     tgt: 'osaka' },
  { src: 'umeda-skyy',       tgt: 'osaka' },     // 梅田スカイビル

  // STEP4: 京都3寺社
  { src: 'kinkakuji',        tgt: 'kyoto' },
  { src: 'kyoto-2',          tgt: 'kyoto' },     // 清水寺
  { src: 'fushimi-2',        tgt: 'kyoto' },     // 伏見稲荷
];

function summarize(desc, max=280) {
  if (!desc) return '';
  if (desc.length <= max) return desc;
  // 最大長で句点末尾を探す
  const cut = desc.slice(0, max);
  const lastPunct = Math.max(cut.lastIndexOf('。'), cut.lastIndexOf('、'));
  return lastPunct > 100 ? cut.slice(0, lastPunct + 1) : cut + '…';
}

function pickMainImage(src) {
  if (!src.images || src.images.length === 0) return null;
  // 最初のimageを採用（main.jpg 想定）
  return src.images[0];
}

let merged = 0;
let skipped = [];

for (const { src: srcId, tgt: tgtId } of MERGES) {
  const src = destinations.find(d => d.id === srcId);
  const tgt = destinations.find(d => d.id === tgtId);

  if (!src) {
    skipped.push(`✗ source ${srcId} not found`);
    continue;
  }
  if (!tgt) {
    skipped.push(`✗ target ${tgtId} not found for ${srcId}`);
    continue;
  }

  const spotName = src.name;
  const spotDesc = summarize(src.description, 280);
  const spotImg = pickMainImage(src);

  // 既存spotがあるか
  const existing = tgt.spots?.find(s => s.name === spotName);
  if (existing) {
    // 既存spot更新
    if (spotDesc && (!existing.description || spotDesc.length > existing.description.length)) {
      existing.description = spotDesc;
    }
    if (spotImg && !existing.imageUrl) {
      existing.imageUrl = spotImg;
    }
    console.log(`◐ ${srcId} → ${tgtId}: spots[${spotName}] を既存上書き`);
  } else {
    // 新規spot追加
    tgt.spots = tgt.spots || [];
    tgt.spots.push({
      name: spotName,
      description: spotDesc,
      imageUrl: spotImg,
    });
    console.log(`+ ${srcId} → ${tgtId}: spots[${spotName}] 新規追加`);
  }

  // tagsをマージ
  if (src.tags) {
    tgt.tags = tgt.tags || [];
    for (const t of src.tags) {
      if (!tgt.tags.includes(t)) tgt.tags.push(t);
    }
  }

  // sourceを削除
  const idx = destinations.findIndex(d => d.id === srcId);
  destinations.splice(idx, 1);
  merged++;
}

fs.writeFileSync(DEST_FILE, JSON.stringify(destinations, null, 2));

console.log(`\n=== 統合完了 ===`);
console.log(`  統合: ${merged}件`);
console.log(`  スキップ: ${skipped.length}件`);
skipped.forEach(s => console.log('  ' + s));
console.log(`  destinations合計: ${destinations.length}`);
