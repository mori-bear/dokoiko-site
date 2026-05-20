#!/usr/bin/env node
/**
 * updateAllIslandHotelLinks.js
 * isIsland=true 全件のhotelLinksを以下の優先順位で再構築:
 *   1) 島内に宿あり (stayAllowedに'1night'/'2night'/'3night+') → 島名
 *   2) hubCity (本土最寄り港町)
 *   3) hub (近隣ハブ都市)
 *   4) prefecture (フォールバック)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEST_FILE = path.join(__dirname, '../src/data/destinations.json');

const destinations = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));

function rakutenLink(keyword) {
  const inner = encodeURIComponent(`https://travel.rakuten.co.jp/search/?keyword=${encodeURIComponent(keyword)}`);
  return `https://hb.afl.rakuten.co.jp/hgc/5113ee4b.8662cfc5.5113ee4c.119de89a/?pc=${inner}`;
}
function jalanLink(keyword) {
  const inner = encodeURIComponent(`https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword=${encodeURIComponent(keyword)}`);
  return `https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=3764408&pid=892559858&vc_url=${inner}`;
}

const islands = destinations.filter(x => x.isIsland === true);
console.log(`isIsland=true: ${islands.length}件`);

let updated = 0, unchanged = 0;
const stats = { 'island_name': 0, 'hubCity': 0, 'hub': 0, 'prefecture': 0, 'fallback': 0 };

for (const x of islands) {
  const sa = new Set(x.stayAllowed || []);
  const hasOvernight = sa.has('1night') || sa.has('2night') || sa.has('3night+');

  let keyword, source;
  if (hasOvernight) {
    // 1) 島内に宿あり
    keyword = x.name;
    source = 'island_name';
  } else if (x.hubCity && x.hubCity !== x.name) {
    // 2) hubCity (本土港町)
    keyword = x.hubCity;
    source = 'hubCity';
  } else if (x.hub && x.hub !== x.name) {
    // 3) hub
    keyword = x.hub;
    source = 'hub';
  } else if (x.prefecture) {
    // 4) prefecture
    keyword = x.prefecture.replace(/[県府都]$/, '');
    source = 'prefecture';
  } else {
    keyword = x.name;
    source = 'fallback';
  }

  const newRakuten = rakutenLink(keyword);
  const newJalan = jalanLink(keyword);
  const oldRakuten = x.hotelLinks?.rakuten || '';
  const oldJalan = x.hotelLinks?.jalan || '';

  const changed = newRakuten !== oldRakuten || newJalan !== oldJalan || x.hotelKeyword !== keyword;
  if (changed) {
    x.hotelKeyword = keyword;
    x.hotelSearch = keyword;
    x.hotelLinks = { rakuten: newRakuten, jalan: newJalan };
    x.stayArea = { rakuten: keyword, jalan: keyword };
    x.staySearchUrl = newRakuten;
    updated++;
  } else {
    unchanged++;
  }
  stats[source]++;
}

fs.writeFileSync(DEST_FILE, JSON.stringify(destinations, null, 2));
console.log(`\n=== 完了 ===`);
console.log(`  更新: ${updated}件 / 変更なし: ${unchanged}件 / 合計: ${islands.length}件`);
console.log(`  ソース内訳: 島名=${stats.island_name} hubCity=${stats.hubCity} hub=${stats.hub} prefecture=${stats.prefecture} fallback=${stats.fallback}`);
