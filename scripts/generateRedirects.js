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

// 2. 旧スラッグ → 新スラッグの既知マッピング
//    旧スラッグが現在のidと一致しないケースのみ追加。
//
//    【照合済み】
//    Search Console 404リスト173件（abashiri, furano, ashikaga, ... taketomi-island 等）
//      → 全て現在のdestinations.jsonの id と完全一致 → Step 1 で自動カバー済み
//    gen_系404リスト24件（gen_青森_馬門温泉, gen_北海_登別温泉, gen_北海_永山神社 等）
//      → 全て現在のdestinations.jsonの id と完全一致 → Step 1 で自動カバー済み
//      （destinations.json には gen_ 系IDが519件残存している）
//
//    ここには id が変更された/削除された場合のみ追加する。
const KNOWN_SLUG_REDIRECTS = {
  // 例: 'old-slug': 'new-slug',
  // 'kozushima':       'kouzushima',
  // 'goto-islands':    'goto',
};

// 3. 完全に削除されたページ（リダイレクト先なし）→ トップページへ
//    削除済みdestinationのslugは src/data/deletedIds.json から自動取り込み。
//    Search Console で個別URLが判明した場合はここに追記。
const DELETED_IDS_FILE = path.join(__dirname, '../src/data/deletedIds.json');
let deletedIds = [];
if (fs.existsSync(DELETED_IDS_FILE)) {
  try { deletedIds = JSON.parse(fs.readFileSync(DELETED_IDS_FILE, 'utf-8')); } catch {}
}
const DEAD_TO_HOMEPAGE = [
  ...deletedIds,
  // 'old-removed-slug',
];

for (const oldSlug of DEAD_TO_HOMEPAGE) {
  const targetUrl = '/';
  const htmlPath = path.join(DIST_DIR, `${oldSlug}.html`);
  if (!fs.existsSync(htmlPath)) {
    fs.writeFileSync(htmlPath, buildRedirectHtml(targetUrl));
    written++;
  }
  const dirPath = path.join(DIST_DIR, oldSlug);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    fs.writeFileSync(path.join(dirPath, 'index.html'), buildRedirectHtml(targetUrl));
    written++;
  }
}

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
