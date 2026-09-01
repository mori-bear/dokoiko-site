#!/usr/bin/env node
/** shotHero.mjs — ヒーロー画像の見えている範囲だけを切り出して保存する。 */
import { chromium } from 'playwright';
import fs from 'fs';
import http from 'http';
import path from 'path';
const PORT = 4341;
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join('dist', p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  const ext = path.extname(f);
  res.writeHead(200, { 'Content-Type': ext === '.html' ? 'text/html' : ext === '.css' ? 'text/css' : ext === '.jpg' ? 'image/jpeg' : 'application/octet-stream' });
  res.end(fs.readFileSync(f));
});
await new Promise((r) => server.listen(PORT, r));
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
fs.mkdirSync('logs/shots', { recursive: true });
for (const id of process.argv.slice(2)) {
  await page.goto(`http://localhost:${PORT}/destinations/${encodeURIComponent(id)}/`, { waitUntil: 'networkidle' });
  const safe = id.replace(/[^\w-]/g, '_');
  await page.locator('.dest-hero').first().screenshot({ path: `logs/shots/hero_${safe}.png` });
  console.log(`logs/shots/hero_${safe}.png`);
}
await b.close(); server.close();
