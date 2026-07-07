/**
 * cleanDeployStubShadowing.js
 * 配信repo (../dokoiko) の destinations/ から、現存する正規ページ
 * {id}/index.html を隠している {id}.html リダイレクトスタブを削除する。
 *
 * 背景: GitHub Pages は {id}.html と {id}/ が併存するとスラッシュなしURL
 * /destinations/{id} を {id}.html に解決する。generateRedirects.js の旧実装が
 * 全正規ページ分のスタブ（移動中...noindex）を生成していたため、全 destination の
 * スラッシュなしURLが noindex 200 を返す事故が発生した（2026-07-07 緊急修復）。
 *
 * 削除条件（安全のためAND）:
 *   - destinations/{id}.html が存在し「移動中」を含むスタブである
 *   - destinations/{id}/index.html が存在し「移動中」を含まない正規ページである
 * 削除済みID（dirもスタブ）のスタブ .html は温存する。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEPLOY_DEST = path.join(__dirname, '../../dokoiko/destinations');

let removed = 0;
let keptDeletedStub = 0;
let keptOther = 0;

for (const entry of fs.readdirSync(DEPLOY_DEST)) {
  if (!entry.endsWith('.html') || entry === 'index.html') continue;
  const htmlPath = path.join(DEPLOY_DEST, entry);
  const slug = entry.slice(0, -'.html'.length);
  const dirIndex = path.join(DEPLOY_DEST, slug, 'index.html');

  const html = fs.readFileSync(htmlPath, 'utf-8');
  const isStub = html.includes('移動中');
  const dirIsRealPage =
    fs.existsSync(dirIndex) && !fs.readFileSync(dirIndex, 'utf-8').includes('移動中');

  if (isStub && dirIsRealPage) {
    fs.unlinkSync(htmlPath);
    removed++;
  } else if (isStub) {
    keptDeletedStub++; // 削除済みID用（dirもスタブ or dirなし）
  } else {
    keptOther++;
    console.log(`  スタブでない .html を温存: ${entry}`);
  }
}

console.log(`✅ 配信repo掃除完了`);
console.log(`   削除（正規ページを隠すスタブ）: ${removed}`);
console.log(`   温存（削除済みID用スタブ）: ${keptDeletedStub}`);
console.log(`   温存（非スタブ）: ${keptOther}`);
