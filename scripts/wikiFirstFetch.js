#!/usr/bin/env node
/**
 * wikiFirstFetch.js
 * 画像なし全件をWikipedia優先で再取得 (制限解除期待)
 * 順: Wikipedia(en summary) → Wikipedia(en pageimages) → Wikipedia(ja summary) → Wikimedia Commons → Openverse → Unsplash
 * リクエスト間隔: 2秒
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
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 Safari/605.1.15';

const dests = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));
const missing = dests.filter(d => !fs.existsSync(path.join(IMG_DIR, d.id, 'main.jpg')) || fs.statSync(path.join(IMG_DIR, d.id, 'main.jpg')).size < 5000);
console.log(`📷 対象: ${missing.length}件 (2秒間隔)`);

// 著名英語名マップ (拡張)
const EN_MAP = {
  'tokashiki-jima':'Tokashiki Island','kumejima':'Kume Island','tanegashima':'Tanegashima',
  'zamami-island':'Zamami Island','ie-island':'Ie Island','irabu-island':'Irabu Island',
  'aguni-island':'Aguni Island','kikai-island':'Kikai Island','kuroshima-yaeyama':'Kuroshima Yaeyama',
  'ama-island':'Ama Island Oki','ogijima':'Ogi Island Kagawa','manabeshima':'Manabe Island',
  'osakikamijima':'Osakikamijima','hakatajima':'Hakata Island Imabari','himakajima':'Himaka Island',
  'sanagijima':'Sanagi Island','kinkasan':'Kinkasan','okinoshima-kochi':'Okinoshima Kochi',
  'toushijima':'Toshi Island','sakatejima':'Sakate Island','hirado-island':'Hirado Island',
  'fukue-island':'Fukue Island',
  'mihonoseki':'Mihonoseki','ozu':'Ozu Ehime','suzu':'Suzu Ishikawa','wakasa-obama':'Obama Fukui',
  'echizen':'Echizen city','yakake':'Yakage','hanamaki':'Hanamaki','gujo-hachiman':'Gujo Hachiman',
  'shima':'Shima Mie','yusuhara':'Yusuhara','kitakata':'Kitakata Fukushima','akakura-onsen':'Akakura Onsen',
  'takarazuka':'Takarazuka','naruto':'Naruto Tokushima','ishinomaki':'Ishinomaki','tendou':'Tendo Yamagata',
  'ogata':'Ogata Akita','sanriku-miyako':'Jodogahama','hitoyoshi-city':'Hitoyoshi','joetsu':'Joetsu',
  'yaizu':'Yaizu','hamanako':'Lake Hamana','takashima-shiga':'Takashima Shiga','owase':'Owase',
  'yatsushiro':'Yatsushiro','oguni-kumamoto':'Oguni Kumamoto','muroto-cape':'Cape Muroto',
  'yonago':'Yonago','iga-ueno':'Iga Ueno','kurikoma':'Mt Kurikoma','kujukuri-icho':'Ichinomiya Chiba',
  'matsumoto-kaido':'Shiojiri','takarakawa-onsen':'Takaragawa Onsen','yawatahama':'Yawatahama',
  'minami-aizu':'Minami Aizu','kashima-saga':'Kashima Saga','kashiwazaki':'Kashiwazaki','kirigamine':'Kirigamine',
  'kaizu-osaki':'Kaizu Osaki','gokase':'Gokase','shiibamura':'Shiiba village','kuki':'Kuki Owase',
  'tottori-sakyu':'Tottori Sand Dunes','iya-vine-bridge':'Iya Kazurabashi',
};
function extractUnique(name) {
  let n = name.replace(/（[^）]+）/g, '').trim();
  const parts = n.split(/[・、と]/).map(s => s.trim()).filter(s => s.length > 1);
  for (const p of parts) if (p.length >= 2 && p.length <= 12) return p;
  return parts[0] || n;
}
function get(url) {
  return new Promise((resolve, reject) => {
    let hops = 0;
    function go(u) {
      hops++;
      if (hops > 5) return reject(new Error('redirects'));
      https.get(u, { headers: { 'User-Agent': UA, 'Accept': 'application/json' } }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume(); return go(res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, u).toString());
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
      https.get(u, { headers: { 'User-Agent': UA } }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume(); return go(res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, u).toString());
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
async function commonsSearch(q) {
  try {
    const body = await get(`https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=3&gsrsearch=${encodeURIComponent(q)}&prop=imageinfo&iiprop=url&iiurlwidth=1200&origin=*`);
    const j = JSON.parse(body);
    const pages = j?.query?.pages;
    if (!pages) return null;
    for (const p of Object.values(pages)) {
      const ii = p?.imageinfo?.[0];
      if (ii?.thumburl) return ii.thumburl;
      if (ii?.url) return ii.url;
    }
    return null;
  } catch { return null; }
}
async function openverse(q) {
  try {
    const body = await get(`https://api.openverse.engineering/v1/images/?q=${encodeURIComponent(q)}&page_size=3&aspect_ratio=wide&license_type=commercial`);
    const j = JSON.parse(body);
    return j?.results?.[0]?.url || null;
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
const stats = { wikiEnSum:0, wikiEnPI:0, wikiJaSum:0, commons:0, openverse:0, unsplash:0 };

for (let i = 0; i < missing.length; i++) {
  const d = missing[i];
  const prefShort = (d.prefecture || '').replace(/[県府都]$/, '');
  const unique = extractUnique(d.name);
  const enQuery = EN_MAP[d.id];

  let img = null, src = null;
  // 1. Wikipedia(en summary)
  if (enQuery) {
    img = await wikiSummary('en', enQuery);
    if (img) { src = `wiki-en-sum:${enQuery}`; stats.wikiEnSum++; }
    await new Promise(r => setTimeout(r, 2000));
  }
  // 2. Wikipedia(en pageimages)
  if (!img && enQuery) {
    img = await wikiPI('en', enQuery);
    if (img) { src = `wiki-en-pi:${enQuery}`; stats.wikiEnPI++; }
    await new Promise(r => setTimeout(r, 2000));
  }
  // 3. Wikipedia(ja summary)
  if (!img) {
    img = await wikiSummary('ja', unique);
    if (img) { src = `wiki-ja-sum:${unique}`; stats.wikiJaSum++; }
    await new Promise(r => setTimeout(r, 2000));
  }
  if (!img && d.name !== unique) {
    img = await wikiSummary('ja', d.name);
    if (img) { src = `wiki-ja-name`; stats.wikiJaSum++; }
    await new Promise(r => setTimeout(r, 2000));
  }
  // 4. Wikimedia Commons
  if (!img) {
    const cq = enQuery || `${unique} ${prefShort}`;
    img = await commonsSearch(cq);
    if (img) { src = `commons:${cq}`; stats.commons++; }
    await new Promise(r => setTimeout(r, 2000));
  }
  // 5. Openverse
  if (!img) {
    img = await openverse(enQuery || `${unique} ${prefShort}`);
    if (img) { src = `openverse`; stats.openverse++; }
    await new Promise(r => setTimeout(r, 2000));
  }
  // 6. Unsplash
  if (!img) {
    img = await unsplash(enQuery || `${unique} ${prefShort} japan`);
    if (img) { src = `unsplash`; stats.unsplash++; }
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
      } else { fs.unlinkSync(dst); fail++; }
    } catch { fail++; }
  } else fail++;

  if ((i+1) % 10 === 0 || i+1 === missing.length) {
    console.log(`  [${i+1}/${missing.length}] ✓${success} ✗${fail} (enSum=${stats.wikiEnSum} enPI=${stats.wikiEnPI} jaSum=${stats.wikiJaSum} commons=${stats.commons} ov=${stats.openverse} un=${stats.unsplash})`);
    fs.writeFileSync(DEST_FILE, JSON.stringify(dests, null, 2));
  }
}
fs.writeFileSync(DEST_FILE, JSON.stringify(dests, null, 2));
console.log(`\n=== 完了 === ✓${success} ✗${fail}`);
