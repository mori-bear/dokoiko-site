#!/usr/bin/env node
/**
 * Fix vision_ng.md 確度中 (236 items) — replace images from Wikimedia Commons
 * Usage: node scripts/fixVisionNgMedium.js [--limit N] [--dry-run]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const isDryRun = process.argv.includes('--dry-run');
const limitArg = process.argv.findIndex(a => a === '--limit');
const LIMIT = limitArg >= 0 ? parseInt(process.argv[limitArg + 1], 10) : 999;

const VISION_NG = path.join(ROOT, 'logs/vision_ng.md');
const DEST_JSON = path.join(ROOT, 'src/data/destinations.json');
const IMG_DIR   = path.join(ROOT, 'public/images');

// ── Load data ────────────────────────────────────────────────────
const ngContent = fs.readFileSync(VISION_NG, 'utf8');
const lines = ngContent.split('\n');

// Find 確度中 section
const mediumStart = lines.findIndex(l => l.startsWith('## 確度中'));
const ngIds = [];
for (let i = mediumStart + 3; i < lines.length; i++) {
  const line = lines[i];
  if (!line.startsWith('|')) break;
  const id = line.split('|')[1]?.trim();
  if (id && id !== 'id') ngIds.push(id);
}
console.log(`確度中: ${ngIds.length} destinations`);

const destinations = JSON.parse(fs.readFileSync(DEST_JSON, 'utf8'));
const destMap = Object.fromEntries(destinations.map(d => [d.id, d]));

// ── Wikimedia Commons helpers ─────────────────────────────────────
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'dokoiko-image-bot/1.0 (tabidokoiko.com)' } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function downloadFile(url, dest, retries = 4) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    function get(u) {
      https.get(u, { headers: { 'User-Agent': 'dokoiko-image-bot/1.0' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          get(res.headers.location); return;
        }
        if (res.statusCode === 429 || res.statusCode === 503) {
          attempts++;
          if (attempts >= retries) { reject(new Error(`HTTP ${res.statusCode} after ${retries} retries`)); return; }
          res.resume();
          setTimeout(() => get(u), 3000 * attempts);
          return;
        }
        if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode} for ${u}`)); return; }
        const out = fs.createWriteStream(dest);
        res.pipe(out);
        out.on('finish', () => out.close(resolve));
        out.on('error', reject);
      }).on('error', reject);
    }
    get(url);
  });
}

async function searchCommons(query, limit = 8) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srnamespace=6&format=json&srlimit=${limit}`;
  const data = await fetchJson(url);
  return (data.query?.search || []).map(r => r.title);
}

async function getImageInfo(title) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url|size|mime|extmetadata&format=json`;
  const data = await fetchJson(url);
  const pages = data.query?.pages || {};
  const page = Object.values(pages)[0];
  const ii = page?.imageinfo?.[0];
  if (!ii) return null;
  const meta = ii.extmetadata || {};
  const license = meta.LicenseShortName?.value || meta.License?.value || '';
  const author = meta.Artist?.value?.replace(/<[^>]+>/g, '').trim() || 'Unknown';
  const url2 = meta.LicenseUrl?.value || '';
  return {
    title,
    url: ii.url,
    width: ii.width,
    height: ii.height,
    mime: ii.mime,
    license,
    author,
    licenseUrl: url2,
    commonsUrl: `https://commons.wikimedia.org/wiki/${title.replace(/ /g, '_')}`,
  };
}

function isAcceptableLicense(license) {
  const l = license.toUpperCase();
  return l.includes('CC BY') || l.includes('PUBLIC DOMAIN') || l.includes('CC0') || l === 'PD';
}

async function findBestImage(name, prefecture, hint = '') {
  const queries = [
    `${name} ${prefecture}`,
    name,
    hint || name,
  ].filter((q, i, a) => q && a.indexOf(q) === i);

  for (const q of queries) {
    try {
      const titles = await searchCommons(q, 20);
      // Two passes: landscape-preferred first, then any orientation
      for (const requireLandscape of [true, false]) {
        for (const title of titles) {
          let info;
          try { info = await getImageInfo(title); } catch { continue; }
          if (!info) continue;
          if (!['image/jpeg', 'image/png'].includes(info.mime)) continue;
          if (info.width < 800) continue;
          if (requireLandscape && info.width < info.height) continue;
          if (!isAcceptableLicense(info.license)) continue;
          return info;
        }
      }
    } catch (e) { /* ignore search errors */ }
    await sleep(400);
  }
  return null;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Main ──────────────────────────────────────────────────────────
const results = { replaced: [], skipped: [], errors: [] };
const destCopy = [...destinations];

async function main() {
  const toProcess = ngIds.slice(0, LIMIT);
  console.log(`Processing ${toProcess.length} destinations...`);

  for (let i = 0; i < toProcess.length; i++) {
    const id = toProcess[i];
    const dest = destMap[id];
    if (!dest) {
      console.log(`[${i+1}/${toProcess.length}] SKIP ${id}: not found in destinations.json`);
      results.skipped.push({ id, reason: 'not in destinations.json' });
      continue;
    }

    const name = dest.name;
    const prefecture = dest.prefecture || '';
    console.log(`[${i+1}/${toProcess.length}] ${id} (${name} / ${prefecture})`);

    try {
      const info = await findBestImage(name, prefecture);
      if (!info) {
        console.log(`  → No suitable Commons image found`);
        results.skipped.push({ id, reason: 'no commons image' });
        continue;
      }

      console.log(`  → ${info.width}×${info.height} | ${info.license} | ${info.author}`);
      console.log(`    ${info.url}`);

      if (!isDryRun) {
        const imgFolder = path.join(IMG_DIR, id);
        fs.mkdirSync(imgFolder, { recursive: true });
        const destPath = path.join(imgFolder, 'main.jpg');
        await downloadFile(info.url, destPath);

        // Update destinations.json in memory
        const idx = destCopy.findIndex(d => d.id === id);
        if (idx >= 0) {
          destCopy[idx] = {
            ...destCopy[idx],
            images: [`/images/${id}/main.jpg`, ...(destCopy[idx].images || []).filter(u => u !== `/images/${id}/main.jpg`)],
            imageCredit: {
              author: info.author,
              license: info.license,
              url: info.commonsUrl,
              attributionRequired: !info.license.toUpperCase().includes('PUBLIC DOMAIN') && !info.license.toUpperCase().includes('CC0'),
            },
          };
          delete destCopy[idx].unsplashUrl;
          delete destCopy[idx].unsplashCredit;
          delete destCopy[idx].unsplashCreditUrl;
          delete destCopy[idx].unsplashPhotoUrl;
        }

        console.log(`  ✓ Saved`);
      } else {
        console.log(`  [DRY RUN] would save`);
      }

      results.replaced.push({ id, name, ...info });
    } catch (e) {
      console.error(`  ERROR: ${e.message}`);
      results.errors.push({ id, error: e.message });
    }

    await sleep(1500);
  }

  if (!isDryRun && results.replaced.length > 0) {
    fs.writeFileSync(DEST_JSON, JSON.stringify(destCopy, null, 2));
    console.log(`\nUpdated destinations.json`);
  }

  const reportPath = path.join(ROOT, 'logs/vision_ng_medium_fix.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));

  console.log(`\n=== Summary ===`);
  console.log(`Replaced: ${results.replaced.length}`);
  console.log(`Skipped:  ${results.skipped.length}`);
  console.log(`Errors:   ${results.errors.length}`);
  console.log(`Report:   ${reportPath}`);
}

main().catch(console.error);
