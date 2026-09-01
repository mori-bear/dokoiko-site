#!/usr/bin/env node
/**
 * applyRefillImages.mjs — 審査を通った main.jpg を destinations.json に反映する。
 *   ・images の先頭を /images/<id>/main.jpg にする（[id].astro はここしか見ていない）
 *   ・imageCredit を Commons のメタデータから設定する
 *     CC BY / CC BY-SA は attributionRequired: true、CC0・パブリックドメインは false。
 *     この区別はデータとして持たせる（spot画像の表示側はこの値で出し分けている）。
 *
 * 反映するのは「厳格審査(Sonnet)を通ったもの」と「撮り直しで採用したもの」だけ。
 * 落選したままのページは画像なしレイアウトのまま残す。
 *
 * usage: node scripts/applyRefillImages.mjs <strict.json> <images.json> [retry.json ...]
 */
import fs from 'fs';
import path from 'path';
const DATA = ['src/data/destinations.json', 'public/data/destinations.json'];

const [strictPath, imagesPath, ...retryPaths] = process.argv.slice(2);
const strict = JSON.parse(fs.readFileSync(strictPath, 'utf8'));
const images = JSON.parse(fs.readFileSync(imagesPath, 'utf8'));
// kyushuDestImages.mjs は attributionRequired を true 固定で書き出すので、
// ここでライセンス名から導出し直す（CC0・パブリックドメインは表示義務なし）。
const normalize = (c) => c && ({
  ...c,
  attributionRequired: !/^(CC0|Public domain|パブリック)/i.test(String(c.license || '')),
});
const creditById = Object.fromEntries(images.adopted.map((x) => [x.id, normalize(x.credit)]));

// 厳格審査を通ったもの
const apply = {};
for (const p of strict.pass) if (creditById[p.id]) apply[p.id] = creditById[p.id];
// 撮り直しで採用したもの（あとから上書きする）
for (const rp of retryPaths) {
  if (!fs.existsSync(rp)) continue;
  for (const x of JSON.parse(fs.readFileSync(rp, 'utf8')).adopted) apply[x.id] = normalize(x.credit);
}

let applied = 0, skippedNoFile = 0;
const list = [];
for (const f of DATA) {
  const all = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const d of all) {
    const credit = apply[d.id];
    if (!credit) continue;
    const rel = `/images/${d.id}/main.jpg`;
    if (!fs.existsSync(path.join('public', rel))) { if (f === DATA[0]) skippedNoFile++; continue; }
    const rest = (d.images || []).filter((p) => p !== rel);
    d.images = [rel, ...rest];
    d.imageCredit = credit;
    if (f === DATA[0]) { applied++; list.push([d.id, d.name, credit.license, credit.attributionRequired]); }
  }
  fs.writeFileSync(f, JSON.stringify(all, null, 2) + '\n');
}
console.log(`■ 反映 ${applied}件（main.jpgが無くて見送り ${skippedNoFile}件）`);
for (const [id, name, lic, req] of list) {
  console.log(`   ${id.padEnd(22)} ${String(name).padEnd(12)} ${String(lic).padEnd(16)} 表示義務=${req}`);
}
