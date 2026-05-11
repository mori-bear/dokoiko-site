/**
 * generateRedirects.js
 * /destinations/{id}.html → /destinations/{id}/ のリダイレクトHTMLを生成
 * Search Consoleで検出された404 (.html旧URL) 対策
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEST_FILE = path.join(__dirname, '../src/data/destinations.json');
const DIST_DIR  = path.join(__dirname, '../dist/destinations');

const destinations = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));

function buildRedirectHtml(targetUrl) {
  const fullUrl = `https://tabidokoiko.com${targetUrl}`;
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta http-equiv="refresh" content="0;url=${targetUrl}">
<link rel="canonical" href="${fullUrl}">
<title>移動中... | どこ行こ？</title>
<meta name="robots" content="noindex">
</head>
<body>
<p>このページは移動しました。<a href="${targetUrl}">こちらへ</a></p>
<script>location.replace("${targetUrl}");</script>
</body>
</html>
`;
}

let written = 0;
let skipped = 0;

// 1. 現在の全destination idに対して .html リダイレクトを生成
for (const d of destinations) {
  const targetUrl = `/destinations/${d.id}/`;
  const htmlPath = path.join(DIST_DIR, `${d.id}.html`);
  // 既にあるディレクトリと衝突しない（同じ名前のディレクトリと共存可能）
  if (fs.existsSync(htmlPath)) {
    skipped++;
    continue;
  }
  fs.writeFileSync(htmlPath, buildRedirectHtml(targetUrl));
  written++;
}

// 2. 旧スラッグ → 新スラッグの既知マッピング（手動で追加）
//    Search Console で検出された具体的URLが判明したら追加
const KNOWN_SLUG_REDIRECTS = {
  // 例: 'old-slug': 'new-slug',
  // 'kozushima':       'kouzushima',
  // 'goto-islands':    'goto',
  // 'iki':             'iki-island',
  // 'ejima':           'ie-island',
  // 'shishijima':      'shijishima',
  // 'mihogaseki':      'mihonoseki',
  // 'kakeromajima':    'kakeroma-island',
  // 'tobushima':       'tobishima-island',
  // 'awashima':        'awashima-island',
  // 'oshima-ehime':    'omishima-island',
  // 'ibuki-island':    'ibukijima',
  // 'motoshima':       'honjima',
  // 'sensui-island':   'sensui-jima',
  // 'manabe-island':   'manabeshima',
};

for (const [oldSlug, newSlug] of Object.entries(KNOWN_SLUG_REDIRECTS)) {
  const targetUrl = `/destinations/${newSlug}/`;
  // 旧スラッグ.html
  const htmlPath = path.join(DIST_DIR, `${oldSlug}.html`);
  if (!fs.existsSync(htmlPath)) {
    fs.writeFileSync(htmlPath, buildRedirectHtml(targetUrl));
    written++;
  }
  // 旧スラッグ/index.html (ディレクトリ形式)
  const dirPath = path.join(DIST_DIR, oldSlug);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    fs.writeFileSync(path.join(dirPath, 'index.html'), buildRedirectHtml(targetUrl));
    written++;
  }
}

console.log(`✅ リダイレクトHTML生成完了`);
console.log(`   生成: ${written} ファイル`);
console.log(`   スキップ(既存): ${skipped} ファイル`);
console.log(`   destinations.json: ${destinations.length} 件`);
