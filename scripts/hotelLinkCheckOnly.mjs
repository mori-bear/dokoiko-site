#!/usr/bin/env node
/**
 * hotelLinkCheckOnly.mjs
 * 全hotelLinks.rakutenをfetchしてステータスチェック。修正なし、リストアップのみ。
 */
import fs from 'fs';
const DEST_FILE = './src/data/destinations.json';
const dests = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));

async function check(url) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, { method: 'GET', redirect: 'follow', signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0' } });
    clearTimeout(t);
    return res.status;
  } catch (e) {
    return e.name === 'AbortError' ? 'TIMEOUT' : 'ERR';
  }
}

const CONC = 15;
const targets = dests.filter(d => d.hotelLinks?.rakuten);
console.log(`📦 検査: ${targets.length}件 (並列${CONC})`);

const bad = [];
let processed = 0;
const queue = targets.slice();

async function worker() {
  while (queue.length) {
    const d = queue.shift();
    if (!d) break;
    const status = await check(d.hotelLinks.rakuten);
    if (status !== 200) {
      bad.push({ id: d.id, name: d.name, pref: d.prefecture, status, url: d.hotelLinks.rakuten });
    }
    processed++;
    if (processed % 100 === 0) console.log(`  ${processed}/${targets.length} bad=${bad.length}`);
  }
}

await Promise.all(Array.from({length:CONC}, () => worker()));

const byStatus = {};
for (const b of bad) byStatus[b.status] = (byStatus[b.status] || 0) + 1;

console.log(`\n=== 完了 ===`);
console.log(`  検査: ${processed}件 / 不良: ${bad.length}件`);
console.log('\nステータス内訳:');
for (const [s, c] of Object.entries(byStatus).sort((a,b)=>b[1]-a[1])) console.log(`  ${s}: ${c}件`);
console.log('\n代表URL (各ステータスから3件ずつ):');
for (const s of Object.keys(byStatus)) {
  const samples = bad.filter(b => b.status === s).slice(0, 3);
  console.log(`\n[${s}]`);
  for (const x of samples) {
    console.log(`  ${x.id} | ${x.name} (${x.pref})`);
    console.log(`    ${x.url.slice(0, 120)}`);
  }
}

fs.writeFileSync('/tmp/hotel_link_bad.json', JSON.stringify(bad, null, 2));
console.log(`\n→ /tmp/hotel_link_bad.json (${bad.length}件)`);
