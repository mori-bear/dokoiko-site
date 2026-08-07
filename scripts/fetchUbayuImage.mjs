#!/usr/bin/env node
/**
 * fetchUbayuImage.mjs — 姥湯温泉のヒーロー画像を Commons から取得し、
 * 2段階 Vision（Haiku で一次選抜 → Sonnet で最終確認）を通してから採用する。
 *
 * 盲目取得は内容が保証されないため、候補ごとに必ず両モデルの合意を取る。
 * 採用時は public/images/ubayu-onsen/main.jpg と imageCredit を更新する。
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import Anthropic from '@anthropic-ai/sdk';

const env = fs.readFileSync('./.env', 'utf-8');
for (const l of env.split('\n')) { const m = l.match(/^([A-Z_]+)=(.+)$/); if (m) process.env[m[1]] = m[2].trim(); }
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const HAIKU = 'claude-haiku-4-5-20251001';
const SONNET = 'claude-sonnet-4-6';

const ID = 'ubayu-onsen';
const OUT_DIR = `public/images/${ID}`;
const DEST_FILE = 'src/data/destinations.json';
const UA = { 'User-Agent': 'DokoIko/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const QUERIES = [
  '姥湯温泉',
  '姥湯温泉 桝形屋',
  'Ubayu Onsen',
  '姥湯 露天風呂 山形',
  '吾妻連峰 姥湯',
];

const CONTEXT = `山形県米沢市の秘湯「姥湯温泉」。吾妻連峰の標高約1300mの谷底にあり、
切り立った岩壁に囲まれた乳白色の硫黄泉の野天風呂と、一軒宿「桝形屋」で知られる。`;

const CRITERIA = `次をすべて満たすときのみ ok:
- 日本の山中の温泉地の風景であり、姥湯温泉（岩壁に囲まれた谷／野天風呂／山中の一軒宿）として矛盾しない
- 別の温泉地・別の観光地・海・都市・人物アップ・料理・室内・地図やイラストではない
- 文字やロゴ、PR透かしの焼き込みがない
- 極端な縦長/横長や不自然な見切れがない
判断に迷う場合は ng。`;

async function judge(model, buf, extra = '') {
  const b64 = (await sharp(buf).resize({ width: 720, withoutEnlargement: true }).jpeg({ quality: 78 }).toBuffer()).toString('base64');
  const res = await client.messages.create({
    model, max_tokens: 300,
    system: `あなたは日本の旅行サイトの画像監査担当です。${CRITERIA}\nJSONのみ返す: {"verdict":"ok"|"ng","reason":"日本語で簡潔に"}`,
    messages: [{ role: 'user', content: [
      { type: 'text', text: `対象: ${CONTEXT}\n${extra}この画像をヒーロー画像として採用してよいか判定。` },
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } },
    ] }],
  });
  let t = res.content[0].text.trim();
  const s = t.indexOf('{'), e = t.lastIndexOf('}');
  if (s >= 0) t = t.slice(s, e + 1);
  try { const j = JSON.parse(t); return { ok: j.verdict === 'ok', reason: j.reason || '' }; }
  catch { return { ok: false, reason: 'パース失敗' }; }
}

async function search(q) {
  const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search`
    + `&gsrsearch=${encodeURIComponent('filetype:bitmap ' + q)}&gsrnamespace=6&gsrlimit=12`
    + `&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1600`;
  const j = await (await fetch(api, { headers: UA })).json();
  return Object.values(j.query?.pages || {}).sort((a, b) => a.index - b.index);
}

const seen = new Set();
let adopted = null;

outer:
for (const q of QUERIES) {
  console.log(`\n🔍 検索: ${q}`);
  const pages = await search(q);
  for (const p of pages) {
    const ii = p.imageinfo?.[0];
    if (!ii || seen.has(p.title)) continue;
    seen.add(p.title);
    if (ii.width < 1000 || ii.width <= ii.height) continue;   // 横長・十分な解像度のみ
    await sleep(800);
    let buf;
    try {
      const dl = await fetch(ii.thumburl || ii.url, { headers: UA });
      if (!dl.ok) continue;
      buf = Buffer.from(await dl.arrayBuffer());
    } catch { continue; }

    process.stdout.write(`   候補 ${p.title.replace('File:', '').slice(0, 60)} … `);
    const h = await judge(HAIKU, buf);
    if (!h.ok) { console.log(`Haiku ng（${h.reason.slice(0, 40)}）`); continue; }
    const s = await judge(SONNET, buf, '一次審査は通過済み。厳しめに最終判断すること。');
    if (!s.ok) { console.log(`Haiku ok → Sonnet ng（${s.reason.slice(0, 40)}）`); continue; }

    console.log(`✅ 両モデル ok`);
    console.log(`      Haiku : ${h.reason}`);
    console.log(`      Sonnet: ${s.reason}`);
    const em = ii.extmetadata || {};
    adopted = {
      buf, title: p.title, width: ii.width, height: ii.height,
      credit: {
        author: (em.Artist?.value || '').replace(/<[^>]*>/g, '').trim() || 'unknown',
        license: em.LicenseShortName?.value || 'unknown',
        url: ii.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title)}`,
        attributionRequired: true,
      },
    };
    break outer;
  }
}

if (!adopted) { console.log('\n❌ 2段階検証を通過する画像が見つかりませんでした（データ未変更）'); process.exit(1); }

fs.mkdirSync(OUT_DIR, { recursive: true });
const outPath = path.join(OUT_DIR, 'main.jpg');
await sharp(adopted.buf).jpeg({ quality: 88 }).toFile(outPath);

const D = JSON.parse(fs.readFileSync(DEST_FILE, 'utf8'));
const d = D.find(x => x.id === ID);
d.imageCredit = adopted.credit;
// 無関係だった Unsplash 画像（夜の街）への参照を除去
for (const k of ['unsplashUrl', 'unsplashThumbUrl', 'unsplashCredit', 'unsplashCreditUrl', 'unsplashPhotoUrl']) delete d[k];
fs.writeFileSync(DEST_FILE, JSON.stringify(D, null, 2));

console.log(`\n📸 採用: ${adopted.title}（${adopted.width}x${adopted.height}）`);
console.log(`   保存: ${outPath}`);
console.log(`   credit: ${adopted.credit.author} / ${adopted.credit.license}`);
console.log(`   無関係だった unsplash* フィールドを削除`);
