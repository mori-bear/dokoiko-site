#!/usr/bin/env node
/**
 * kyushuDestImages.mjs — 九州の新規destination候補のメイン画像を Commons から取得する。
 *
 * newDestImages.mjs との違い: 「Commonsメタデータ照合」を Vision より前に置き、
 * 同名異所を画素判定に到達する前に落とす。
 *   実測(2026-08-26)で Haiku は南房総白浜に和歌山の写真を identifiable:true で通した。
 *   Commons のカテゴリ/説明文に他県名が出れば ng と判定できるので、こちらが先。
 *
 * 判定順: 候補取得 → placeCheck(ng は即棄却) → Haiku → identifiable:false なら Sonnet
 * 合格した候補だけ public/images/<id>/main.jpg に保存。不合格はdestination自体を不採用。
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import Anthropic from '@anthropic-ai/sdk';
import { placeCheck } from './commonsPlaceCheck.mjs';

const env = fs.readFileSync('./.env', 'utf-8');
for (const line of env.split('\n')) { const m = line.match(/^([A-Z_]+)=(.+)$/); if (m) process.env[m[1]] = m[2].trim(); }
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const HAIKU = 'claude-haiku-4-5';
const SONNET = 'claude-sonnet-4-6';
const UA = { 'User-Agent': 'DokoIko-DataAudit/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const IMAGES_DIR = 'public/images';
// 追加分を別ファイルで流せるように引数で差し替え可能にする
// usage: node scripts/kyushuDestImages.mjs [targetsPath] [outPath]
const TARGETS = process.argv[2] || 'logs/kyushu_targets.json';
const OUT = process.argv[3] || 'logs/kyushu_images.json';

const SYSTEM = `あなたは旅行サイトの画像審査担当です。指定された旅先の紹介画像として使えるかを判定します。
不可の例: 別の場所の写真、屋内の資料展示だけ、人物のポートレート、文字やロゴの焼き込み、
地図・図表・イラスト、極端に暗い/ブレている、被写体が小さすぎて何か分からない。
JSONのみで返答: {"verdict":"ok"|"ng","identifiable":true|false,"reason":"40字以内"}
identifiable は「その場所だと断定できる手がかり（看板・特徴的建造物・地形・湯屋の造り）が写っているか」。`;

async function judge(model, buf, ctx) {
  const b64 = (await sharp(buf).resize({ width: 640, withoutEnlargement: true })
    .jpeg({ quality: 75 }).toBuffer()).toString('base64');
  const res = await client.messages.create({
    model, max_tokens: 300, system: SYSTEM,
    messages: [{ role: 'user', content: [
      { type: 'text', text: `旅先: ${ctx}\nこの画像は紹介画像として適切か判定。` },
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } },
    ] }],
  });
  let t = res.content[0].text.trim();
  const s = t.indexOf('{'), e = t.lastIndexOf('}');
  if (s >= 0) t = t.slice(s, e + 1);
  try { return JSON.parse(t); } catch { return { verdict: 'ng', identifiable: false, reason: 'JSON解析不可' }; }
}

async function candidates(query, limit = 8) {
  const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search`
    + `&gsrsearch=${encodeURIComponent('filetype:bitmap ' + query)}&gsrnamespace=6&gsrlimit=${limit * 2}`
    + `&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1600`;
  const j = await (await fetch(api, { headers: UA })).json();
  const pages = Object.values(j.query?.pages || {}).sort((a, b) => a.index - b.index);
  const out = [];
  for (const p of pages) {
    const ii = p.imageinfo?.[0];
    // 横長・十分な解像度のみ。比が2.4を超えるものはCommonsのバナー画像で、
    // ヒーローにもXのカードにも収まらないので弾く。
    if (!ii || ii.width < 1200 || ii.width <= ii.height || ii.width / ii.height > 2.4) continue;
    out.push({ title: p.title, url: ii.thumburl || ii.url, descurl: ii.descriptionurl, em: ii.extmetadata || {} });
    if (out.length >= limit) break;
  }
  return out;
}

const creditOf = (c) => ({
  author: (c.em.Artist?.value || '').replace(/<[^>]*>/g, '').trim() || 'unknown',
  license: c.em.LicenseShortName?.value || 'unknown',
  url: c.descurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(c.title)}`,
  attributionRequired: true,
});

const targets = JSON.parse(fs.readFileSync(TARGETS, 'utf8'));
const report = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { adopted: [], rejected: [] };
const done = new Set([...report.adopted.map((x) => x.id), ...report.rejected.map((x) => x.id)]);

for (const t of targets) {
  if (done.has(t.id)) { console.log(`  skip ${t.name}（判定済み）`); continue; }
  const ctx = `${t.name}（${t.prefecture}）`;
  let cands = await candidates(t.imageQuery);
  if (cands.length < 3) cands = cands.concat(await candidates(`${t.name} ${t.prefecture}`));
  let picked = null; const tried = [];

  for (const c of cands) {
    // ① Commonsメタ照合（無料・確実）。他県の写真ならここで落とす
    let pc;
    try { pc = await placeCheck(c.title, t.prefecture, t.localityWords || []); }
    catch (e) { tried.push({ title: c.title, stage: 'placeCheck', reason: String(e).slice(0, 40) }); continue; }
    await sleep(400);
    if (pc.verdict === 'ng') {
      tried.push({ title: c.title, stage: 'placeCheck', verdict: 'ng', others: pc.others });
      continue;
    }

    // ② 画像取得
    let buf;
    try {
      const dl = await fetch(c.url, { headers: UA });
      if (!dl.ok) { tried.push({ title: c.title, stage: 'download', reason: `HTTP ${dl.status}` }); continue; }
      buf = Buffer.from(await dl.arrayBuffer());
    } catch (e) { tried.push({ title: c.title, stage: 'download', reason: String(e).slice(0, 40) }); continue; }

    // ③ Haiku → グレーゾーンのみ Sonnet
    const h = await judge(HAIKU, buf, ctx);
    if (h.verdict !== 'ok') { tried.push({ title: c.title, stage: 'haiku', placeCheck: pc.verdict, ...h }); continue; }

    // placeCheck が weak（根拠なし）の場合も Sonnet で確定させる
    if (h.identifiable === false || pc.verdict === 'weak') {
      await sleep(800);
      const s = await judge(SONNET, buf, ctx);
      tried.push({ title: c.title, stage: 'sonnet', placeCheck: pc.verdict, haiku: h, sonnet: s });
      if (s.verdict !== 'ok') continue;
      picked = { c, buf, pc, verdict: { haiku: h, sonnet: s } };
    } else {
      tried.push({ title: c.title, stage: 'haiku', placeCheck: pc.verdict, ...h });
      picked = { c, buf, pc, verdict: { haiku: h } };
    }
    break;
  }

  if (!picked) {
    report.rejected.push({ id: t.id, name: t.name, reason: '合格画像なし', tried });
    console.log(`  ❌ ${t.name}: 合格画像なし（${tried.length}枚試行）`);
  } else {
    fs.mkdirSync(path.join(IMAGES_DIR, t.id), { recursive: true });
    await sharp(picked.buf).resize({ width: 1600, withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true, progressive: true })
      .toFile(path.join(IMAGES_DIR, t.id, 'main.jpg'));
    report.adopted.push({ id: t.id, name: t.name, title: picked.c.title,
      placeCheck: picked.pc.verdict, credit: creditOf(picked.c), verdict: picked.verdict, tried });
    const via = picked.verdict.sonnet ? 'Haiku→Sonnet' : 'Haiku';
    console.log(`  ✅ ${t.name}: ${picked.c.title.replace('File:', '').slice(0, 46)} [place=${picked.pc.verdict} / ${via}]`);
  }
  fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
  await sleep(1200);
}
console.log(`\n採用 ${report.adopted.length} / 不採用 ${report.rejected.length}`);
