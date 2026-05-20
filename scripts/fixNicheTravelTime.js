#!/usr/bin/env node
/**
 * fixNicheTravelTime.js
 * niche_ destinationの travelTime のうち 240分超を削除（daytrip矛盾解消）
 */
import fs from 'fs';
const DEST_FILE = './src/data/destinations.json';
const destinations = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));

let fixed = 0;
for (const d of destinations) {
  if (!d.id.startsWith('niche_')) continue;
  if (!d.travelTime) d.travelTime = {};
  // 999などの未確定値を削除
  for (const [city, min] of Object.entries(d.travelTime)) {
    if (typeof min !== 'number' || min >= 999) {
      delete d.travelTime[city];
    }
  }
  // travelTime空の場合は hubCity を 60分で初期化
  if (Object.keys(d.travelTime).length === 0) {
    const hub = d.hubCity || d.hub;
    if (hub) {
      // hubCity名→travelTimeキー(romaji)へ変換テーブル
      const TO_KEY = { '東京':'tokyo','大阪':'osaka','名古屋':'nagoya','京都':'kyoto','神戸':'kobe','横浜':'yokohama',
        '札幌':'sapporo','仙台':'sendai','広島':'hiroshima','福岡':'fukuoka','那覇':'naha','金沢':'kanazawa','岐阜':'gifu',
        '青森':'aomori','盛岡':'morioka','秋田':'akita','山形':'yamagata','福島':'fukushima','水戸':'mito','宇都宮':'utsunomiya',
        '前橋':'maebashi','千葉':'chiba','大宮':'omiya','新潟':'niigata','富山':'toyama','福井':'fukui','甲府':'kofu',
        '松本':'matsumoto','長野':'nagano','静岡':'shizuoka','津':'tsu','大津':'otsu','和歌山':'wakayama','鳥取':'tottori',
        '松江':'matsue','岡山':'okayama','山口':'yamaguchi','徳島':'tokushima','高松':'takamatsu','松山':'matsuyama',
        '高知':'kochi','佐賀':'saga','長崎':'nagasaki','熊本':'kumamoto','大分':'oita','宮崎':'miyazaki','鹿児島':'kagoshima' };
      const key = TO_KEY[hub] || hub.toLowerCase();
      d.travelTime[key] = 60;
    } else {
      d.travelTime.tokyo = 180;
    }
  }
  // daytrip 矛盾: min > 120 で daytrip 含む → daytripを削除
  const sa = new Set(d.stayAllowed || []);
  if (sa.has('daytrip')) {
    const mn = Math.min(...Object.values(d.travelTime).filter(v => typeof v === 'number'));
    if (mn > 120) {
      sa.delete('daytrip');
      d.stayAllowed = [...sa];
      if (d.stayAllowed.length === 0) d.stayAllowed = ['1night'];
    }
  }
  fixed++;
}
fs.writeFileSync(DEST_FILE, JSON.stringify(destinations, null, 2));
console.log(`✓ niche destinationのtravelTime修正: ${fixed}件`);
