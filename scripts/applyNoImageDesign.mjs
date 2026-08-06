#!/usr/bin/env node
/**
 * applyNoImageDesign.mjs — 最終再取得(refetchRelaxed)後も未解決の画像を
 * 「意図的な画像なしデザイン」へ切り替える。
 *  - main: main.jpg削除 + imageCredit/unsplash系フィールド除去
 *          → テンプレの dest-header-noimg（#2A6049グラデーションヒーロー）が発動
 *  - spot: spot-N.jpg削除 + spots[i].imageUrl/imageCredit除去
 *          → スポットはテキストのみ表示（既存の分岐で自然に劣化）
 * 出力: logs/no_image_applied.json（対象一覧）
 */
import fs from 'fs';
import path from 'path';

const DEST_FILE = 'src/data/destinations.json';
const dests = JSON.parse(fs.readFileSync(DEST_FILE, 'utf8'));
const byId = Object.fromEntries(dests.map(d => [d.id, d]));
const unres = JSON.parse(fs.readFileSync('logs/ng_refetch3_report.json', 'utf8')).unresolvable;

const applied = { mains: [], spots: [] };
for (const { key } of unres) {
  const [destId, file] = key.split('/');
  const dest = byId[destId];
  if (!dest) continue;
  const abs = path.join('public/images', destId, file);

  if (/^main/i.test(file)) {
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
    delete dest.imageCredit;
    // unsplashフォールバックが誤発動しないよう関連フィールドも除去
    delete dest.unsplashUrl; delete dest.unsplashCredit;
    delete dest.unsplashCreditUrl; delete dest.unsplashPhotoUrl;
    // 外部URLのimages[0]もヒーロー画像として拾われるため除去（ローカルパスは無害）
    if (Array.isArray(dest.images)) dest.images = dest.images.filter(u => typeof u === 'string' && u.startsWith('/images/'));
    applied.mains.push({ id: destId, name: dest.name, pref: dest.prefecture });
  } else {
    const sm = file.match(/spot-(\d+)/i);
    const spot = sm ? dest.spots?.[+sm[1] - 1] : null;
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
    if (spot && typeof spot === 'object') { delete spot.imageUrl; delete spot.imageCredit; }
    applied.spots.push({ id: destId, file });
  }
}

fs.writeFileSync(DEST_FILE, JSON.stringify(dests, null, 1));
fs.writeFileSync('logs/no_image_applied.json', JSON.stringify(applied, null, 1));
console.log(`画像なしデザイン適用: main ${applied.mains.length}件 / spot ${applied.spots.length}件`);
