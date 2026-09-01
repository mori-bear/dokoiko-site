#!/usr/bin/env node
/** captureCreditRender.mjs — クレジット表示の見た目を実寸(390x844)で確かめる。 */
import { chromium } from 'playwright';
import fs from 'fs';
import http from 'http';
import path from 'path';

const PORT = 4331;
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join('dist', p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  const ext = path.extname(f);
  res.writeHead(200, { 'Content-Type': ext === '.html' ? 'text/html' : ext === '.css' ? 'text/css' : 'application/octet-stream' });
  res.end(fs.readFileSync(f));
});
await new Promise((r) => server.listen(PORT, r));

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
fs.mkdirSync('logs/shots', { recursive: true });
for (const id of ['kurokawa-k', 'akakura-onsen', 'aka-island']) {
  await page.goto(`http://localhost:${PORT}/destinations/${id}/`, { waitUntil: 'networkidle' });
  const fig = page.locator('figure.spot-figure').first();
  if (await fig.count()) {
    await fig.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `logs/shots/credit_${id}.png` });
  }
  const rows = await page.evaluate(() => [...document.querySelectorAll('.spot-section')].map((s) => ({
    title: s.querySelector('.spot-title')?.textContent?.trim().slice(0, 30) ?? '',
    img: !!s.querySelector('.spot-thumb'),
    credit: s.querySelector('.spot-credit')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
  })));
  console.log(`■ ${id}`);
  for (const r of rows) console.log(`   img=${r.img ? '有' : '無'} ${r.title.padEnd(32)} ${r.credit}`);
}
await b.close(); server.close();
