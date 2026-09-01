#!/usr/bin/env node
/**
 * adoptRetryImage.mjs — 目視で選んだ再取得候補を main.jpg として採用し、
 * logs/major_images.json の採用記録（クレジット含む）を差し替える。
 * usage: node scripts/adoptRetryImage.mjs <id> <候補番号>
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
const UA = { 'User-Agent': 'DokoIko-DataAudit/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
// usage: node scripts/adoptRetryImage.mjs <id> <候補番号> [候補ファイル]
const [id, num, src = 'logs/major_retry.json'] = process.argv.slice(2);
const retry = JSON.parse(fs.readFileSync(src, 'utf8'));
const c = retry.find((x) => x.id === id && x.n === Number(num));
if (!c) throw new Error(`候補が無い: ${id} #${num}`);

// 保存用に原寸を取り直す（retry時に保存したのは確認用の1200px）
const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json`
  + `&titles=${encodeURIComponent(c.title)}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1600`;
const j = await (await fetch(api, { headers: UA })).json();
const ii = Object.values(j.query.pages)[0].imageinfo[0];
const buf = Buffer.from(await (await fetch(ii.thumburl || ii.url, { headers: UA })).arrayBuffer());
fs.mkdirSync(path.join('public/images', id), { recursive: true });
await sharp(buf).resize({ width: 1600, withoutEnlargement: true })
  .jpeg({ quality: 80, mozjpeg: true, progressive: true }).toFile(path.join('public/images', id, 'main.jpg'));

const report = JSON.parse(fs.readFileSync('logs/major_images.json', 'utf8'));
report.adopted = report.adopted.filter((x) => x.id !== id);
report.rejected = (report.rejected || []).filter((x) => x.id !== id);
report.adopted.push({ id, name: c.title, title: c.title, placeCheck: c.place,
  credit: { author: c.author, license: c.license, url: c.descurl,
    attributionRequired: !/^(CC0|Public domain)/i.test(c.license) },
  verdict: { retry: true, subject: c.subject } });
fs.writeFileSync('logs/major_images.json', JSON.stringify(report, null, 1));
console.log(`採用 ${id} ← ${c.title}  (${c.author} / ${c.license})`);
