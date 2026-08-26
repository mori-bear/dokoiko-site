#!/usr/bin/env node
/**
 * newDestImagesRetry.mjs — 画像ゲートに落ちた候補だけ、検索語を変えて再取得する。
 * 今回は Vision の前に Commons メタデータ照合（placeCheck）を通し、
 * ok 以外は Vision に掛けるまでもなく捨てる。
 * 落とした理由（2026-08-26）:
 *   南房総白浜 … 和歌山の南紀白浜の写真だった（同名異所）
 *   弘法山     … 写っているのは権現山で、弘法山は画角外だった
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import Anthropic from '@anthropic-ai/sdk';
import { placeCheck } from './commonsPlaceCheck.mjs';

const env = fs.readFileSync('./.env', 'utf-8');
for (const l of env.split('\n')) { const m = l.match(/^([A-Z_]+)=(.+)$/); if (m) process.env[m[1]] = m[2].trim(); }
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const UA = { 'User-Agent': 'DokoIko-DataAudit/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const SYSTEM = `あなたは旅行サイトの画像審査担当です。指定された旅先の紹介画像として使えるかを判定します。
特に「主題がその場所そのものか」を厳しく見ます。遠景で別の山や建物が主役になっている、
その場所は画角の外、といった場合は ng にしてください。
JSONのみ: {"verdict":"ok"|"ng","identifiable":true|false,"reason":"40字以内"}`;

const RETRY = [
  { id: 'shirahama-boso', name: '南房総白浜', prefecture: '千葉県',
    queries: ['野島埼灯台', 'Nojimazaki Lighthouse', '南房総市 海岸'], local: ['野島','南房総','安房','Nojima'] },
  { id: 'kobouyama', name: '弘法山', prefecture: '神奈川県',
    queries: ['弘法山公園 秦野', 'Kobōyama Hadano', '弘法山 桜 秦野'], local: ['弘法山','秦野','Hadano','Kobo'] },
];

async function judge(model, buf, ctx) {
  const b64 = (await sharp(buf).resize({ width: 640, withoutEnlargement: true }).jpeg({ quality: 75 }).toBuffer()).toString('base64');
  const res = await client.messages.create({ model, max_tokens: 300, system: SYSTEM,
    messages: [{ role: 'user', content: [
      { type: 'text', text: `旅先: ${ctx}\nこの画像は紹介画像として適切か判定。` },
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } }] }] });
  let t = res.content[0].text.trim(); const s = t.indexOf('{'), e = t.lastIndexOf('}');
  if (s >= 0) t = t.slice(s, e + 1);
  try { return JSON.parse(t); } catch { return { verdict: 'ng', reason: 'JSON解析不可' }; }
}
async function candidates(query, limit = 6) {
  const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search` +
    `&gsrsearch=${encodeURIComponent('filetype:bitmap ' + query)}&gsrnamespace=6&gsrlimit=${limit * 2}` +
    `&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1600`;
  const j = await (await fetch(api, { headers: UA })).json();
  const out = [];
  for (const p of Object.values(j.query?.pages || {}).sort((a, b) => a.index - b.index)) {
    const ii = p.imageinfo?.[0];
    if (!ii || ii.width < 1200 || ii.width <= ii.height) continue;
    out.push({ title: p.title, url: ii.thumburl || ii.url, descurl: ii.descriptionurl, em: ii.extmetadata || {} });
    if (out.length >= limit) break;
  }
  return out;
}
const creditOf = (c) => ({ author: (c.em.Artist?.value || '').replace(/<[^>]*>/g, '').trim() || 'unknown',
  license: c.em.LicenseShortName?.value || 'unknown',
  url: c.descurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(c.title)}`, attributionRequired: true });

const result = [];
for (const t of RETRY) {
  let picked = null; const tried = [];
  outer: for (const q of t.queries) {
    for (const c of await candidates(q)) {
      await sleep(500);
      const pc = await placeCheck(c.title, t.prefecture, t.local);
      if (pc.verdict !== 'ok') { tried.push({ title: c.title, stage: 'meta', verdict: pc.verdict, others: pc.others }); continue; }
      await sleep(900);
      const dl = await fetch(c.url, { headers: UA });
      if (!dl.ok) { tried.push({ title: c.title, stage: 'dl', reason: dl.status }); continue; }
      const buf = Buffer.from(await dl.arrayBuffer());
      const h = await judge('claude-haiku-4-5', buf, `${t.name}（${t.prefecture}）`);
      if (h.verdict !== 'ok') { tried.push({ title: c.title, stage: 'haiku', ...h }); continue; }
      await sleep(700);
      const s = await judge('claude-sonnet-4-6', buf, `${t.name}（${t.prefecture}）`);   // 再取得分は必ずSonnetも通す
      tried.push({ title: c.title, stage: 'sonnet', haiku: h, sonnet: s, meta: pc.verdict });
      if (s.verdict !== 'ok') continue;
      picked = { c, buf, h, s, pc }; break outer;
    }
  }
  if (!picked) { console.log(`  ❌ ${t.name}: 差し替え候補なし`); result.push({ id: t.id, ok: false, tried }); }
  else {
    fs.mkdirSync(path.join('public/images', t.id), { recursive: true });
    await sharp(picked.buf).jpeg({ quality: 88 }).toFile(path.join('public/images', t.id, 'main.jpg'));
    console.log(`  ✅ ${t.name}: ${picked.c.title.replace('File:','')}  [meta=${picked.pc.verdict} Haiku+Sonnet]`);
    console.log(`      ${picked.s.reason}`);
    result.push({ id: t.id, ok: true, title: picked.c.title, credit: creditOf(picked.c), tried });
  }
}
fs.writeFileSync('logs/new_dest_images_retry.json', JSON.stringify(result, null, 1));
