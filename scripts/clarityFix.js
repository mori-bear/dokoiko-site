#!/usr/bin/env node
/**
 * clarityFix.js — 確度中NG 231件の画像をWikimedia Commonsから差し替え
 *
 * 特徴:
 *   - 3〜5秒ランダムウェイト (429回避)
 *   - 10件ごとに30秒バッチ休憩
 *   - logs/clarity_progress.json にチェックポイント保存 (5件ごと)
 *   - 途中停止 → 再実行で続きから
 *   - 完了時に自動ビルド＆デプロイ
 *
 * Usage:
 *   node scripts/clarityFix.js           # 全件
 *   node scripts/clarityFix.js --limit N # N件だけ
 *   node scripts/clarityFix.js --dry-run # ダウンロードなし
 */

import fs   from 'fs';
import path from 'path';
import https from 'https';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT        = path.join(__dirname, '..');
const DEST_JSON   = path.join(ROOT, 'src/data/destinations.json');
const IMG_DIR     = path.join(ROOT, 'public/images');
const VISION_NG   = path.join(ROOT, 'logs/vision_ng.md');
const PROGRESS    = path.join(ROOT, 'logs/clarity_progress.json');

const isDryRun  = process.argv.includes('--dry-run');
const limitArg  = process.argv.findIndex(a => a === '--limit');
const LIMIT     = limitArg >= 0 ? parseInt(process.argv[limitArg + 1], 10) : Infinity;

// Batch params
const BATCH_SIZE       = 10;   // items per batch
const BATCH_PAUSE_MS   = 30000; // 30s break between batches
const ITEM_MIN_MS      = 3000;  // min wait between items
const ITEM_MAX_MS      = 5000;  // max wait between items
const CHECKPOINT_EVERY = 5;     // save progress every N items
const RETRY_MAX        = 5;
const RETRY_BASE_MS    = 4000;  // 4s × attempt# for backoff
const THUMB_WIDTH      = 1920;  // download this pixel width

// ── Helpers ───────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const opts = {
      headers: { 'User-Agent': 'dokoiko-clarity-bot/2.0 (tabidokoiko.com; morizou0718@gmail.com)' },
    };
    https.get(url, opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

function downloadFile(url, dest, attempt = 1) {
  return new Promise((resolve, reject) => {
    const opts = {
      headers: { 'User-Agent': 'dokoiko-clarity-bot/2.0 (tabidokoiko.com; morizou0718@gmail.com)' },
    };
    https.get(url, opts, res => {
      // Follow redirect
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        downloadFile(res.headers.location, dest, attempt).then(resolve, reject);
        return;
      }
      if (res.statusCode === 429 || res.statusCode === 503) {
        res.resume();
        if (attempt >= RETRY_MAX) { reject(new Error(`HTTP ${res.statusCode} after ${RETRY_MAX} retries`)); return; }
        const delay = RETRY_BASE_MS * attempt + randInt(0, 2000);
        console.log(`    429 → retry ${attempt}/${RETRY_MAX} in ${Math.round(delay/1000)}s`);
        sleep(delay).then(() => downloadFile(url, dest, attempt + 1)).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
      const out = fs.createWriteStream(dest);
      res.pipe(out);
      out.on('finish', () => out.close(resolve));
      out.on('error', reject);
    }).on('error', reject);
  });
}

async function searchCommons(query, limit = 15) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srnamespace=6&format=json&srlimit=${limit}`;
  const data = await fetchJson(url);
  return (data.query?.search || []).map(r => r.title);
}

async function getImageInfo(title) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url|size|mime|extmetadata|thumburl&iiurlwidth=${THUMB_WIDTH}&format=json`;
  const data = await fetchJson(url);
  const page = Object.values(data.query?.pages || {})[0];
  const ii   = page?.imageinfo?.[0];
  if (!ii) return null;
  const meta    = ii.extmetadata || {};
  const license = meta.LicenseShortName?.value || meta.License?.value || '';
  const author  = meta.Artist?.value?.replace(/<[^>]+>/g, '').trim() || 'Unknown';
  const ok      = ['CC BY', 'CC0', 'PUBLIC DOMAIN', 'PD'].some(t => license.toUpperCase().includes(t));
  if (!ok) return null;
  if (!['image/jpeg', 'image/png'].includes(ii.mime)) return null;
  // thumburl exists when iiurlwidth is set; fall back to full url
  const downloadUrl = ii.thumburl || ii.url;
  return {
    title,
    downloadUrl,
    fullUrl: ii.url,
    width:   ii.width,
    height:  ii.height,
    license,
    author,
    commonsUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
  };
}

async function findBestImage(name, prefecture, id) {
  // Multiple query strategies: japanese, romanized id, etc.
  const queries = [
    `${name} ${prefecture}`,
    name,
    `${id.replace(/-/g, ' ')} Japan`,
  ].filter((q, i, a) => a.indexOf(q) === i);

  for (const q of queries) {
    let titles;
    try {
      titles = await searchCommons(q, 15);
      await sleep(800); // small pause after search API call
    } catch { continue; }

    // Pass 1: landscape + wide (≥1200px wide)
    // Pass 2: any orientation ≥800px
    for (const requireLandscape of [true, false]) {
      for (const title of titles) {
        let info;
        try { info = await getImageInfo(title); } catch { continue; }
        if (!info) continue;
        if (info.width < 800) continue;
        if (requireLandscape && info.height > 0 && info.width < info.height) continue;
        // Prefer landscape that's at least 1200px wide on first pass
        if (requireLandscape && info.width < 1200) continue;
        return info;
      }
    }
  }
  return null;
}

// ── Progress file ──────────────────────────────────────────────────

function loadProgress() {
  try { return JSON.parse(fs.readFileSync(PROGRESS, 'utf8')); } catch { return { done: {}, skipped: {}, errors: {} }; }
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS, JSON.stringify(progress, null, 2));
}

// ── Load NG list ───────────────────────────────────────────────────

function loadNgIds() {
  const lines = fs.readFileSync(VISION_NG, 'utf8').split('\n');
  const start = lines.findIndex(l => l.startsWith('## 確度中'));
  const ids   = [];
  for (let i = start + 3; i < lines.length; i++) {
    if (!lines[i].startsWith('|')) break;
    const id = lines[i].split('|')[1]?.trim();
    if (id && id !== 'id') ids.push(id);
  }
  return ids;
}

// ── Deploy ─────────────────────────────────────────────────────────

function deploy() {
  const DOKOIKO = path.join(ROOT, '..', 'dokoiko');
  console.log('\n=== AUTO DEPLOY ===');
  execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });
  execSync(`rm -rf ${DOKOIKO}/destinations ${DOKOIKO}/images ${DOKOIKO}/_astro ${DOKOIKO}/hub`);
  execSync(`cp -r dist/destinations ${DOKOIKO}/destinations`, { cwd: ROOT });
  execSync(`cp -r public/images ${DOKOIKO}/images`, { cwd: ROOT });
  execSync(`cp dist/index.html ${DOKOIKO}/index.html`, { cwd: ROOT });
  execSync(`cp -r dist/_astro ${DOKOIKO}/_astro`, { cwd: ROOT });
  execSync(`cp -r dist/hub ${DOKOIKO}/hub`, { cwd: ROOT });
  execSync(`mkdir -p ${DOKOIKO}/data && cp dist/data/destinations.json ${DOKOIKO}/data/destinations.json`, { cwd: ROOT });
  execSync(`cp dist/sitemap.xml ${DOKOIKO}/sitemap.xml`, { cwd: ROOT });
  execSync(`node scripts/generateRedirects.js`, { cwd: ROOT, stdio: 'inherit' });
  execSync(`cp -r dist/destinations/. ${DOKOIKO}/destinations/`, { cwd: ROOT });
  execSync(`git -C ${DOKOIKO} add -A`);
  execSync(`git -C ${DOKOIKO} commit -m "fix: 確度中画像 自動修正完了"`, { stdio: 'inherit' });
  execSync(`git -C ${DOKOIKO} push origin main`, { stdio: 'inherit' });
  console.log('=== DEPLOY DONE ===\n');
}

// ── Main ───────────────────────────────────────────────────────────

async function main() {
  const allIds  = loadNgIds();
  const progress = loadProgress();
  const dests   = JSON.parse(fs.readFileSync(DEST_JSON, 'utf8'));
  const destMap  = Object.fromEntries(dests.map(d => [d.id, d]));
  const destCopy = [...dests];

  console.log(`確度中: ${allIds.length} total`);
  console.log(`Already done: ${Object.keys(progress.done).length}`);

  // Filter to unprocessed
  const todo = allIds.filter(id => !progress.done[id] && !progress.skipped[id]);
  const toProcess = todo.slice(0, LIMIT === Infinity ? todo.length : LIMIT);
  console.log(`To process: ${toProcess.length}\n`);

  let savedCount = 0;
  let sinceSave  = 0;
  let sinceBatch = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const id   = toProcess[i];
    const dest = destMap[id];

    // Batch pause every BATCH_SIZE items
    if (sinceBatch > 0 && sinceBatch % BATCH_SIZE === 0) {
      console.log(`\n--- Batch pause ${BATCH_PAUSE_MS/1000}s (after ${sinceBatch} items) ---\n`);
      await sleep(BATCH_PAUSE_MS);
      sinceBatch = 0;
    }

    const label = `[${i+1}/${toProcess.length}] ${id}`;

    if (!dest) {
      console.log(`${label} SKIP: not in destinations.json`);
      progress.skipped[id] = { reason: 'not in destinations.json' };
      sinceSave++; sinceBatch++;
      if (sinceSave >= CHECKPOINT_EVERY) { saveProgress(progress); sinceSave = 0; }
      continue;
    }

    console.log(`${label} (${dest.name} / ${dest.prefecture || ''})`);

    try {
      const info = await findBestImage(dest.name, dest.prefecture || '', id);
      if (!info) {
        console.log(`  → No suitable image found`);
        progress.skipped[id] = { reason: 'no commons image' };
      } else {
        console.log(`  → ${info.width}×${info.height} | ${info.license} | ${info.author}`);
        console.log(`    ${info.downloadUrl}`);

        if (!isDryRun) {
          const folder = path.join(IMG_DIR, id);
          fs.mkdirSync(folder, { recursive: true });
          await downloadFile(info.downloadUrl, path.join(folder, 'main.jpg'));

          // Update in-memory copy of destinations
          const idx = destCopy.findIndex(d => d.id === id);
          if (idx >= 0) {
            const imgPath = `/images/${id}/main.jpg`;
            destCopy[idx] = {
              ...destCopy[idx],
              images: [imgPath, ...(destCopy[idx].images || []).filter(u => u !== imgPath)],
              imageCredit: {
                author: info.author,
                license: info.license,
                url: info.commonsUrl,
                attributionRequired: !['PUBLIC DOMAIN', 'CC0'].some(t => info.license.toUpperCase().includes(t)),
              },
            };
            delete destCopy[idx].unsplashUrl;
            delete destCopy[idx].unsplashCredit;
            delete destCopy[idx].unsplashCreditUrl;
            delete destCopy[idx].unsplashPhotoUrl;
          }

          // Write destinations.json immediately after each success
          fs.writeFileSync(DEST_JSON, JSON.stringify(destCopy, null, 2));
          savedCount++;
          console.log(`  ✓ Saved (total: ${savedCount})`);
        } else {
          console.log(`  [DRY-RUN] would save`);
        }

        if (!isDryRun) {
          progress.done[id] = { license: info.license, author: info.author, url: info.commonsUrl };
        }
      }
    } catch (e) {
      console.error(`  ERROR: ${e.message}`);
      progress.errors[id] = e.message;
    }

    sinceSave++; sinceBatch++;

    // Checkpoint every N items
    if (sinceSave >= CHECKPOINT_EVERY) {
      saveProgress(progress);
      sinceSave = 0;
      console.log(`  [checkpoint saved]`);
    }

    // Random wait between items
    const wait = randInt(ITEM_MIN_MS, ITEM_MAX_MS);
    await sleep(wait);
  }

  // Final save
  saveProgress(progress);

  const doneTotal    = Object.keys(progress.done).length;
  const skippedTotal = Object.keys(progress.skipped).length;
  const errorTotal   = Object.keys(progress.errors).length;

  console.log(`\n=== Summary ===`);
  console.log(`Done (replaced): ${doneTotal}`);
  console.log(`Skipped:         ${skippedTotal}`);
  console.log(`Errors:          ${errorTotal}`);
  console.log(`New this run:    ${savedCount}`);

  // Auto-deploy only when all IDs have been processed
  const remaining = allIds.filter(id => !progress.done[id] && !progress.skipped[id] && !progress.errors[id]);
  console.log(`Remaining unprocessed: ${remaining.length}`);

  if (!isDryRun && remaining.length === 0 && savedCount > 0) {
    console.log('\nAll items processed — deploying...');
    deploy();
  } else if (remaining.length > 0) {
    console.log(`\nRe-run to continue: node scripts/clarityFix.js`);
  } else {
    console.log('\nNo new images this run — skipping deploy.');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
