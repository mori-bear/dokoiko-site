import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, '../src/data/destinations.json');

const SLUG_TO_JA = {
  'tokyo-o':     '東京',
  'naha':        '那覇',
  'osaka-t':     '大阪',
  'morioka':     '盛岡',
  'nagoya-t':    '名古屋',
  'hiroshima-t': '広島',
  'hiroshima':   '広島',
  'matsumoto-n': '松本',
  'sendai-t':    '仙台',
  'fukuoka-t':   '福岡',
  'sapporo-t':   '札幌',
  'matsue':      '松江',
  'kumamoto':    '熊本',
  'kagoshima':   '鹿児島',
  'kanazawa-t':  '金沢',
  'matsuyama':   '松山',
  'kushiro':     '釧路',
  'okayama-o':   '岡山',
  'yamagata':    '山形',
  'kochi':       '高知',
  'niigata':     '新潟',
  'nagasaki':    '長崎',
  'kyoto-t':     '京都',
  'fukui':       '福井',
  'miyazaki':    '宮崎',
  'asahikawa':   '旭川',
  'tokushima':   '徳島',
  'saga':        '佐賀',
  'kofu':        '甲府',
  'shizuoka':    '静岡',
  'gifu':        '岐阜',
  'tottori':     '鳥取',
  'kobe':        '神戸',
  'hakodate':    '函館',
  'mito':        '水戸',
  'toyama':      '富山',
  'iida':        '飯田',
  'himeji':      '姫路',
  'yokohama':    '横浜',
  'nara':        '奈良',
  'takamatsu':   '高松',
};

const destinations = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));

let changed = 0;
const before = {};
const after = {};

const updated = destinations.map(dest => {
  const hub = dest.hub;
  if (!hub) return dest;

  before[hub] = (before[hub] || 0) + 1;

  const normalized = SLUG_TO_JA[hub] ?? hub;
  after[normalized] = (after[normalized] || 0) + 1;

  if (normalized !== hub) {
    changed++;
    return { ...dest, hub: normalized };
  }
  return dest;
});

fs.writeFileSync(DATA_PATH, JSON.stringify(updated, null, 2), 'utf8');

// 正規化前後の比較レポート
console.log(`変換件数: ${changed}件\n`);

console.log('【正規化後 件数降順】');
Object.entries(after)
  .sort((a, b) => b[1] - a[1])
  .forEach(([hub, cnt]) => console.log(`  ${cnt}\t${hub}`));

// 統合されたもの（複数スラグ → 1つ）を表示
const merges = {};
Object.entries(SLUG_TO_JA).forEach(([slug, ja]) => {
  if (!merges[ja]) merges[ja] = [];
  merges[ja].push(slug);
});
const merged = Object.entries(merges).filter(([, slugs]) => slugs.length > 1);
if (merged.length) {
  console.log('\n【統合されたマッピング】');
  merged.forEach(([ja, slugs]) => console.log(`  ${slugs.join(' + ')} → ${ja}`));
}
