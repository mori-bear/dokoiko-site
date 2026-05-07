import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const destPath = path.join(__dirname, '../src/data/destinations.json');

const HUB_NAMES = {
  'tokyo-o': '東京', 'osaka-t': '大阪', 'nagoya-t': '名古屋', 'fukuoka-t': '福岡',
  'sapporo-t': '札幌', 'sendai-t': '仙台', 'hiroshima-t': '広島', 'hiroshima': '広島',
  'kanazawa-t': '金沢', 'kyoto-t': '京都', 'kobe': '神戸', 'naha': '那覇',
  'okayama-o': '岡山', 'takamatsu': '高松', 'matsuyama': '松山', 'tokushima': '徳島',
  'matsue': '松江', 'tottori': '鳥取', 'gifu': '岐阜', 'shizuoka': '静岡',
  'kofu': '甲府', 'mito': '水戸', 'morioka': '盛岡', 'yamagata': '山形',
  'niigata': '新潟', 'toyama': '富山', 'fukui': '福井', 'nagasaki': '長崎',
  'kumamoto': '熊本', 'kagoshima': '鹿児島', 'miyazaki': '宮崎', 'saga': '佐賀',
  'matsumoto-n': '松本', 'hakodate': '函館', 'asahikawa': '旭川', 'kushiro': '釧路',
  'yokohama': '横浜', 'himeji': '姫路', 'kochi': '高知', 'iida': '飯田',
  'nara': '奈良',
  '前橋': '前橋', '宇都宮': '宇都宮', '札幌': '札幌', '水戸': '水戸', '青森': '青森',
};

const data = JSON.parse(fs.readFileSync(destPath, 'utf8'));
const hubIdSet = new Set(data.filter(d => d.hub).map(d => d.hub));
const destById = Object.fromEntries(data.map(d => [d.id, d]));

const result = data.map(dest => {
  const tier2 = hubIdSet.has(dest.id) ? 'hub' : (dest.tier || 'spot');

  let hubName = null;
  if (dest.hub) {
    if (destById[dest.hub]) {
      hubName = destById[dest.hub].name;
    } else {
      hubName = HUB_NAMES[dest.hub] || null;
    }
  }

  return { ...dest, tier2, hubName };
});

fs.writeFileSync(destPath, JSON.stringify(result, null, 2) + '\n', 'utf8');
console.log(`✅ ${result.length}件に tier2・hubName を追加`);

console.log('\n確認サンプル:');
['naoshima', 'shimonada', 'kusatsu-onsen', 'nara', 'tottori', 'kamakura'].forEach(id => {
  const d = result.find(x => x.id === id);
  if (d) console.log(`  ${id}: tier2=${d.tier2}, hub=${d.hub}, hubName=${d.hubName}`);
});

const unmapped = result.filter(d => d.hub && !d.hubName);
console.log(`\nhubNameなし(hubあり): ${unmapped.length}件`, unmapped.map(d => d.id));

const tier2counts = result.reduce((a, d) => { a[d.tier2] = (a[d.tier2]||0)+1; return a; }, {});
console.log('\ntier2集計:', tier2counts);
