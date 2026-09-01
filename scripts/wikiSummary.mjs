#!/usr/bin/env node
/**
 * wikiSummary.mjs — ja.Wikipedia の記事本文（プレーンテキスト）を取り出す。
 * WebFetchで記事名を当てられないときに、検索して正しい記事名を突き止めるためにも使う。
 * usage: node scripts/wikiSummary.mjs "<検索語>" [文字数]
 */
const UA = { 'User-Agent': 'DokoIko-DataAudit/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const q = process.argv[2];
const limit = Number(process.argv[3] || 2200);

const s = `https://ja.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}`
  + `&srlimit=5&format=json&formatversion=2`;
const hits = (await (await fetch(s, { headers: UA })).json()).query.search;
console.log('■ 検索結果');
for (const h of hits) console.log(`   ${h.title}`);
if (!hits.length) process.exit(0);

const title = hits[0].title;
const e = `https://ja.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1`
  + `&titles=${encodeURIComponent(title)}&format=json&formatversion=2&redirects=1`;
const p = (await (await fetch(e, { headers: UA })).json()).query.pages[0];
console.log(`\n■ ${p.title}\n`);
console.log((p.extract || '').slice(0, limit));
