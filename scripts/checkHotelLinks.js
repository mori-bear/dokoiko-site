import fs from 'fs';
import https from 'https';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const destinations = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../dist/data/destinations.json'), 'utf8')
);

const CONCURRENCY = 50;
const TIMEOUT_MS  = 12000;
const OUT_CSV     = '/tmp/hotel_links_issues.csv';

// ── URLデコードヘルパー ──────────────────────────────────────────
function extractRakutenInner(raw) {
  if (!raw) return '';
  const d1 = decodeURIComponent(raw);
  for (const p of ['?pc=', '&pc=']) {
    const idx = d1.indexOf(p);
    if (idx !== -1) {
      const inner = d1.slice(idx + p.length).split('&')[0];
      return decodeURIComponent(inner);
    }
  }
  return raw;
}

function extractJalanInner(raw) {
  if (!raw) return '';
  // 1回 decodeURIComponent してvc_url=の中身を取り出す
  let d1;
  try { d1 = decodeURIComponent(raw); } catch { d1 = raw; }
  const idx = d1.indexOf('vc_url=');
  if (idx === -1) return raw;
  // vc_url= の値（まだ1重エンコード状態）
  const encoded = d1.slice(idx + 7).split('&')[0];
  // ASCII構造文字（:/?=&#）のみデコードし、Shift-JIS系バイト(%8x %9x %Cx %Dx %Ex %Fx)はそのまま残す
  return encoded.replace(/%([0-9A-Fa-f]{2})/g, (m, hex) => {
    const code = parseInt(hex, 16);
    // 0x20-0x7E = 印字可能ASCII → デコードしてよい構造文字
    if (code >= 0x20 && code <= 0x7E) return String.fromCharCode(code);
    // それ以外（Shift-JIS系）はそのまま
    return m;
  });
}

// ── HTTP GETヘルパー（リダイレクト追跡・最大3ホップ） ───────────
async function head(url, hops = 0) {
  if (hops > 3) return { status: 0, finalUrl: url, note: 'too many redirects' };
  return new Promise(resolve => {
    let done = false;
    const finish = v => { if (!done) { done = true; resolve(v); } };

    let parsed;
    try { parsed = new URL(url); } catch { return finish({ status: 0, finalUrl: url, note: 'invalid URL' }); }

    const client = parsed.protocol === 'https:' ? https : http;
    const opts = {
      method: 'HEAD',
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DokoikoChecker/1.0)',
        'Accept': 'text/html',
      },
      timeout: TIMEOUT_MS,
    };

    const req = client.request(opts, res => {
      const { statusCode, headers } = res;
      res.resume();

      if ([301, 302, 303, 307, 308].includes(statusCode) && headers.location) {
        let loc = headers.location;
        if (!loc.startsWith('http')) {
          loc = `${parsed.protocol}//${parsed.host}${loc.startsWith('/') ? '' : '/'}${loc}`;
        }
        resolve(head(loc, hops + 1).then(r => ({
          ...r,
          redirectChain: (r.redirectChain || []).concat(url),
        })));
        return;
      }
      finish({ status: statusCode, finalUrl: url });
    });

    req.on('error', e => finish({ status: 0, finalUrl: url, note: e.message }));
    req.on('timeout', () => { req.destroy(); finish({ status: -1, finalUrl: url, note: 'timeout' }); });
    req.end();
  });
}

// ── 1件チェック ──────────────────────────────────────────────────
async function checkOne(dest) {
  const hl = dest.hotelLinks || {};
  const rakutenInner = extractRakutenInner(hl.rakuten || '');
  const jalanInner   = extractJalanInner(hl.jalan || '');

  const [rRes, jRes] = await Promise.all([
    rakutenInner ? head(rakutenInner) : Promise.resolve({ status: -2, finalUrl: '', note: 'no URL' }),
    jalanInner   ? head(jalanInner)   : Promise.resolve({ status: -2, finalUrl: '', note: 'no URL' }),
  ]);

  return {
    id:   dest.id,
    name: dest.name,
    region: dest.region || '',
    prefecture: dest.prefecture || '',
    rakutenInner,
    jalanInner,
    rStatus:   rRes.status,
    rFinalUrl: rRes.finalUrl,
    rNote:     rRes.note || '',
    rRedirect: rRes.redirectChain ? rRes.redirectChain.length : 0,
    jStatus:   jRes.status,
    jFinalUrl: jRes.finalUrl,
    jNote:     jRes.note || '',
    jRedirect: jRes.redirectChain ? jRes.redirectChain.length : 0,
  };
}

// ── 並列バッチ実行 ────────────────────────────────────────────────
async function runBatch(items, fn, concurrency) {
  const results = [];
  let i = 0;
  const total = items.length;

  async function worker() {
    while (i < total) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
      if (idx % concurrency === 0 || idx === total - 1) {
        const pct = Math.round((idx + 1) / total * 100);
        process.stdout.write(`\r  進捗: ${idx + 1}/${total} (${pct}%)`);
      }
    }
  }

  const workers = Array.from({ length: concurrency }, worker);
  await Promise.all(workers);
  process.stdout.write('\n');
  return results;
}

// ── メイン ────────────────────────────────────────────────────────
console.log(`対象: ${destinations.length}件 / 並列: ${CONCURRENCY} / タイムアウト: ${TIMEOUT_MS}ms`);
console.log('チェック開始...\n');

const startTime = Date.now();
const allResults = await runBatch(destinations, checkOne, CONCURRENCY);
const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

// ── 集計 ─────────────────────────────────────────────────────────
const issues = allResults.filter(r =>
  r.rStatus !== 200 || r.jStatus !== 200
);

const byCategory = {
  rakuten404:    allResults.filter(r => r.rStatus === 404),
  rakutenError:  allResults.filter(r => r.rStatus <= 0),
  rakutenOther:  allResults.filter(r => r.rStatus !== 200 && r.rStatus !== 404 && r.rStatus > 0),
  jalan404:      allResults.filter(r => r.jStatus === 404),
  jalanError:    allResults.filter(r => r.jStatus <= 0),
  jalanOther:    allResults.filter(r => r.jStatus !== 200 && r.jStatus !== 404 && r.jStatus > 0),
};

// ── CSV出力 ───────────────────────────────────────────────────────
const csvHeader = 'id,name,region,rakuten_status,jalan_status,rakuten_url,jalan_url,rakuten_note,jalan_note';
const csvRows = issues.map(r => [
  r.id, r.name, r.region,
  r.rStatus, r.jStatus,
  `"${r.rakutenInner.replace(/"/g,'""')}"`,
  `"${r.jalanInner.replace(/"/g,'""')}"`,
  r.rNote, r.jNote,
].join(','));

fs.writeFileSync(OUT_CSV, [csvHeader, ...csvRows].join('\n') + '\n', 'utf8');

// ── レポート ─────────────────────────────────────────────────────
console.log(`\n===== チェック完了 (${elapsed}秒) =====`);
console.log(`\n【楽天】`);
console.log(`  200 OK:  ${allResults.filter(r => r.rStatus === 200).length}件`);
console.log(`  404:     ${byCategory.rakuten404.length}件`);
console.log(`  タイムアウト/エラー: ${byCategory.rakutenError.length}件`);
console.log(`  その他(3xx等): ${byCategory.rakutenOther.length}件`);

console.log(`\n【じゃらん】`);
console.log(`  200 OK:  ${allResults.filter(r => r.jStatus === 200).length}件`);
console.log(`  404:     ${byCategory.jalan404.length}件`);
console.log(`  タイムアウト/エラー: ${byCategory.jalanError.length}件`);
console.log(`  その他(3xx等): ${byCategory.jalanOther.length}件`);

console.log(`\n問題件数合計: ${issues.length}件`);
console.log(`CSV出力: ${OUT_CSV}`);

// ── 代表的な問題URL ───────────────────────────────────────────────
if (byCategory.rakuten404.length > 0) {
  console.log(`\n--- 楽天404 サンプル ---`);
  byCategory.rakuten404.slice(0, 10).forEach(r =>
    console.log(`  [${r.id}] ${r.name}  →  ${r.rakutenInner}`)
  );
}
if (byCategory.jalan404.length > 0) {
  console.log(`\n--- じゃらん404 サンプル ---`);
  byCategory.jalan404.slice(0, 10).forEach(r =>
    console.log(`  [${r.id}] ${r.name}  →  ${r.jalanInner}`)
  );
}
if (byCategory.rakutenError.length > 0) {
  console.log(`\n--- 楽天 エラー/タイムアウト サンプル ---`);
  byCategory.rakutenError.slice(0, 5).forEach(r =>
    console.log(`  [${r.id}] ${r.name}  status=${r.rStatus} ${r.rNote}`)
  );
}
if (byCategory.jalanError.length > 0) {
  console.log(`\n--- じゃらん エラー/タイムアウト サンプル ---`);
  byCategory.jalanError.slice(0, 5).forEach(r =>
    console.log(`  [${r.id}] ${r.name}  status=${r.jStatus} ${r.jNote}`)
  );
}
if (byCategory.rakutenOther.length > 0) {
  console.log(`\n--- 楽天 その他ステータス ---`);
  byCategory.rakutenOther.slice(0, 10).forEach(r =>
    console.log(`  [${r.id}] ${r.name}  status=${r.rStatus}  →  ${r.rFinalUrl}`)
  );
}
if (byCategory.jalanOther.length > 0) {
  console.log(`\n--- じゃらん その他ステータス サンプル（先頭10件）---`);
  byCategory.jalanOther.slice(0, 10).forEach(r =>
    console.log(`  [${r.id}] ${r.name}  status=${r.jStatus}  final=${r.jFinalUrl}`)
  );
}
