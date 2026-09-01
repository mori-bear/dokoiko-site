#!/usr/bin/env node
/**
 * kurokawaSpotImage.mjs — 黒川温泉の spot 画像候補を落として2段階Visionに掛ける。
 * ハナミズキ誤画像（Benthamidia_florida7.jpg）の差し替え先を選ぶための下ごしらえ。
 * 判定に通ったものを scratch に並べ、最後は目視で決める。
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import Anthropic from '@anthropic-ai/sdk';

const env = fs.readFileSync('./.env', 'utf-8');
for (const line of env.split('\n')) { const m = line.match(/^([A-Z_]+)=(.+)$/); if (m) process.env[m[1]] = m[2].trim(); }
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const HAIKU = 'claude-haiku-4-5', SONNET = 'claude-sonnet-4-6';
const UA = { 'User-Agent': 'DokoIko-DataAudit/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const OUTDIR = process.argv[2] || 'logs/kurokawa_cand';
fs.mkdirSync(OUTDIR, { recursive: true });

const CAND = [
  'File:Kurokawa-onsen.jpg',
  'File:Kurokawa onsen 001.JPG',
  'File:黒川温泉 - panoramio.jpg',
  'File:黒川温泉 (268553622).jpg',
  'File:黒川温泉 (268552393).jpg',
  'File:黒川温泉 (268552178).jpg',
  'File:Kurokawa Onsen-1.jpg',
  'File:Kurokawa Onsen-2.jpg',
  'File:Street in Kurokawa Onsen.jpg',
  'File:Kurokawa-Onsen Light-up.jpg',
  'File:黒川温泉穴湯1 - panoramio.jpg',
  'File:黒川温泉穴湯2 - panoramio.jpg',
  'File:Yumotosō -Kurokawa Onsen.jpg',
  'File:Ikoi ryokan -Kurokawa Onsen.jpg',
];

const SYSTEM = `あなたは旅行サイトの画像審査担当です。指定された旅先の紹介画像として使えるかを判定します。
不可の例: 別の場所の写真、屋内の資料展示だけ、人物のポートレート、文字やロゴの焼き込み、
地図・図表・イラスト、極端に暗い/ブレている、被写体が小さすぎて何か分からない。
JSONのみで返答: {"verdict":"ok"|"ng","identifiable":true|false,"subject":"写っているものを20字で","reason":"40字以内"}
identifiable は「その場所だと断定できる手がかり（看板・特徴的建造物・地形・湯屋の造り）が写っているか」。`;

async function judge(model, buf, ctx) {
  const b64 = (await sharp(buf).resize({ width: 640, withoutEnlargement: true }).jpeg({ quality: 75 }).toBuffer()).toString('base64');
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

const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json`
  + `&titles=${encodeURIComponent(CAND.join('|'))}&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1600`;
const j = await (await fetch(api, { headers: UA })).json();
const out = [];
let n = 0;
for (const p of Object.values(j.query.pages)) {
  const ii = p.imageinfo?.[0]; if (!ii) continue;
  const em = ii.extmetadata || {};
  const buf = Buffer.from(await (await fetch(ii.thumburl || ii.url, { headers: UA })).arrayBuffer());
  const file = path.join(OUTDIR, `${String(++n).padStart(2, '0')}.jpg`);
  await sharp(buf).resize({ width: 1200, withoutEnlargement: true }).jpeg({ quality: 82 }).toFile(file);
  const h = await judge(HAIKU, buf, '黒川温泉（熊本県南小国町）');
  const s = h.identifiable ? null : await judge(SONNET, buf, '黒川温泉（熊本県南小国町）');
  const v = s || h;
  out.push({ n, title: p.title, file, w: ii.width, h: ii.height,
    license: em.LicenseShortName?.value, author: (em.Artist?.value || '').replace(/<[^>]*>/g, '').trim(),
    descurl: ii.descriptionurl, desc: String(em.ImageDescription?.value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
    haiku: h, sonnet: s, verdict: v.verdict, identifiable: v.identifiable, subject: v.subject });
  console.log(`${String(n).padStart(2)} ${v.verdict === 'ok' ? '✅' : '❌'} id=${String(v.identifiable).padEnd(5)} ${String(em.LicenseShortName?.value).padEnd(12)} ${p.title.replace('File:', '').slice(0, 40).padEnd(42)} ${v.subject || ''} / ${v.reason || ''}`);
}
fs.writeFileSync('logs/kurokawa_cand.json', JSON.stringify(out, null, 2));
console.log(`\n候補 ${out.length}件 → ${OUTDIR}/ ・ logs/kurokawa_cand.json`);
