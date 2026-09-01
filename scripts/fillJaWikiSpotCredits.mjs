#!/usr/bin/env node
/**
 * fillJaWikiSpotCredits.mjs — Commons ではなく ja.wikipedia にローカル投稿された
 * 画像を使っている spot に、ja.wikipedia 側のメタデータからクレジットを入れる。
 * ja.wikipedia はフェアユースを認めていないので、これらも自由ライセンス＝表示義務がある。
 */
import fs from 'fs';
const UA = { 'User-Agent': 'DokoIko-DataAudit/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const DATA = ['src/data/destinations.json', 'public/data/destinations.json'];
const fileTitle = (url) => {
  const m = String(url).match(/\/wikipedia\/ja\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/?]+)/);
  return m ? 'ファイル:' + decodeURIComponent(m[1]).replace(/_/g, ' ') : null;
};

const all = JSON.parse(fs.readFileSync(DATA[0], 'utf8'));
const titles = new Set();
for (const d of all) for (const s of d.spots || []) {
  if (s && typeof s === 'object' && s.imageUrl) {
    const t = fileTitle(s.imageUrl); if (t) titles.add(t);
  }
}
const list = [...titles];
console.log(`■ ja.wikipedia のファイル ${list.length}件`);
const meta = {};
if (list.length) {
  const api = `https://ja.wikipedia.org/w/api.php?action=query&format=json`
    + `&titles=${encodeURIComponent(list.join('|'))}&prop=imageinfo&iiprop=url|extmetadata`;
  const j = await (await fetch(api, { headers: UA })).json();
  for (const p of Object.values(j.query?.pages || {})) {
    const ii = p.imageinfo?.[0];
    if (!ii) { console.log(`  ✗ ${p.title} … 取得できず`); continue; }
    const em = ii.extmetadata || {};
    const lic = em.LicenseShortName?.value || 'unknown';
    meta[p.title] = {
      author: (em.Artist?.value || '').replace(/<[^>]*>/g, '').split(/\n|This photo was taken/)[0].replace(/\s+/g, ' ').trim() || 'unknown',
      license: lic, url: ii.descriptionurl,
      attributionRequired: !/^(CC0|Public domain)/i.test(lic),
    };
    console.log(`  ○ ${p.title} … ${meta[p.title].author} / ${lic}`);
  }
}
let n = 0;
for (const f of DATA) {
  const data = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const d of data) for (const s of d.spots || []) {
    if (!s || typeof s !== 'object' || !s.imageUrl) continue;
    const t = fileTitle(s.imageUrl);
    if (t && meta[t]) { s.imageCredit = meta[t]; if (f === DATA[0]) n++; }
  }
  fs.writeFileSync(f, JSON.stringify(data, null, 2));
}
console.log(`\n埋めた ${n}件`);
