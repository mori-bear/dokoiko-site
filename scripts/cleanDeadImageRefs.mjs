#!/usr/bin/env node
/**
 * cleanDeadImageRefs.mjs — images配列に残っている、実体の無いパスを取り除く。
 *
 * [id].astro と index.astro は images[0] しか読んでいないため（grep で確認）、
 * 2番目以降の spot-N.jpg はページに一切出ていない。宣言だけが残ったゴミなので消す。
 * images[0] が欠けているもの（＝ヒーローが出ないもの）はここでは触らない。
 * 画像を取得して埋める対象なので、宣言を消すと取得後に繋がらなくなる。
 */
import fs from 'fs';
import path from 'path';
const DATA = ['src/data/destinations.json', 'public/data/destinations.json'];

let removed = 0, touched = 0, keptHead = 0;
for (const f of DATA) {
  const all = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const d of all) {
    const imgs = d.images;
    if (!Array.isArray(imgs) || !imgs.length) continue;
    const head = imgs[0];
    const kept = imgs.filter((p, i) => i === 0 || fs.existsSync(path.join('public', p)));
    if (kept.length === imgs.length) continue;
    if (f === DATA[0]) { removed += imgs.length - kept.length; touched++; if (!fs.existsSync(path.join('public', head))) keptHead++; }
    d.images = kept;
  }
  fs.writeFileSync(f, JSON.stringify(all, null, 2) + '\n');
}
console.log(`■ 実体の無い画像参照を掃除`);
console.log(`   消した参照 ${removed}件 / 対象destination ${touched}件`);
console.log(`   うち先頭(ヒーロー)が欠けたまま残したもの ${keptHead}件（画像取得の対象）`);
