#!/usr/bin/env node
/**
 * fillSpotCredits.mjs — Commons由来なのに imageCredit が無い spot 画像に、
 * Commons API から取り直した著作者・ライセンス・ファイルページURLを埋める。
 * 画像を表示している以上 CC BY / CC BY-SA は著作者表示が条件になる。
 */
import fs from 'fs';
const UA = { 'User-Agent': 'DokoIko-DataAudit/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const DATA = ['src/data/destinations.json', 'public/data/destinations.json'];

// 画像URLから Commons のファイル名を復元する
function fileTitle(url) {
  const m = String(url).match(/\/commons\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/?]+)/);
  return m ? 'File:' + decodeURIComponent(m[1]).replace(/_/g, ' ') : null;
}

const all = JSON.parse(fs.readFileSync(DATA[0], 'utf8'));
const need = [];
for (const d of all) {
  for (const s of d.spots || []) {
    if (!s || typeof s !== 'object') continue;
    const u = s.imageUrl || '';
    if (!u.includes('wikimedia.org') || s.imageCredit) continue;
    const t = fileTitle(u);
    need.push({ id: d.id, name: s.name, url: u, title: t });
  }
}
console.log(`■ クレジット未設定の Commons 画像 ${need.length}件`);
for (const n of need) console.log(`   ${n.id.padEnd(20)} ${String(n.name).padEnd(18)} ${n.title ?? '（ファイル名を復元できず）'}`);

const titles = [...new Set(need.map((n) => n.title).filter(Boolean))];
const meta = {};
for (let i = 0; i < titles.length; i += 40) {
  const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json`
    + `&titles=${encodeURIComponent(titles.slice(i, i + 40).join('|'))}`
    + `&prop=imageinfo&iiprop=url|extmetadata`;
  const j = await (await fetch(api, { headers: UA })).json();
  for (const p of Object.values(j.query?.pages || {})) {
    const ii = p.imageinfo?.[0]; if (!ii) continue;
    const em = ii.extmetadata || {};
    const lic = em.LicenseShortName?.value || 'unknown';
    meta[p.title] = {
      author: (em.Artist?.value || '').replace(/<[^>]*>/g, '').split(/\n|This photo was taken/)[0].replace(/\s+/g, ' ').trim() || 'unknown',
      license: lic,
      url: ii.descriptionurl,
      attributionRequired: !/^(CC0|Public domain)/i.test(lic),
    };
  }
}

let filled = 0, unresolved = [];
for (const f of DATA) {
  const data = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const d of data) {
    for (const s of d.spots || []) {
      if (!s || typeof s !== 'object') continue;
      const u = s.imageUrl || '';
      if (!u.includes('wikimedia.org') || s.imageCredit) continue;
      const t = fileTitle(u);
      if (t && meta[t]) { s.imageCredit = meta[t]; if (f === DATA[0]) filled++; }
      else if (f === DATA[0]) unresolved.push(`${d.id}/${s.name}`);
    }
  }
  fs.writeFileSync(f, JSON.stringify(data, null, 2));
}
console.log(`\n埋めた ${filled}件 / 解決できず ${unresolved.length}件`);
for (const u of unresolved) console.log(`   ⚠️ ${u}`);
