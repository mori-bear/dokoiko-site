#!/usr/bin/env node
/**
 * verifyHeroImages.mjs — ビルド済みHTMLで、実際にヒーロー画像が出ていないページを数える。
 * データ側の推定ではなく、出力されたHTMLを見て確かめる。
 */
import fs from 'fs';
import path from 'path';
const files = [];
for (const e of fs.readdirSync('dist/destinations', { withFileTypes: true })) {
  if (!e.isDirectory()) continue;
  const f = path.join('dist/destinations', e.name, 'index.html');
  if (fs.existsSync(f)) files.push([e.name, f]);
}
const broken = [];
for (const [id, f] of files) {
  const html = fs.readFileSync(f, 'utf8');
  if (!/class="dest-hero-img"/.test(html)) broken.push(id);
}
console.log(`■ destinationページ ${files.length}件`);
console.log(`   ヒーロー画像が出ていない ${broken.length}件`);
for (const id of broken.slice(0, 30)) console.log(`   - ${id}`);
if (broken.length > 30) console.log(`   … ほか${broken.length - 30}件`);
fs.writeFileSync('logs/hero_broken.json', JSON.stringify(broken, null, 1));
