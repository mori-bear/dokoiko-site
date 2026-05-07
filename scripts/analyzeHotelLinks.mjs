import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

const dataPath = join(__dirname, '../src/data/destinations.json');
const raw = readFileSync(dataPath, 'utf-8');
const data = JSON.parse(raw);

const entries = Object.values(data);
const destinations = entries.filter(e => e.type === 'destination');

console.log(`総エントリ数: ${destinations.length}`);

// ===== 1. hotelSearch フィールド集計 =====
let withHotelSearch = 0;
let withoutHotelSearch = 0;
destinations.forEach(d => {
  if (d.hotelSearch) withHotelSearch++;
  else withoutHotelSearch++;
});
console.log(`\n## 1. hotelSearch フィールド集計`);
console.log(`  hotelSearch あり: ${withHotelSearch}件`);
console.log(`  hotelSearch なし (name使用): ${withoutHotelSearch}件`);

// なしの場合のリスト
const noHotelSearch = destinations.filter(d => !d.hotelSearch);
console.log(`  → name使用: ${noHotelSearch.slice(0, 10).map(d => `${d.id}(${d.name})`).join(', ')}`);

// ===== 2. isDaytripOnly の集計 =====
const daytripOnly = destinations.filter(d => {
  const s = d.stayAllowed || [];
  return s.length > 0 && !s.includes('1night');
});
console.log(`\n## 2. stayAllowed が daytrip のみ (isDaytripOnly): ${daytripOnly.length}件`);

// ===== 3. isBusOnly の集計 =====
const busOnly = destinations.filter(d => {
  const railNote = d.railNote || '';
  const hubId = d.hub || d.accessHub;
  return railNote.includes('バス') && !!hubId;
});
console.log(`\n## 3. railNote に「バス」を含み hub がある (isBusOnly): ${busOnly.length}件`);

// ===== 4. hotelSearchKeyword 決定とURL生成 =====
const results = destinations.map(d => {
  const stayAllowed = d.stayAllowed || [];
  const isDaytripOnly = stayAllowed.length > 0 && !stayAllowed.includes('1night');
  const railNote = d.railNote || '';
  const hubId = d.hub || d.accessHub;
  const isBusOnly = railNote.includes('バス') && !!hubId;
  const hubName = HUB_NAMES[hubId] || null;

  let keyword;
  let reason;
  if (isDaytripOnly && hubId && hubName) {
    keyword = hubName;
    reason = 'daytrip-only→hub';
  } else if (isBusOnly && hubName && !isDaytripOnly) {
    keyword = hubName;
    reason = 'bus+hub→hub周辺';
  } else {
    keyword = d.hotelSearch || d.name;
    reason = d.hotelSearch ? 'hotelSearch' : 'name';
  }

  const rakutenUrl = `https://travel.rakuten.co.jp/hotel/keyword/${encodeURIComponent(keyword)}/`;
  const jalanUrl = `https://www.jalan.net/yad/?word=${encodeURIComponent(keyword)}`;

  // 実際のhotelLinksも確認
  const actualRakuten = d.hotelLinks?.rakuten || d.staySearchUrl || null;
  const actualJalan = d.hotelLinks?.jalan || null;

  return {
    id: d.id,
    name: d.name,
    hubId,
    hubName,
    isDaytripOnly,
    isBusOnly,
    stayAllowed,
    railNote: d.railNote,
    hotelSearch: d.hotelSearch,
    keyword,
    reason,
    rakutenUrl,
    jalanUrl,
    actualRakuten,
    actualJalan,
  };
});

// 集計
const daytripOnlyHub = results.filter(r => r.reason === 'daytrip-only→hub');
const busOnlyHub = results.filter(r => r.reason === 'bus+hub→hub周辺');
const normalResults = results.filter(r => r.reason === 'hotelSearch' || r.reason === 'name');

console.log(`\n## hub切り替え集計`);
console.log(`  daytrip-only → hub使用: ${daytripOnlyHub.length}件`);
console.log(`  バス+hub → hub周辺: ${busOnlyHub.length}件`);
console.log(`  通常（自身のキーワード）: ${normalResults.length}件`);

// daytrip-onlyかつhubがないケース
const daytripNoHub = results.filter(r => r.isDaytripOnly && (!r.hubId || !HUB_NAMES[r.hubId]));
if (daytripNoHub.length > 0) {
  console.log(`\n  ※ daytrip-only だが hub マッピングなし: ${daytripNoHub.length}件`);
  daytripNoHub.forEach(d => console.log(`    - ${d.id} (${d.name}) hubId=${d.hubId}`));
}

// ===== 実際のhotelLinks有無 =====
const withHotelLinks = destinations.filter(d => d.hotelLinks?.rakuten || d.hotelLinks?.jalan);
const withStaySearchUrl = destinations.filter(d => d.staySearchUrl);
console.log(`\n## 既存URLフィールド集計`);
console.log(`  hotelLinks.rakuten あり: ${destinations.filter(d => d.hotelLinks?.rakuten).length}件`);
console.log(`  hotelLinks.jalan あり: ${destinations.filter(d => d.hotelLinks?.jalan).length}件`);
console.log(`  staySearchUrl あり: ${withStaySearchUrl.length}件`);
console.log(`  hotelKeyword あり: ${destinations.filter(d => d.hotelKeyword).length}件`);
console.log(`  stayArea あり: ${destinations.filter(d => d.stayArea).length}件`);

// ===== curl確認用10件選出 =====
const curlTargets = [
  results.find(r => r.id === 'naoshima'),
  results.find(r => r.id === 'kusatsu-onsen'),
  results.find(r => r.id === 'mitoyo'),
  results.filter(r => r.isDaytripOnly)[0],
  results.filter(r => r.isDaytripOnly)[1],
  results.filter(r => r.isBusOnly && r.reason === 'bus+hub→hub周辺')[0],
  results.filter(r => r.isBusOnly && r.reason === 'bus+hub→hub周辺')[1],
  results.find(r => r.reason === 'hotelSearch' && !['naoshima','kusatsu-onsen','mitoyo'].includes(r.id)),
  results.find(r => r.reason === 'name'),
  results.find(r => r.id === 'kamakura'),
].filter(Boolean);

// 重複を除く
const seen = new Set();
const uniqueTargets = curlTargets.filter(r => {
  if (seen.has(r.id)) return false;
  seen.add(r.id);
  return true;
}).slice(0, 10);

console.log('\n## curl確認用URL（10件）');
uniqueTargets.forEach(r => {
  console.log(`ID: ${r.id} | name: ${r.name} | keyword: ${r.keyword} | reason: ${r.reason}`);
  console.log(`  RAKUTEN: ${r.rakutenUrl}`);
  console.log(`  JALAN:   ${r.jalanUrl}`);
  if (r.actualRakuten) console.log(`  ACTUAL_R: ${r.actualRakuten.slice(0, 100)}...`);
});

// actualRakutenのURL形式を確認
const sampleWithActual = results.filter(r => r.actualRakuten).slice(0, 3);
console.log('\n## 実際のhotelLinks.rakuten URLサンプル（アフィリエイトリンク確認）');
sampleWithActual.forEach(r => {
  console.log(`  ${r.id}: ${r.actualRakuten?.slice(0, 120)}`);
});
