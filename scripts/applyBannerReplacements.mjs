#!/usr/bin/env node
/**
 * applyBannerReplacements.mjs — 目視で選んだ差し替えを main.jpg に反映する。
 *
 * 対象は極端に横長なバナー画像を使っていた3ページ。
 *   佐渡島 1600x228 / 尾瀬 1600x230 / 深谷 1600x271
 * この比率だとページのヒーロー（縦295px）で左右が大きく切れて絵が成立せず、
 * Xの大きいカードでも上下に余白が入る。
 *
 * 深谷は駅舎の写真だが、東京駅を模した赤レンガ駅舎そのものが深谷の見どころなので
 * 「駅舎は不可」の例外として採る。
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
const UA = { 'User-Agent': 'DokoIko-DataAudit/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const DATA = ['src/data/destinations.json', 'public/data/destinations.json'];

// usage: node scripts/applyBannerReplacements.mjs <候補ファイル> <id:番号> ...
const CAND_FILE = process.argv[2] || 'logs/banner_candidates.json';
const PICK = Object.fromEntries(process.argv.slice(3).map((a) => {
  const i = a.lastIndexOf(':');
  return [a.slice(0, i), Number(a.slice(i + 1))];
}));
if (!Object.keys(PICK).length) Object.assign(PICK, { 'sado-island': 5, 'oze-2': 4, fukaya: 2 });
const cands = JSON.parse(fs.readFileSync(CAND_FILE, 'utf8'));

const applied = {};
for (const [id, n] of Object.entries(PICK)) {
  const c = cands.find((x) => x.id === id && x.n === n);
  if (!c) throw new Error(`候補が無い: ${id} #${n}`);
  const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json`
    + `&titles=${encodeURIComponent(c.title)}&prop=imageinfo&iiprop=url&iiurlwidth=1600`;
  const ii = Object.values((await (await fetch(api, { headers: UA })).json()).query.pages)[0].imageinfo[0];
  const buf = Buffer.from(await (await fetch(ii.thumburl || ii.url, { headers: UA })).arrayBuffer());
  fs.mkdirSync(path.join('public/images', id), { recursive: true });
  await sharp(buf).resize({ width: 1600, withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true, progressive: true })
    .toFile(path.join('public/images', id, 'main.jpg'));
  applied[id] = c;
  console.log(`採用 ${id.padEnd(14)} ${c.title.replace('File:', '').slice(0, 44)} ${c.w}x${c.h} 比${c.ratio} (${c.credit.author} / ${c.credit.license})`);
}

for (const f of DATA) {
  const all = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const d of all) {
    const c = applied[d.id];
    if (!c) continue;
    const rel = `/images/${d.id}/main.jpg`;
    d.images = [rel, ...(d.images || []).filter((p) => p !== rel)];
    d.imageCredit = c.credit;
  }
  fs.writeFileSync(f, JSON.stringify(all, null, 2) + '\n');
}
console.log('destinations.json に反映した');
