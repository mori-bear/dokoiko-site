#!/usr/bin/env node
/**
 * auditStayLinks.mjs — featured_stay.name とリンク先ページの宿名を照合する（④専用）。
 *
 * 判定は最長共通部分文字列（4文字以上で一致とみなす）。
 *   「定山渓温泉 ぬくもりの宿ふる川」↔「ぬくもりの宿 ふる川」のような表記ゆれを
 *   一致と扱い、「大原温泉湯元 お宿 芹生」↔「SAN AWAJI」のような別宿だけを検出する。
 * じゃらんは連続アクセスでブロックするため間隔を空け、ブロック時はリトライする。
 *
 * 出力: logs/stay_link_audit.json
 */
import fs from 'fs';

const D = JSON.parse(fs.readFileSync('src/data/destinations.json', 'utf8'));
const UA = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', 'Accept-Language': 'ja' };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const norm = (s) => String(s || '').normalize('NFKC')
  .replace(/[\s　・･（）()「」【】〜~\-–—、,.。／\/]/g, '').toLowerCase();
const stripTitle = (t) => t
  .replace(/-?\s*宿泊予約は?[＜<].*$/,'').replace(/【楽天トラベル】.*$/, '')
  .replace(/の宿泊予約.*$/, '').trim();

function lcs(a, b) {
  if (!a || !b) return 0;
  let best = 0; const dp = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let prev = 0;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev + 1 : 0;
      if (dp[j] > best) best = dp[j];
      prev = tmp;
    }
  }
  return best;
}

async function fetchTitle(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const c = new AbortController(); const t = setTimeout(() => c.abort(), 15000);
      const r = await fetch(url, { headers: UA, redirect: 'follow', signal: c.signal });
      clearTimeout(t);
      const b = Buffer.from(await r.arrayBuffer());
      let h = b.toString('utf8');
      if (/�/.test(h.slice(0, 2000))) { try { h = new TextDecoder('shift_jis').decode(b); } catch {} }
      const ti = (h.match(/<title>([\s\S]*?)<\/title>/i) || [])[1]?.replace(/\s+/g, ' ').trim() || '';
      if (/アクセスしにくい|しばらく|混雑/.test(ti)) { await sleep(8000 * (i + 1)); continue; }  // 一時ブロック→待って再試行
      return { status: r.status, title: ti };
    } catch { await sleep(3000 * (i + 1)); }
  }
  return { status: 'BLOCKED', title: null };
}

const targets = D.filter(d => d.featured_stay?.jalanUrl || d.featured_stay?.rakutenUrl);
console.log(`featured_stay リンク照合: ${targets.length}件\n`);

const mismatch = [], broken = [], unknown = [];
let ok = 0, i = 0;
for (const d of targets) {
  const url = d.featured_stay.jalanUrl || d.featured_stay.rakutenUrl;
  const { status, title } = await fetchTitle(url);
  i++;
  if (i % 25 === 0) process.stderr.write(`  ${i}/${targets.length}（一致 ${ok} / 不一致 ${mismatch.length} / 切れ ${broken.length} / 不明 ${unknown.length}）\n`);

  if (title === null) { unknown.push({ id: d.id, name: d.name, stay: d.featured_stay.name, url, reason: 'ブロック等で取得不可' }); await sleep(1200); continue; }
  if (/エラー画面|ページが見つかり|not found/i.test(title)) {
    broken.push({ id: d.id, name: d.name, stay: d.featured_stay.name, url, title });
    await sleep(1200); continue;
  }
  const a = norm(d.featured_stay.name), b = norm(stripTitle(title));
  if (lcs(a, b) >= 4 || (b && (a.includes(b) || b.includes(a)))) ok++;
  else mismatch.push({ id: d.id, name: d.name, stay: d.featured_stay.name, url, title, lcs: lcs(a, b) });
  await sleep(1200);
}

console.log(`\n${'═'.repeat(66)}`);
console.log(`一致 ${ok} / 宿名不一致 ${mismatch.length} / リンク切れ ${broken.length} / 判定不能 ${unknown.length}`);
console.log(`${'═'.repeat(66)}`);
if (mismatch.length) {
  console.log('\n■ 宿名がリンク先と一致しない（要修正）');
  for (const m of mismatch) console.log(`  [${m.id}] ${m.name}\n      featured_stay.name「${m.stay}」\n      リンク先「${stripTitle(m.title)}」\n      ${m.url}`);
}
if (broken.length) {
  console.log('\n■ リンク切れ（じゃらんのエラー画面）');
  for (const b of broken) console.log(`  [${b.id}] ${b.name} — 「${b.stay}」 ${b.url}`);
}
if (unknown.length) {
  console.log(`\n■ 判定不能（アクセス制限）: ${unknown.length}件`);
  for (const u of unknown.slice(0, 10)) console.log(`  [${u.id}] ${u.name} — 「${u.stay}」`);
  if (unknown.length > 10) console.log(`  … ほか${unknown.length - 10}件`);
}
fs.mkdirSync('logs', { recursive: true });
fs.writeFileSync('logs/stay_link_audit.json', JSON.stringify({ ok, mismatch, broken, unknown }, null, 2));
console.log('\n出力: logs/stay_link_audit.json');
