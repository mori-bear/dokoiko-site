#!/usr/bin/env node
/**
 * verifyStaticPages.mjs — 固定4ページ（運営者情報/お問い合わせ/プライバシー/利用規約）を
 * 実機相当で開き、表示・内部リンク・フッターの導線を検査する。
 * あわせて、旧フッターが指していた404リンクが残っていないかも見る。
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(process.cwd(), 'dist');
const PORT = 4408;
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.xml': 'application/xml' };
const server = http.createServer((req, res) => {
  let f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); res.end('404'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(PORT, r));

const PAGES = [['/about/', '運営者情報'], ['/contact/', 'お問い合わせ'],
  ['/privacy/', 'プライバシーポリシー'], ['/terms/', '利用規約']];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, locale: 'ja-JP' });
const page = await ctx.newPage();
let ng = 0;

console.log('■ 固定ページの表示');
for (const [url, label] of PAGES) {
  const r = await page.goto(`http://localhost:${PORT}${url}`, { waitUntil: 'networkidle' });
  const info = await page.evaluate(() => ({
    title: document.title,
    h1: document.querySelector('h1')?.textContent?.trim() ?? null,
    desc: document.querySelector('meta[name="description"]')?.content?.length ?? 0,
    canonical: document.querySelector('link[rel=canonical]')?.href ?? null,
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    // 本文の内部リンク（相対パス）を集める
    links: [...document.querySelectorAll('main a[href^="/"]')].map((a) => a.getAttribute('href')),
    footerLinks: [...document.querySelectorAll('.site-footer a')].map((a) => a.getAttribute('href')),
    h2: document.querySelectorAll('main h2').length,
  }));
  const bad = !r.ok() || info.overflow || !info.h1 || info.desc < 40;
  if (bad) ng++;
  console.log(`  ${bad ? '❌' : '✅'} ${String(r.status())} ${url.padEnd(11)} 「${info.h1}」 見出し${info.h2}本 desc${info.desc}字 横スクロール${info.overflow ? 'あり' : 'なし'}`);
  // 内部リンクの到達性
  for (const href of new Set([...info.links, ...info.footerLinks])) {
    const rr = await fetch(`http://localhost:${PORT}${href}`);
    if (!rr.ok) { ng++; console.log(`     ❌ リンク切れ ${href} (${rr.status})`); }
  }
}

console.log('\n■ 旧404リンクの残存確認（全ページ共通フッター）');
await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
const oldLinks = await page.evaluate(() =>
  [...document.querySelectorAll('a')].map((a) => a.getAttribute('href') || '').filter((h) => h.includes('/pages/')));
if (oldLinks.length) { ng++; console.log(`  ❌ 旧リンクが残存: ${oldLinks.join(', ')}`); }
else console.log('  ✅ /pages/*.html への参照なし');

console.log('\n■ フッター導線（トップページ）');
const foot = await page.evaluate(() => [...document.querySelectorAll('.site-footer a')].map((a) => `${a.textContent.trim()}→${a.getAttribute('href')}`));
for (const f of foot) console.log(`  ${f}`);

console.log('\n■ サイトマップ');
const sm = await (await fetch(`http://localhost:${PORT}/sitemap.xml`)).text();
for (const p of ['/about/', '/contact/', '/privacy/', '/terms/']) {
  const has = sm.includes(`https://tabidokoiko.com${p}`);
  if (!has) ng++;
  console.log(`  ${has ? '✅' : '❌'} ${p}`);
}

await page.goto(`http://localhost:${PORT}/about/`, { waitUntil: 'networkidle' });
await page.screenshot({ path: 'logs/shots/page-about.png', fullPage: false });
await browser.close();
server.close();
console.log(ng ? `\nNG ${ng}件` : '\n✅ すべて正常');
process.exit(ng ? 1 : 0);
