#!/usr/bin/env node
// 引田(香川県東かがわ市)の正しい画像候補を Wikimedia Commons / Wikipedia から検索・列挙
import https from 'https';

function get(url, opts = {}, redirs = 0) {
  return new Promise(resolve => {
    const req = https.get(url, { timeout: 15000, ...opts }, res => {
      if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location && redirs < 5) {
        res.resume();
        const next = res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, url).href;
        return resolve(get(next, opts, redirs + 1));
      }
      const c = []; res.on('data', d => c.push(d));
      res.on('end', () => resolve({ status: res.statusCode, data: Buffer.concat(c) }));
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}
const UA = { 'User-Agent': 'DokoIko/1.0 (tabidokoiko.com)' };

const queries = [
  '引田 東かがわ', '引田 醤油', '引田 港', 'Hiketa Kagawa', 'Hiketa Higashikagawa',
  '讃州井筒屋敷', '引田 町並み', '東かがわ市 引田',
];

console.log('=== Wikimedia Commons 検索結果 ===');
for (const q of queries) {
  const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search`
    + `&gsrsearch=${encodeURIComponent('filetype:bitmap ' + q)}&gsrnamespace=6&gsrlimit=6`
    + `&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1600`;
  const r = await get(api, { headers: UA });
  if (!r || r.status !== 200) { console.log(`\n[${q}] 取得失敗`); continue; }
  let pages;
  try { pages = JSON.parse(r.data.toString())?.query?.pages; } catch { pages = null; }
  if (!pages) { console.log(`\n[${q}] ヒットなし`); continue; }
  console.log(`\n[${q}]`);
  for (const p of Object.values(pages)) {
    const ii = p.imageinfo?.[0];
    if (!ii) continue;
    const land = ii.width >= ii.height ? '横' : '縦';
    console.log(`  ${land} ${ii.width}x${ii.height} | ${p.title.replace('File:','')}`);
    console.log(`     thumb: ${ii.thumburl}`);
  }
  await new Promise(r => setTimeout(r, 300));
}

console.log('\n=== Wikipedia ja summary originalimage ===');
for (const t of ['引田', '引田 (香川県)', '引田町']) {
  const r = await get(`https://ja.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(t)}`, { headers: UA });
  if (!r || r.status !== 200) { console.log(`[${t}] なし`); continue; }
  try {
    const j = JSON.parse(r.data.toString());
    console.log(`[${t}] ${j.title} / image: ${j.originalimage?.source || 'なし'}`);
  } catch { console.log(`[${t}] parse失敗`); }
  await new Promise(r => setTimeout(r, 300));
}
