/**
 * checkLinkTargets.mjs — Task4: 宿リンクの実効ターゲットURLを重複排除して404検査。
 * テンプレートは楽天/じゃらんを必ずアフィリ形式へ変換するため（構造的に保証）、
 * ここでは「アフィリの内側=実際の遷移先」を取り出し、distinctなURLのみ検査する。
 * 404/410 のみ「壊れ」。403/429/timeout はbotブロックの可能性が高く「保留」。
 * 出力: logs/link_check.json
 */
import fs from 'fs';
const dests = JSON.parse(fs.readFileSync('src/data/destinations.json', 'utf8'));

// afl/valuecommerce ラッパを外して実遷移先を得る
function unwrapRakuten(u) {
  if (!u) return null;
  const m = u.match(/[?&]pc=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : u;
}
function unwrapJalan(u) {
  if (!u) return null;
  const m = u.match(/vc_url=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : u;
}

const targetToIds = new Map();
function add(url, id) {
  if (!url) return;
  if (!targetToIds.has(url)) targetToIds.set(url, []);
  targetToIds.get(url).push(id);
}
for (const d of dests) {
  if (!d.hotelLinks) continue;
  add(unwrapRakuten(d.hotelLinks.rakuten), d.id);
  add(unwrapJalan(d.hotelLinks.jalan), d.id);
}
const targets = [...targetToIds.keys()];
console.log(`目的地 ${dests.length} / distinct遷移先 ${targets.length} を検査`);

async function check(url) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(url, { method: 'GET', redirect: 'follow', signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', 'Accept-Language': 'ja' } });
    clearTimeout(t);
    return res.status;
  } catch (e) { return e.name === 'AbortError' ? 'TIMEOUT' : 'ERR'; }
}

const results = {};
let i = 0;
const queue = targets.slice();
async function worker() {
  while (queue.length) {
    const url = queue.shift();
    const status = await check(url);
    results[url] = { status, count: targetToIds.get(url).length, sampleIds: targetToIds.get(url).slice(0, 3) };
    if (++i % 20 === 0) { process.stdout.write(`\r  ${i}/${targets.length}`); fs.writeFileSync('logs/link_check.json', JSON.stringify(results, null, 1)); }
  }
}
await Promise.all(Array.from({ length: 10 }, () => worker()));
fs.writeFileSync('logs/link_check.json', JSON.stringify(results, null, 1));

const broken = Object.entries(results).filter(([, r]) => r.status === 404 || r.status === 410);
const hold = Object.entries(results).filter(([, r]) => ['TIMEOUT', 'ERR', 403, 429, 503].includes(r.status));
const ok = Object.entries(results).filter(([, r]) => typeof r.status === 'number' && r.status >= 200 && r.status < 400);
console.log(`\n完了。distinct ${targets.length} / OK ${ok.length} / 壊れ(404) ${broken.length} / 保留(bot/timeout) ${hold.length}`);
if (broken.length) { console.log('=== 404 ==='); for (const [u, r] of broken) console.log(`  ${r.status} x${r.count}  ${u.slice(0, 80)}  ids:${r.sampleIds}`); }
const statusDist = {};
for (const [, r] of Object.entries(results)) statusDist[r.status] = (statusDist[r.status] || 0) + 1;
console.log('status分布:', JSON.stringify(statusDist));
