#!/usr/bin/env node
/**
 * mergeGenOnsenSightToHubs.js
 * gen_系の温泉・観光 destination を、以下の条件を全部満たすものに限り
 * 対応する hub destinationの spotsに統合・独立削除。
 *
 * 条件:
 *   1. hubCity が設定されている
 *   2. hubCity名前と同じ destination が存在
 *   3. travelTime[hubCityキー] ≤ 60
 *
 * 統合しない（独立維持）:
 *   - 有名温泉地（FAMOUS_KEYWORDSにヒット）
 *   - 上記条件いずれか欠如
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEST_FILE = path.join(__dirname, '../src/data/destinations.json');
const IMG_DIR = path.join(__dirname, '../public/images');

const destinations = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));

// hubCity (日本語) → travelTime キー (romaji)
const TO_KEY = {
  '札幌':'sapporo','函館':'hakodate','旭川':'asahikawa','釧路':'kushiro','帯広':'obihiro','北見':'kitami','稚内':'wakkanai',
  '青森':'aomori','八戸':'hachinohe','盛岡':'morioka','秋田':'akita','山形':'yamagata','仙台':'sendai','福島':'fukushima',
  '水戸':'mito','宇都宮':'utsunomiya','前橋':'maebashi','高崎':'takasaki','大宮':'omiya','千葉':'chiba',
  '東京':'tokyo','横浜':'yokohama','新潟':'niigata','金沢':'kanazawa','富山':'toyama','福井':'fukui',
  '甲府':'kofu','長野':'nagano','松本':'matsumoto','岐阜':'gifu','名古屋':'nagoya','浜松':'hamamatsu','静岡':'shizuoka',
  '京都':'kyoto','大阪':'osaka','神戸':'kobe','姫路':'himeji',
  '津':'tsu','大津':'otsu','奈良':'nara','和歌山':'wakayama','新宮':'shingu','田辺':'tanabe','白浜':'shirahama','串本':'kushimoto',
  '鳥取':'tottori','松江':'matsue','岡山':'okayama','広島':'hiroshima','福山':'fukuyama','下関':'shimonoseki','山口':'yamaguchi','北九州':'kitakyushu',
  '高松':'takamatsu','松山':'matsuyama','高知':'kochi','徳島':'tokushima',
  '福岡':'fukuoka','佐賀':'saga','長崎':'nagasaki','熊本':'kumamoto','大分':'oita','別府':'beppu','宮崎':'miyazaki','鹿児島':'kagoshima',
  '那覇':'naha','宮古':'miyako','宮古島':'miyakojima','石垣':'ishigaki',
};

// 単独旅行目的になる有名温泉地・観光地（独立維持）
const FAMOUS_KEYWORDS = [
  // 北海道
  '定山渓','登別','洞爺湖','支笏湖','ニセコ','二セコ','層雲峡','十勝川','阿寒湖','摩周','ウトロ','カムイワッカ',
  // 東北
  '蔵王','銀山','作並','秋保','遠刈田','飯坂','東山','磐梯熱海','磐梯','乳頭','玉造','瀬見','肘折','黒石','酸ヶ湯','八甲田',
  // 関東
  '草津','伊香保','水上','四万','万座','鬼怒川','日光','塩原','那須','鴨川','箱根','熱海','湯河原','土肥','修善寺','戸倉',
  // 中部
  '伊豆','石和','下部','蓼科','野沢','妙高','奥飛騨','下呂','飛騨','和倉','片山津','山中','山代','粟津','加賀','芦原','三国','越前',
  // 近畿
  '城崎','有馬','湯の山','榊原','洞川','十津川','龍神','勝浦','南紀','白浜温泉','本宮','湯ノ峰','川湯',
  // 中国・四国
  '玉造温泉','三朝','皆生','湯原','湯郷','湯の町','道後',
  // 九州
  '由布院','湯布院','黒川','杖立','日田','長湯','筋湯','鉄輪','明礬','嬉野','武雄','雲仙','小浜','人吉','指宿','霧島','妙見','東霧島',
];

function isFamous(name) {
  return FAMOUS_KEYWORDS.some(k => name.includes(k));
}

const targets = destinations.filter(x =>
  x.id.startsWith('gen_') &&
  ((x.tags || [])[0] === '温泉' || (x.tags || [])[0] === '観光')
);
console.log(`gen_温泉・観光: ${targets.length}件`);

// hub destinationインデックス (name → destination)
const nameIdx = {};
for (const d of destinations) {
  // hub的なdestination (city/タウン系)
  if (!d.id.startsWith('gen_') && (d.destType === 'city' || d.tier === 'hub' || d.tier2 === 'hub' || ['kyoto','osaka','tokyo','kobe','yokohama','fukuoka','kanazawa','sapporo','sendai','nagoya','hiroshima','naha'].includes(d.id))) {
    nameIdx[d.name] = d;
  }
  // hubCityと同名のregularなdestinationも対象
  if (!d.id.startsWith('gen_')) {
    if (!nameIdx[d.name]) nameIdx[d.name] = d;
  }
}

const merges = [];
const skipped = { 'famous':0, 'no-hub':0, 'no-hub-dest':0, 'far':0 };

for (const t of targets) {
  if (isFamous(t.name)) { skipped.famous++; continue; }
  const hubCity = t.hubCity;
  if (!hubCity) { skipped['no-hub']++; continue; }
  const hubDest = nameIdx[hubCity];
  if (!hubDest) { skipped['no-hub-dest']++; continue; }
  const hubKey = TO_KEY[hubCity] || hubCity.toLowerCase();
  const min = t.travelTime?.[hubKey];
  if (typeof min !== 'number' || min > 60) { skipped.far++; continue; }
  merges.push({ src: t, tgt: hubDest });
}

console.log(`統合候補: ${merges.length}件`);
console.log(`スキップ内訳: famous=${skipped.famous} hubCityなし=${skipped['no-hub']} hubdest無=${skipped['no-hub-dest']} 60分超=${skipped.far}`);

const deleteIds = new Set();
let added = 0;
for (const { src, tgt } of merges) {
  tgt.spots = tgt.spots || [];
  const exists = tgt.spots.find(s => s.name === src.name);
  const spotDesc = (src.description || '').slice(0, 200);
  const spotImg = src.images?.[0] || null;
  if (exists) {
    if (spotDesc.length > (exists.description || '').length) exists.description = spotDesc;
    if (spotImg && !exists.imageUrl) exists.imageUrl = spotImg;
  } else {
    tgt.spots.push({ name: src.name, description: spotDesc, imageUrl: spotImg });
    added++;
  }
  // tagsマージ
  if (src.tags) {
    tgt.tags = tgt.tags || [];
    for (const t of src.tags) if (!tgt.tags.includes(t)) tgt.tags.push(t);
  }
  deleteIds.add(src.id);
}

const before = destinations.length;
const remaining = destinations.filter(d => !deleteIds.has(d.id));
fs.writeFileSync(DEST_FILE, JSON.stringify(remaining, null, 2));

// 画像フォルダ削除
for (const id of deleteIds) {
  const folder = path.join(IMG_DIR, id);
  if (fs.existsSync(folder)) fs.rmSync(folder, { recursive: true, force: true });
}

console.log(`\n=== 完了 ===`);
console.log(`  統合: ${deleteIds.size}件 (新規spot追加=${added})`);
console.log(`  destinations: ${before} → ${remaining.length}`);
