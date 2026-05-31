#!/usr/bin/env node
/**
 * refetchBadImages.js
 * logs/imageScan.json の不良画像を再取得する。
 * 取得順: ① Wikipedia OGP(ja/en) → ② Wikimedia Commons(複数クエリ) → ③ Unsplash(地域+県)
 * 採用条件: 横幅 >= 1000px かつ 横長(幅 >= 高さ)。満たさなければ既存を維持(強制置換しない)。
 */
import fs from 'fs';
import https from 'https';
import path from 'path';
import sharp from 'sharp';

const UNSPLASH_KEY = 'nDJVqw9sUkOprnPMFGOFud44i_bhpCEAZdWSRXT_0Xo';
const UNSPLASH_LIMIT = 45;        // 時間あたりレート上限の安全枠
const MIN_W = 1000;
const IMG_DIR = 'public/images';
const TMP = 'logs/_tmp_refetch.jpg';

const bad = JSON.parse(fs.readFileSync('logs/imageScan.json', 'utf8'))
  .filter(r => r.id !== 'hero' && r.id !== 'spots');
const dests = JSON.parse(fs.readFileSync('src/data/destinations.json', 'utf8'));
const destMap = Object.fromEntries(dests.map(d => [d.id, d]));

const sleep = ms => new Promise(r => setTimeout(r, ms));

function get(url, opts = {}, redirs = 0) {
  return new Promise(resolve => {
    const req = https.get(url, { timeout: 15000, ...opts }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirs < 5) {
        res.resume();
        const next = res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, url).href;
        return resolve(get(next, opts, redirs + 1));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, data: Buffer.concat(chunks), headers: res.headers }));
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

const UA = { 'User-Agent': 'DokoIko/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };

// ① Wikipedia OGP相当 (REST summary の originalimage)
async function fromWikipedia(name, pref) {
  const queries = [name, pref ? `${name} (${pref})` : null].filter(Boolean);
  for (const base of ['ja', 'en']) {
    for (const q of queries) {
      const url = `https://${base}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q)}`;
      const r = await get(url, { headers: UA });
      await sleep(300);
      if (!r || r.status !== 200) continue;
      try {
        const j = JSON.parse(r.data.toString());
        const src = j.originalimage?.source || j.thumbnail?.source?.replace(/\/\d+px-/, '/1280px-');
        if (src) return src;
      } catch {}
    }
  }
  return null;
}

// ② Wikimedia Commons 画像検索 (複数クエリパターン)
async function fromCommons(name, pref) {
  const patterns = [name, pref ? `${name} ${pref}` : null, pref ? `${pref} ${name}` : null].filter(Boolean);
  for (const q of patterns) {
    const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search` +
      `&gsrsearch=${encodeURIComponent('filetype:bitmap ' + q)}&gsrnamespace=6&gsrlimit=8` +
      `&prop=imageinfo&iiprop=url|size&iiurlwidth=1600`;
    const r = await get(api, { headers: UA });
    await sleep(300);
    if (!r || r.status !== 200) continue;
    try {
      const pages = JSON.parse(r.data.toString())?.query?.pages;
      if (!pages) continue;
      // 横長で大きいものを優先
      const cands = Object.values(pages)
        .map(p => p.imageinfo?.[0])
        .filter(ii => ii && ii.width >= MIN_W && ii.width >= ii.height)
        .sort((a, b) => b.width - a.width);
      if (cands.length) return cands[0].thumburl || cands[0].url;
    } catch {}
  }
  return null;
}

// ③ Unsplash (地域名+県名)
async function fromUnsplash(name, pref) {
  for (const q of [`${name} ${pref || ''} 日本 風景`.trim(), `${name} Japan landscape`]) {
    const url = `https://api.unsplash.com/photos/random?query=${encodeURIComponent(q)}&orientation=landscape&content_filter=high`;
    const r = await get(url, { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}`, 'Accept-Version': 'v1' } });
    await sleep(800);
    if (!r || r.status !== 200) continue;
    try {
      const u = JSON.parse(r.data.toString()).urls?.regular;
      if (u) return u + '&w=1600';
    } catch {}
  }
  return null;
}

async function downloadValid(url) {
  const r = await get(url, { headers: UA });
  if (!r || r.status !== 200 || !r.data || r.data.length < 10000) return null;
  fs.writeFileSync(TMP, r.data);
  try {
    const m = await sharp(TMP).metadata();
    if ((m.width || 0) >= MIN_W && (m.width || 0) >= (m.height || 0)) {
      return { w: m.width, h: m.height, bytes: r.data.length };
    }
  } catch {}
  return null;
}

const report = [];
let success = 0, fail = 0, unsplashUsed = 0, unsplashSkipped = 0;
let i = 0;

for (const item of bad) {
  i++;
  const dest = destMap[item.id];
  if (!dest) { fail++; report.push({ id: item.id, result: 'ID不明' }); continue; }
  const name = dest.name || dest['名前'];
  const pref = dest.prefecture || '';
  const oldDim = `${item.w}x${item.h}(${Math.round(item.bytes / 1024)}KB)`;

  let url = null, srcUsed = null, dim = null;

  // ① Wikipedia
  url = await fromWikipedia(name, pref);
  if (url) { dim = await downloadValid(url); if (dim) srcUsed = 'Wikipedia'; }

  // ② Commons
  if (!srcUsed) {
    url = await fromCommons(name, pref);
    if (url) { dim = await downloadValid(url); if (dim) srcUsed = 'Commons'; }
  }

  // ③ Unsplash (レート上限内)
  if (!srcUsed) {
    if (unsplashUsed < UNSPLASH_LIMIT) {
      url = await fromUnsplash(name, pref);
      unsplashUsed++;
      if (url) { dim = await downloadValid(url); if (dim) srcUsed = 'Unsplash'; }
    } else {
      unsplashSkipped++;
    }
  }

  if (srcUsed && dim) {
    const dir = path.join(IMG_DIR, dest.id);
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(TMP, path.join(dir, 'main.jpg'));
    success++;
    const newDim = `${dim.w}x${dim.h}(${Math.round(dim.bytes / 1024)}KB)`;
    report.push({ id: dest.id, name, result: 'OK', src: srcUsed, old: oldDim, new: newDim });
    process.stdout.write(`✅ [${i}/${bad.length}] ${dest.id} (${name}) ${srcUsed} ${oldDim}→${newDim}\n`);
  } else {
    fail++;
    report.push({ id: dest.id, name, result: '取得失敗(既存維持)', old: oldDim });
    process.stdout.write(`⚠  [${i}/${bad.length}] ${dest.id} (${name}) 取得失敗→既存維持\n`);
  }
}

if (fs.existsSync(TMP)) fs.unlinkSync(TMP);
fs.writeFileSync('logs/imageRefetch.json', JSON.stringify(report, null, 2));

console.log(`\n===== 再取得 完了 =====`);
console.log(`対象不良: ${bad.length} 件`);
console.log(`成功(置換): ${success} 件 / 失敗(既存維持): ${fail} 件`);
console.log(`Unsplash使用: ${unsplashUsed} 件 (上限${UNSPLASH_LIMIT}) / 上限超でスキップ: ${unsplashSkipped} 件`);
console.log(`内訳ログ: logs/imageRefetch.json`);
