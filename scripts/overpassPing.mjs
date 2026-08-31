#!/usr/bin/env node
/** overpassPing.mjs — Overpass の各ミラーへ疎通確認（どのエンドポイントが使えるか調べる） */
const UA = { 'User-Agent': 'DokoIko-DataAudit/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass.osm.jp/api/interpreter',
];
const q = '[out:json][timeout:20];node["name"~"筋湯"](33.0,131.1,33.2,131.3);out center 5;';

for (const ep of ENDPOINTS) {
  try {
    const r = await fetch(ep, {
      method: 'POST',
      headers: { ...UA, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'data=' + encodeURIComponent(q),
      signal: AbortSignal.timeout(30000),
    });
    if (!r.ok) { console.log(`✗ ${ep}  HTTP ${r.status}`); continue; }
    const j = await r.json();
    console.log(`✓ ${ep}  elements=${(j.elements || []).length} ${(j.elements||[]).map(e=>e.tags?.name).filter(Boolean).join(',')}`);
  } catch (e) {
    console.log(`✗ ${ep}  ${String(e).slice(0, 80)}`);
  }
}
