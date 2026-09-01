#!/usr/bin/env node
/**
 * measureAirNoteWrap.mjs — .air-note（沖縄発着で出る飛行機の案内）の改行も
 * 同じ観点で実測する。midori と同時に直したので、こちらも孤立行が無いか確かめる。
 * air-note は skyscannerUrl が作れないときだけ出るので、DOMに無ければ
 * midori-note を air-note の文言に差し替えて同条件で測る。
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(process.cwd(), 'dist');
const PORT = 4407;
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); res.end('404'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(PORT, r));

const WIDTHS = [320, 360, 375, 390, 414, 430];
const TEXT = '✈️ 飛行機でのアクセスがおすすめ';
const browser = await chromium.launch();
let bad = 0;

for (const w of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 2, isMobile: true, locale: 'ja-JP' });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/destinations/horoka/`, { waitUntil: 'domcontentloaded' });
  await page.selectOption('#departure-select', '大阪').catch(() => {});
  await page.waitForTimeout(200);
  const res = await page.evaluate((text) => {
    // midori-note を air-note のスタイル・文言に付け替えて同条件で測る
    const el = document.querySelector('.travel-time-block[data-city="大阪"] .midori-note');
    if (!el) return null;
    el.className = 'air-note';
    el.textContent = text;
    const node = [...el.childNodes].find((n) => n.nodeType === 3);
    const t = node.textContent;
    const r = document.createRange();
    const lines = []; let top = null, cur = '';
    for (let i = 0; i < t.length; i++) {
      r.setStart(node, i); r.setEnd(node, i + 1);
      const b = r.getBoundingClientRect();
      if (b.width === 0 && b.height === 0) { cur += t[i]; continue; }
      if (top === null || Math.abs(b.top - top) < 2) { top = top ?? b.top; cur += t[i]; }
      else { lines.push(cur); cur = t[i]; top = b.top; }
    }
    if (cur) lines.push(cur);
    return lines;
  }, TEXT);
  await ctx.close();
  if (!res) { console.log(`  ${w}px 取得不可`); continue; }
  const last = res[res.length - 1].trim();
  const lonely = res.length > 1 && last.length <= 2;
  if (lonely) bad++;
  console.log(`  ${String(w).padStart(4)}px  ${res.length}行  最終行「${last}」(${last.length}字) ${lonely ? '❌ 孤立' : '✅'}`);
  console.log(`         ${res.map((l) => '［' + l.trim() + '］').join('')}`);
}
console.log(bad ? `\n孤立行 ${bad}件` : '\n✅ air-note も孤立行なし');
await browser.close();
server.close();
