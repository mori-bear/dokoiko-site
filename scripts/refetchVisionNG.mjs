/**
 * refetchVisionNG.mjs
 * Vision点検でNGとなったヒーロー画像（main.jpg）を Commons から再取得する。
 *   - クエリ: 「mainSpot 都道府県」→ ダメなら「目的地名 都道府県」の2段階
 *   - 候補条件: 横長1.2〜2.4・幅1200以上・白帯/黒帯なし・現在のNG画像と同一ファイルは除外
 *   - レート制御: 各件3〜5秒・10件ごとに30秒休憩
 *   - 差し替え時は imageCredit を更新
 *
 * 使い方: node scripts/refetchVisionNG.mjs <NGリスト> <出力レポート>
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMAGES_DIR = path.join(__dirname, '../public/images');
const DEST_FILE = path.join(__dirname, '../src/data/destinations.json');
const NG_FILE = process.argv[2];
const OUT = process.argv[3] || path.join(__dirname, '../.refetch-vision-report.json');

const UA = { 'User-Agent': 'DokoIko/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitJitter = () => sleep(3000 + Math.floor(Math.random() * 2000));

const ngList = JSON.parse(fs.readFileSync(NG_FILE, 'utf-8'));
const destinations = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));
const destById = Object.fromEntries(destinations.map((d) => [d.id, d]));

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

/** Commons検索して検証を通る最初の候補（excludeTitleと同一ファイルは除外） */
async function searchValid(query, excludeUrl) {
  const api =
    `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search` +
    `&gsrsearch=${encodeURIComponent('filetype:bitmap ' + query)}&gsrnamespace=6&gsrlimit=8` +
    `&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1600`;
  const j = await fetchJson(api);
  const pages = Object.values(j.query?.pages || {}).sort((a, b) => a.index - b.index);
  for (const p of pages) {
    const ii = p.imageinfo?.[0];
    if (!ii || ii.width < 1200 || ii.width <= ii.height) continue;
    // 現在のNG画像と同じファイルは再取得しない
    if (excludeUrl && ii.descriptionurl && excludeUrl.includes(encodeURIComponent(p.title.replace('File:', '').replace(/ /g, '_')))) continue;
    if (excludeUrl && ii.descriptionurl === excludeUrl) continue;
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

const report = { replaced: [], unresolvable: [], errors: [] };
let processed = 0;
console.log(`Vision NG: ${ngList.length} 件の再取得を開始`);

for (const ng of ngList) {
  processed++;
  if (processed % 10 === 0) {
    console.log(`  ${processed}/${ngList.length}… 30秒休憩`);
    await sleep(30000);
  }
  const dest = destById[ng.id];
  if (!dest) continue;
  const excludeUrl = dest.imageCredit?.url || null;

  try {
    // 1段階目: mainSpot（意図した被写体）で検索
    let cand = null;
    if (ng.mainSpot) {
      cand = await searchValid(`${ng.mainSpot} ${ng.prefecture || ''}`.trim(), excludeUrl);
      await waitJitter();
    }
    // 2段階目: 目的地名で検索
    if (!cand) {
      cand = await searchValid(`${ng.name} ${ng.prefecture || ''}`.trim(), excludeUrl);
      await waitJitter();
    }
    if (!cand) { report.unresolvable.push({ id: ng.id, reason: ng.reason }); continue; }
    const outPath = path.join(IMAGES_DIR, ng.id, 'main.jpg');
    await sharp(cand.buf).jpeg({ quality: 88 }).toFile(outPath);
    dest.imageCredit = cand.credit;
    report.replaced.push({ id: ng.id, ngReason: ng.reason, newTitle: cand.title, size: cand.size });
  } catch (err) {
    report.errors.push({ id: ng.id, error: String(err.message || err) });
    await sleep(1000);
  }
}

fs.writeFileSync(DEST_FILE, JSON.stringify(destinations, null, 1));
fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
console.log(`✅ Vision NG再取得完了: 置換=${report.replaced.length} 解決不能=${report.unresolvable.length} エラー=${report.errors.length}`);
console.log(`   レポート: ${OUT}`);
