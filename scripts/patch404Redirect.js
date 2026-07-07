/**
 * patch404Redirect.js
 * 配信repo (../dokoiko) の 404.html に、旧URL /destinations/{id}.html →
 * /destinations/{id}/ へのJSリダイレクトを挿入する（404.astro と同一ロジック）。
 * 次回フルビルド時は 404.astro から自動生成されるため、これは緊急パッチ用。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, '../../dokoiko/404.html');

const SCRIPT =
  '<script>(function(){var m=location.pathname.match(/^\\/destinations\\/(.+)\\.html$/);' +
  "if(m)location.replace('/destinations/'+m[1]+'/');})();</script>";

let html = fs.readFileSync(FILE, 'utf-8');
if (html.includes('destinations\\/(.+)\\.html')) {
  console.log('既に挿入済み — スキップ');
} else {
  html = html.replace('</head>', SCRIPT + '</head>');
  fs.writeFileSync(FILE, html);
  console.log('✅ 404.html にリダイレクトスクリプトを挿入');
}
