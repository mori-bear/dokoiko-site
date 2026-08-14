// 移動手段タブ（電車・バス / 車）の表示確認用スクリーンショット。
// 事前に `npm run build` を実行し、dist を静的サーバで配信してから実行する。
// 使い方: node scripts/shotTransportTabs.mjs
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const outDir = path.join(root, 'logs', 'shots-transport');
fs.mkdirSync(outDir, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.xml': 'application/xml',
};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  let file = path.join(dist, p);
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

const PORT = 4321;
const TARGETS = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['abashiri', 'nakijin', 'hakone', 'enoshima'];
const DEPARTURE = '東京';

await new Promise(r => server.listen(PORT, r));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

for (const id of TARGETS) {
  const url = `http://127.0.0.1:${PORT}/destinations/${id}/`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  const section = page.locator('#access');
  if (!(await section.count())) { console.log(`${id}: #access なし — skip`); continue; }

  // 出発地を選ぶ（ルート検索リンクを出す）
  const select = page.locator('#departure-select');
  if (await select.count()) await select.selectOption(DEPARTURE);
  await page.waitForTimeout(300);

  await section.screenshot({ path: path.join(outDir, `${id}-1-transit.png`) });

  const carLabel = page.locator('.transport-tab-label-car');
  if (!(await carLabel.count())) { console.log(`${id}: 車タブなし（テスト対象外）`); continue; }
  await carLabel.click();
  await page.waitForTimeout(300);
  await section.screenshot({ path: path.join(outDir, `${id}-2-car.png`) });

  // 表示状態の自己検査
  const state = await page.evaluate(() => {
    const vis = (el) => !!(el && el.offsetParent !== null);
    const q = (s) => document.querySelector(s);
    const selected = q('.travel-time-block.selected');
    return {
      driveBtn: vis(selected?.querySelector('.mode-car-btn')),
      carLabelSpan: vis(selected?.querySelector('.travel-time-row .mode-car-only')),
      transitBtnsVisible: [...(selected?.querySelectorAll('.mode-transit-only') || [])].filter(vis).length,
      accessSteps: vis(q('.access-steps')),
      carPane: vis(q('.car-pane')),
      rentacar: vis(q('.car-rentacar')),
      parkingItems: document.querySelectorAll('.car-parking-item').length,
      parkingEmpty: !!q('.car-parking-empty'),
      // 車ペインがルート検索リンクより下にあるか（=ルート検索が最上部）
      routeAboveCarPane: (q('.travel-time-block.selected .mode-car-btn')?.getBoundingClientRect().top ?? 1e9)
        < (q('.car-pane')?.getBoundingClientRect().top ?? -1),
    };
  });
  console.log(`${id} [車]`, JSON.stringify(state));

  // 電車・バスへ戻して現行UIが復帰するか
  await page.locator('.transport-tab-label-transit').click();
  await page.waitForTimeout(200);
  const back = await page.evaluate(() => {
    const vis = (el) => !!(el && el.offsetParent !== null);
    const selected = document.querySelector('.travel-time-block.selected');
    return {
      transitBtnsVisible: [...(selected?.querySelectorAll('.mode-transit-only') || [])].filter(vis).length,
      driveBtn: vis(selected?.querySelector('.mode-car-btn')),
      carLabelSpan: vis(selected?.querySelector('.travel-time-row .mode-car-only')),
      accessSteps: vis(document.querySelector('.access-steps')),
      carPane: vis(document.querySelector('.car-pane')),
    };
  });
  console.log(`${id} [電車]`, JSON.stringify(back));
}

await browser.close();
server.close();
console.log('shots →', outDir);
