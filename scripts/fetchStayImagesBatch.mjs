// featured_stay 画像バッチ取得: 検索→トップ候補DL→クレジット記録（目視検証は呼び出し側で実施）
// 使い方: node scripts/fetchStayImagesBatch.mjs logs/stay_batches/batchN.json
import fs from 'fs';

const targetsFile = process.argv[2];
const TARGETS = JSON.parse(fs.readFileSync(targetsFile, 'utf8')); // [{id, search, file?}]
const UA = 'DokoikoBot/1.0 (morilab.support@gmail.com)';
fs.mkdirSync('public/images/stays', { recursive: true });
const creditsPath = 'logs/featured_stay_credits.json';
const credits = fs.existsSync(creditsPath) ? JSON.parse(fs.readFileSync(creditsPath, 'utf8')) : {};

async function api(url) { return (await fetch(url, { headers: { 'User-Agent': UA } })).json(); }

for (const t of TARGETS) {
  let file = t.file;
  if (!file) {
    const j = await api(`https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(t.search)}&gsrnamespace=6&gsrlimit=5&prop=imageinfo&iiprop=url|extmetadata&format=json`);
    const pages = Object.values(j.query?.pages || {});
    // jpg優先・PDF等除外
    const cand = pages.filter(p => /\.(jpe?g|png)$/i.test(p.title));
    if (!cand.length) { console.log(`NOIMG ${t.id}: 候補なし`); continue; }
    file = cand[0].title.replace(/^File:/, '');
    console.log(`PICK ${t.id}: ${file}`);
    for (const c of cand.slice(0, 4)) console.log(`   候補: ${c.title}`);
  }
  const j2 = await api(`https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent('File:' + file)}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1200&format=json`);
  const info = Object.values(j2.query.pages)[0].imageinfo?.[0];
  if (!info) { console.log(`NG ${t.id}: imageinfoなし`); continue; }
  const meta = info.extmetadata || {};
  const license = meta.LicenseShortName?.value || '';
  if (!/CC|Public domain|CC0/i.test(license)) { console.log(`SKIP ${t.id}: license=${license}`); continue; }
  const buf = Buffer.from(await (await fetch(info.thumburl || info.url, { headers: { 'User-Agent': UA } })).arrayBuffer());
  fs.writeFileSync(`public/images/stays/${t.id}.jpg`, buf);
  credits[t.id] = {
    author: (meta.Artist?.value || '').replace(/<[^>]+>/g, '').trim(),
    license,
    url: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file)}`,
    attributionRequired: !/CC0|Public domain/i.test(license),
  };
  console.log(`OK ${t.id}: ${buf.length}b | ${license}`);
  await new Promise(r => setTimeout(r, 1000));
}
fs.writeFileSync(creditsPath, JSON.stringify(credits, null, 1));
console.log('credits saved');
