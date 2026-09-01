#!/usr/bin/env node
/** saveAwaraImage.mjs — 目視で選んだあわら温泉の候補(芦湯)を main.jpg として保存する。 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
const UA = { 'User-Agent': 'DokoIko-DataAudit/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const ID = 'niche_福井_3';
const cand = JSON.parse(fs.readFileSync('logs/awara_retry.json', 'utf8')).find((x) => x.n === 2);   // 行灯の灯る碁盤目の通り。ヒーローの縦トリミングでも街並みが画面に残る
const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json`
  + `&titles=${encodeURIComponent(cand.title)}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1600`;
const ii = Object.values((await (await fetch(api, { headers: UA })).json()).query.pages)[0].imageinfo[0];
const buf = Buffer.from(await (await fetch(ii.thumburl || ii.url, { headers: UA })).arrayBuffer());
fs.mkdirSync(path.join('public/images', ID), { recursive: true });
await sharp(buf).resize({ width: 1600, withoutEnlargement: true })
  .jpeg({ quality: 80, mozjpeg: true, progressive: true }).toFile(path.join('public/images', ID, 'main.jpg'));
fs.writeFileSync('logs/awara_images.json', JSON.stringify({
  id: ID, title: cand.title,
  credit: { author: cand.author, license: cand.license, url: cand.descurl,
    attributionRequired: !/^(CC0|Public domain)/i.test(cand.license) },
}, null, 2));
console.log(`保存 public/images/${ID}/main.jpg ← ${cand.title} (${cand.author} / ${cand.license})`);
