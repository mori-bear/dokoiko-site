#!/usr/bin/env node
/**
 * kyushuCoordVerify.mjs — 確定座標(2ソースの中点)が本当に狙った市町村に落ちているかを
 * Nominatim の逆ジオコーディングで確認する。
 *
 * 2ソースが5km離れていても「一致」判定は通るため、中点が隣の自治体や山中に
 * ずれ込むことがある。地図ピンとして出す以上ここまで見ておく。
 */
import fs from 'fs';
const UA = { 'User-Agent': 'DokoIko-DataAudit/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 期待する市町村（候補選定時に想定していたもの）
const EXPECT = {
  'sujiyu-onsen': '九重町', 'hosenji-onsen': '九重町', 'yunohira-onsen': '由布市',
  'hagenoyu-onsen': '小国町', 'hinagu-onsen': '八代市', 'yunotsuru-onsen': '水俣市',
  'tsuetate-onsen': '小国町', 'funagoya-onsen': '筑後市', 'kumanokawa-onsen': '佐賀市',
  'furuyu-onsen': '佐賀市', 'hinokage-onsen': '日之影町',
};

const targets = JSON.parse(fs.readFileSync('logs/kyushu_targets.json', 'utf8'));
const cands = JSON.parse(fs.readFileSync('logs/kyushu_candidates3.json', 'utf8'));
const out = [];

for (const t of targets) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${t.lat}&lon=${t.lng}&format=json&zoom=12&addressdetails=1`;
  const j = await (await fetch(url, { headers: UA })).json();
  await sleep(1200);
  const a = j.address || {};
  const city = a.city || a.town || a.village || a.county || a.municipality || '?';
  const pref = a.province || a.state || '?';
  const c = cands.find((x) => x.id === t.id);
  const okPref = pref === t.prefecture;
  const okCity = EXPECT[t.id] ? city.includes(EXPECT[t.id].replace(/[市町村]$/, '')) : null;
  const mark = okPref && okCity !== false ? '✅' : '⚠️ ';
  out.push({ id: t.id, name: t.name, pref, city, expect: EXPECT[t.id], spreadKm: c?.distanceKm, ok: okPref && okCity !== false });
  console.log(`${mark} ${t.name.padEnd(12)} 逆引き=${pref}${city}  期待=${t.prefecture}${EXPECT[t.id] ?? '-'}  2ソース差=${c?.distanceKm ?? '?'}km`);
}
fs.writeFileSync('logs/kyushu_coord_verify.json', JSON.stringify(out, null, 2));
const ng = out.filter((x) => !x.ok);
console.log(`\n一致 ${out.length - ng.length} / ${out.length}${ng.length ? ' — 要確認: ' + ng.map((x) => x.name).join(', ') : ''}`);
