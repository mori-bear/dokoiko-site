#!/usr/bin/env node
/**
 * refetchVisionVerified.mjs — NG画像を「Commons複数候補→Vision検証→OK採用」で確実に差し替える。
 * 盲目再取得(refetchVisionNG.mjs)は内容未検証で約半数悪化するため、候補ごとにVision判定し
 * verdict=okの最初の候補のみ採用する。OK候補が無ければ現状維持(unresolvable)。
 *
 * 使い方: node scripts/refetchVisionVerified.mjs logs/ng_main.json [main|spot] logs/refetch_verified.json
 * 要 ANTHROPIC_API_KEY 残高。逐次保存・再開可(既に採用済みidはスキップ)。
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import Anthropic from '@anthropic-ai/sdk';

const env = fs.readFileSync('./.env', 'utf-8');
for (const line of env.split('\n')) { const m = line.match(/^([A-Z_]+)=(.+)$/); if (m) process.env[m[1]] = m[2].trim(); }
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-4-6';

const NG_FILE = process.argv[2] || 'logs/ng_main.json';
const KIND = process.argv[3] || 'main';   // main | spot
const OUT = process.argv[4] || 'logs/refetch_verified.json';
const CAND = 5;                            // 候補数
const UA = { 'User-Agent': 'DokoIko/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const IMAGES_DIR = 'public/images';
const DEST_FILE = 'src/data/destinations.json';
const ngList = JSON.parse(fs.readFileSync(NG_FILE, 'utf8'));
const dests = JSON.parse(fs.readFileSync(DEST_FILE, 'utf8'));
const byId = Object.fromEntries(dests.map(d => [d.id, d]));
let report = { replaced: [], unresolvable: [], errors: [] };
if (fs.existsSync(OUT)) { try { report = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch {} }
const doneIds = new Set([...report.replaced, ...report.unresolvable].map(r => r.key));

const SYSTEM = `日本の旅行サイトの画像監査担当として、候補画像が指定された旅先の紹介画像として適切かを判定する。
NG: 日本国外/内容不一致(その土地の風景でない)/焼込テキスト・ロゴ・PR透かし/極端アスペクト・不自然トリミング・帯。
OK: その土地の風景・名所・自然・町並みとして妥当。
JSONのみ返す: {"verdict":"ok"|"ng","reason":"簡潔に"}`;

async function visionOk(buf, ctx) {
  const b64 = (await sharp(buf).resize({ width: 640, withoutEnlargement: true }).jpeg({ quality: 75 }).toBuffer()).toString('base64');
  const res = await client.messages.create({ model: MODEL, max_tokens: 300, system: SYSTEM,
    messages: [{ role: 'user', content: [
      { type: 'text', text: `旅先: ${ctx}\nこの画像は紹介画像として適切か判定。` },
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } },
    ] }] });
  let t = res.content[0].text.trim();
  const s = t.indexOf('{'), e = t.lastIndexOf('}');
  if (s >= 0) t = t.slice(s, e + 1);
  try { return JSON.parse(t).verdict === 'ok'; } catch { return false; }
}

async function candidates(query) {
  const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search` +
    `&gsrsearch=${encodeURIComponent('filetype:bitmap ' + query)}&gsrnamespace=6&gsrlimit=${CAND * 2}` +
    `&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1600`;
  const j = await (await fetch(api, { headers: UA })).json();
  const pages = Object.values(j.query?.pages || {}).sort((a, b) => a.index - b.index);
  const out = [];
  for (const p of pages) {
    const ii = p.imageinfo?.[0];
    if (!ii || ii.width < 1200 || ii.width <= ii.height) continue;
    out.push({ title: p.title, url: ii.thumburl || ii.url, descurl: ii.descriptionurl, em: ii.extmetadata || {} });
    if (out.length >= CAND) break;
  }
  return out;
}

function creditOf(c) {
  return { author: (c.em.Artist?.value || '').replace(/<[^>]*>/g, '').trim() || 'unknown',
    license: c.em.LicenseShortName?.value || 'unknown',
    url: c.descurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(c.title)}`, attributionRequired: true };
}

let n = 0;
for (const ng of ngList) {
  const key = KIND === 'main' ? `${ng.id}/main.jpg` : `${ng.id}/${ng.file}`;
  if (doneIds.has(key)) continue;
  n++;
  if (n % 8 === 0) { console.log(`  ${n}件目… 30秒休憩`); await sleep(30000); }
  const dest = byId[ng.id];
  if (!dest) continue;
  const subject = KIND === 'main' ? (ng.mainSpot || ng.name) : (ng.spotName || ng.name);
  const ctx = `${dest.name}（${dest.prefecture || ''}）${KIND === 'spot' ? 'の' + subject : ''}`;
  try {
    let cands = await candidates(`${subject} ${dest.prefecture || ''}`.trim());
    if (cands.length < 2) cands = cands.concat(await candidates(`${ng.name} ${dest.prefecture || ''}`.trim()));
    let picked = null;
    for (const c of cands) {
      await sleep(1200);
      const dl = await fetch(c.url, { headers: UA });
      if (!dl.ok) continue;
      const buf = Buffer.from(await dl.arrayBuffer());
      if (await visionOk(buf, ctx)) { picked = { c, buf }; break; }
    }
    if (!picked) { report.unresolvable.push({ key, id: ng.id, reason: ng.reason }); }
    else {
      const outPath = path.join(IMAGES_DIR, ng.id, KIND === 'main' ? 'main.jpg' : ng.file);
      await sharp(picked.buf).jpeg({ quality: 88 }).toFile(outPath);
      if (KIND === 'main') dest.imageCredit = creditOf(picked.c);
      else if (Array.isArray(dest.spots) && dest.spots[ng.spotIndex] && typeof dest.spots[ng.spotIndex] === 'object') {
        dest.spots[ng.spotIndex].imageCredit = creditOf(picked.c);
      }
      report.replaced.push({ key, id: ng.id, newTitle: picked.c.title });
    }
    fs.writeFileSync(DEST_FILE, JSON.stringify(dests, null, 1));
    fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
    await sleep(2500);
  } catch (err) {
    report.errors.push({ key, id: ng.id, error: String(err.message || err).slice(0, 80) });
    fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
    await sleep(1500);
  }
}
console.log(`完了: 置換${report.replaced.length} / 解決不能${report.unresolvable.length} / err${report.errors.length}`);
