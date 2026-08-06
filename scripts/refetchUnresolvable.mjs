#!/usr/bin/env node
/**
 * refetchUnresolvable.mjs — 前回解決不能(logs/ng_refetch_report.json unresolvable)の再チャレンジ。
 * Commonsで見つからなかった分を、取得ソースを広げて再取得する:
 *   1. Commons クエリ変奏（spot名単独 / googleMapsQuery / 英語表記(id由来)）
 *   2. Wikipedia(ja) 記事内画像（infobox以外も。フリーライセンス確認済みのみ）
 *   3. Openverse API（CC0/BY/BY-SA/PDM のみ。квота429以降は自動スキップ）
 *
 * ライセンス検証: LicenseShortName が CC系/Public domain 以外は候補から除外（不明は絶対不採用）。
 * Vision検証: Haiku一次 → ok/mid は Sonnet 確認。パスしたもののみ採用。
 * レート: 3〜5秒ランダムウェイト/件・10件毎30秒休憩・429指数バックオフ。
 * 逐次保存・再開可: logs/ng_refetch2_report.json。完了時 "ALL_DONE" 出力。
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import Anthropic from '@anthropic-ai/sdk';

const env = fs.readFileSync('./.env', 'utf-8');
for (const line of env.split('\n')) { const m = line.match(/^([A-Z_]+)=(.+)$/); if (m) process.env[m[1]] = m[2].trim(); }
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const HAIKU = 'claude-haiku-4-5-20251001';
const SONNET = 'claude-sonnet-4-6';

const SRC_REPORT = 'logs/ng_refetch_report.json';
const OUT = 'logs/ng_refetch2_report.json';
const UA = { 'User-Agent': 'DokoIko/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const rand = (a, b) => a + Math.floor(Math.random() * (b - a));

const IMAGES_DIR = 'public/images';
const DEST_FILE = 'src/data/destinations.json';
const AUDIT = 'logs/vision_full_audit.json';
const audit = JSON.parse(fs.readFileSync(AUDIT, 'utf8'));
const dests = JSON.parse(fs.readFileSync(DEST_FILE, 'utf8'));
const byId = Object.fromEntries(dests.map(d => [d.id, d]));
const targets = JSON.parse(fs.readFileSync(SRC_REPORT, 'utf8')).unresolvable;

let report = { replaced: [], unresolvable: [], skipped: [], errors: [] };
if (fs.existsSync(OUT)) { try { report = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch {} }
const doneKeys = new Set([...report.replaced, ...report.unresolvable, ...report.skipped, ...report.errors].map(r => r.key));
let openverseDisabled = false;

const FREE_LICENSE = /^(cc|creative commons|public domain|pd|cc0|attribution|no restrictions)/i;

const SYSTEM = `日本の旅行サイトの画像監査担当として、候補画像が指定された旅先の紹介画像として適切かを判定する。
NG: 日本国外/内容不一致(その土地の風景でない)/被写体がその場所と断定困難/焼込テキスト・ロゴ・PR透かし/極端アスペクト・不自然トリミング・帯。
OK: その土地の風景・名所・自然・町並みとして妥当。
JSONのみ返す: {"verdict":"ok"|"ng","confidence":"high"|"mid","reason":"簡潔に"}`;

async function visionJudge(model, b64, ctx) {
  const res = await client.messages.create({ model, max_tokens: 300, system: SYSTEM,
    messages: [{ role: 'user', content: [
      { type: 'text', text: `旅先: ${ctx}\nこの画像は紹介画像として適切か判定。` },
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } },
    ] }] });
  let t = res.content[0].text.trim();
  const s = t.indexOf('{'), e = t.lastIndexOf('}');
  if (s >= 0) t = t.slice(s, e + 1);
  try { return JSON.parse(t); } catch { return { verdict: 'ng', confidence: 'mid' }; }
}

async function visionOk(buf, ctx) {
  const b64 = (await sharp(buf).resize({ width: 640, withoutEnlargement: true }).jpeg({ quality: 75 }).toBuffer()).toString('base64');
  const h = await visionJudge(HAIKU, b64, ctx);
  if (h.verdict !== 'ok') return false;
  if (h.confidence === 'high') return true;
  const s = await visionJudge(SONNET, b64, ctx);
  return s.verdict === 'ok';
}

function pageToCand(p, source) {
  const ii = p.imageinfo?.[0];
  if (!ii || ii.width < 1200 || ii.width <= ii.height) return null;
  if (!/\.(jpe?g)$/i.test(p.title)) return null;
  const license = p.imageinfo[0].extmetadata?.LicenseShortName?.value || '';
  if (!FREE_LICENSE.test(license)) return null;  // ライセンス不明・非フリーは除外
  return { title: p.title, url: ii.thumburl || ii.url, descurl: ii.descriptionurl,
    author: (ii.extmetadata?.Artist?.value || '').replace(/<[^>]*>/g, '').trim() || 'unknown',
    license, source };
}

async function mwQuery(base, params, attempt = 0) {
  const res = await fetch(`${base}?${params}`, { headers: UA });
  if (res.status === 429 && attempt < 5) { await sleep(15000 * (attempt + 1)); return mwQuery(base, params, attempt + 1); }
  if (!res.ok) return null;
  return res.json();
}

// ソース1: Commons検索（クエリ変奏用）
async function commonsSearch(query) {
  const j = await mwQuery('https://commons.wikimedia.org/w/api.php',
    `action=query&format=json&generator=search&gsrsearch=${encodeURIComponent('filetype:bitmap ' + query)}` +
    `&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1600`);
  const pages = Object.values(j?.query?.pages || {}).sort((a, b) => a.index - b.index);
  return pages.map(p => pageToCand(p, 'commons')).filter(Boolean);
}

// ソース2: Wikipedia(ja) 記事内画像（記事名解決→記事内の全File→フリーのみ）
async function wikipediaImages(title) {
  const os = await mwQuery('https://ja.wikipedia.org/w/api.php',
    `action=opensearch&format=json&limit=1&search=${encodeURIComponent(title)}`);
  const article = os?.[1]?.[0];
  if (!article) return [];
  const j = await mwQuery('https://ja.wikipedia.org/w/api.php',
    `action=query&format=json&titles=${encodeURIComponent(article)}&generator=images&gimlimit=30` +
    `&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1600`);
  const pages = Object.values(j?.query?.pages || {});
  return pages.map(p => pageToCand(p, `wikipedia:${article}`)).filter(Boolean);
}

// ソース3: Openverse（CCライセンス限定・quota切れ以降は無効化）
async function openverse(query) {
  if (openverseDisabled) return [];
  const res = await fetch(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}` +
    `&license=cc0,pdm,by,by-sa&size=large&per_page=8`, { headers: UA });
  if (res.status === 429) { openverseDisabled = true; console.log('  Openverse quota到達→以降スキップ'); return []; }
  if (!res.ok) return [];
  const j = await res.json();
  return (j.results || [])
    .filter(r => r.width >= 1200 && r.width > r.height && /^(cc0|pdm|by|by-sa)$/.test(r.license))
    .map(r => ({ title: r.title || r.id, url: r.url, descurl: r.foreign_landing_url,
      author: r.creator || 'unknown', license: `CC ${r.license.toUpperCase()} ${r.license_version || ''}`.trim(),
      source: 'openverse' }));
}

const englishName = (id) => id.split('-').map(w => w[0]?.toUpperCase() + w.slice(1)).join(' ');

console.log(`対象 ${targets.length} / 済 ${[...doneKeys].length} / 残 ${targets.filter(t => !doneKeys.has(t.key)).length}`);

let n = 0;
for (const t of targets) {
  if (doneKeys.has(t.key)) continue;
  const [destId, file] = t.key.split('/');
  const dest = byId[destId];
  const abs = path.join(IMAGES_DIR, destId, file);
  if (!dest || !fs.existsSync(abs)) {
    report.skipped.push({ key: t.key, reason: !dest ? 'dest_removed' : 'file_missing' });
    fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
    continue;
  }
  n++;
  if (n % 10 === 0) { console.log(`\n${n}件目… 30秒休憩`); await sleep(30000); }

  const sm = file.match(/spot-(\d+)/i);
  const spot = sm ? dest.spots?.[+sm[1] - 1] : null;
  const spotName = spot ? (typeof spot === 'object' ? spot.name : String(spot)) : null;
  const gmq = spot && typeof spot === 'object' ? spot.googleMapsQuery : null;
  const ctx = audit[t.key]?.ctx || `${dest.name}（${dest.prefecture || ''}）${spotName ? ' の見どころ「' + spotName + '」' : ''}`;
  const prevCredit = sm ? (typeof spot === 'object' ? spot?.imageCredit?.url : null) : dest.imageCredit?.url;

  try {
    // 候補収集（順に試し、重複除去。ソースごとに逐次追加）
    const seen = new Set();
    const pool = [];
    const add = (arr) => { for (const c of arr) { if (!seen.has(c.url) && c.descurl !== prevCredit) { seen.add(c.url); pool.push(c); } } };

    if (spotName) add(await commonsSearch(spotName));                              // spot名単独
    if (pool.length < 4 && gmq && gmq !== spotName) add(await commonsSearch(gmq)); // googleMapsQuery(別名/旧地名含む)
    if (pool.length < 4) add(await commonsSearch(`${englishName(destId)} Japan`)); // 英語表記
    if (pool.length < 4) add(await wikipediaImages(spotName || dest.name));        // Wikipedia記事内
    if (pool.length < 4 && spotName) add(await wikipediaImages(dest.name));
    if (pool.length < 2) add(await openverse(`${dest.name} ${spotName || ''}`.trim())); // Openverse

    let picked = null;
    for (const c of pool.slice(0, 8)) {
      await sleep(1200);
      const dl = await fetch(c.url, { headers: UA });
      if (!dl.ok) continue;
      const buf = Buffer.from(await dl.arrayBuffer());
      if (await visionOk(buf, ctx)) { picked = { c, buf }; break; }
    }

    if (!picked) {
      report.unresolvable.push({ key: t.key });
    } else {
      await sharp(picked.buf).jpeg({ quality: 88 }).toFile(abs);
      const credit = { author: picked.c.author, license: picked.c.license,
        url: picked.c.descurl || picked.c.url, attributionRequired: true };
      if (sm) { if (spot && typeof spot === 'object') spot.imageCredit = credit; }
      else dest.imageCredit = credit;
      report.replaced.push({ key: t.key, source: picked.c.source, newTitle: picked.c.title, license: picked.c.license });
      fs.writeFileSync(DEST_FILE, JSON.stringify(dests, null, 1));
    }
    fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
    await sleep(rand(3000, 5000));
  } catch (err) {
    report.errors.push({ key: t.key, error: String(err.message || err).slice(0, 80) });
    fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
    await sleep(3000);
  }
}

console.log(`\nALL_DONE 置換${report.replaced.length} / 解決不能${report.unresolvable.length} / スキップ${report.skipped.length} / err${report.errors.length}`);
