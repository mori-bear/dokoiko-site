// じゃらんUniversal Link(アプリ起動)対象URLの全量監査
// jalan.netのAASA(apple-app-site-association)の適用パターンと、
// destinations.json内・ビルド出力内の全jalan URLを突き合わせる。
// 使い方:
//   node scripts/auditJalanAppLinks.mjs           # src/data を監査
//   node scripts/auditJalanAppLinks.mjs --dist    # dist のHTML全量を監査(ビルド後検証)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// AASA適用(include)パターン → アプリが起動するURL (2026-08-12取得のAASAに基づく)
export function isJalanAppLink(rawUrl) {
  let u;
  try { u = new URL(rawUrl); } catch { return false; }
  if (!/(^|\.)jalan\.net$/.test(u.hostname)) return false;
  const p = u.pathname;
  const q = u.searchParams;
  if (p === '/' && q.get('isDeepLink') === '1') return true;
  if (/^\/yad\d{6}\/$/.test(p)) return true;                    // 宿詳細
  if (/^\/yad\d{6}\/plan\/$/.test(p)) return true;              // 宿プラン一覧
  if (p === '/uw/uwp3200/uww3201init.do'                        // プラン予約
      && /^\d{6}$/.test(q.get('yadNo') || '')
      && /^\d{8}$/.test(q.get('planCd') || '')
      && q.get('roomTypeCd') && q.get('roomCrack')) return true;
  if (p === '/theme/') return true;
  if (/^\/.{6}\/LRG_.{6}\/$/.test(p)) return true;              // 地域(大)
  if (/^\/.{6}\/LRG_.{6}\/SML_.{6}\/$/.test(p)) return true;    // 地域(小)
  if (/^\/.{6}\/STA_(?!9).{6}\/$/.test(p)) return true;         // 駅(STA_9xxxxxは除外)
  if (/^\/onsen\/LRG_.{6}\.html$/.test(p)) return true;         // 温泉地域
  if (/^\/ikisaki\/map\/.{3,9}\/$/.test(p)) return true;        // 行き先マップ
  if (/^\/onsen\/OSN_\d{5}\.html$/.test(p)) return true;        // 温泉(個別excludeは無視=安全側)
  return false;
}

function collectUrls(value, ctx, out) {
  if (typeof value === 'string') {
    for (const m of value.matchAll(/https?:\/\/(?:www\.)?jalan\.net[^\s"'<>\\)]*/g)) out.push({ url: m[0], ctx });
    // VCラッパー内のvc_urlも展開して検査
    for (const m of value.matchAll(/vc_url=([^&\s"'<>]+)/g)) {
      try {
        const inner = decodeURIComponent(m[1]);
        if (inner.includes('jalan.net')) out.push({ url: inner, ctx: ctx + ' (vc_url内)' });
      } catch { /* noop */ }
    }
  } else if (Array.isArray(value)) value.forEach((v, i) => collectUrls(v, ctx, out));
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) collectUrls(v, `${ctx}.${k}`, out);
}

const mode = process.argv[2];
const found = [];
if (mode === '--dist') {
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const fp = path.join(dir, e.name);
      if (e.isDirectory()) walk(fp);
      else if (/\.(html|js|json)$/.test(e.name)) {
        const txt = fs.readFileSync(fp, 'utf8').replace(/&#38;|&amp;/g, '&');
        collectUrls(txt, path.relative(path.join(root, 'dist'), fp), found);
      }
    }
  };
  walk(path.join(root, 'dist'));
} else {
  const dests = JSON.parse(fs.readFileSync(path.join(root, 'src/data/destinations.json'), 'utf8'));
  for (const d of dests) collectUrls(d, d.id, found);
}

const risky = [];
const seen = new Set();
let total = 0;
for (const f of found) {
  total++;
  if (isJalanAppLink(f.url)) {
    const key = f.url;
    if (!seen.has(key)) { seen.add(key); risky.push(f); }
  }
}
console.log(`jalan URL総数(重複込): ${total}`);
console.log(`アプリ起動(UL)対象のユニークURL: ${risky.length}`);
for (const r of risky.slice(0, 30)) console.log(`  [${r.ctx}] ${r.url.slice(0, 100)}`);
if (risky.length > 30) console.log(`  ... 他${risky.length - 30}件`);
process.exitCode = risky.length ? 1 : 0;
