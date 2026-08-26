#!/usr/bin/env node
/**
 * newDestSpotImages.mjs — 新規destinationのスポット画像(3枚/件)を取得する。
 * 検証は main 画像と同じ3段構え:
 *   ① Commons メタデータ照合（他県の同名地でないか）… 無料・決定的
 *   ② Haiku で内容判定
 *   ③ Haiku が「断定できない」と言った場合のみ Sonnet で確定
 * どれかで落ちた枚は採用せず、imageUrl 無しのスポットとして残す
 * （spot画像はページ表示上は任意。main画像と違い、欠けても destination は採用できる）。
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
const OUT = 'logs/new_dest_spot_images.json';

const SYSTEM = `あなたは旅行サイトの画像審査担当です。指定されたスポットの紹介画像として使えるかを判定します。
主題がそのスポットそのものかを見ます。別の場所が主役、屋内の展示パネルだけ、地図・図表、
人物のポートレート、文字やロゴの焼き込み、暗すぎ・ブレは ng。
JSONのみ: {"verdict":"ok"|"ng","identifiable":true|false,"reason":"40字以内"}`;

async function judge(model, buf, ctx) {
  const b64 = (await sharp(buf).resize({ width: 640, withoutEnlargement: true }).jpeg({ quality: 75 }).toBuffer()).toString('base64');
  const res = await client.messages.create({ model, max_tokens: 300, system: SYSTEM,
    messages: [{ role: 'user', content: [
      { type: 'text', text: `スポット: ${ctx}\nこの画像は紹介画像として適切か判定。` },
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } }] }] });
  let t = res.content[0].text.trim(); const s = t.indexOf('{'), e = t.lastIndexOf('}');
  if (s >= 0) t = t.slice(s, e + 1);
  try { return JSON.parse(t); } catch { return { verdict: 'ng', reason: 'JSON解析不可' }; }
}
async function candidates(query, limit = 5) {
  const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search` +
    `&gsrsearch=${encodeURIComponent('filetype:bitmap ' + query)}&gsrnamespace=6&gsrlimit=${limit * 2}` +
    `&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1600`;
  const j = await (await fetch(api, { headers: UA })).json();
  const out = [];
  for (const p of Object.values(j.query?.pages || {}).sort((a, b) => a.index - b.index)) {
    const ii = p.imageinfo?.[0];
    if (!ii || ii.width < 900) continue;
    out.push({ title: p.title, url: ii.thumburl || ii.url, descurl: ii.descriptionurl, em: ii.extmetadata || {} });
    if (out.length >= limit) break;
  }
  return out;
}
const creditOf = (c) => ({ author: (c.em.Artist?.value || '').replace(/<[^>]*>/g, '').trim() || 'unknown',
  license: c.em.LicenseShortName?.value || 'unknown',
  url: c.descurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(c.title)}`, attributionRequired: true });

const LOCAL = {
  jindaiji:['深大寺','調布','Jindai'], kunitachi:['国立','Kunitachi'], 'todoroki-keikoku':['等々力','世田谷','Todoroki'],
  gyoda:['行田','忍城','Oshi','Gyoda'], kinchakuda:['巾着田','日高','日和田','Kinchaku'],
  'soka-matsubara':['草加','Soka','Sōka'], fukaya:['深谷','Fukaya','煉瓦','渋沢'],
  higashichichibu:['東秩父','和紙','秩父','大霧山'], kisarazu:['木更津','江川','證誠','Kisarazu'],
  'futtsu-misaki':['富津','海堡','Futtsu'], 'kasamori-kannon':['笠森','長南','Kasamori'],
  'shirahama-boso':['野島','南房総','白浜 千葉','フラワーライン','Nojima'],
  'kawasaki-daishi':['川崎','平間寺','Kawasaki'], miyagase:['宮ヶ瀬','清川','Miyagase'],
  'oyama-afuri':['大山','阿夫利','伊勢原','Oyama','Afuri'], shomyoji:['称名寺','金沢文庫','Shomyo','Kanazawa-bunko'],
};

const content = JSON.parse(fs.readFileSync('scripts/newDestContent.json', 'utf8'));
const report = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};

for (const d of content) {
  report[d.id] ??= {};
  for (let i = 0; i < d.spots.length; i++) {
    const key = `spot-${i + 1}`;
    if (report[d.id][key]) continue;
    const sp = d.spots[i];
    const ctx = `${d.name}（${d.prefecture}）の${sp.name}`;
    let picked = null; const tried = [];
    for (const c of await candidates(sp.q)) {
      await sleep(450);
      const pc = await placeCheck(c.title, d.prefecture, LOCAL[d.id] || []);
      if (pc.verdict === 'ng') { tried.push({ t: c.title, stage: 'meta', v: 'ng', others: pc.others }); continue; }
      await sleep(900);
      let buf; try {
        const dl = await fetch(c.url, { headers: UA });
        if (!dl.ok) { tried.push({ t: c.title, stage: 'dl', v: dl.status }); continue; }
        buf = Buffer.from(await dl.arrayBuffer());
      } catch { tried.push({ t: c.title, stage: 'dl', v: 'err' }); continue; }
      const h = await judge('claude-haiku-4-5', buf, ctx);
      if (h.verdict !== 'ok') { tried.push({ t: c.title, stage: 'haiku', ...h }); continue; }
      let s = null;
      if (h.identifiable === false || pc.verdict === 'weak') {   // グレーゾーンは Sonnet で確定
        await sleep(700);
        s = await judge('claude-sonnet-4-6', buf, ctx);
        tried.push({ t: c.title, stage: 'sonnet', haiku: h, sonnet: s, meta: pc.verdict });
        if (s.verdict !== 'ok') continue;
      } else tried.push({ t: c.title, stage: 'haiku', ...h, meta: pc.verdict });
      picked = { c, buf, h, s, pc }; break;
    }
    if (!picked) {
      report[d.id][key] = { ok: false, tried };
      console.log(`  ―  ${d.name}/${sp.name}: 合格画像なし`);
    } else {
      fs.mkdirSync(path.join('public/images', d.id), { recursive: true });
      await sharp(picked.buf).jpeg({ quality: 88 }).toFile(path.join('public/images', d.id, `${key}.jpg`));
      report[d.id][key] = { ok: true, title: picked.c.title, imageUrl: picked.c.url,
        credit: creditOf(picked.c), via: picked.s ? 'Haiku→Sonnet' : 'Haiku', meta: picked.pc.verdict };
      console.log(`  ✅ ${d.name}/${sp.name}: ${picked.c.title.replace('File:','').slice(0,40)} [${picked.s?'H→S':'H'}]`);
    }
    fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
    await sleep(900);
  }
}
const flat = Object.values(report).flatMap(o => Object.values(o));
console.log(`\nスポット画像 採用 ${flat.filter(x=>x.ok).length} / 全 ${flat.length}`);
