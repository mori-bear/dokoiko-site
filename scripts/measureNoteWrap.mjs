#!/usr/bin/env node
/**
 * measureNoteWrap.mjs — 案内テキスト(.midori-note / .air-note)の改行位置を
 * 複数の画面幅で実測する。行数と「最終行に何文字残るか」を出す。
 *
 * 1文字だけ next line に落ちる（孤立行）のが見た目の問題なので、
 * 目視ではなく Range の矩形から行を割り出して数える。
 *
 * usage: node scripts/measureNoteWrap.mjs [比較したい文言...]
 *   引数を渡すと、実ページの文言を差し替えて同じ計測を行う（DOM上だけの試着）。
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(process.cwd(), 'dist');
const PORT = 4406;
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); res.end('404'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(PORT, r));

const WIDTHS = [320, 360, 375, 390, 414, 430, 480, 600, 768];
const CANDIDATES = process.argv.slice(2);

const browser = await chromium.launch();

// 1行ごとの文字列を Range の矩形から復元する
const LINES_FN = `({ sel, replacement }) => {
  const el = document.querySelector(sel);
  if (!el) return null;
  if (replacement !== null) el.textContent = replacement;
  const node = [...el.childNodes].find(n => n.nodeType === 3);
  if (!node) return null;
  const text = node.textContent;
  const r = document.createRange();
  const lines = [];
  let curTop = null, cur = '';
  for (let i = 0; i < text.length; i++) {
    r.setStart(node, i); r.setEnd(node, i + 1);
    const rect = r.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) { cur += text[i]; continue; }
    if (curTop === null || Math.abs(rect.top - curTop) < 2) { curTop = curTop ?? rect.top; cur += text[i]; }
    else { lines.push(cur); cur = text[i]; curTop = rect.top; }
  }
  if (cur) lines.push(cur);
  return { lines, boxWidth: Math.round(el.getBoundingClientRect().width) };
}`;

async function measure(label, replacement) {
  console.log(`\n■ ${label}`);
  let worst = 0;
  for (const w of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 2, isMobile: w < 600, locale: 'ja-JP' });
    const page = await ctx.newPage();
    await page.goto(`http://localhost:${PORT}/destinations/horoka/`, { waitUntil: 'domcontentloaded' });
    await page.selectOption('#departure-select', '大阪').catch(() => {});
    await page.waitForTimeout(200);
    const res = await page.evaluate(new Function('return ' + LINES_FN)(), { sel: '.travel-time-block[data-city="大阪"] .midori-note', replacement });
    await ctx.close();
    if (!res) { console.log(`  ${String(w).padStart(4)}px  取得不可`); continue; }
    const last = res.lines[res.lines.length - 1].trim();
    const lonely = res.lines.length > 1 && last.length <= 2;
    if (lonely) worst++;
    console.log(`  ${String(w).padStart(4)}px  幅${String(res.boxWidth).padStart(3)}  ${res.lines.length}行  最終行「${last}」(${last.length}字) ${lonely ? '❌ 孤立' : '✅'}`);
    console.log(`         ${res.lines.map((l) => '［' + l.trim() + '］').join('')}`);
  }
  console.log(`  → 孤立行が出た幅: ${worst}/${WIDTHS.length}`);
  return worst;
}

await measure('現状の文言', null);
for (const c of CANDIDATES) await measure(`候補: ${c}`, c);

await browser.close();
server.close();
