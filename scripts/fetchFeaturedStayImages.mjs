// featured_stay 用の Commons 画像取得（thumb幅はAPI取得・クレジット記録）
import fs from 'fs';

const TARGETS = [
  { id: 'shuzenji',       file: 'Arai Ryokan Entrance.jpg' },
  { id: 'kinosaki-onsen', file: 'Sanpou Nishimuraya, Kinosaki Onsen JAPAN (49108378111).jpg' },
  { id: 'ginzan-onsen',   file: 'Ginzan Onsen Noto-ya Ryokan with a sign of founder, Kido Sasaemon, in Hanazawa, Yamagata (山形県銀山温泉 能登屋旅館 と 創業者・木戸佐左エ門の大看板) (2015-03-07 by Eiji Kikuta @Pixabay 1366872).jpg' },
  { id: 'nyuto-onsen',    file: 'Tsurunoyu Onsen 04.jpg' },
  { id: 'shima-onsen',    file: '積善館本館 中之条 2013 (9994399714).jpg' },
];
const UA = 'DokoikoBot/1.0 (morilab.support@gmail.com)';
fs.mkdirSync('public/images/stays', { recursive: true });

const credits = {};
for (const t of TARGETS) {
  const api = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent('File:' + t.file)}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1200&format=json`;
  const j = await (await fetch(api, { headers: { 'User-Agent': UA } })).json();
  const page = Object.values(j.query.pages)[0];
  const info = page.imageinfo?.[0];
  if (!info) { console.log(`NG ${t.id}: no imageinfo`); continue; }
  const url = info.thumburl || info.url;
  const meta = info.extmetadata || {};
  const author = (meta.Artist?.value || '').replace(/<[^>]+>/g, '').trim();
  const license = meta.LicenseShortName?.value || '';
  const buf = Buffer.from(await (await fetch(url, { headers: { 'User-Agent': UA } })).arrayBuffer());
  fs.writeFileSync(`public/images/stays/${t.id}.jpg`, buf);
  credits[t.id] = {
    author, license,
    url: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(t.file)}`,
    attributionRequired: !/CC0|Public domain/i.test(license),
  };
  console.log(`OK ${t.id}: ${buf.length} bytes | ${license} | ${author}`);
  await new Promise(r => setTimeout(r, 1200));
}
fs.writeFileSync('logs/featured_stay_credits.json', JSON.stringify(credits, null, 1));
console.log('credits saved');
