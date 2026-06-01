#!/usr/bin/env node
/**
 * refetchOverseas.js
 * logs/domestic_mismatch.json の287件を Wikimedia Commons のみで再取得し、
 * Vision で「日本国内・destinationとして適切」を再検証してから置換する。
 * Unsplashは一切使用しない。最大3候補、全滅なら既存維持＋スキップ記録。
 * 結果: logs/domestic_refetch.json（逐次保存・再開可）
 */
import fs from 'fs';
import path from 'path';
import https from 'https';
import sharp from 'sharp';
import Anthropic from '@anthropic-ai/sdk';

const env = fs.readFileSync('./.env', 'utf-8');
for (const line of env.split('\n')) { const m = line.match(/^([A-Z_]+)=(.+)$/); if (m) process.env[m[1]] = m[2].trim(); }
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-4-6';
const MIN_W = 1000, MAX_TRY = 3, CONCURRENCY = 4;
const OUT = 'logs/domestic_refetch.json';
const UA = { 'User-Agent': 'DokoIkoImageBot/1.0 (https://tabidokoiko.com; morizou0718@gmail.com)' };

const dests = JSON.parse(fs.readFileSync('src/data/destinations.json', 'utf8'));
const destMap = Object.fromEntries(dests.map(d => [d.id, d]));
const targets = JSON.parse(fs.readFileSync('logs/domestic_mismatch.json', 'utf8'));

let results = {};
if (fs.existsSync(OUT)) { try { results = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch {} }

const sleep = ms => new Promise(r => setTimeout(r, ms));
function get(url, redirs = 0) {
  return new Promise(resolve => {
    const req = https.get(url, { headers: UA, timeout: 25000 }, res => {
      if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location && redirs < 5) {
        res.resume();
        const next = res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, url).href;
        return resolve(get(next, redirs + 1));
      }
      const c = []; res.on('data', d => c.push(d));
      res.on('end', () => resolve({ status: res.statusCode, data: Buffer.concat(c) }));
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

// Commons 候補収集（複数クエリ・横長・大サイズ優先・重複除去）
async function commonsCandidates(d) {
  const name = d.name || d['名前'];
  const pref = d.prefecture || '';
  const idWords = d.id.replace(/^(gen|niche)_/, '').replace(/[_-]/g, ' ').replace(/[^\x00-\x7F]/g, '').trim();
  const queries = [`${name} ${pref}`, name, idWords && `${idWords}`].filter(Boolean);
  const seen = new Set(); const cands = [];
  for (const q of queries) {
    const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search`
      + `&gsrsearch=${encodeURIComponent('filetype:bitmap ' + q)}&gsrnamespace=6&gsrlimit=10`
      + `&prop=imageinfo&iiprop=url|size&iiurlwidth=1920`;
    const r = await get(api);
    await sleep(250);
    if (!r || r.status !== 200) continue;
    let pages; try { pages = JSON.parse(r.data.toString())?.query?.pages; } catch { continue; }
    if (!pages) continue;
    for (const p of Object.values(pages)) {
      const ii = p.imageinfo?.[0];
      if (!ii || !ii.thumburl) continue;
      if (ii.width < MIN_W || ii.width < ii.height) continue; // 横長・1000px以上
      if (seen.has(ii.thumburl)) continue;
      seen.add(ii.thumburl);
      cands.push({ url: ii.thumburl, w: ii.width, h: ii.height, title: (p.title || '').replace('File:', '') });
    }
  }
  return cands.sort((a, b) => b.w - a.w).slice(0, 8);
}

// Vision 再検証（日本国内・destinationとして妥当か）
async function visionOk(d, b64, attempt = 0) {
  try {
    const res = await client.messages.create({
      model: MODEL, max_tokens: 300,
      system: `この画像が日本の旅先「${d.name}（${d.prefecture}）」のメイン画像として妥当か判定。\n判定基準: (1)日本国内の風景/建物/自然であること(海外なら必ずNG) (2)destinationのテーマ(${(d.tags||[]).join('/')||'その土地'})と矛盾しないこと。固有同定までは不要だが、海外・明らかな別物・人物アップ/無関係な物のみ等はNG。\nJSONのみ: {"ok":true|false,"reason":"簡潔に"}`,
      messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } }, { type: 'text', text: '判定してJSONで返す。' }] }],
    });
    let t = res.content[0].text.trim();
    const s = t.indexOf('{'), e = t.lastIndexOf('}');
    if (s >= 0) t = t.slice(s, e + 1);
    const j = JSON.parse(t);
    return { ok: !!j.ok, reason: j.reason || '' };
  } catch (e) {
    if ((e.status === 429 || e.status === 529) && attempt < 4) { await sleep(4000 * (attempt + 1)); return visionOk(d, b64, attempt + 1); }
    return { ok: false, reason: 'VISION_ERR:' + e.message.slice(0, 40) };
  }
}

async function dl(url) {
  for (let i = 0; i < 3; i++) {
    const r = await get(url);
    if (r && r.status === 200 && r.data.length > 10000) return r.data;
    if (r && r.status === 429) await sleep(5000 * (i + 1)); else await sleep(800);
  }
  return null;
}

async function processOne(t) {
  const d = destMap[t.id];
  if (!d) { results[t.id] = { status: 'skip', reason: 'dest不在' }; return; }
  const cands = await commonsCandidates(d);
  if (!cands.length) { results[t.id] = { status: 'skip', name: d.name, reason: 'Commons候補なし' }; return; }
  const tried = [];
  for (const c of cands.slice(0, MAX_TRY)) {
    const raw = await dl(c.url);
    if (!raw) { tried.push({ title: c.title, r: 'DL失敗' }); continue; }
    let norm;
    try { norm = await sharp(raw).resize({ width: 1920, withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toBuffer(); }
    catch { tried.push({ title: c.title, r: '画像不正' }); continue; }
    const b64 = (await sharp(norm).resize({ width: 640 }).jpeg({ quality: 75 }).toBuffer()).toString('base64');
    const v = await visionOk(d, b64);
    if (v.ok) {
      fs.writeFileSync(path.join('public/images', d.id, 'main.jpg'), norm);
      const m = await sharp(norm).metadata();
      results[t.id] = { status: 'ok', name: d.name, src: c.title, url: c.url, dim: `${m.width}x${m.height}`, vision: v.reason };
      return;
    }
    tried.push({ title: c.title, r: 'Vision NG: ' + v.reason.slice(0, 40) });
  }
  results[t.id] = { status: 'skip', name: d.name, pref: d.prefecture, reason: '3候補NG', tried };
}

console.log(`対象 ${targets.length} / 処理済 ${targets.filter(t => results[t.id]).length}`);
const pending = targets.filter(t => !results[t.id]);
let done = targets.length - pending.length;
for (let i = 0; i < pending.length; i += CONCURRENCY) {
  await Promise.all(pending.slice(i, i + CONCURRENCY).map(processOne));
  fs.writeFileSync(OUT, JSON.stringify(results, null, 1));
  done += Math.min(CONCURRENCY, pending.length - i);
  const ok = Object.values(results).filter(r => r.status === 'ok').length;
  process.stdout.write(`\r処理 ${done}/${targets.length} (成功 ${ok})`);
}
const ok = Object.values(results).filter(r => r.status === 'ok').length;
const skip = Object.values(results).filter(r => r.status === 'skip').length;
console.log(`\n完了。成功(置換) ${ok} / スキップ(既存維持) ${skip}`);
