const fs = require('fs');
const path = require('path');

const HUB_NAMES = {
  'tokyo-o': '東京',
  'osaka-t': '大阪',
  'nagoya-t': '名古屋',
  'fukuoka-t': '福岡',
  'sapporo-t': '札幌',
  'sendai-t': '仙台',
  'hiroshima-t': '広島',
  'hiroshima': '広島',
  'kanazawa-t': '金沢',
  'kyoto-t': '京都',
  'kobe': '神戸',
  'naha': '那覇',
  'okayama-o': '岡山',
  'takamatsu': '高松',
  'matsuyama': '松山',
  'tokushima': '徳島',
  'matsue': '松江',
  'tottori': '鳥取',
  'gifu': '岐阜',
  'shizuoka': '静岡',
  'kofu': '甲府',
  'mito': '水戸',
  'morioka': '盛岡',
  'yamagata': '山形',
  'niigata': '新潟',
  'toyama': '富山',
  'fukui': '福井',
  'nagasaki': '長崎',
  'kumamoto': '熊本',
  'kagoshima': '鹿児島',
  'miyazaki': '宮崎',
  'saga': '佐賀',
  'matsumoto-n': '松本',
  'hakodate': '函館',
  'asahikawa': '旭川',
  'kushiro': '釧路',
  'yokohama': '横浜',
  'himeji': '姫路',
  'kochi': '高知',
  'iida': '飯田',
  'nara': '奈良',
  '前橋': '前橋',
  '宇都宮': '宇都宮',
  '札幌': '札幌',
  '水戸': '水戸',
  '青森': '青森',
};

const dataPath = path.join(__dirname, '../src/data/destinations.json');
const raw = fs.readFileSync(dataPath, 'utf-8');
const data = JSON.parse(raw);

// destinations.jsonの構造を把握
const keys = Object.keys(data);
console.log('Top-level keys:', keys.slice(0, 5), '... total:', keys.length);

// データ構造を確認
const firstKey = keys[0];
console.log('Sample entry key:', firstKey);
console.log('Sample entry:', JSON.stringify(data[firstKey]).slice(0, 500));
