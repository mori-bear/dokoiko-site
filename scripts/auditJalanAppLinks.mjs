// じゃらんリンクの「安全形式許可リスト」監査
// AASA照合だけでは不十分(県トップ/140000/が301で/ikisaki/map/=UL対象に着地し
// アプリが起動する・実機確認済み)。そのため全リダイレクトホップの安全を実測確認
// できた形式のみ許可し、それ以外のjalan URLを検出する。
// 許可リスト(iPhone UAで全ホップUL対象外を実測・checkJalanRedirects.mjs):
//   /uw/uwp2011/uww2011init.do (キーワード検索)・/activity/・/rentacar/*
// 使い方:
//   node scripts/auditJalanAppLinks.mjs           # src/data を監査(参考: データ内の生URL)
//   node scripts/auditJalanAppLinks.mjs --dist    # distのHTML(タップ面)を監査。許可リスト外が1件でもあればexit 1
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

export function isJalanSafeUrl(rawUrl) {
  let u;
  try { u = new URL(rawUrl); } catch { return false; }
  if (!/(^|\.)jalan\.net$/.test(u.hostname)) return true; // jalan以外は対象外
  const p = u.pathname;
  return p === '/uw/uwp2011/uww2011init.do' || p === '/activity/' || p === '/rentacar/' || p.startsWith('/rentacar/');
}

// 旧AASAパターン判定(参考用・checkJalanRedirects.mjsが利用)
export function isJalanAppLink(rawUrl) {
  let u;
  try { u = new URL(rawUrl); } catch { return false; }
  if (!/(^|\.)jalan\.net$/.test(u.hostname)) return false;
  const p = u.pathname;
  if (p === '/' && u.searchParams.get('isDeepLink') === '1') return true;
  if (/^\/yad\d{6}\/(plan\/)?$/.test(p)) return true;
  if (p === '/uw/uwp3200/uww3201init.do') return true;
  if (p === '/theme/') return true;
  if (/^\/.{6}\/LRG_.{6}\/(SML_.{6}\/)?$/.test(p)) return true;
  if (/^\/.{6}\/STA_(?!9).{6}\/$/.test(p)) return true;
  if (/^\/onsen\/(LRG_.{6}|OSN_\d{5})\.html$/.test(p)) return true;
  if (/^\/ikisaki\/map\/.{3,9}\/$/.test(p)) return true;
  return false;
}

function collectUrls(value, ctx, out) {
  if (typeof value === 'string') {
    for (const m of value.matchAll(/https?:\/\/(?:www\.)?jalan\.net[^\s"'<>\\)]*/g)) out.push({ url: m[0], ctx });
    for (const m of value.matchAll(/vc_url=([^&\s"'<>]+)/g)) {
      try {
        const inner = decodeURIComponent(m[1]);
        if (inner.includes('jalan.net')) out.push({ url: inner, ctx: ctx + ' (vc_url内)' });
      } catch { /* noop */ }
    }
  } else if (Array.isArray(value)) value.forEach((v) => collectUrls(v, ctx, out));
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) collectUrls(v, `${ctx}.${k}`, out);
}

function main() {
  const mode = process.argv[2];
  const found = [];
  if (mode === '--dist') {
    // タップ面 = レンダリング済みHTMLのみ。data/*.jsonの生URLはリンク描画されない。
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const fp = path.join(dir, e.name);
        if (e.isDirectory()) walk(fp);
        else if (/\.html$/.test(e.name)) {
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
  for (const f of found) {
    if (!isJalanSafeUrl(f.url) && !seen.has(f.url)) { seen.add(f.url); risky.push(f); }
  }
  console.log(`jalan URL総数(重複込): ${found.length}`);
  console.log(`許可リスト外のユニークURL: ${risky.length}`);
  for (const r of risky.slice(0, 30)) console.log(`  [${r.ctx}] ${r.url.slice(0, 100)}`);
  if (risky.length > 30) console.log(`  ... 他${risky.length - 30}件`);
  process.exitCode = risky.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
