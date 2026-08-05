#!/usr/bin/env node
/**
 * refetchAuditNG.mjs — Vision監査(logs/vision_full_audit.json)のng確定分を
 * 「Commons複数候補 → Vision検証(Haiku一次→怪しければSonnet確認) → OKのみ採用」で差し替える。
 * 盲目差し替えは約半数悪化する実績があるため、候補検証をパスしたものだけ採用する。
 *
 * - 3〜5秒ランダムウェイト/件・10件毎に30秒休憩（Commonsレートリミット対策）
 * - 候補なし/全候補NGは現状維持で logs/ng_refetch_report.json の unresolvable へ
 * - 逐次保存・再開可（レポートに載っているkeyはスキップ）
 * - 完了時に stdout へ "ALL_DONE" を出力（外部監視用）
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

const AUDIT = 'logs/vision_full_audit.json';
const OUT = 'logs/ng_refetch_report.json';
const CAND = 5;
const UA = { 'User-Agent': 'DokoIko/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const rand = (a, b) => a + Math.floor(Math.random() * (b - a));

const IMAGES_DIR = 'public/images';
const DEST_FILE = 'src/data/destinations.json';
const audit = JSON.parse(fs.readFileSync(AUDIT, 'utf8'));
const dests = JSON.parse(fs.readFileSync(DEST_FILE, 'utf8'));
const byId = Object.fromEntries(dests.map(d => [d.id, d]));

const ngs = Object.entries(audit)
  .filter(([, r]) => r.verdict === 'ng')
  .map(([key, r]) => ({ key, ...r }))
  .sort((a, b) => a.key.localeCompare(b.key));

let report = { replaced: [], unresolvable: [], skipped: [], errors: [] };
if (fs.existsSync(OUT)) { try { report = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch {} }
const doneKeys = new Set([...report.replaced, ...report.unresolvable, ...report.skipped, ...report.errors].map(r => r.key));

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
  try { return JSON.parse(t); } catch { return { verdict: 'ng', confidence: 'mid', reason: 'parse_error' }; }
}

/** 2段階検証: Haiku一次 → ok/high以外の「怪しい」okはSonnetで確認。 */
async function visionOk(buf, ctx) {
  const b64 = (await sharp(buf).resize({ width: 640, withoutEnlargement: true }).jpeg({ quality: 75 }).toBuffer()).toString('base64');
  const h = await visionJudge(HAIKU, b64, ctx);
  if (h.verdict !== 'ok') return false;
  if (h.confidence === 'high') return true;
  const s = await visionJudge(SONNET, b64, ctx);
  return s.verdict === 'ok';
}

async function candidates(query, attempt = 0) {
  const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search` +
    `&gsrsearch=${encodeURIComponent('filetype:bitmap ' + query)}&gsrnamespace=6&gsrlimit=${CAND * 2}` +
    `&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1600`;
  const res = await fetch(api, { headers: UA });
  if (res.status === 429 && attempt < 5) { await sleep(15000 * (attempt + 1)); return candidates(query, attempt + 1); }
  if (!res.ok) return [];
  const j = await res.json();
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

console.log(`NG対象 ${ngs.length} / 済 ${[...doneKeys].length} / 残 ${ngs.filter(n => !doneKeys.has(n.key)).length}`);

let n = 0;
for (const ng of ngs) {
  if (doneKeys.has(ng.key)) continue;
  const [destId, file] = ng.key.split('/');
  const dest = byId[destId];
  const abs = path.join(IMAGES_DIR, destId, file);
  // destination削除済み・ファイル消滅はスキップリストへ
  if (!dest || !fs.existsSync(abs)) {
    report.skipped.push({ key: ng.key, reason: !dest ? 'dest_removed' : 'file_missing' });
    fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
    continue;
  }
  n++;
  if (n % 10 === 0) { console.log(`\n${n}件目… 30秒休憩`); await sleep(30000); }

  // 被写体: spot-N はスポット名、main は destination 名
  const sm = file.match(/spot-(\d+)/i);
  const spot = sm ? dest.spots?.[+sm[1] - 1] : null;
  const spotName = spot ? (typeof spot === 'object' ? spot.name : String(spot)) : null;
  const subject = spotName || dest.name;
  const ctx = ng.ctx || `${dest.name}（${dest.prefecture || ''}）${spotName ? ' の見どころ「' + spotName + '」' : ''}`;
  // 既存クレジットURL（同一候補の再採用を避ける）
  const prevCredit = sm ? (typeof spot === 'object' ? spot?.imageCredit?.url : null) : dest.imageCredit?.url;

  try {
    let cands = await candidates(`${subject} ${dest.prefecture || ''}`.trim());
    if (cands.length < 2 && spotName) cands = cands.concat(await candidates(`${dest.name} ${spotName}`.trim()));
    if (cands.length < 2) cands = cands.concat(await candidates(`${dest.name} ${dest.prefecture || ''}`.trim()));
    cands = cands.filter(c => !prevCredit || c.descurl !== prevCredit);

    let picked = null;
    for (const c of cands) {
      await sleep(1200);
      const dl = await fetch(c.url, { headers: UA });
      if (!dl.ok) continue;
      const buf = Buffer.from(await dl.arrayBuffer());
      if (await visionOk(buf, ctx)) { picked = { c, buf }; break; }
    }

    if (!picked) {
      report.unresolvable.push({ key: ng.key, reason: ng.reason?.slice(0, 60) });
    } else {
      await sharp(picked.buf).jpeg({ quality: 88 }).toFile(abs);
      const credit = creditOf(picked.c);
      if (sm) { if (spot && typeof spot === 'object') spot.imageCredit = credit; }
      else dest.imageCredit = credit;
      report.replaced.push({ key: ng.key, newTitle: picked.c.title });
      fs.writeFileSync(DEST_FILE, JSON.stringify(dests, null, 1));
    }
    fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
    await sleep(rand(3000, 5000));
  } catch (err) {
    report.errors.push({ key: ng.key, error: String(err.message || err).slice(0, 80) });
    fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
    await sleep(3000);
  }
}

console.log(`\nALL_DONE 置換${report.replaced.length} / 解決不能${report.unresolvable.length} / スキップ${report.skipped.length} / err${report.errors.length}`);
