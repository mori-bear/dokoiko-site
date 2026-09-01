#!/usr/bin/env node
/**
 * resyncSpotCredits.mjs — 全 destination の spot 画像について、imageCredit を
 * 「実際に表示している画像ファイル」から取り直す。
 *
 * 背景: 画像を差し替えたときに imageCredit が付いてこず、別ファイルの著作者・
 * ライセンス・ファイルページURLが残っていた。ビルド済みHTMLの検査で 858件が
 * 画像と表記の不一致だった。他人の作品の著作者名を掲げることになるので、
 * 表示を出す前に全件を実ファイル基準へ揃える。
 */
import fs from 'fs';
const UA = { 'User-Agent': 'DokoIko-DataAudit/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const DATA = ['src/data/destinations.json', 'public/data/destinations.json'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const fileTitle = (url) => {
  const m = String(url).match(/\/commons\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/?]+)/);
  return m ? 'File:' + decodeURIComponent(m[1]).replace(/_/g, ' ') : null;
};

const all = JSON.parse(fs.readFileSync(DATA[0], 'utf8'));
const titles = new Set();
for (const d of all) {
  for (const s of d.spots || []) {
    if (!s || typeof s !== 'object' || !s.imageUrl) continue;
    const t = fileTitle(s.imageUrl);
    if (t) titles.add(t);
  }
}
const list = [...titles];
console.log(`■ 参照している Commons ファイル ${list.length}件のメタデータを取得`);

const meta = {};
for (let i = 0; i < list.length; i += 50) {
  const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json`
    + `&titles=${encodeURIComponent(list.slice(i, i + 50).join('|'))}`
    + `&prop=imageinfo&iiprop=url|extmetadata`;
  const j = await (await fetch(api, { headers: UA })).json();
  // 改名されたファイルは normalized/redirects で別名が返るので対応表を作る
  const alias = {};
  for (const n of j.query?.normalized || []) alias[n.to] = n.from;
  for (const r of j.query?.redirects || []) alias[r.to] = r.from;
  for (const p of Object.values(j.query?.pages || {})) {
    const ii = p.imageinfo?.[0]; if (!ii) continue;
    const em = ii.extmetadata || {};
    const lic = em.LicenseShortName?.value || 'unknown';
    const c = {
      author: (em.Artist?.value || '').replace(/<[^>]*>/g, '').split(/\n|This photo was taken/)[0].replace(/\s+/g, ' ').trim() || 'unknown',
      license: lic,
      url: ii.descriptionurl,
      attributionRequired: !/^(CC0|Public domain)/i.test(lic),
    };
    meta[p.title] = c;
    if (alias[p.title]) meta[alias[p.title]] = c;   // 元の呼び名でも引けるようにする
  }
  if (i % 500 === 0) console.log(`   ${i}/${list.length}`);
  await sleep(120);
}
console.log(`   取得できた ${Object.keys(meta).length}件`);

let changed = 0, kept = 0, unresolved = [];
for (const f of DATA) {
  const data = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const d of data) {
    for (const s of d.spots || []) {
      if (!s || typeof s !== 'object' || !s.imageUrl) continue;
      const t = fileTitle(s.imageUrl);
      if (!t) { if (f === DATA[0]) unresolved.push(`${d.id}/${s.name}（Commons外）`); continue; }
      const c = meta[t];
      if (!c) { if (f === DATA[0]) unresolved.push(`${d.id}/${s.name} → ${t}`); continue; }
      const before = JSON.stringify(s.imageCredit || null);
      s.imageCredit = c;
      if (f === DATA[0]) (before === JSON.stringify(c) ? kept++ : changed++);
    }
  }
  fs.writeFileSync(f, JSON.stringify(data, null, 2));
}
console.log(`\n書き換え ${changed}件 / 元から一致 ${kept}件 / 解決できず ${unresolved.length}件`);
for (const u of unresolved.slice(0, 20)) console.log(`   ⚠️ ${u}`);
