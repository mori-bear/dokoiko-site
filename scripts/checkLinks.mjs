/**
 * checkLinks.mjs
 * 全destinationのリンクを機械検証する（API課金なし）。
 *   A. 形式検証（全1211件）:
 *      - hotelLinks.rakuten … 楽天アフィリ形式 or travel.rakuten.co.jp（テンプレでラップ可能）
 *      - hotelLinks.jalan   … jalan.net ドメイン
 *      - staySearchUrl      … 楽天アフィリ形式
 *   B. 生存確認（ユニークURLへ重複排除して HTTP チェック・500msウェイト）:
 *      - アフィリラッパーは pc= の実ターゲットURLを検証（ラッパー自体は常に200のため）
 *      - JR予約/レンタカーの固定URL群
 *
 * 使い方: node scripts/checkLinks.mjs <出力レポート>
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEST_FILE = path.join(__dirname, '../src/data/destinations.json');
const OUT = process.argv[2] || path.join(__dirname, '../.link-check-report.json');
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; DokoIkoLinkCheck/1.0; tabidokoiko.com)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const destinations = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));

// ---- A. 形式検証 ------------------------------------------------------
const formatNG = [];
const targets = new Map();   // 生存確認するユニークURL → 参照元ID一覧

function extractTarget(url) {
  // アフィリラッパーから実URLを取り出す
  if (url.startsWith('https://hb.afl.rakuten.co.jp/')) {
    const m = url.match(/[?&]pc=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }
  return url;
}

for (const d of destinations) {
  const hl = d.hotelLinks || {};
  // rakuten
  if (!hl.rakuten) {
    formatNG.push({ id: d.id, field: 'hotelLinks.rakuten', issue: '未設定' });
  } else if (!/^https:\/\/(hb\.afl\.rakuten\.co\.jp|travel\.rakuten\.co\.jp)\//.test(hl.rakuten)) {
    formatNG.push({ id: d.id, field: 'hotelLinks.rakuten', issue: '想定外ドメイン', url: hl.rakuten.slice(0, 120) });
  } else {
    const t = extractTarget(hl.rakuten);
    if (t) targets.set(t, [...(targets.get(t) || []), d.id]);
  }
  // jalan
  if (!hl.jalan) {
    formatNG.push({ id: d.id, field: 'hotelLinks.jalan', issue: '未設定' });
  } else if (!hl.jalan.includes('jalan.net')) {
    formatNG.push({ id: d.id, field: 'hotelLinks.jalan', issue: '想定外ドメイン', url: hl.jalan.slice(0, 120) });
  } else {
    targets.set(hl.jalan, [...(targets.get(hl.jalan) || []), d.id]);
  }
  // staySearchUrl（任意フィールド）
  if (d.staySearchUrl && !d.staySearchUrl.startsWith('https://hb.afl.rakuten.co.jp/')) {
    formatNG.push({ id: d.id, field: 'staySearchUrl', issue: 'アフィリ形式でない', url: d.staySearchUrl.slice(0, 120) });
  }
}

// JR予約・レンタカーの固定URL
const FIXED = [
  'https://www.eki-net.com/personal/wb/menu/00100.aspx',
  'https://www.jr-odekake.net/goyoyaku/e5489/',
  'https://smart-ex.jp/',
  'https://train.yoyaku.jrkyushu.co.jp/',
  'https://www.jr.cyber-station.ne.jp/',
  'https://travel.rakuten.co.jp/cars/',
];
for (const u of FIXED) targets.set(u, [...(targets.get(u) || []), '(fixed)']);

console.log(`形式NG: ${formatNG.length} 件`);
console.log(`生存確認対象（ユニーク）: ${targets.size} URL`);

// ---- B. 生存確認 ------------------------------------------------------
async function checkUrl(url) {
  try {
    // HEADが拒否されるサイトがあるためGET（bodyは読み捨て）
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(url, { headers: UA, redirect: 'follow', signal: ctrl.signal });
    clearTimeout(timer);
    return { status: res.status, ok: res.status < 400 };
  } catch (e) {
    return { status: 0, ok: false, error: String(e.message || e).slice(0, 80) };
  }
}

const alive = [];
const dead = [];
let i = 0;
for (const [url, refs] of targets) {
  i++;
  if (i % 25 === 0) console.log(`  ${i}/${targets.size}...`);
  const r = await checkUrl(url);
  if (r.ok) alive.push({ url, status: r.status });
  else dead.push({ url: url.slice(0, 160), status: r.status, error: r.error, refCount: refs.length, refs: refs.slice(0, 5) });
  await sleep(500);
}

const report = {
  generatedAt: new Date().toISOString(),
  destinations: destinations.length,
  formatNGCount: formatNG.length,
  uniqueUrlCount: targets.size,
  deadCount: dead.length,
  formatNG, dead,
};
fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
console.log(`✅ リンク検証完了: 形式NG=${formatNG.length} / 死活NG=${dead.length}/${targets.size}`);
console.log(`   レポート: ${OUT}`);
