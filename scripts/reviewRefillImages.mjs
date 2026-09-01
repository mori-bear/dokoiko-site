#!/usr/bin/env node
/**
 * reviewRefillImages.mjs — 取得した main.jpg を目視確認用に並べる。
 * 判定結果（Commonsのファイル名とVisionの所見）を添えて、
 * 駅舎・看板・地図などの誤採用を人の目で弾くための一覧を作る。
 * usage: node scripts/reviewRefillImages.mjs logs/refill_images1.json [開始] [件数]
 */
import fs from 'fs';
const report = JSON.parse(fs.readFileSync(process.argv[2] || 'logs/refill_images1.json', 'utf8'));
const from = Number(process.argv[3] || 0);
const n = Number(process.argv[4] || 100);
const a = report.adopted.slice(from, from + n);
for (const x of a) {
  const v = x.verdict?.sonnet || x.verdict?.haiku || {};
  console.log(`${x.id.padEnd(22)} ${String(x.title).replace('File:', '').slice(0, 46).padEnd(48)} place=${String(x.placeCheck).padEnd(4)} ${v.reason ?? ''}`);
}
console.log(`\n採用 ${report.adopted.length}件（${from}〜${from + a.length}を表示）`);
console.log(`不採用 ${report.rejected.length}件: ${report.rejected.map((x) => x.name ?? x.id).join(', ')}`);
