#!/usr/bin/env node
/**
 * refetchRelaxed.mjs — 未解決380枚の最終再取得（条件緩和＋被写体切替）。
 *  【1】条件緩和: 縦長許容（object-fit:coverでクロップ前提）・幅800px以上に緩和
 *  【2】被写体切替: 通常IDのmainは「駅前」「市街地」「代表スポット」クエリを追加
 *  Vision検証（Haiku一次→ok/midはSonnet確認）とライセンス確認は従来どおり厳格。
 * レポート: logs/ng_refetch3_report.json（逐次保存・再開可）。完了時 "ALL_DONE"。
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

const OUT = 'logs/ng_refetch3_report.json';
const UA = { 'User-Agent': 'DokoIko/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const rand = (a, b) => a + Math.floor(Math.random() * (b - a));
const MIN_W = 800;   // 緩和: 1200 → 800

const IMAGES_DIR = 'public/images';
const DEST_FILE = 'src/data/destinations.json';
const audit = JSON.parse(fs.readFileSync('logs/vision_full_audit.json', 'utf8'));
const dests = JSON.parse(fs.readFileSync(DEST_FILE, 'utf8'));
const byId = Object.fromEntries(dests.map(d => [d.id, d]));
const targets = JSON.parse(fs.readFileSync('logs/ng_refetch2_report.json', 'utf8')).unresolvable;

let report = { replaced: [], unresolvable: [], skipped: [], errors: [] };
if (fs.existsSync(OUT)) { try { report = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch {} }
const doneKeys = new Set([...report.replaced, ...report.unresolvable, ...report.skipped, ...report.errors].map(r => r.key));
let openverseDisabled = false;

const FREE_LICENSE = /^(cc|creative commons|public domain|pd|cc0|attribution|no restrictions)/i;

const SYSTEM = `日本の旅行サイトの画像監査担当として、候補画像が指定された旅先の紹介画像として適切かを判定する。
NG: 日本国外/内容不一致(その土地の風景でない)/被写体がその場所と断定困難/焼込テキスト・ロゴ・PR透かし/帯。
OK: その土地の風景・名所・自然・町並み・駅前・市街地として妥当（縦長構図もOK）。
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
  if (!ii || ii.width < MIN_W) return null;           // 縦長許容・幅800以上
  if (!/\.(jpe?g)$/i.test(p.title)) return null;
  const license = ii.extmetadata?.LicenseShortName?.value || '';
  if (!FREE_LICENSE.test(license)) return null;
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

async function commonsSearch(query) {
  const j = await mwQuery('https://commons.wikimedia.org/w/api.php',
    `action=query&format=json&generator=search&gsrsearch=${encodeURIComponent('filetype:bitmap ' + query)}` +
    `&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1600`);
  const pages = Object.values(j?.query?.pages || {}).sort((a, b) => a.index - b.index);
  return pages.map(p => pageToCand(p, 'commons')).filter(Boolean);
}

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

async function openverse(query) {
  if (openverseDisabled) return [];
  const res = await fetch(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}` +
    `&license=cc0,pdm,by,by-sa&size=large&per_page=8`, { headers: UA });
  if (res.status === 429) { openverseDisabled = true; return []; }
  if (!res.ok) return [];
  const j = await res.json();
  return (j.results || [])
    .filter(r => r.width >= MIN_W && /^(cc0|pdm|by|by-sa)$/.test(r.license))
    .map(r => ({ title: r.title || r.id, url: r.url, descurl: r.foreign_landing_url,
      author: r.creator || 'unknown', license: `CC ${r.license.toUpperCase()} ${r.license_version || ''}`.trim(),
      source: 'openverse' }));
}

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
  const isNormalId = !/^(gen_|niche_)/.test(destId);
  const ctx = audit[t.key]?.ctx || `${dest.name}（${dest.prefecture || ''}）${spotName ? ' の見どころ「' + spotName + '」' : ''}`;
  const prevCredit = sm ? (typeof spot === 'object' ? spot?.imageCredit?.url : null) : dest.imageCredit?.url;

  try {
    const seen = new Set();
    const pool = [];
    const add = (arr) => { for (const c of arr) { if (!seen.has(c.url) && c.descurl !== prevCredit) { seen.add(c.url); pool.push(c); } } };

    if (!sm && isNormalId) {
      // 【2】被写体切替: 市街地・駅前・代表スポット
      const firstSpot = dest.spots?.[0];
      const landmark = firstSpot ? (typeof firstSpot === 'object' ? firstSpot.name : String(firstSpot)) : null;
      add(await commonsSearch(`${dest.name}駅`));
      if (pool.length < 4) add(await commonsSearch(`${dest.name} 市街地`));
      if (pool.length < 4 && landmark) add(await commonsSearch(`${landmark} ${dest.prefecture || ''}`.trim()));
      if (pool.length < 4) add(await wikipediaImages(dest.name));
    } else {
      // 【1】条件緩和のみ（従来クエリを縦長・800px許容で再走）
      if (spotName) add(await commonsSearch(`${spotName} ${dest.prefecture || ''}`.trim()));
      if (pool.length < 4) add(await commonsSearch(`${dest.name} ${dest.prefecture || ''}`.trim()));
      if (pool.length < 4) add(await wikipediaImages(spotName || dest.name));
    }
    if (pool.length < 2) add(await openverse(`${dest.name} ${spotName || ''}`.trim()));

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
      report.replaced.push({ key: t.key, source: picked.c.source, newTitle: picked.c.title });
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
