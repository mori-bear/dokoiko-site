#!/usr/bin/env node
/**
 * noImageDestStats.mjs — 画像を持たないdestinationが何件あり、どう扱われているかを見る（調査のみ）。
 * 柿木温泉のようにCommonsに写真が存在しない旅先を、画像なしで載せてよいかの判断材料。
 */
import fs from 'fs';
import path from 'path';
const all = JSON.parse(fs.readFileSync('src/data/destinations.json', 'utf8'));
const imgDir = 'public/images';

const has = (d) => fs.existsSync(path.join(imgDir, d.id, 'main.jpg')) || fs.existsSync(path.join(imgDir, `${d.id}.jpg`));
const withImg = all.filter(has);
const without = all.filter((d) => !has(d));

console.log(`総数 ${all.length} / main画像あり ${withImg.length} / なし ${without.length}`);
console.log(`images配列あり ${all.filter((d) => (d.images || []).length).length}件`);
console.log(`unsplashUrlあり ${all.filter((d) => d.unsplashUrl).length}件`);

const noneAtAll = without.filter((d) => !d.unsplashUrl && !(d.images || []).length);
console.log(`\n画像手段が完全に無い: ${noneAtAll.length}件`);
for (const d of noneAtAll.slice(0, 15)) console.log(`  ${d.id.padEnd(24)} ${d.name} (${d.prefecture})`);
