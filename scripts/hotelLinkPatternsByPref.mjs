#!/usr/bin/env node
/** hotelLinkPatternsByPref.mjs — 指定県の既存 hotelLinks / hotelArea の最多パターンを出す（コピー元確認用）。 */
import fs from 'fs';
const all = JSON.parse(fs.readFileSync('src/data/destinations.json', 'utf8'));
for (const pref of process.argv.slice(2)) {
  const rows = all.filter((d) => d.prefecture === pref);
  const cnt = (f) => {
    const m = new Map();
    for (const d of rows) { const v = f(d); if (v) m.set(v, (m.get(v) || 0) + 1); }
    return [...m.entries()].sort((a, b) => b[1] - a[1])[0];
  };
  const rk = cnt((d) => d.hotelLinks?.rakuten && !d.hotelLinks.rakuten.includes('afl.rakuten') ? d.hotelLinks.rakuten : null);
  const jl = cnt((d) => d.hotelLinks?.jalan);
  const ar = cnt((d) => d.hotelArea);
  console.log(`${pref.padEnd(5)} (${rows.length}件)`);
  console.log(`   rakuten: ${rk ? `${rk[0]} (${rk[1]})` : 'なし'}`);
  console.log(`   jalan  : ${jl ? `${jl[0]} (${jl[1]})` : 'なし'}`);
  console.log(`   area   : ${ar ? `${ar[0]} (${ar[1]})` : 'なし'}`);
}
