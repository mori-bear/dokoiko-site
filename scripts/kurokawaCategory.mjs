#!/usr/bin/env node
/** kurokawaCategory.mjs — Category:Kurokawa Onsen (Kumamoto) の全ファイルを列挙する。 */
const UA = { 'User-Agent': 'DokoIko-DataAudit/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=categorymembers`
  + `&gcmtitle=${encodeURIComponent('Category:Kurokawa Onsen (Kumamoto)')}&gcmtype=file&gcmlimit=200`
  + `&prop=imageinfo&iiprop=url|size|extmetadata`;
const j = await (await fetch(api, { headers: UA })).json();
const pages = Object.values(j.query?.pages || {});
console.log(`■ ${pages.length}件`);
for (const p of pages) {
  const ii = p.imageinfo?.[0]; if (!ii) continue;
  const em = ii.extmetadata || {};
  const desc = String(em.ImageDescription?.value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  const ok = ii.width >= 1200 && ii.width > ii.height && ii.width / ii.height < 3;
  console.log(`${ok ? '◎' : ' '} ${String(ii.width).padStart(5)}x${String(ii.height).padEnd(5)} ${(em.LicenseShortName?.value || '?').padEnd(12)} ${p.title.replace('File:', '').padEnd(46)} ${desc}`);
}
