#!/usr/bin/env node
/**
 * coverageGap.mjs — 都道府県 × ジャンルで空白を洗い出す。
 * 件数だけでなく destType の分布を見て、「その県にどのジャンルが無いか」を出す。
 */
import fs from 'fs';
const all = JSON.parse(fs.readFileSync('src/data/destinations.json', 'utf8'));
const PREFS = ['北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県','茨城県','栃木県','群馬県',
'埼玉県','千葉県','東京都','神奈川県','新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県',
'静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県','鳥取県','島根県',
'岡山県','広島県','山口県','徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県','熊本県',
'大分県','宮崎県','鹿児島県','沖縄県'];

// タグから「街並み」「絶景」を数える（destTypeだけでは分類が粗いため）
const has = (d, t) => (d.tags || []).includes(t);
const rows = PREFS.map((p) => {
  const l = all.filter((d) => (d.prefecture || '') === p);
  return {
    p, n: l.length,
    onsen: l.filter((d) => d.destType === 'onsen' || has(d, '温泉')).length,
    machi: l.filter((d) => has(d, '街歩き') || has(d, '歴史')).length,
    kei: l.filter((d) => has(d, '絶景')).length,
    area: l.filter((d) => d.tier === 'area').length,
    spot: l.filter((d) => d.tier === 'spot').length,
  };
});

console.log('■ 都道府県 × ジャンル（件数の少ない順）');
console.log('   県      総数  温泉 街並み 絶景 | area spot');
for (const r of rows.sort((a, b) => a.n - b.n)) {
  const flag = [r.onsen === 0 ? '温泉0' : '', r.kei === 0 ? '絶景0' : '', r.machi === 0 ? '街並み0' : ''].filter(Boolean).join(' ');
  console.log(`   ${r.p.padEnd(5)} ${String(r.n).padStart(4)} ${String(r.onsen).padStart(5)} ${String(r.machi).padStart(5)} ${String(r.kei).padStart(4)} | ${String(r.area).padStart(4)} ${String(r.spot).padStart(4)}  ${flag}`);
}

const med = [...rows].sort((a, b) => a.n - b.n)[Math.floor(rows.length / 2)].n;
console.log(`\n   中央値 ${med}件`);
console.log('\n■ ジャンルが丸ごと無い県');
for (const k of [['onsen', '温泉'], ['kei', '絶景'], ['machi', '街並み・歴史']]) {
  const list = rows.filter((r) => r[k[0]] === 0).map((r) => r.p);
  console.log(`   ${k[1].padEnd(8)} ${list.length ? list.join(' / ') : 'なし'}`);
}
console.log('\n■ 総数が中央値を大きく下回る県（次バッチの優先候補）');
for (const r of rows.filter((x) => x.n <= med - 4).sort((a, b) => a.n - b.n)) {
  console.log(`   ${r.p.padEnd(5)} ${r.n}件  温泉${r.onsen} 街並み${r.machi} 絶景${r.kei}`);
}
