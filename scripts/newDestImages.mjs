#!/usr/bin/env node
/**
 * newDestImages.mjs — 新規destination候補のメイン画像を Wikimedia Commons から取得し、
 * 2段階 Vision 検証（Haiku 一次 → グレーゾーンのみ Sonnet 再判定）を通す。
 *
 * 2段階にする理由: Haiku は「それらしい風景」を安く弾けるが、被写体の同定が弱く
 * 「日本のどこかの寺」を目的の寺だと通してしまうことがある。断定要素（社号標・地名看板・
 * 特徴的な建造物）が読み取れないと自己申告した場合だけ Sonnet に回して確定させる。
 *
 * 合格した候補だけ public/images/<id>/main.jpg に保存し、
 * logs/new_dest_images.json に結果（採用/不採用の理由・クレジット）を残す。
 * 不合格の候補は destination 自体を採用しない（品質ゲート）。
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import Anthropic from '@anthropic-ai/sdk';

const env = fs.readFileSync('./.env', 'utf-8');
for (const line of env.split('\n')) { const m = line.match(/^([A-Z_]+)=(.+)$/); if (m) process.env[m[1]] = m[2].trim(); }
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const HAIKU = 'claude-haiku-4-5';
const SONNET = 'claude-sonnet-4-6';
const UA = { 'User-Agent': 'DokoIko-DataAudit/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const IMAGES_DIR = 'public/images';
const OUT = 'logs/new_dest_images.json';

const SYSTEM = `あなたは旅行サイトの画像審査担当です。指定された旅先の紹介画像として使えるかを判定します。
不可の例: 別の場所の写真、屋内の資料展示だけ、人物のポートレート、文字やロゴの焼き込み、
地図・図表・イラスト、極端に暗い/ブレている、被写体が小さすぎて何か分からない。
JSONのみで返答: {"verdict":"ok"|"ng","identifiable":true|false,"reason":"40字以内"}
identifiable は「その場所だと断定できる手がかり（社号標・特徴的建造物・地形・看板）が写っているか」。`;

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

async function candidates(query, limit = 6) {
  const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search` +
    `&gsrsearch=${encodeURIComponent('filetype:bitmap ' + query)}&gsrnamespace=6&gsrlimit=${limit * 2}` +
    `&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1600`;
  const j = await (await fetch(api, { headers: UA })).json();
  const pages = Object.values(j.query?.pages || {}).sort((a, b) => a.index - b.index);
  const out = [];
  for (const p of pages) {
    const ii = p.imageinfo?.[0];
    if (!ii || ii.width < 1200 || ii.width <= ii.height) continue;   // 横長・十分な解像度のみ
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

const targets = JSON.parse(fs.readFileSync('logs/new_dest_targets.json', 'utf8'));
const report = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { adopted: [], rejected: [] };
const done = new Set([...report.adopted.map(x => x.id), ...report.rejected.map(x => x.id)]);

for (const t of targets) {
  if (done.has(t.id)) { console.log(`  skip ${t.name}（判定済み）`); continue; }
  const ctx = `${t.name}（${t.prefecture}）`;
  let cands = await candidates(t.imageQuery);
  if (cands.length < 3) cands = cands.concat(await candidates(`${t.name} ${t.prefecture}`));
  let picked = null; const tried = [];

  for (const c of cands) {
    await sleep(1200);
    let buf;
    try {
      const dl = await fetch(c.url, { headers: UA });
      if (!dl.ok) { tried.push({ title: c.title, stage: 'download', reason: `HTTP ${dl.status}` }); continue; }
      buf = Buffer.from(await dl.arrayBuffer());
    } catch (e) { tried.push({ title: c.title, stage: 'download', reason: String(e).slice(0, 40) }); continue; }

    const h = await judge(HAIKU, buf, ctx);
    if (h.verdict !== 'ok') { tried.push({ title: c.title, stage: 'haiku', ...h }); continue; }

    // グレーゾーン: Haiku が ok でも「その場所だと断定できない」と言った場合は Sonnet で確定させる
    if (h.identifiable === false) {
      await sleep(800);
      const s = await judge(SONNET, buf, ctx);
      tried.push({ title: c.title, stage: 'sonnet', haiku: h, sonnet: s });
      if (s.verdict !== 'ok') continue;
      picked = { c, buf, verdict: { haiku: h, sonnet: s } };
    } else {
      tried.push({ title: c.title, stage: 'haiku', ...h });
      picked = { c, buf, verdict: { haiku: h } };
    }
    break;
  }

  if (!picked) {
    report.rejected.push({ id: t.id, name: t.name, reason: '合格画像なし', tried });
    console.log(`  ❌ ${t.name}: 合格画像なし（${tried.length}枚試行）`);
  } else {
    fs.mkdirSync(path.join(IMAGES_DIR, t.id), { recursive: true });
    await sharp(picked.buf).jpeg({ quality: 88 }).toFile(path.join(IMAGES_DIR, t.id, 'main.jpg'));
    report.adopted.push({ id: t.id, name: t.name, title: picked.c.title,
      credit: creditOf(picked.c), verdict: picked.verdict, tried });
    const via = picked.verdict.sonnet ? 'Haiku→Sonnet' : 'Haiku';
    console.log(`  ✅ ${t.name}: ${picked.c.title.replace('File:', '').slice(0, 46)} [${via}]`);
  }
  fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
  await sleep(1500);
}
console.log(`\n採用 ${report.adopted.length} / 不採用 ${report.rejected.length}`);
