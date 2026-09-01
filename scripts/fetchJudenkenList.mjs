#!/usr/bin/env node
/**
 * fetchJudenkenList.mjs — 重要伝統的建造物群保存地区の一覧を ja.Wikipedia の
 * 記事ウィキテキストから機械的に取り出す。
 * WebFetchの要約に頼ると取りこぼすので、生のウィキテキストを自前で解析する。
 */
import fs from 'fs';
const UA = { 'User-Agent': 'DokoIko-DataAudit/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const title = process.argv[2] || '重要伝統的建造物群保存地区';
const url = `https://ja.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}`
  + `&prop=wikitext&format=json&formatversion=2`;
const j = await (await fetch(url, { headers: UA })).json();
if (j.error) { console.log('取得失敗:', j.error.info); process.exit(1); }
const wt = j.parse.wikitext;
fs.writeFileSync('logs/judenken_wikitext.txt', wt);
console.log(`ウィキテキスト ${wt.length}文字 → logs/judenken_wikitext.txt`);

// 表は1行1セル（先頭が縦棒）の形。|- で区切って8セルずつ読む。
// 各セルには {{Display none|…}} のソートキーが付くので落とす。
const clean = (c) => c
  .replace(/\{\{Display none\|[^}]*\}\}/g, '')
  .replace(/\{\{[^}]*\}\}/g, '')
  .replace(/\[\[(?:ファイル|File):[^\]]*\]\]/g, '')
  .replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, '$2')
  .replace(/<[^>]*>/g, '')
  .replace(/^\|/, '')
  .trim();

const table = wt.slice(wt.indexOf('{| class="wikitable sortable"'));
const rows = [];
for (const block of table.split('\n|-\n')) {
  const cells = block.split('\n').filter((l) => l.startsWith('|') && !l.startsWith('|}')).map(clean);
  if (cells.length < 6) continue;
  const [pref, city, name, date, , kind, area] = cells;
  if (!/[都道府県]$/.test(pref)) continue;
  rows.push({ prefecture: pref, city, name, date, kind, areaHa: area });
}
console.log(`表から拾えた行 ${rows.length}件`);
const byKind = {};
for (const r of rows) byKind[r.kind] = (byKind[r.kind] || 0) + 1;
console.log('種別:', Object.entries(byKind).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}${v}`).join(' / '));
fs.writeFileSync('logs/judenken_rows.json', JSON.stringify(rows, null, 1));
console.log('→ logs/judenken_rows.json');
