/**
 * fetchTargetedImage.mjs
 * 指定クエリで Commons を検索し、横長・幅1200以上の候補を上位から最大N件
 * 一時ディレクトリへダウンロードする（目視検証用）。
 *
 * 使い方: node scripts/fetchTargetedImage.mjs "<検索クエリ>" <出力dir> [候補数=4]
 * 出力: <出力dir>/cand-1.jpg ... と candidates.json（title/credit/寸法）
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const UA = { 'User-Agent': 'DokoIko/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const query = process.argv[2];
const outDir = process.argv[3];
const maxN = parseInt(process.argv[4] || '4', 10);
if (!query || !outDir) { console.error('usage: fetchTargetedImage.mjs <query> <outDir> [n]'); process.exit(1); }
fs.mkdirSync(outDir, { recursive: true });

const api =
  `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search` +
  `&gsrsearch=${encodeURIComponent('filetype:bitmap ' + query)}&gsrnamespace=6&gsrlimit=20` +
  `&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1600`;

const res = await fetch(api, { headers: UA });
const j = await res.json();
const pages = Object.values(j.query?.pages || {}).sort((a, b) => a.index - b.index);

const saved = [];
for (const p of pages) {
  if (saved.length >= maxN) break;
  const ii = p.imageinfo?.[0];
  if (!ii || ii.width < 1200 || ii.width <= ii.height) continue;
  const ratio = ii.width / ii.height;
  if (ratio > 2.4) continue;
  try {
    const dl = await fetch(ii.thumburl || ii.url, { headers: UA });
    if (!dl.ok) continue;
    const buf = Buffer.from(await dl.arrayBuffer());
    const meta = await sharp(buf).metadata();
    const file = path.join(outDir, `cand-${saved.length + 1}.jpg`);
    // JPEG化して保存（webp/png候補も統一）
    await sharp(buf).jpeg({ quality: 88 }).toFile(file);
    const em = ii.extmetadata || {};
    saved.push({
      file: path.basename(file),
      title: p.title,
      width: meta.width, height: meta.height,
      credit: {
        author: (em.Artist?.value || '').replace(/<[^>]*>/g, '').trim() || 'unknown',
        license: em.LicenseShortName?.value || 'unknown',
        url: ii.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title)}`,
        attributionRequired: true,
      },
    });
    await sleep(400);
  } catch { /* skip */ }
}

fs.writeFileSync(path.join(outDir, 'candidates.json'), JSON.stringify(saved, null, 1));
console.log(`✅ ${saved.length}候補を保存 → ${outDir}`);
for (const s of saved) console.log(`   ${s.file}: ${s.title} (${s.width}x${s.height}) ${s.credit.license}`);
