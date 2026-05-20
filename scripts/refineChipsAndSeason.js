#!/usr/bin/env node
/**
 * refineChipsAndSeason.js
 * (STEP3) reasonChips 再評価: description/tags/属性から自動付与・矛盾を削除
 * (STEP4) bestSeason 設定: tagsとdescriptionから判定
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEST_FILE = path.join(__dirname, '../src/data/destinations.json');
const destinations = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));

// ====== STEP4: bestSeason 判定 ======
function inferSeason(d) {
  const text = `${d.name} ${d.description || ''} ${(d.tags||[]).join('、')} ${(d.spots||[]).map(s => s.name + ' ' + (s.description||'')).join(' ')}`;
  const score = { '春': 0, '夏': 0, '秋': 0, '冬': 0 };
  // 春
  if (/桜|花見|新緑|春|菜の花|チューリップ|花咲く|藤|つつじ/.test(text)) score['春'] += 3;
  // 夏
  if (/海水浴|花火|新緑|ビーチ|海開き|納涼|夏|滝|蛍|青空|サンゴ|シュノーケル|ダイビング/.test(text)) score['夏'] += 3;
  // 秋
  if (/紅葉|秋|もみじ|楓|稲穂|収穫|秋祭り|栗|サンマ/.test(text)) score['秋'] += 3;
  // 冬
  if (/雪|スキー|スノー|樹氷|流氷|温泉|冬|イルミネーション|霧氷|氷瀑/.test(text)) score['冬'] += 2;
  // タグ直接
  for (const t of (d.tags||[])) {
    if (t === '春') score['春'] += 4;
    if (t === '夏') score['夏'] += 4;
    if (t === '秋') score['秋'] += 4;
    if (t === '冬') score['冬'] += 4;
  }
  // 沖縄・南西諸島は通年だが特に春〜秋
  if (/沖縄|宮古|石垣|西表|与那国|奄美/.test(text)) { score['春'] += 1; score['夏'] += 2; score['秋'] += 1; }
  // 北海道は夏・冬が顕著
  if (d.prefecture === '北海道') { score['冬'] += 1; score['夏'] += 1; }

  // 最高スコアの季節を返す。タイは「春・秋」のような表記
  const max = Math.max(...Object.values(score));
  if (max === 0) return '通年';
  const tops = Object.entries(score).filter(([_,v]) => v === max).map(([k]) => k);
  if (tops.length >= 3) return '通年';
  return tops.join('・');
}

// ====== STEP3: reasonChips 整備 ======
function refineChips(d) {
  const text = `${d.name} ${d.description || ''} ${(d.tags||[]).join('、')} ${(d.spots||[]).map(s => s.name + ' ' + (s.description||'')).join(' ')}`;
  const tagsSet = new Set(d.tags || []);
  const oldChips = d.reasonChips || [];
  const newChips = new Set(oldChips);

  // 追加候補
  function add(chip) { newChips.add(chip); }

  // 車なしOK判定
  if (d.requiresCar !== true) {
    if (/駅から|電車|地下鉄|新幹線|徒歩|路面電車|モノレール/.test(text)) add('車なしOK');
  }
  // 温泉
  if (tagsSet.has('温泉') || /温泉|湯|湯治|露天/.test(text)) add('温泉');
  // グルメ
  if (tagsSet.has('グルメ') || /グルメ|郷土料理|海鮮|寿司|ラーメン|うどん|そば|海の幸|肉/.test(text)) add('グルメ');
  // 離島
  if (d.isIsland) add('離島');
  // 絶景
  if (tagsSet.has('絶景') || /絶景|パノラマ|見渡せる|大パノラマ|雄大|広がる景色/.test(text)) add('絶景');
  // 世界遺産
  if (/世界遺産|UNESCO|登録/.test(text) && /世界/.test(text)) add('世界遺産');
  // 1泊がおすすめ / 日帰り最適
  const sa = new Set(d.stayAllowed || []);
  if (sa.has('1night') && !sa.has('2night') && !sa.has('3night+')) add('1泊がおすすめ');
  if (sa.has('daytrip') && sa.size === 1) add('日帰り最適');
  // 旅行スタイル
  const situ = new Set(d.situations || []);
  if (situ.has('solo')) add('ひとり旅向け');
  if (situ.has('couple')) add('カップル向け');
  if (situ.has('family')) add('家族向け');
  if (situ.has('friends')) add('友達と');
  // 歴史
  if (tagsSet.has('歴史') || tagsSet.has('寺社') || /歴史|寺院|神社|城|文化財|遺跡|古墳|武家/.test(text)) add('歴史を辿る');
  // 寺社
  if (tagsSet.has('寺社') || /寺|神社|大社|参拝|神宮|仏閣/.test(text)) add('寺社めぐり');
  // 春の花
  if (/桜|花見|藤|つつじ/.test(text)) add('春の絶景');
  // 紅葉
  if (/紅葉|もみじ/.test(text)) add('紅葉');
  // 自然
  if (tagsSet.has('自然') || tagsSet.has('山') || /自然|高原|渓谷|滝|湖|湿原|森/.test(text)) add('自然と過ごす');
  // 街歩き
  if (tagsSet.has('街歩き') || /街歩き|レトロ|路地|商店街|町並み/.test(text)) add('街歩き');
  // 工芸
  if (tagsSet.has('工芸') || /工芸|焼物|陶器|染物|和紙|漆/.test(text)) add('工芸文化');
  // 雪・スキー
  if (/スキー|スノーボード|樹氷|雪見/.test(text)) add('雪景色');
  // 海水浴・ビーチ
  if (/海水浴|ビーチ|砂浜|シュノーケル/.test(text)) add('ビーチ');

  // 矛盾削除
  if (d.requiresCar === true) {
    newChips.delete('車なしOK');
  }
  if (sa.has('2night') || sa.has('3night+')) {
    newChips.delete('日帰り最適');
  }
  if (!d.isIsland) newChips.delete('離島');

  // 最大8個に制限（重要順）
  const PRIORITY = ['世界遺産', '絶景', '温泉', '紅葉', '春の絶景', '雪景色', 'ビーチ',
                    '離島', '歴史を辿る', '寺社めぐり', '自然と過ごす', '街歩き', '工芸文化',
                    'グルメ', '車なしOK', '日帰り最適', '1泊がおすすめ',
                    'ひとり旅向け', 'カップル向け', '家族向け', '友達と'];
  const sorted = [...newChips].sort((a, b) => {
    const ai = PRIORITY.indexOf(a);
    const bi = PRIORITY.indexOf(b);
    return (ai >= 0 ? ai : 99) - (bi >= 0 ? bi : 99);
  }).slice(0, 8);

  return sorted;
}

let chipsUpdated = 0;
let seasonUpdated = 0;
for (const d of destinations) {
  const newChips = refineChips(d);
  const oldChips = d.reasonChips || [];
  if (JSON.stringify(newChips) !== JSON.stringify(oldChips)) {
    d.reasonChips = newChips;
    chipsUpdated++;
  }
  const newSeason = inferSeason(d);
  if (d.bestSeason !== newSeason) {
    d.bestSeason = newSeason;
    seasonUpdated++;
  }
}
fs.writeFileSync(DEST_FILE, JSON.stringify(destinations, null, 2));

// 統計
const seasonStats = {};
for (const d of destinations) {
  seasonStats[d.bestSeason] = (seasonStats[d.bestSeason] || 0) + 1;
}
console.log(`✓ reasonChips更新: ${chipsUpdated}件`);
console.log(`✓ bestSeason更新: ${seasonUpdated}件`);
console.log('\nbestSeason分布:');
for (const [k, v] of Object.entries(seasonStats).sort((a,b) => b[1]-a[1])) {
  console.log(`  ${k}: ${v}件`);
}
