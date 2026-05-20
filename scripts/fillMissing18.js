#!/usr/bin/env node
/**
 * fillMissing18.js
 * 画像なし18件に対し複数手段で画像取得:
 *   1. ja.wikipedia.org REST page/summary (thumbnail.source)
 *   2. en.wikipedia.org REST page/summary (thumbnail.source)
 *   3. Wikimedia Commons search API (File:検索→画像URL)
 *   4. Wikipedia query API pageimages (前回未使用クエリで)
 */
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEST_FILE = path.join(__dirname, '../src/data/destinations.json');
const IMG_DIR = path.join(__dirname, '../public/images');

const destinations = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));

// Re-run target: Unsplash後に残った4件
const TARGETS = [
  'izumi', 'kurobe-gorge', 'shisui', 'ryugado',
];

const EN_NAME = {
  'katsurahama': 'Katsurahama',
  'soya-misaki': 'Cape Sōya',
  'senjojiki-aomori': 'Senjōjiki Coast',
  'wajima-asaichi': 'Wajima morning market',
  'izumi': 'Izumi, Kagoshima',
  'katano': 'Katano, Osaka',
  'kurobe-gorge': 'Kurobe Gorge',
  'shirahama': 'Shirahama, Wakayama',
  'toba-pearl': 'Mikimoto Pearl Island',
  'takasakiyama': 'Takasakiyama Natural Zoological Garden',
  'saitobaru': 'Saitobaru Burial Mounds',
  'chiba-zoo': 'Chiba Zoological Park',
  'shisui': 'Shisui Premium Outlets',
  'izu-jogasaki': 'Jōgasaki Coast',
  'motonosumi': 'Motonosumi Inari Shrine',
  'mt-yatsugatake': 'Yatsugatake Mountains',
  'ryugado': 'Ryūgadō',
  'kanazawa': 'Kanazawa',
};

const JA_TITLE = {
  'katsurahama': '桂浜',
  'soya-misaki': '宗谷岬',
  'senjojiki-aomori': '千畳敷海岸 (深浦町)',
  'wajima-asaichi': '輪島市朝市',
  'izumi': '出水市',
  'katano': '交野山',
  'kurobe-gorge': '黒部峡谷',
  'shirahama': '白浜町 (和歌山県)',
  'toba-pearl': 'ミキモト真珠島',
  'takasakiyama': '高崎山自然動物園',
  'saitobaru': '西都原古墳群',
  'chiba-zoo': '千葉市動物公園',
  'shisui': '酒々井プレミアム・アウトレット',
  'izu-jogasaki': '城ヶ崎海岸',
  'motonosumi': '元乃隅神社',
  'mt-yatsugatake': '八ヶ岳連峰',
  'ryugado': '龍河洞',
  'kanazawa': '金沢市',
};

function get(url) {
  return new Promise((resolve, reject) => {
    let hops = 0;
    function go(u) {
      hops++;
      if (hops > 5) return reject(new Error('redirects'));
      https.get(u, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15', 'Accept': 'application/json' } }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return go(res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, u).toString());
        }
        if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
        let body = '';
        res.setEncoding('utf-8');
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
      https.get(u, { headers: { 'User-Agent': 'dokoiko/1.0' } }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return go(res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, u).toString());
        }
        if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
      }).on('error', reject);
    }
    go(url);
  });
}

async function trySummary(lang, title) {
  const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  try {
    const body = await get(url);
    const j = JSON.parse(body);
    return j?.thumbnail?.source || j?.originalimage?.source || null;
  } catch { return null; }
}

async function tryCommonsSearch(query) {
  // Commons search namespace=6 (File), get first match → thumbnail URL
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=3&gsrsearch=${encodeURIComponent(query)}&prop=imageinfo&iiprop=url&iiurlwidth=800&origin=*`;
  try {
    const body = await get(url);
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

async function tryPageImages(lang, query) {
  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&piprop=thumbnail|original&pithumbsize=800&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=3&origin=*`;
  try {
    const body = await get(url);
    const j = JSON.parse(body);
    const pages = j?.query?.pages;
    if (!pages) return null;
    for (const p of Object.values(pages)) {
      const t = p?.thumbnail?.source || p?.original?.source;
      if (t) return t;
    }
    return null;
  } catch { return null; }
}

let success = 0, fail = 0;
const results = [];

for (const id of TARGETS) {
  const d = destinations.find(x => x.id === id);
  if (!d) { console.log(`✗ ${id}: not found in destinations.json`); continue; }
  const ja = JA_TITLE[id] || d.name;
  const en = EN_NAME[id];

  const attempts = [
    ['ja-summary', () => trySummary('ja', ja)],
    ['en-summary', en ? () => trySummary('en', en) : null],
    ['ja-summary(name)', () => trySummary('ja', d.name)],
    ['ja-pageimages', () => tryPageImages('ja', ja)],
    ['en-pageimages', en ? () => tryPageImages('en', en) : null],
    ['commons-ja', () => tryCommonsSearch(ja)],
    ['commons-en', en ? () => tryCommonsSearch(en) : null],
  ].filter(a => a[1]);

  let img = null, source = null;
  for (const [name, fn] of attempts) {
    img = await fn();
    if (img) { source = name; break; }
    await new Promise(r => setTimeout(r, 1500));
  }

  if (img) {
    const folder = path.join(IMG_DIR, id);
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
    const dst = path.join(folder, 'main.jpg');
    try {
      await download(img, dst);
      const size = fs.statSync(dst).size;
      if (size > 0) {
        d.images = [`/images/${id}/main.jpg`];
        success++;
        console.log(`✓ ${id} [${source}] ${size}B`);
        results.push({ id, status: 'ok', source });
      } else {
        fs.unlinkSync(dst);
        fail++;
        console.log(`✗ ${id}: 0-byte download`);
        results.push({ id, status: 'fail' });
      }
    } catch (e) {
      fail++;
      console.log(`✗ ${id}: ${e.message}`);
      results.push({ id, status: 'fail', err: e.message });
    }
  } else {
    fail++;
    console.log(`✗ ${id}: 全API失敗`);
    results.push({ id, status: 'fail' });
  }
  await new Promise(r => setTimeout(r, 2500));
}

fs.writeFileSync(DEST_FILE, JSON.stringify(destinations, null, 2));
console.log(`\n=== 完了 ===`);
console.log(`  成功: ${success} / 失敗: ${fail}`);
console.log(`  残りなし: ${TARGETS.filter(id => results.find(r => r.id===id && r.status==='ok')).join(', ')}`);
console.log(`  失敗: ${results.filter(r => r.status==='fail').map(r => r.id).join(', ')}`);
