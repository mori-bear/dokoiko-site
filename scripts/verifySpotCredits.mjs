#!/usr/bin/env node
/**
 * verifySpotCredits.mjs — ビルド済みHTMLで spot 画像の著作者表示を検査する。
 *   ・表示義務のある画像に figcaption が出ているか
 *   ・クレジットのリンク先が、実際に表示している画像のファイル名と一致するか
 *     （食い違っていると別作品の著作者を掲げることになる）
 */
import fs from 'fs';
import path from 'path';

const htmls = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name === 'index.html' && p.includes('destinations')) htmls.push(p);
  }
})('dist/destinations');

// Commons と ja.wikipedia のどちらに載っている画像でも、ファイル名を取り出す
const fileOf = (u) => {
  const m = decodeURIComponent(String(u)).match(/\/wikipedia\/(?:commons|ja)\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/?]+)/);
  return m ? m[1].replace(/_/g, ' ') : null;
};
const creditFileOf = (u) => {
  const m = decodeURIComponent(String(u)).match(/\/wiki\/(?:File|ファイル):(.+)$/);
  return m ? m[1].replace(/_/g, ' ') : null;
};

let imgs = 0, commons = 0, credited = 0, noCredit = 0, mismatch = 0;
const noCreditList = [], mismatchList = [];

for (const f of htmls) {
  const html = fs.readFileSync(f, 'utf8');
  // <figure class="spot-figure"> … </figure> を1つずつ見る
  for (const fig of html.match(/<figure class="spot-figure"[\s\S]*?<\/figure>/g) || []) {
    const src = (fig.match(/class="spot-thumb" src="([^"]+)"/) || [])[1];
    if (!src) continue;
    imgs++;
    if (!src.includes('wikimedia.org')) continue;
    commons++;
    const cap = fig.match(/<figcaption class="spot-credit"[\s\S]*?<\/figcaption>/);
    if (!cap) { noCredit++; noCreditList.push([f, src.slice(-60)]); continue; }
    credited++;
    const href = (cap[0].match(/href="([^"]+)"/) || [])[1];
    const a = fileOf(src), b = href ? creditFileOf(href) : null;
    if (a && b && a !== b) { mismatch++; mismatchList.push([f, a, b]); }
  }
}
console.log(`■ spot画像のクレジット検査（destinationページ ${htmls.length}件）`);
console.log(`  spot画像            ${imgs}`);
console.log(`  うちCommons由来      ${commons}`);
console.log(`  クレジット表示あり     ${credited}`);
console.log(`  表示なし（CC0等を含む） ${noCredit}`);
console.log(`  リンク先が画像と不一致  ${mismatch}`);
for (const [f, a, b] of mismatchList.slice(0, 10)) console.log(`    ❌ ${f}\n        画像=${a}\n        表記=${b}`);
console.log(mismatch ? `\nNG ${mismatch}件` : '\n✅ クレジットは全て実ファイルと一致');
process.exit(mismatch ? 1 : 0);
