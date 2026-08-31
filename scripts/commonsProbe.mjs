#!/usr/bin/env node
/**
 * commonsProbe.mjs — Commonsに使えそうな画像があるか事前に見る（調査のみ・DL/判定はしない）。
 * usage: node scripts/commonsProbe.mjs "検索語" ["検索語2" ...]
 * 横長・幅1200px以上（本採用の条件）を満たす候補が何枚あるかを出す。
 */
const UA = { 'User-Agent': 'DokoIko-DataAudit/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const q of process.argv.slice(2)) {
  const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search`
    + `&gsrsearch=${encodeURIComponent('filetype:bitmap ' + q)}&gsrnamespace=6&gsrlimit=20`
    + `&prop=imageinfo&iiprop=url|size`;
  const j = await (await fetch(api, { headers: UA })).json();
  const pages = Object.values(j.query?.pages || {}).sort((a, b) => a.index - b.index);
  const usable = [], other = [];
  for (const p of pages) {
    const ii = p.imageinfo?.[0];
    if (!ii) continue;
    const rec = `${p.title.replace('File:', '').slice(0, 58)} ${ii.width}x${ii.height}`;
    (ii.width >= 1200 && ii.width > ii.height ? usable : other).push(rec);
  }
  console.log(`\n■ "${q}"  全${pages.length}件 / 条件を満たす${usable.length}件`);
  for (const u of usable.slice(0, 8)) console.log(`   ✓ ${u}`);
  for (const o of other.slice(0, 4)) console.log(`   - ${o}`);
  await sleep(500);
}
