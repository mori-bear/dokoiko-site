/**
 * refetchByDimension.mjs
 * 寸法チェックレポート（checkImageDimensionsBatch.mjs 出力）に基づき、
 * フラグ画像だけを Wikimedia Commons から機械的に再取得する。
 * Vision API等の画像内容判定は一切行わない（寸法基準のみ）。
 *
 *   - 幅1000未満（横長）: 既知のCommons元ファイルの高解像度版(width=1600)を再取得
 *   - 縦長: Commons検索（スポット名/目的地名＋都道府県）の先頭候補のうち
 *           「横長かつ幅1200以上」を満たす最初の1枚に差し替え（機械的選択）
 *   - 元ファイル不明の幅不足も検索差し替えにフォールバック
 *
 * 成功時のみ上書き。差し替え時は destinations.json の imageCredit を更新。
 * 全アクションをレポートJSONに記録する。
 *
 * 使い方: node scripts/refetchByDimension.mjs <寸法レポート> <出力レポート>
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMAGES_DIR = path.join(__dirname, '../public/images');
const DEST_FILE = path.join(__dirname, '../src/data/destinations.json');
const DIM_REPORT = process.argv[2];
const OUT_REPORT = process.argv[3] || path.join(__dirname, '../.refetch-report.json');

const UA = { 'User-Agent': 'DokoIko/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const dims = JSON.parse(fs.readFileSync(DIM_REPORT, 'utf-8'));
const destinations = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));
const destById = Object.fromEntries(destinations.map((d) => [d.id, d]));

// フラグ統合（narrow ∪ portrait、重複排除）
const flagged = new Map();
for (const e of dims.narrow) flagged.set(e.file, { ...e, reasons: ['narrow'] });
for (const e of dims.portrait) {
  if (flagged.has(e.file)) flagged.get(e.file).reasons.push('portrait');
  else flagged.set(e.file, { ...e, reasons: ['portrait'] });
}

async function fetchJson(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, { headers: UA });
    if (res.status === 429) {
      await sleep(3000 * (i + 1));
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }
  throw new Error('429 retries exhausted');
}

async function downloadTo(url, filePath) {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`DL HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  // 上書き前に寸法検証
  const meta = await sharp(buf).metadata();
  let { width: w, height: h, orientation } = meta;
  if (orientation >= 5) [w, h] = [h, w];
  if (w < 1000 || h > w) throw new Error(`検証NG w=${w} h=${h}`);
  fs.writeFileSync(filePath, buf);
  return { width: w, height: h };
}

/** Commonsファイルページ URL → File:xxx タイトル */
function fileTitleFromCreditUrl(url) {
  if (!url) return null;
  const m = url.match(/\/wiki\/(File:[^?#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

/** 同一ファイルの width=1600 サムネイルURLと元寸法を取得 */
async function sameFileThumb(fileTitle) {
  const api =
    `https://commons.wikimedia.org/w/api.php?action=query&format=json` +
    `&titles=${encodeURIComponent(fileTitle)}&prop=imageinfo&iiprop=url|size&iiurlwidth=1600`;
  const j = await fetchJson(api);
  const page = Object.values(j.query?.pages || {})[0];
  const ii = page?.imageinfo?.[0];
  if (!ii) return null;
  return { thumburl: ii.thumburl || ii.url, width: ii.width, height: ii.height };
}

/** Commons検索 → 横長・幅1200以上の最初の候補（機械的選択・内容判定なし） */
async function searchLandscape(query) {
  const api =
    `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search` +
    `&gsrsearch=${encodeURIComponent('filetype:bitmap ' + query)}&gsrnamespace=6&gsrlimit=10` +
    `&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1600`;
  const j = await fetchJson(api);
  const pages = Object.values(j.query?.pages || {}).sort((a, b) => a.index - b.index);
  for (const p of pages) {
    const ii = p.imageinfo?.[0];
    if (!ii) continue;
    if (ii.width >= 1200 && ii.width > ii.height) {
      const em = ii.extmetadata || {};
      return {
        thumburl: ii.thumburl || ii.url,
        title: p.title,
        credit: {
          author: (em.Artist?.value || '').replace(/<[^>]*>/g, '').trim() || 'unknown',
          license: em.LicenseShortName?.value || 'unknown',
          url: ii.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title)}`,
          attributionRequired: true,
        },
      };
    }
  }
  return null;
}

/** flaggedファイル → { dest, kind: 'main'|'spot', spotIndex } */
function mapToDest(relFile) {
  const m = relFile.match(/^([^/]+)\/(main|spot-(\d+))\.(jpg|jpeg|png|webp)$/);
  if (!m) return null;
  const dest = destById[m[1]];
  if (!dest) return null;
  if (m[2] === 'main') return { dest, kind: 'main' };
  return { dest, kind: 'spot', spotIndex: parseInt(m[3], 10) - 1 };
}

const report = { upgraded: [], replaced: [], unresolvable: [], skippedOrphan: [], errors: [] };
let processed = 0;
const entries = [...flagged.values()];
console.log(`フラグ画像: ${entries.length} 件`);

for (const entry of entries) {
  processed++;
  if (processed % 100 === 0) console.log(`  ${processed}/${entries.length}...`);
  const mapping = mapToDest(entry.file);
  if (!mapping) {
    report.skippedOrphan.push(entry.file);
    continue;
  }
  const { dest, kind, spotIndex } = mapping;
  const spot = kind === 'spot' ? dest.spots?.[spotIndex] : null;
  const credit = kind === 'main' ? dest.imageCredit : spot?.imageCredit;
  const filePath = path.join(IMAGES_DIR, entry.file);
  const isPortrait = entry.reasons.includes('portrait');

  try {
    // 1) 横長・幅不足のみ → 同一ファイルの高解像度版を試す
    if (!isPortrait) {
      const title = fileTitleFromCreditUrl(credit?.url);
      if (title) {
        const info = await sameFileThumb(title);
        await sleep(300);
        if (info && info.width >= 1000 && info.width > info.height) {
          const size = await downloadTo(info.thumburl, filePath);
          report.upgraded.push({ file: entry.file, from: entry.width, to: size.width });
          await sleep(300);
          continue;
        }
        // 元ファイル自体が小さい/縦長 → 検索差し替えへフォールスルー
      }
    }
    // 2) 検索差し替え（縦長・元不明・元も低解像度）
    const name = kind === 'spot' ? spot?.name : dest.name;
    const query = `${name} ${dest.prefecture || ''}`.trim();
    const cand = await searchLandscape(query);
    await sleep(400);
    if (!cand) {
      report.unresolvable.push({ file: entry.file, reasons: entry.reasons, query });
      continue;
    }
    const size = await downloadTo(cand.thumburl, filePath);
    // 別ファイルへの差し替え → 帰属情報を更新
    if (kind === 'main') dest.imageCredit = cand.credit;
    else if (spot) spot.imageCredit = cand.credit;
    report.replaced.push({ file: entry.file, reasons: entry.reasons, newTitle: cand.title, to: `${size.width}x${size.height}` });
    await sleep(300);
  } catch (err) {
    report.errors.push({ file: entry.file, error: String(err.message || err) });
    await sleep(500);
  }
}

fs.writeFileSync(DEST_FILE, JSON.stringify(destinations, null, 1));
fs.writeFileSync(OUT_REPORT, JSON.stringify(report, null, 1));
console.log(`✅ 再取得完了`);
console.log(`   同一ファイル高解像度化: ${report.upgraded.length}`);
console.log(`   検索差し替え: ${report.replaced.length}`);
console.log(`   解決不能: ${report.unresolvable.length}`);
console.log(`   対象外(孤児): ${report.skippedOrphan.length}`);
console.log(`   エラー: ${report.errors.length}`);
console.log(`   レポート: ${OUT_REPORT}`);
