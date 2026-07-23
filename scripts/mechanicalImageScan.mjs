#!/usr/bin/env node
/**
 * mechanicalImageScan.mjs — Vision API 不要の全画像機械チェック
 *  - 横1000px以上か
 *  - 横長か（w > h）
 *  - 極端なアスペクト比でないか（2.4超 or 0.9未満で flag）
 *  - レターボックス/白帯・黒帯（上下端3%が極端に均一）でないか
 * 結果: logs/mechanical_scan.json ＋ NGサマリー標準出力
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const ROOT = 'public/images';
const OUT = 'logs/mechanical_scan.json';

const files = [];
(function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p);
    else if (/\.(jpe?g|png|webp)$/i.test(f)) files.push(p);
  }
})(ROOT);
console.log(`対象画像: ${files.length}件`);

const results = {};
let done = 0;
const CONC = 8;

async function bandStd(img, region) {
  const { channels } = await img.clone().extract(region).stats();
  // 各chの標準偏差平均（小さいほど均一＝帯の疑い）と平均輝度
  const stds = channels.map(c => c.stdev);
  const means = channels.map(c => c.mean);
  return { std: stds.reduce((a, b) => a + b, 0) / stds.length, mean: means.reduce((a, b) => a + b, 0) / means.length };
}

async function scan(p) {
  try {
    const img = sharp(p);
    const meta = await img.metadata();
    const w = meta.width, h = meta.height;
    const issues = [];
    if (w < 1000) issues.push(`W<1000(${w})`);
    if (w <= h) issues.push(`縦長/正方(${w}x${h})`);
    const ratio = w / h;
    if (ratio > 2.4) issues.push(`超横長(${ratio.toFixed(2)})`);
    if (ratio < 0.9) issues.push(`超縦長(${ratio.toFixed(2)})`);
    // レターボックス: 上下端3%（最低4px）の均一帯チェック
    const bandH = Math.max(4, Math.round(h * 0.03));
    const top = await bandStd(img, { left: 0, top: 0, width: w, height: bandH });
    const bot = await bandStd(img, { left: 0, top: h - bandH, width: w, height: bandH });
    for (const [label, b] of [['上帯', top], ['下帯', bot]]) {
      if (b.std < 3 && (b.mean > 245 || b.mean < 10)) issues.push(`${label}${b.mean > 128 ? '白' : '黒'}(std${b.std.toFixed(1)})`);
    }
    results[p.replace(ROOT + '/', '')] = { w, h, issues };
  } catch (e) {
    results[p.replace(ROOT + '/', '')] = { issues: ['READ_ERR:' + String(e.message).slice(0, 40)] };
  }
  if (++done % 500 === 0) {
    console.log(`進捗 ${done}/${files.length}`);
    fs.writeFileSync(OUT, JSON.stringify(results, null, 1));
  }
}

for (let i = 0; i < files.length; i += CONC) {
  await Promise.all(files.slice(i, i + CONC).map(scan));
}
fs.writeFileSync(OUT, JSON.stringify(results, null, 1));

const ng = Object.entries(results).filter(([, r]) => r.issues.length);
console.log(`\n完了。総 ${files.length} / NG ${ng.length}`);
const byType = {};
for (const [, r] of ng) for (const is of r.issues) { const k = is.replace(/\(.*/, ''); byType[k] = (byType[k] || 0) + 1; }
console.log('内訳:', JSON.stringify(byType));
console.log('\n--- main画像のNG（優先） ---');
for (const [p, r] of ng.filter(([p]) => /main\./.test(p)).slice(0, 40)) console.log(p, r.w + 'x' + r.h, r.issues.join(','));
