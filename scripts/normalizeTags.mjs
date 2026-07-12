/**
 * normalizeTags.mjs
 * tags / reasonChips の表記ゆれを明示的なマップで統一する（意味を変える統合はしない）。
 * 統合後に destination 内の重複タグを除去。変更内容をレポートに出力。
 *
 * 使い方: node scripts/normalizeTags.mjs <出力レポート>
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEST_FILE = path.join(__dirname, '../src/data/destinations.json');
const OUT = process.argv[2] || path.join(__dirname, '../.tag-normalize-report.json');

// 表記ゆれ統一マップ（変更前 → 正規形）。意味が同一と判断できるもののみ。
const MERGE = {
  '観光地': '観光',
  '食': 'グルメ',
  '食べ物': 'グルメ',
  '地元グルメ': 'グルメ',
  'ローカルグルメ': 'グルメ',
  '地物グルメ': 'グルメ',
  '民宿グルメ': 'グルメ',
  '祭り': '祭',
  '秋祭り': '祭',
  '町並み': '古い町並み',
  '古町並み': '古い町並み',
  '古町': '古い町並み',
  '歴史的建造物': '歴史建築',
  '古建築': '歴史建築',
  '古い建築': '歴史建築',
  '伝統建築': '歴史建築',
  '源泉掛け流し': '源泉かけ流し',
  '寺社仏閣': '寺社',
  '神社': '寺社',
  '湯治場': '湯治',
  '炭鉱跡': '炭鉱遺産',
  '炭鉱遺跡': '炭鉱遺産',
  '昭和懐古': '昭和レトロ',
  '懐古': '昭和レトロ',
  'レトログラム': '昭和レトロ',
  '夕焼け': '夕日',
  '夕景': '夕日',
  'そば': '蕎麦',
  '郷土蕎麦': '蕎麦',
  '城跡': '城',
  '山城跡': '城',
  '星空観測': '星空',
  '廃線': '廃線跡',
  '自転車': 'サイクリング',
  '海鮮グルメ': '海鮮',
  '海鮮食': '海鮮',
  '海鮮食堂': '海鮮',
  '朝獲れ海鮮': '海鮮',
  '工芸品': '工芸',
  '伝統工芸': '工芸',
  '山景観': '山岳景観',
  '山景色': '山岳景観',
  '郷土食': '郷土料理',
  '景観': '風景',
};

const destinations = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));
const changes = [];

function normalize(list, destId, field) {
  if (!Array.isArray(list)) return list;
  const seen = new Set();
  const out = [];
  for (const t of list) {
    const canon = MERGE[t] || t;
    if (canon !== t) changes.push({ id: destId, field, from: t, to: canon });
    if (!seen.has(canon)) { seen.add(canon); out.push(canon); }
  }
  return out;
}

for (const d of destinations) {
  d.tags = normalize(d.tags, d.id, 'tags');
  d.reasonChips = normalize(d.reasonChips, d.id, 'reasonChips');
}

fs.writeFileSync(DEST_FILE, JSON.stringify(destinations, null, 1));
fs.writeFileSync(OUT, JSON.stringify({ mergeRules: Object.keys(MERGE).length, changeCount: changes.length, changes }, null, 1));
console.log(`✅ タグ正規化完了: ルール${Object.keys(MERGE).length}件 / 変更${changes.length}箇所`);
console.log(`   レポート: ${OUT}`);
