#!/usr/bin/env node
import fs from 'fs';
const DEST_FILE = './src/data/destinations.json';
const dests = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));

async function check(url, expectKeyword) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, { method: 'GET', redirect: 'follow', signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0' } });
    clearTimeout(t);
    if (res.status !== 200) return { status: res.status, finalUrl: res.url };
    const reader = res.body?.getReader();
    let body = '';
    let read = 0;
    while (reader && read < 15000) {
      const { value, done } = await reader.read();
      if (done) break;
      body += new TextDecoder().decode(value);
      read = body.length;
    }
    reader?.cancel().catch(()=>{});
    return { status: 200, finalUrl: res.url, body: body.slice(0, 10000) };
  } catch (e) { return { status: 'ERR', error: e.message }; }
}

const PREF_JALAN = {
  '北海道':'01','青森県':'02','岩手県':'03','宮城県':'04','秋田県':'05','山形県':'06','福島県':'07',
  '茨城県':'08','栃木県':'09','群馬県':'10','埼玉県':'11','千葉県':'12','東京都':'13','神奈川県':'14',
  '新潟県':'15','富山県':'16','石川県':'17','福井県':'18','山梨県':'19','長野県':'20','岐阜県':'21','静岡県':'22','愛知県':'23',
  '三重県':'24','滋賀県':'25','京都府':'26','大阪府':'27','兵庫県':'28','奈良県':'29','和歌山県':'30',
  '鳥取県':'31','島根県':'32','岡山県':'33','広島県':'34','山口県':'35',
  '徳島県':'36','香川県':'37','愛媛県':'38','高知県':'39',
  '福岡県':'40','佐賀県':'41','長崎県':'42','熊本県':'43','大分県':'44','宮崎県':'45','鹿児島県':'46',
  '沖縄県':'47',
};

const CONC = 15;
const targets = dests.filter(d => d.hotelLinks?.jalan);
console.log(`📦 検査: ${targets.length}件`);

const bad = [];
let processed = 0;
const queue = targets.slice();

async function worker() {
  while (queue.length) {
    const d = queue.shift();
    if (!d) break;
    const r = await check(d.hotelLinks.jalan, d.prefecture);
    let reason = null;
    if (r.status !== 200) reason = `status_${r.status}`;
    else {
      // チェック1: finalUrlが /prf00/ や / トップ
      if (/\/prf00\b|jalan\.net\/?$/.test(r.finalUrl)) reason = 'top_page';
      // チェック2: body に prefecture or 都道府県code が含まれるか
      else {
        const pref = (d.prefecture || '').replace(/[県府都]$/, '');
        const code = PREF_JALAN[d.prefecture];
        if (pref && !r.body.includes(pref) && code && !r.body.includes(`prf${code}`)) reason = 'no_region_text';
      }
    }
    if (reason) bad.push({ id: d.id, name: d.name, pref: d.prefecture, url: d.hotelLinks.jalan, status: r.status, reason });
    processed++;
    if (processed % 100 === 0) console.log(`  ${processed}/${targets.length} bad=${bad.length}`);
  }
}

await Promise.all(Array.from({length:CONC}, () => worker()));

const byReason = {};
for (const b of bad) byReason[b.reason] = (byReason[b.reason] || 0) + 1;
console.log(`\n=== 完了 ===`);
console.log(`  検査: ${processed}件 / 不良: ${bad.length}件`);
console.log('理由内訳:');
for (const [r, c] of Object.entries(byReason)) console.log(`  ${r}: ${c}件`);
if (bad.length > 0 && bad.length <= 50) {
  console.log('\n代表:');
  for (const x of bad.slice(0, 10)) console.log(`  ${x.id} | ${x.name} | ${x.url} | ${x.reason}`);
}
fs.writeFileSync('/tmp/jalan_bad.json', JSON.stringify(bad, null, 2));
