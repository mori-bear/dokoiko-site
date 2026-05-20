#!/usr/bin/env node
/**
 * fixDuplicatesAndIC.js
 * 1. kyoto.spots「伏見稲荷大社」と「伏見稲荷」を1件にマージ
 * 2. osaka-castle destinationを osaka.spots[大阪城]に統合し削除
 * 3. 全destinationのdescription / spots.descriptionから
 *    「ICカード」「Suica」「ICOCA」「交通系IC」を含む文を削除
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEST_FILE = path.join(__dirname, '../src/data/destinations.json');

const destinations = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));

// ====== 1. 伏見稲荷重複マージ ======
{
  const kyoto = destinations.find(d => d.id === 'kyoto');
  const spots = kyoto.spots;
  const taishaIdx = spots.findIndex(s => s.name === '伏見稲荷大社');
  const shortIdx = spots.findIndex(s => s.name === '伏見稲荷');
  if (taishaIdx >= 0 && shortIdx >= 0) {
    const taisha = spots[taishaIdx];
    const short = spots[shortIdx];
    // descが長い方を採用、imageUrl優先取得
    const winner = (short.description || '').length > (taisha.description || '').length ? short : taisha;
    const merged = {
      name: '伏見稲荷大社',  // 正式名称に統一
      description: winner.description,
      imageUrl: winner.imageUrl || taisha.imageUrl || short.imageUrl || null,
    };
    // 両方削除して merged を追加
    kyoto.spots = spots.filter((_, i) => i !== taishaIdx && i !== shortIdx);
    kyoto.spots.push(merged);
    console.log(`✓ kyoto.spots: 伏見稲荷大社/伏見稲荷 を統合 (name=伏見稲荷大社, desc_len=${merged.description.length})`);
  } else {
    console.log(`⏭  kyoto.spots: 重複なし`);
  }
}

// ====== 2. osaka-castle 統合 ======
{
  const osakaCastle = destinations.find(d => d.id === 'osaka-castle');
  const osaka = destinations.find(d => d.id === 'osaka');
  if (osakaCastle && osaka) {
    const existing = osaka.spots.find(s => s.name === '大阪城');
    const ocImg = osakaCastle.images?.[0] || null;
    const ocDesc = (osakaCastle.description || '');
    // テンプレ・Wikipedia引用部分を粗くクリーニング: 「過去と現在が大阪府・」「大坂城または大阪城（おおさかじょう）」など除去
    let cleanDesc = ocDesc
      .replace(/^過去と現在が[^。]*。/, '')
      .replace(/大坂城または大阪城（[^）]*）は、現在の[^。]*。/, '')
      .replace(/別称は[^。]*。/, '')
      .replace(/^[、。\s]+/, '');
    // 必要なら既存desc(豊臣秀吉が築いた…)を保持して差し替え
    if (existing) {
      const baseDesc = '豊臣秀吉が築いた天守閣。周囲の公園は桜の名所で、春は人で埋まる。' + (cleanDesc ? cleanDesc : '');
      if (baseDesc.length > (existing.description || '').length) {
        existing.description = baseDesc;
      }
      if (ocImg && !existing.imageUrl) existing.imageUrl = ocImg;
      console.log(`◐ osaka.spots[大阪城]を上書き (desc_len=${existing.description.length}, img=${!!existing.imageUrl})`);
    } else {
      osaka.spots.push({ name: '大阪城', description: cleanDesc || '豊臣秀吉が築いた天守閣。', imageUrl: ocImg });
      console.log(`+ osaka.spots[大阪城]を新規追加`);
    }
    // tagsマージ
    if (osakaCastle.tags) {
      osaka.tags = osaka.tags || [];
      for (const t of osakaCastle.tags) if (!osaka.tags.includes(t)) osaka.tags.push(t);
    }
    // osaka-castle削除
    const idx = destinations.findIndex(d => d.id === 'osaka-castle');
    destinations.splice(idx, 1);
    console.log(`✓ osaka-castle destination削除`);
  } else {
    console.log(`⏭  osaka-castle 統合: source/target欠落`);
  }
}

// ====== 3. ICカード関連文を削除 ======
const IC_PATTERN = /ICカード|Suica|ICOCA|交通系IC|PASMO|Kitaca|manaca|TOICA|nimoca|はやかけん|SUGOCA/i;

function stripICSentences(text) {
  if (!text) return text;
  // 「。」「！」「？」を文区切りとして分割（区切り文字保持）
  const parts = text.split(/(?<=[。！？])/);
  const kept = parts.filter(p => !IC_PATTERN.test(p));
  let result = kept.join('');
  // 文中のフレーズ削除（句読点の切れ目で）
  result = result.replace(/、[^、。]*(?:ICカード|Suica|ICOCA|交通系IC)[^、。]*(?=[、。])/g, '');
  // 連続する句読点クリーンアップ
  result = result.replace(/、{2,}/g, '、').replace(/。{2,}/g, '。').replace(/^[、\s]+/, '');
  return result;
}

let descCount = 0, spotCount = 0;
for (const d of destinations) {
  if (d.description && IC_PATTERN.test(d.description)) {
    const before = d.description.length;
    d.description = stripICSentences(d.description);
    descCount++;
  }
  if (d.spots) {
    for (const s of d.spots) {
      if (s.description && IC_PATTERN.test(s.description)) {
        s.description = stripICSentences(s.description);
        spotCount++;
      }
    }
  }
}
console.log(`\n✓ IC文言削除: destination.description ${descCount}件 / spots.description ${spotCount}件`);

fs.writeFileSync(DEST_FILE, JSON.stringify(destinations, null, 2));
console.log(`\n✓ 完了: destinations合計 ${destinations.length}件`);
