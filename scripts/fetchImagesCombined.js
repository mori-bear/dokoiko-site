import fs from 'fs';
import https from 'https';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UNSPLASH_KEY = 'nDJVqw9sUkOprnPMFGOFud44i_bhpCEAZdWSRXT_0Xo';
const imageDir = path.join(__dirname, '../public/images');

const destinations = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../dist/data/destinations.json'), 'utf8')
);
const destMap = Object.fromEntries(destinations.map(d => [d.id, d]));

// ① 画像なし28件
const NO_IMAGE_IDS = [
  'suwa','ito','hita','takeo-onsen','iiyama','hanamaki',
  'dogo-onsen','miyanoshita','kirishima','tanabe','yunotsu-onsen','taketa',
  'nokogiriyama','nasu','shiobara-onsen','tazawako','myoko-kogen',
  'echigo-yuzawa','akakura-onsen','yuwaku-onsen','mimasaka','kaga-onsen2',
  'shibu-onsen','shimokitazawa-nyuto','unzen2','hateruma-island',
  'suo-oshima','kashiwajima',
];

// ② 要確認11件（上書き）
const REPLACE_IDS = [
  'nikko','beppu','takayama-o','aizu','ginzan-onsen',
  'hakone','kamakura','yufuin','nyuto-onsen','noboribetsu',
];

// ③ 北海道系（gen_北海_ プレフィックス・画像なし全件）
const HOKKAIDO_IDS = destinations
  .filter(d => d.id.startsWith('gen_北海_') && !fs.existsSync(path.join(imageDir, `${d.id}.jpg`)))
  .map(d => d.id);

// 全対象をまとめる（重複排除）
const allTargets = [...new Set([...NO_IMAGE_IDS, ...REPLACE_IDS, ...HOKKAIDO_IDS])];
console.log(`対象: 計${allTargets.length}件 (画像なし${NO_IMAGE_IDS.length} + 上書き${REPLACE_IDS.length} + 北海道${HOKKAIDO_IDS.length})`);

// ── HTTP ヘルパー ──────────────────────────────────────────────
async function get(url, opts = {}) {
  return new Promise(resolve => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout: 12000, ...opts }, res => {
      if ([301, 302].includes(res.statusCode) && res.headers.location) {
        return resolve(get(res.headers.location, opts));
      }
      let buf = [];
      res.on('data', c => buf.push(Buffer.from(c, 'binary')));
      res.on('end', () => resolve({ status: res.statusCode, data: buf.join(''), headers: res.headers }));
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

// ── Unsplash ──────────────────────────────────────────────────
async function fetchUnsplash(query) {
  const url = `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=landscape&content_filter=high`;
  const r = await get(url, { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}`, 'Accept-Version': 'v1' } });
  if (!r || r.status !== 200) return null;
  try { return JSON.parse(r.data).urls?.regular || null; } catch { return null; }
}

// ── Wikipedia フォールバック ────────────────────────────────────
async function fetchWiki(query) {
  for (const base of ['ja', 'en']) {
    const url = `https://${base}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
    const r = await get(url, { headers: { 'User-Agent': 'DokoIko/1.0 (tabidokoiko.com)' } });
    if (!r || r.status !== 200) continue;
    try {
      const j = JSON.parse(r.data);
      const src = j.originalimage?.source || j.thumbnail?.source;
      if (src) return src;
    } catch {}
  }
  return null;
}

// ── ダウンロード ───────────────────────────────────────────────
async function download(url, filepath) {
  return new Promise(resolve => {
    const client = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(filepath);
    client.get(url, { headers: { 'User-Agent': 'DokoIko/1.0' }, timeout: 20000 }, res => {
      if ([301, 302].includes(res.statusCode) && res.headers.location) {
        file.close();
        fs.unlink(filepath, () => {});
        return resolve(download(res.headers.location, filepath));
      }
      if (res.statusCode !== 200) { file.close(); fs.unlink(filepath, () => {}); return resolve(false); }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(true); });
      file.on('error', () => { fs.unlink(filepath, () => {}); resolve(false); });
    }).on('error', () => { fs.unlink(filepath, () => {}); resolve(false); });
  });
}

// ── メイン処理 ────────────────────────────────────────────────
let ok = 0, ng = 0;
let unsplashCount = 0;
const UNSPLASH_LIMIT = 45;

for (const id of allTargets) {
  const dest = destMap[id];
  if (!dest) {
    console.log(`⚠  ID不明: ${id}`);
    ng++;
    continue;
  }

  const filepath = path.join(imageDir, `${dest.id}.jpg`);
  const isReplace = REPLACE_IDS.includes(id);

  // 上書き対象はバックアップ
  if (isReplace && fs.existsSync(filepath)) {
    fs.copyFileSync(filepath, filepath + '.bak');
  }

  let imgUrl = null;

  // 1. Unsplash（レート制限内）
  if (unsplashCount < UNSPLASH_LIMIT) {
    const q = `${dest.name} ${dest.prefecture || ''} 日本 風景`.trim();
    imgUrl = await fetchUnsplash(q);
    if (imgUrl) {
      unsplashCount++;
    } else {
      const qEn = `${dest.name} Japan scenery`;
      imgUrl = await fetchUnsplash(qEn);
      if (imgUrl) unsplashCount++;
    }
    await new Promise(r => setTimeout(r, 1300));
  }

  // 2. Wikipedia フォールバック
  if (!imgUrl) {
    imgUrl = await fetchWiki(dest.name);
    if (!imgUrl && dest.prefecture) {
      imgUrl = await fetchWiki(`${dest.name} (${dest.prefecture})`);
    }
    if (imgUrl) await new Promise(r => setTimeout(r, 500));
  }

  if (imgUrl) {
    const success = await download(imgUrl, filepath);
    const tag = isReplace ? '[上書き]' : '';
    if (success) {
      ok++;
      const size = Math.round(fs.statSync(filepath).size / 1024);
      process.stdout.write(`✅ ${tag}[${ok + ng}/${allTargets.length}] ${dest.name} (${size}KB)\n`);
    } else {
      ng++;
      if (isReplace && fs.existsSync(filepath + '.bak')) {
        fs.copyFileSync(filepath + '.bak', filepath);
        fs.unlink(filepath + '.bak', () => {});
      }
      process.stdout.write(`❌ DL失敗: ${dest.name}\n`);
    }
  } else {
    ng++;
    process.stdout.write(`⚠  スキップ: ${dest.name} (URL取得不可)\n`);
  }
}

console.log(`\n===== 完了 =====`);
console.log(`取得成功: ${ok}件 / 失敗・スキップ: ${ng}件`);
console.log(`Unsplash使用: ${unsplashCount}件 / ${UNSPLASH_LIMIT}件上限`);
