#!/usr/bin/env node
/**
 * updateIslandHotelLinks.js
 * 日帰り限定離島(isIsland=true && stayAllowed=['daytrip'])のhotelLinksを
 * 島名→hubCity経由に切り替え（島内に宿がないため、本土最寄り港町で予約）
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

let updated = 0;
const targets = destinations.filter(x =>
  x.isIsland === true &&
  Array.isArray(x.stayAllowed) &&
  x.stayAllowed.length === 1 &&
  x.stayAllowed[0] === 'daytrip'
);

console.log(`日帰り限定離島: ${targets.length}件`);

for (const x of targets) {
  // 優先順位: hubCity → hub → prefecture
  const newKeyword = x.hubCity || x.hub || (x.prefecture || '').replace(/[県府都]$/, '');
  if (!newKeyword || newKeyword === x.name) continue;

  const oldKeyword = x.hotelKeyword || x.hotelSearch;
  x.hotelKeyword = newKeyword;
  x.hotelSearch = newKeyword;
  x.hotelLinks = {
    rakuten: rakutenLink(newKeyword),
    jalan: jalanLink(newKeyword),
  };
  x.stayArea = { rakuten: newKeyword, jalan: newKeyword };
  x.staySearchUrl = rakutenLink(newKeyword);
  updated++;
  console.log(`  ✓ ${x.id} (${x.name}): ${oldKeyword} → ${newKeyword}`);
}

fs.writeFileSync(DEST_FILE, JSON.stringify(destinations, null, 2));
console.log(`\n完了: ${updated}件更新`);
