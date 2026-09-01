#!/usr/bin/env node
/**
 * auditMissingImages.mjs — images配列で宣言しているのに実体が無い画像を洗い出す。
 *   ・main.jpg が無いのか、spot-N.jpg が無いのかを分ける
 *   ・main が無い場合、ページが実際にどう表示されるか（[id].astro の判定）に合わせて
 *     「ヒーロー画像が出ない destination」を特定する
 *   ・知名度の目安として weight と travelTime の充実度を添えて並べる
 */
import fs from 'fs';
import path from 'path';
const all = JSON.parse(fs.readFileSync('src/data/destinations.json', 'utf8'));

// [id].astro のヒーロー解決と同じ順で判定する:
//   main.jpg → {id}.jpg → images[0]（ただし /images/ で始まるものは使われない）→ unsplashUrl
const rows = [];
for (const d of all) {
  const imgs = d.images || [];
  const missing = imgs.filter((p) => !fs.existsSync(path.join('public', p)));
  const heroResolves = fs.existsSync(path.join('public', `images/${d.id}/main.jpg`))
    || fs.existsSync(path.join('public', `images/${d.id}.jpg`))
    || (imgs[0] && !String(imgs[0]).startsWith('/images/'));
  // unsplashUrl は hasImage の判定に阻まれて実際には出ないので数に入れない
  // （verifyHeroImages.mjs でビルド済みHTMLを実測して確認した）
  if (!missing.length && heroResolves) continue;
  const mainDeclared = imgs.some((p) => /\/main\.jpg$/.test(p));
  const mainExists = fs.existsSync(path.join('public', `images/${d.id}/main.jpg`));
  const singleExists = fs.existsSync(path.join('public', `images/${d.id}.jpg`));
  rows.push({
    id: d.id, name: d.name, pref: d.prefecture, weight: d.weight ?? 0,
    tier: d.tier, destType: d.destType,
    declared: imgs.length, missing: missing.length,
    mainDeclared, mainExists, singleExists,
    heroBroken: !heroResolves,   // ページにヒーロー画像が出ない
    missingList: missing,
  });
}

const heroBroken = rows.filter((r) => r.heroBroken);
const spotOnly = rows.filter((r) => !r.heroBroken);

console.log(`■ 画像に問題があるdestination ${rows.length}件`);
console.log(`   うちページにヒーロー画像が出ない ${heroBroken.length}件`);
console.log(`   うちspot画像だけが欠けている    ${spotOnly.length}件`);

console.log(`\n■ ヒーロー画像が無い ${heroBroken.length}件（weight降順＝サイト内の重み順）`);
for (const r of heroBroken.sort((a, b) => b.weight - a.weight)) {
  console.log(`  ${String(r.weight).padStart(5)} ${r.id.padEnd(22)} ${String(r.name).padEnd(14)} ${String(r.pref).padEnd(5)} ${r.destType ?? '-'}`);
}

console.log(`\n■ spot画像だけ欠けている ${spotOnly.length}件（先頭20件）`);
for (const r of spotOnly.sort((a, b) => b.weight - a.weight).slice(0, 20)) {
  console.log(`  ${String(r.weight).padStart(5)} ${r.id.padEnd(22)} ${String(r.name).padEnd(14)} 欠${r.missing}/${r.declared}  ${r.missingList.join(' ')}`);
}

fs.writeFileSync('logs/missing_images.json', JSON.stringify({ heroBroken, spotOnly }, null, 1));
console.log('\n→ logs/missing_images.json');
