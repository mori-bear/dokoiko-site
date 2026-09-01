#!/usr/bin/env node
/**
 * meishoGap.mjs — 国指定名勝536件のうち、既存destinationsに一切登場しないものを洗い出す。
 * 名前・spot名・description本文まで見る。庭園や邸宅など「滞在の目的地」にならないものは
 * 語で弾き、自然景観に寄せる。
 */
import fs from 'fs';
const rows = JSON.parse(fs.readFileSync('logs/meisho_rows.json', 'utf8'));
const all = JSON.parse(fs.readFileSync('src/data/destinations.json', 'utf8'));

// 庭園・邸宅・寺社の境内など、単独の旅先になりにくいものを外す
const SKIP = /庭園|邸|旧宅|屋敷|苑$|公園$|墓|城跡$|寺$|神社$|宮$|院$|跡$|並木|遺跡|学校|廟|塚/;
const NATURE = /峡|渓|滝|海岸|岬|島|湖|沼|池|山|岳|川|谷|浜|磯|洞|柱|石|岩|砂|湾|原$|高原|樹|林|杉|松/;

const haystack = all.map((d) => ({
  id: d.id, name: d.name, pref: d.prefecture, lat: d.lat, lng: d.lng,
  text: [d.name, d.city, d.description, ...(d.spots || []).map((s) => (s && s.name) || ''),
    ...(d.spots || []).map((s) => (s && s.description) || '')].join(' '),
}));

const miss = [];
for (const r of rows) {
  const n = r.name.replace(/^(国指定|特別)/, '').trim();
  if (n.length < 2 || SKIP.test(n) || !NATURE.test(n)) continue;
  const base = n.replace(/(及び.*|附.*)$/, '').trim();
  const found = haystack.find((h) => h.name === base || h.name.includes(base)
    || (h.pref === r.prefecture && h.text.includes(base)));
  if (!found) miss.push({ ...r, key: base });
}
console.log(`■ 自然景観の名勝のうち、既存に一度も出てこないもの ${miss.length}件`);
const byPref = {};
for (const m of miss) (byPref[m.prefecture] ||= []).push(`${m.key}${m.where ? `（${m.where}）` : ''}`);
for (const [p, list] of Object.entries(byPref)) console.log(`  ${p.padEnd(5)} ${list.join(' / ')}`);
fs.writeFileSync('logs/meisho_gap.json', JSON.stringify(miss, null, 1));
