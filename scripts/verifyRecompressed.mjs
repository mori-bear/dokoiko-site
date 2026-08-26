#!/usr/bin/env node
/** verifyRecompressed.mjs — 再圧縮後の全画像が正常に開けるか・寸法が想定内かを機械チェックする。 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const DIR = 'public/images';
const exts = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p); else if (exts.has(path.extname(e.name).toLowerCase())) files.push(p);
  }
})(DIR);

const before = Object.fromEntries(JSON.parse(fs.readFileSync('logs/image_sizes.json','utf8')).map(r=>[r.f,r]));
let broken=0, oversize=0, tooNarrow=0, zero=0, grew=0, done=0, bytes=0;
const problems=[];
for (const f of files) {
  const st = fs.statSync(f); bytes += st.size;
  if (st.size === 0) { zero++; problems.push({f, why:'0バイト'}); continue; }
  try {
    const m = await sharp(f).metadata();
    if (!m.width) { broken++; problems.push({f, why:'寸法を読めない'}); continue; }
    // 基準は「幅」1600px。縦長を長辺で縮めると幅が1000pxを割り、
    // 既存QA(checkImageDimensionsBatch.mjs)の欠陥条件に触れてしまうため。
    if (m.width > 1600) { oversize++; problems.push({f, why:`幅${m.width}px`}); }
    const b = before[f];
    // 元が1000px以上あったのに1000px未満になっていたら縮めすぎ
    if (b?.w >= 1000 && m.width < 1000) { tooNarrow++; problems.push({f, why:`幅${b.w}→${m.width}px`}); }
    if (b && st.size > b.bytes) { grew++; problems.push({f, why:`増加 ${Math.round(b.bytes/1024)}→${Math.round(st.size/1024)}KB`}); }
  } catch (e) { broken++; problems.push({f, why:'デコード失敗 '+String(e).slice(0,40)}); }
  if (++done % 1500 === 0) process.stderr.write(`  ${done}/${files.length}\n`);
}
const mb=(b)=>(b/1024/1024).toFixed(0)+'MB';
console.log(`検査 ${files.length}枚 / 合計 ${mb(bytes)} / 平均 ${Math.round(bytes/files.length/1024)}KB`);
console.log(`  0バイト ${zero} / 開けない ${broken} / 長辺1600px超 ${oversize} / 幅1000px未満に縮小 ${tooNarrow} / 増加 ${grew}`);
if (problems.length) { console.log('  問題のあるファイル（先頭15件）'); problems.slice(0,15).forEach(p=>console.log(`    ${p.f} … ${p.why}`)); }
else console.log('  ✅ 問題なし');
fs.writeFileSync('logs/recompress_verify.json', JSON.stringify(problems,null,1));
process.exit(zero+broken+tooNarrow ? 1 : 0);
