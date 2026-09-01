#!/usr/bin/env node
/** measureHero.mjs — ヒーロー画像の実寸と、CSSが効いているかを実ブラウザで測る。 */
import { chromium } from 'playwright';
import fs from 'fs';
import http from 'http';
import path from 'path';
const PORT = 4339;
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
for (const id of process.argv.slice(2)) {
  await page.goto(`http://localhost:${PORT}/destinations/${encodeURIComponent(id)}/`, { waitUntil: 'networkidle' });
  const m = await page.evaluate(() => {
    const hero = document.querySelector('.dest-hero');
    const img = document.querySelector('.dest-hero-img');
    if (!hero || !img) return null;
    const hr = hero.getBoundingClientRect(), ir = img.getBoundingClientRect();
    const cs = getComputedStyle(hero), ci = getComputedStyle(img);
    return { heroH: Math.round(hr.height), heroW: Math.round(hr.width),
      maxH: cs.maxHeight, height: cs.height, overflow: cs.overflow,
      imgH: Math.round(ir.height), fit: ci.objectFit, pos: ci.objectPosition,
      nat: `${img.naturalWidth}x${img.naturalHeight}` };
  });
  console.log(`${id.padEnd(18)} ${JSON.stringify(m)}`);
}
await b.close(); server.close();
