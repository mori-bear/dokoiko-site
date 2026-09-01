#!/usr/bin/env node
/**
 * fetchBannerReplacements.mjs — 極端に横長な「バナー画像」を採ってしまったページの
 * 差し替え候補を集める。VisionのAPIが使えない状況なので、機械的な条件で絞ったうえで
 * 最後は目視で選ぶ。
 *
 * 機械条件: 幅1200以上 / 横長 / 縦横比が1.2〜2.2（バナーとポートレートを弾く）
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { placeCheck } from './commonsPlaceCheck.mjs';

const UA = { 'User-Agent': 'DokoIko-DataAudit/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TARGETS = [
  { id: 'sado-island', pref: '新潟県', words: ['佐渡', '新潟'], queries: ['佐渡島 風景', '佐渡 棚田', '佐渡 尖閣湾', '佐渡金山'] },
  { id: 'oze-2', pref: '群馬県', words: ['尾瀬', '片品', '群馬'], queries: ['尾瀬ヶ原', '尾瀬 湿原 木道', '尾瀬 至仏山', '尾瀬沼'] },
  { id: 'fukaya', pref: '埼玉県', words: ['深谷', '埼玉'], queries: ['深谷駅', '深谷 渋沢栄一 記念館', '深谷 ねぎ 畑', '旧煉瓦製造施設 深谷'] },
];

async function search(query, limit = 8) {
  const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search`
    + `&gsrsearch=${encodeURIComponent('filetype:bitmap ' + query)}&gsrnamespace=6&gsrlimit=${limit * 3}`
    + `&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1600`;
  let j;
  try { j = await (await fetch(api, { headers: UA })).json(); } catch { return []; }
  const out = [];
  for (const p of Object.values(j.query?.pages || {}).sort((a, b) => a.index - b.index)) {
    const ii = p.imageinfo?.[0];
    if (!ii || ii.width < 1200) continue;
    const r = ii.width / ii.height;
    if (r < 1.2 || r > 2.2) continue;          // バナーと縦長を弾く
    out.push({ title: p.title, url: ii.thumburl || ii.url, descurl: ii.descriptionurl,
      w: ii.width, h: ii.height, em: ii.extmetadata || {} });
    if (out.length >= limit) break;
  }
  return out;
}

const report = [];
for (const t of TARGETS) {
  const dir = `logs/banner_${t.id}`;
  fs.mkdirSync(dir, { recursive: true });
  let n = 0;
  const seen = new Set();
  console.log(`\n■ ${t.id}`);
  for (const q of t.queries) {
    for (const c of await search(q)) {
      if (seen.has(c.title)) continue;
      seen.add(c.title);
      const pc = await placeCheck(c.title, t.pref, t.words).catch(() => ({ verdict: 'weak' }));
      await sleep(250);
      if (pc.verdict === 'ng') { console.log(`   -- place=ng ${c.title.replace('File:', '').slice(0, 44)}`); continue; }
      let buf;
      try { buf = Buffer.from(await (await fetch(c.url, { headers: UA })).arrayBuffer()); } catch { continue; }
      const file = path.join(dir, `${String(++n).padStart(2, '0')}.jpg`);
      await sharp(buf).resize({ width: 1200, withoutEnlargement: true }).jpeg({ quality: 82 }).toFile(file);
      const lic = c.em.LicenseShortName?.value || 'unknown';
      report.push({ id: t.id, n, file, title: c.title, w: c.w, h: c.h,
        ratio: +(c.w / c.h).toFixed(2), place: pc.verdict,
        credit: {
          author: (c.em.Artist?.value || '').replace(/<[^>]*>/g, '').split(/\n|This photo was taken/)[0].replace(/\s+/g, ' ').trim() || 'unknown',
          license: lic, url: c.descurl,
          attributionRequired: !/^(CC0|Public domain|パブリック)/i.test(lic),
        } });
      console.log(`   ${String(n).padStart(2)} ${String(c.w)}x${c.h} 比${(c.w / c.h).toFixed(2)} place=${pc.verdict.padEnd(4)} ${c.title.replace('File:', '').slice(0, 46)}`);
      if (n >= 8) break;
      await sleep(300);
    }
    if (n >= 8) break;
  }
}
fs.writeFileSync('logs/banner_candidates.json', JSON.stringify(report, null, 1));
console.log(`\n候補 ${report.length}件 → logs/banner_candidates.json`);
