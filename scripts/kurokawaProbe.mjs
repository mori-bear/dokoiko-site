#!/usr/bin/env node
/**
 * kurokawaProbe.mjs — 黒川温泉の①差し替え候補画像の一覧と、②現在使っている画像の
 * 正しいメタデータ（作者・ライセンス・ファイルページURL）を取り出す。
 * クレジットの url が実ファイルと食い違っているのを直すための下調べ。
 */
import fs from 'fs';
const UA = { 'User-Agent': 'DokoIko-DataAudit/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };

async function search(query, limit = 20) {
  const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search`
    + `&gsrsearch=${encodeURIComponent('filetype:bitmap ' + query)}&gsrnamespace=6&gsrlimit=${limit}`
    + `&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1600`;
  const j = await (await fetch(api, { headers: UA })).json();
  return Object.values(j.query?.pages || {}).sort((a, b) => a.index - b.index);
}

async function meta(titles) {
  const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&titles=${encodeURIComponent(titles.join('|'))}`
    + `&prop=imageinfo&iiprop=url|size|extmetadata`;
  const j = await (await fetch(api, { headers: UA })).json();
  return Object.values(j.query?.pages || {});
}

console.log('■ 現在 kurokawa-k が使っている Commons ファイルの実メタデータ');
const used = ['File:入湯手形 - flickr 4114375901 52b8e4aec0 o.jpg',
  'File:Kokonoe Dream Big Suspension Bridge Oita,JAPAN.jpg',
  'File:黒川温泉 (268553622).jpg'];
for (const p of await meta(used)) {
  const ii = p.imageinfo?.[0];
  if (!ii) { console.log(`  ✗ ${p.title} … 存在しない`); continue; }
  const em = ii.extmetadata || {};
  console.log(`  ○ ${p.title}`);
  console.log(`      作者     ${(em.Artist?.value || '').replace(/<[^>]*>/g, '').trim()}`);
  console.log(`       license  ${em.LicenseShortName?.value || '?'}`);
  console.log(`      ページ   ${ii.descriptionurl}`);
  console.log(`      サイズ   ${ii.width}x${ii.height}`);
}

console.log('\n■ 差し替え候補（黒川温泉）');
for (const q of ['黒川温泉', 'Kurokawa Onsen', '黒川温泉 露天風呂 熊本']) {
  console.log(`  --- 検索語: ${q} ---`);
  for (const p of await search(q, 20)) {
    const ii = p.imageinfo?.[0];
    if (!ii) continue;
    const land = ii.width > ii.height;
    const big = ii.width >= 1200;
    console.log(`   ${big && land ? '◎' : '  '} ${String(ii.width).padStart(5)}x${String(ii.height).padEnd(5)} ${(ii.extmetadata?.LicenseShortName?.value || '?').padEnd(12)} ${p.title}`);
  }
}
