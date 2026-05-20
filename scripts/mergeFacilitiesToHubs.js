#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEST_FILE = path.join(__dirname, '../src/data/destinations.json');
const IMG_DIR = path.join(__dirname, '../public/images');
const dests = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));

// 統合マップ (src destination id → target destination id)
const MERGES = [
  // ユーザー指定10件
  ['kochi-anpanman', 'yokohama'],          // アンパンマンミュージアム → 横浜
  ['moroyama-tea', 'hanno'],                // ムーミンバレーパーク → 飯能
  ['gen_北海_ノーザンホースパーク', 'tomakomai'],
  ['mother-farm', 'tateyama-chiba'],
  ['osaka-banpaku', 'senri'],               // エキスポシティ → 万博記念公園
  ['gen_栃木_時代村', 'nikko'],
  ['miharashidai', 'beppu'],                // ハーモニーランド
  ['aichi-meijimura', 'inuyama'],           // 博物館明治村
  ['gen_北海_サンタプレゼントパーク・マロースゲレンデ', 'obihiro'],
  ['gen_北海_のぼりべつクマ牧場', 'noboribetsu'],
  // 追加施設系
  ['gen_北海_上野ファーム', 'hokkaido-asahikawa'],
  ['gen_北海_キロロリゾート', 'otaru'],
  ['gen_北海_サホロリゾート', 'obihiro'],
  ['gen_北海_ファーム富田', 'furano'],
  ['gen_北海_二風谷ファミリーランド', 'tomakomai'],
  ['gen_北海_日高山岳ビラパーク', 'tomakomai'],
  ['gen_栃木_あしかがフラワーパーク', 'ashikaga'],
  ['toyama-himi-bridge', 'zuiryuji'],       // 海王丸パーク → 高岡
  ['huis-ten-bosch', 'sasebo'],
  ['kuju-yamanami', 'yufuin-2'],            // やまなみハイウェイ → 由布院
  ['motobu-2', 'motobu'],                   // 美ら海水族館 → 本部
  ['saitama-museum', 'nagatoro'],
  ['sankou-bonchi', 'tonami'],              // 砺波チューリップフェア
  ['takasakiyama', 'oita'],
  ['umineko', 'oita'],
  ['shisui', 'naritasan'],
  ['okinawa-world', 'nanjo-okinawa'],
  ['hokkaido-asahi-zoo', 'hokkaido-asahikawa'],
];

let merged = 0;
const deleteIds = new Set();
const skipped = [];
for (const [srcId, tgtId] of MERGES) {
  const src = dests.find(x => x.id === srcId);
  const tgt = dests.find(x => x.id === tgtId);
  if (!src) { skipped.push(`src ${srcId} not found`); continue; }
  if (!tgt) { skipped.push(`tgt ${tgtId} not found for ${srcId}`); continue; }
  const spotName = src.name;
  const spotDesc = (src.description || '').slice(0, 200);
  const spotImg = src.images?.[0] || null;
  tgt.spots = tgt.spots || [];
  const exists = tgt.spots.find(s => s.name === spotName);
  if (exists) {
    if (spotDesc && (!exists.description || spotDesc.length > exists.description.length)) exists.description = spotDesc;
    if (spotImg && !exists.imageUrl) exists.imageUrl = spotImg;
    console.log(`◐ ${srcId} → ${tgtId}: spots[${spotName}]を更新`);
  } else {
    tgt.spots.push({ name: spotName, description: spotDesc, imageUrl: spotImg });
    console.log(`+ ${srcId} → ${tgtId}: spots[${spotName}]を追加`);
  }
  // tagsマージ
  if (src.tags) {
    tgt.tags = tgt.tags || [];
    for (const t of src.tags) if (!tgt.tags.includes(t)) tgt.tags.push(t);
  }
  deleteIds.add(srcId);
  merged++;
}

const before = dests.length;
const remaining = dests.filter(d => !deleteIds.has(d.id));
fs.writeFileSync(DEST_FILE, JSON.stringify(remaining, null, 2));
// 画像フォルダ削除
for (const id of deleteIds) {
  const folder = path.join(IMG_DIR, id);
  if (fs.existsSync(folder)) fs.rmSync(folder, { recursive: true, force: true });
}
console.log(`\n=== 完了 ===`);
console.log(`  統合: ${merged}件`);
console.log(`  スキップ: ${skipped.length}件`);
for (const s of skipped) console.log(`  ${s}`);
console.log(`  destinations: ${before} → ${remaining.length}`);
