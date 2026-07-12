/**
 * refetchDefects.mjs
 * detectImageDefects.mjs のレポート（極端アスペクト比・焼き込みレターボックス）を受け、
 * 該当画像を Commons 検索で差し替える。
 *   - 候補条件: 横長 1.2〜2.4・幅1200以上・DL後に白帯/黒帯なしを検証
 *   - レート制御: 各件 3〜5 秒ウェイト・10件ごとに 30 秒休憩
 *   - 差し替え時は destinations.json の imageCredit を更新
 *
 * 使い方: node scripts/refetchDefects.mjs <defectsレポート> <出力レポート>
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMAGES_DIR = path.join(__dirname, '../public/images');
const DEST_FILE = path.join(__dirname, '../src/data/destinations.json');
const DEFECTS = process.argv[2];
const OUT = process.argv[3] || path.join(__dirname, '../.refetch-defects-report.json');

const UA = { 'User-Agent': 'DokoIko/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitJitter = () => sleep(3000 + Math.floor(Math.random() * 2000)); // 3〜5秒

const defects = JSON.parse(fs.readFileSync(DEFECTS, 'utf-8'));
const destinations = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));
const destById = Object.fromEntries(destinations.map((d) => [d.id, d]));

// 対象統合（重複排除）
const targets = new Map();
for (const e of defects.extremeAspect) targets.set(e.file, { file: e.file, reasons: ['aspect'] });
for (const e of defects.letterbox) {
  if (targets.has(e.file)) targets.get(e.file).reasons.push('letterbox');
  else targets.set(e.file, { file: e.file, reasons: ['letterbox'] });
}

function mapToDest(relFile) {
  const m = relFile.match(/^([^/]+)\/(main|spot-(\d+))\.(jpg|jpeg|png|webp)$/);
  if (!m) return null;
  const dest = destById[m[1]];
  if (!dest) return null;
  if (m[2] === 'main') return { dest, kind: 'main' };
  return { dest, kind: 'spot', spotIndex: parseInt(m[3], 10) - 1 };
}

function isUniformBand(data, width, channels, rowStart, rowCount) {
  let sum = 0, sumSq = 0, n = 0;
  for (let r = 0; r < rowCount; r++) {
    const off = (rowStart + r) * width * channels;
    for (let x = 0; x < width; x += 4) {
      const i = off + x * channels;
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      sum += lum; sumSq += lum * lum; n++;
    }
  }
  const mean = sum / n;
  const varc = sumSq / n - mean * mean;
  return varc < 40 && (mean >= 235 || mean <= 20);
}

/** バッファを検証: 横長1.2-2.4・幅1000以上・上下帯なし */
async function validateBuffer(buf) {
  const meta = await sharp(buf).metadata();
  let { width: w, height: h, orientation } = meta;
  if (orientation >= 5) [w, h] = [h, w];
  const ratio = w / h;
  if (w < 1000 || ratio < 1.2 || ratio > 2.4) return null;
  const { data, info } = await sharp(buf).resize(160, null, { fit: 'inside' })
    .removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const rows = Math.max(3, Math.floor(info.height * 0.08));
  if (isUniformBand(data, info.width, info.channels, 0, rows) &&
      isUniformBand(data, info.width, info.channels, info.height - rows, rows)) return null;
  return { width: w, height: h };
}

async function fetchJson(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, { headers: UA });
    if (res.status === 429) { await sleep(5000 * (i + 1)); continue; }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }
  throw new Error('429 retries exhausted');
}

/** Commons検索 → 検証を通る最初の候補 */
async function searchValid(query) {
  const api =
    `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search` +
    `&gsrsearch=${encodeURIComponent('filetype:bitmap ' + query)}&gsrnamespace=6&gsrlimit=8` +
    `&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1600`;
  const j = await fetchJson(api);
  const pages = Object.values(j.query?.pages || {}).sort((a, b) => a.index - b.index);
  for (const p of pages) {
    const ii = p.imageinfo?.[0];
    if (!ii || ii.width < 1200 || ii.width <= ii.height) continue;
    try {
      const dl = await fetch(ii.thumburl || ii.url, { headers: UA });
      if (!dl.ok) continue;
      const buf = Buffer.from(await dl.arrayBuffer());
      const ok = await validateBuffer(buf);
      if (!ok) continue;
      const em = ii.extmetadata || {};
      return {
        buf, title: p.title, size: ok,
        credit: {
          author: (em.Artist?.value || '').replace(/<[^>]*>/g, '').trim() || 'unknown',
          license: em.LicenseShortName?.value || 'unknown',
          url: ii.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title)}`,
          attributionRequired: true,
        },
      };
    } catch { /* next */ }
  }
  return null;
}

const report = { replaced: [], unresolvable: [], skippedOrphan: [], errors: [] };
let processed = 0;
const entries = [...targets.values()];
console.log(`対象: ${entries.length} 件（aspect ${defects.extremeAspect.length} / letterbox ${defects.letterbox.length}・重複統合後）`);

for (const entry of entries) {
  processed++;
  if (processed % 10 === 0) {
    console.log(`  ${processed}/${entries.length}… 30秒休憩`);
    await sleep(30000);
  }
  const mapping = mapToDest(entry.file);
  if (!mapping) { report.skippedOrphan.push(entry.file); continue; }
  const { dest, kind, spotIndex } = mapping;
  const spot = kind === 'spot' ? dest.spots?.[spotIndex] : null;
  const name = kind === 'spot' ? spot?.name : dest.name;

  try {
    const cand = await searchValid(`${name} ${dest.prefecture || ''}`.trim());
    await waitJitter();
    if (!cand) { report.unresolvable.push({ file: entry.file, reasons: entry.reasons }); continue; }
    const outPath = path.join(IMAGES_DIR, entry.file);
    await sharp(cand.buf).jpeg({ quality: 88 }).toFile(outPath);
    if (kind === 'main') dest.imageCredit = cand.credit;
    else if (spot) spot.imageCredit = cand.credit;
    report.replaced.push({ file: entry.file, reasons: entry.reasons, newTitle: cand.title, size: cand.size });
  } catch (err) {
    report.errors.push({ file: entry.file, error: String(err.message || err) });
    await sleep(1000);
  }
}

fs.writeFileSync(DEST_FILE, JSON.stringify(destinations, null, 1));
fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
console.log(`✅ 差し替え完了: 置換=${report.replaced.length} 解決不能=${report.unresolvable.length} 対象外=${report.skippedOrphan.length} エラー=${report.errors.length}`);
console.log(`   レポート: ${OUT}`);
