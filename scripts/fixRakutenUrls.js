import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, '../src/data/destinations.json');
const RAKUTEN_AFF = 'https://hb.afl.rakuten.co.jp/hgc/5113ee4b.8662cfc5.5113ee4c.119de89a/';

// 有効な楽天トラベル都道府県スラグ
const VALID_PREF_SLUGS = new Set([
  'hokkaido','aomori','iwate','miyagi','akita','yamagata','fukushima',
  'ibaraki','tochigi','gunma','saitama','chiba','tokyo','kanagawa',
  'niigata','toyama','ishikawa','fukui','yamanashi','nagano',
  'shizuoka','aichi','mie','shiga','kyoto','osaka','hyogo','nara','wakayama',
  'tottori','shimane','okayama','hiroshima','yamaguchi',
  'tokushima','kagawa','ehime','kochi',
  'fukuoka','saga','nagasaki','kumamoto','oita','miyazaki','kagoshima','okinawa','gifu',
]);

// 都道府県名 → スラグ
const PREF_TO_SLUG = {
  '北海道': 'hokkaido', '青森県': 'aomori', '岩手県': 'iwate', '宮城県': 'miyagi',
  '秋田県': 'akita', '山形県': 'yamagata', '福島県': 'fukushima', '茨城県': 'ibaraki',
  '栃木県': 'tochigi', '群馬県': 'gunma', '埼玉県': 'saitama', '千葉県': 'chiba',
  '東京都': 'tokyo', '神奈川県': 'kanagawa', '新潟県': 'niigata', '富山県': 'toyama',
  '石川県': 'ishikawa', '福井県': 'fukui', '山梨県': 'yamanashi', '長野県': 'nagano',
  '岐阜県': 'gifu', '静岡県': 'shizuoka', '愛知県': 'aichi', '三重県': 'mie',
  '滋賀県': 'shiga', '京都府': 'kyoto', '大阪府': 'osaka', '兵庫県': 'hyogo',
  '奈良県': 'nara', '和歌山県': 'wakayama', '鳥取県': 'tottori', '島根県': 'shimane',
  '岡山県': 'okayama', '広島県': 'hiroshima', '山口県': 'yamaguchi', '徳島県': 'tokushima',
  '香川県': 'kagawa', '愛媛県': 'ehime', '高知県': 'kochi', '福岡県': 'fukuoka',
  '佐賀県': 'saga', '長崎県': 'nagasaki', '熊本県': 'kumamoto', '大分県': 'oita',
  '宮崎県': 'miyazaki', '鹿児島県': 'kagoshima', '沖縄県': 'okinawa',
};

// 非標準hotelArea値 → 都道府県スラグ
const AREA_TO_PREF = {
  // Japanese text
  '北海道': 'hokkaido',
  '栃木県': 'tochigi',
  '群馬県': 'gunma',
  '茨城県': 'ibaraki',
  '青森県': 'aomori',
  // City-level codes
  'hachinohe': 'aomori',
  'hirosaki': 'aomori',
  'kagawa-takamatsu': 'kagawa',
  'kitakyushu': 'fukuoka',
  'nagahama': 'shiga',
  'oda': 'shimane',
  'ozu': 'ehime',
  'tokamachi': 'niigata',
  'tosa-shimizu': 'kochi',
  'tsumagoi': 'gunma',
  // Region codes (fallback to prefecture)
  'kyushu': null,  // use prefecture field
  'tohoku': null,  // use prefecture field
};

function getPrefSlug(dest) {
  const area = dest.hotelArea;
  const pref = dest.prefecture;

  if (area) {
    // 有効な都道府県スラグならそのまま使う
    if (VALID_PREF_SLUGS.has(area)) return area;
    // 明示的なマッピングがある
    if (AREA_TO_PREF[area] !== undefined) {
      const mapped = AREA_TO_PREF[area];
      if (mapped) return mapped;
    }
  }

  // prefecture フィールドからスラグを導出
  if (pref && PREF_TO_SLUG[pref]) return PREF_TO_SLUG[pref];

  return null;
}

function buildRakutenUrl(prefSlug) {
  const inner = `https://travel.rakuten.co.jp/yado/${prefSlug}/`;
  return RAKUTEN_AFF + '?pc=' + encodeURIComponent(inner);
}

function extractInnerUrl(affiliateUrl) {
  const d1 = decodeURIComponent(affiliateUrl);
  for (const p of ['?pc=', '&pc=']) {
    const idx = d1.indexOf(p);
    if (idx !== -1) return decodeURIComponent(d1.slice(idx + p.length).split('&')[0]);
  }
  return affiliateUrl;
}

const destinations = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));

let fixed = 0;
let skipped = 0;
let noSlug = 0;

const updated = destinations.map(dest => {
  const rakutenUrl = dest.hotelLinks?.rakuten || '';

  // f_query形式のみ修正対象
  const inner = extractInnerUrl(rakutenUrl);
  if (!inner.includes('f_query')) {
    skipped++;
    return dest;
  }

  const prefSlug = getPrefSlug(dest);
  if (!prefSlug) {
    noSlug++;
    console.warn(`[WARN] スラグ不明: ${dest.id} (${dest.name}) hotelArea=${dest.hotelArea} pref=${dest.prefecture}`);
    return dest;
  }

  const newUrl = buildRakutenUrl(prefSlug);
  fixed++;

  return {
    ...dest,
    hotelLinks: { ...dest.hotelLinks, rakuten: newUrl },
  };
});

fs.writeFileSync(DATA_PATH, JSON.stringify(updated, null, 2), 'utf8');

console.log(`\n修正完了:`);
console.log(`  修正: ${fixed}件`);
console.log(`  スキップ (direct URL): ${skipped}件`);
console.log(`  スラグ不明 (未修正): ${noSlug}件`);
