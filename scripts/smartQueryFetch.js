#!/usr/bin/env node
/**
 * smartQueryFetch.js
 * 画像なし159件に最適化クエリで再取得。
 * 1. ユニーク固有名詞抽出
 * 2. 著名地は英語クエリも試す
 * 3. API: Openverse → Wikipedia(en) → Wikipedia(ja) → Unsplash
 */
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEST_FILE = path.join(__dirname, '../src/data/destinations.json');
const IMG_DIR = path.join(__dirname, '../public/images');
const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf-8');
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.+)$/);
  if (m) process.env[m[1]] = m[2].trim();
}
const UNSPLASH = process.env.UNSPLASH_ACCESS_KEY;
const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 Safari/605.1.15';

const dests = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));
const missing = dests.filter(d => !fs.existsSync(path.join(IMG_DIR, d.id, 'main.jpg')) || fs.statSync(path.join(IMG_DIR, d.id, 'main.jpg')).size < 5000);
console.log(`📷 対象: ${missing.length}件`);

// 著名地の英語名マップ
const EN_MAP = {
  'tottori-sakyu': 'Tottori Sand Dunes',
  'iya-vine-bridge': 'Iya Kazurabashi',
  'kumejima': 'Kume Island',
  'tokashiki-jima': 'Tokashiki Island',
  'tanegashima': 'Tanegashima',
  'hamanako': 'Lake Hamana',
  'kirigamine': 'Kirigamine highland',
  'gujo-hachiman': 'Gujo Hachiman',
  'hanamaki': 'Hanamaki Iwate',
  'ishinomaki': 'Ishinomaki Miyagi',
  'kitakata': 'Kitakata Fukushima',
  'hirado-island': 'Hirado Island',
  'fukue-island': 'Fukue Island',
  'zamami-island': 'Zamami Island',
  'ie-island': 'Ie Island Okinawa',
  'irabu-island': 'Irabu Island',
  'aguni-island': 'Aguni Island',
  'kikai-island': 'Kikai Island',
  'kuroshima-yaeyama': 'Kuroshima Yaeyama',
  'ama-island': 'Ama Oki Island Shimane',
  'ogijima': 'Ogijima Kagawa',
  'manabeshima': 'Manabe Island',
  'osakikamijima': 'Osakikamijima',
  'hakatajima': 'Hakata Island Ehime',
  'himakajima': 'Himakajima',
  'sanagijima': 'Sanagi Island',
  'kinkasan': 'Kinkasan Miyagi',
  'okinoshima-kochi': 'Okinoshima Kochi',
  'toushijima': 'Toshijima',
  'sakatejima': 'Sakatejima',
  'yusuhara': 'Yusuhara Kochi',
  'shiibamura': 'Shiiba Village',
  'shima': 'Shima Mie',
  'kuki': 'Kuki Mie',
  'naruto': 'Naruto Tokushima',
  'tendou': 'Tendo Yamagata',
  'ozu': 'Ozu Ehime',
  'suzu': 'Suzu Noto',
  'wakasa-obama': 'Obama Fukui',
  'echizen': 'Echizen Fukui',
  'yakake': 'Yakage Okayama',
  'yawatahama': 'Yawatahama Ehime',
  'kashima-saga': 'Kashima Saga',
  'kashiwazaki': 'Kashiwazaki Niigata',
  'kaizu-osaki': 'Kaizu Osaki cherry',
  'gokase': 'Gokase Miyazaki',
  'yatsushiro': 'Yatsushiro Kumamoto',
  'oguni-kumamoto': 'Oguni Kumamoto',
  'muroto-cape': 'Cape Muroto',
  'yonago': 'Yonago Tottori',
  'iga-ueno': 'Iga Ueno castle',
  'mihonoseki': 'Mihonoseki Shimane',
  'sanriku-miyako': 'Jodogahama beach Miyako',
  'akakura-onsen': 'Akakura Onsen Niigata',
  'takarazuka': 'Takarazuka Hyogo',
  'kurikoma': 'Mt Kurikoma',
  'matsumoto-kaido': 'Shiojiri Nagano',
  'kujukuri-icho': 'Ichinomiya Chiba',
  'minami-aizu': 'Minami Aizu',
  'hitoyoshi-city': 'Hitoyoshi Kumamoto',
  'joetsu': 'Joetsu Niigata',
  'yaizu': 'Yaizu Shizuoka',
  'takashima-shiga': 'Takashima Shiga',
  'owase': 'Owase Mie',
  'ogata': 'Ogata Akita',
  'takarakawa-onsen': 'Takaragawa Onsen',
};

// 固有名詞抽出: 「・」「と」「（」で区切った最初の固有名詞
function extractUnique(name) {
  // 括弧の中身は読み仮名扱いで除く
  let n = name.replace(/（[^）]+）/g, '').trim();
  // 「・」「と」「、」で区切って最初の固有名詞
  const parts = n.split(/[・、と]/).map(s => s.trim()).filter(s => s.length > 1);
  // 長さ2-12のものを優先
  for (const p of parts) {
    if (p.length >= 2 && p.length <= 12) return p;
  }
  return parts[0] || n;
}

function get(url) {
  return new Promise((resolve, reject) => {
    let hops = 0;
    function go(u) {
      hops++;
      if (hops > 5) return reject(new Error('redirects'));
      https.get(u, { headers: { 'User-Agent': BROWSER_UA, 'Accept': 'application/json' } }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return go(res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, u).toString());
        }
        if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
        let body = ''; res.setEncoding('utf-8');
        res.on('data', c => body += c);
        res.on('end', () => resolve(body));
      }).on('error', reject);
    }
    go(url);
  });
}
function download(url, dest) {
  return new Promise((resolve, reject) => {
    let hops = 0;
    function go(u) {
      hops++;
      if (hops > 5) return reject(new Error('redirects'));
      https.get(u, { headers: { 'User-Agent': BROWSER_UA } }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return go(res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, u).toString());
        }
        if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
        const f = fs.createWriteStream(dest);
        res.pipe(f);
        f.on('finish', () => f.close(resolve));
      }).on('error', reject);
    }
    go(url);
  });
}

async function openverse(q) {
  try {
    const url = `https://api.openverse.engineering/v1/images/?q=${encodeURIComponent(q)}&page_size=3&aspect_ratio=wide&license_type=commercial`;
    const body = await get(url);
    const j = JSON.parse(body);
    return j?.results?.[0]?.url || null;
  } catch { return null; }
}
async function wikiSummary(lang, title) {
  try {
    const body = await get(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
    const j = JSON.parse(body);
    return j?.originalimage?.source || j?.thumbnail?.source || null;
  } catch { return null; }
}
async function wikiPI(lang, q) {
  try {
    const body = await get(`https://${lang}.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&piprop=thumbnail|original&pithumbsize=1200&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrlimit=3&origin=*`);
    const j = JSON.parse(body);
    const pages = j?.query?.pages;
    if (!pages) return null;
    for (const p of Object.values(pages)) {
      if (p?.original?.source) return p.original.source;
      if (p?.thumbnail?.source) return p.thumbnail.source;
    }
    return null;
  } catch { return null; }
}
async function unsplash(q) {
  try {
    const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=1&orientation=landscape`,
      { headers: { Authorization: `Client-ID ${UNSPLASH}` } });
    if (!res.ok) return null;
    const j = await res.json();
    return j?.results?.[0]?.urls?.regular || null;
  } catch { return null; }
}

let success = 0, fail = 0;
const stats = { openverse: 0, wikiEn: 0, wikiJa: 0, unsplash: 0 };

for (let i = 0; i < missing.length; i++) {
  const d = missing[i];
  const prefShort = (d.prefecture || '').replace(/[県府都]$/, '');
  const unique = extractUnique(d.name);
  const enQuery = EN_MAP[d.id];
  // クエリ優先順
  const queries = [];
  if (enQuery) queries.push(['en', enQuery]);
  queries.push(['ja', unique]);
  if (prefShort && unique !== prefShort) queries.push(['ja-pref', `${unique} ${prefShort}`]);
  queries.push(['ja-name', d.name]);

  let img = null, src = null;
  // 1. Openverse (英語クエリあれば優先、なければ日本語)
  for (const [lang, q] of queries.slice(0, 3)) {
    img = await openverse(q);
    if (img) { src = `openverse:${q}`; stats.openverse++; break; }
    await new Promise(r => setTimeout(r, 800));
  }
  // 2. Wikipedia (英→日)
  if (!img && enQuery) {
    img = await wikiSummary('en', enQuery);
    if (img) { src = `wiki-en:${enQuery}`; stats.wikiEn++; }
    if (!img) {
      await new Promise(r => setTimeout(r, 800));
      img = await wikiPI('en', enQuery);
      if (img) { src = `wiki-en-pi:${enQuery}`; stats.wikiEn++; }
    }
  }
  if (!img) {
    img = await wikiSummary('ja', unique);
    if (img) { src = `wiki-ja:${unique}`; stats.wikiJa++; }
  }
  if (!img && d.name !== unique) {
    await new Promise(r => setTimeout(r, 800));
    img = await wikiSummary('ja', d.name);
    if (img) { src = `wiki-ja-name`; stats.wikiJa++; }
  }
  // 3. Unsplash
  if (!img) {
    const uq = enQuery || `${unique} ${prefShort} japan`;
    img = await unsplash(uq);
    if (img) { src = `unsplash:${uq}`; stats.unsplash++; }
  }

  if (img) {
    const folder = path.join(IMG_DIR, d.id);
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
    const dst = path.join(folder, 'main.jpg');
    try {
      await download(img, dst);
      const size = fs.statSync(dst).size;
      if (size > 5000) {
        const j = dests.find(x => x.id === d.id);
        if (j) {
          j.images = j.images || [];
          if (!j.images.some(p => p === `/images/${d.id}/main.jpg`)) j.images.unshift(`/images/${d.id}/main.jpg`);
        }
        success++;
      } else {
        fs.unlinkSync(dst);
        fail++;
      }
    } catch { fail++; }
  } else fail++;

  if ((i+1) % 15 === 0 || i+1 === missing.length) {
    console.log(`  [${i+1}/${missing.length}] ✓${success} ✗${fail} (ov=${stats.openverse} en=${stats.wikiEn} ja=${stats.wikiJa} un=${stats.unsplash})`);
    fs.writeFileSync(DEST_FILE, JSON.stringify(dests, null, 2));
  }
  await new Promise(r => setTimeout(r, 1500));
}
fs.writeFileSync(DEST_FILE, JSON.stringify(dests, null, 2));
console.log(`\n=== 完了 === ✓${success} ✗${fail}`);
