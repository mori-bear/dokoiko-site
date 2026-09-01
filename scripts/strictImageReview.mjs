#!/usr/bin/env node
/**
 * strictImageReview.mjs — 取得済みの main.jpg を、旅先の紹介画像として使えるかという
 * 厳しい基準で Sonnet に審査させる。
 *
 * 背景: kyushuDestImages.mjs の Haiku 判定は「その場所だと特定できるか」を重く見るため、
 * 駅舎・市役所・中学校・空港ターミナル・道の駅の看板・災害の航空写真まで通してしまった。
 * 場所は特定できても、旅先の紹介画像としては使えない。
 * ここでは「この写真を見て行きたくなるか」を基準に、もう一段落とす。
 *
 * usage: node scripts/strictImageReview.mjs <report.json> [出力先]
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import Anthropic from '@anthropic-ai/sdk';

const env = fs.readFileSync('./.env', 'utf-8');
for (const line of env.split('\n')) { const m = line.match(/^([A-Z_]+)=(.+)$/); if (m) process.env[m[1]] = m[2].trim(); }
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const SONNET = 'claude-sonnet-4-6';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SRC = process.argv[2] || 'logs/refill_images1.json';
const OUT = process.argv[3] || SRC.replace('.json', '_strict.json');

const SYSTEM = `あなたは旅行サイトの写真編集者です。ある旅先のトップに大きく出す1枚として使えるかを判定します。

使えないもの（場所が特定できても不可）:
・駅舎、駅のホーム、駅名標、バス停、空港ターミナル
・市役所、学校、信用金庫、病院などの一般建物
・駐車場、道路、道の駅の看板、案内看板、標識が主役のもの
・災害の記録写真、工事現場、航空写真の記録カット
・屋内の資料展示、物のクローズアップ、人物のポートレート
・地図、図表、イラスト、ロゴ
・極端に暗い、白飛び、ブレている、被写体が小さすぎる

使えるもの:
・その土地の自然、街並み、湯屋、社寺、海や山の景観など、見て行きたくなる風景

JSONのみで返答:
{"verdict":"ok"|"ng","subject":"写っているものを20字で","reason":"30字以内の理由"}`;

const report = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { pass: [], fail: [] };
const done = new Set([...prev.pass.map((x) => x.id), ...prev.fail.map((x) => x.id)]);

for (const x of report.adopted) {
  if (done.has(x.id)) continue;
  const file = path.join('public/images', x.id, 'main.jpg');
  if (!fs.existsSync(file)) { console.log(`  -- ${x.id}: main.jpg が無い`); continue; }
  const b64 = (await sharp(file).resize({ width: 640, withoutEnlargement: true })
    .jpeg({ quality: 75 }).toBuffer()).toString('base64');
  let v;
  try {
    const res = await client.messages.create({
      model: SONNET, max_tokens: 250, system: SYSTEM,
      messages: [{ role: 'user', content: [
        { type: 'text', text: `旅先: ${x.name ?? x.id}\nこの写真をトップの1枚に使えるか判定。` },
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } },
      ] }],
    });
    let t = res.content[0].text.trim();
    const s = t.indexOf('{'), e = t.lastIndexOf('}');
    if (s >= 0) t = t.slice(s, e + 1);
    v = JSON.parse(t);
  } catch (err) {
    console.log(`  !! ${x.id}: ${String(err).slice(0, 60)}`);
    continue;
  }
  const rec = { id: x.id, title: x.title, subject: v.subject, reason: v.reason };
  (v.verdict === 'ok' ? prev.pass : prev.fail).push(rec);
  console.log(`${v.verdict === 'ok' ? '✅' : '❌'} ${x.id.padEnd(22)} ${String(v.subject ?? '').slice(0, 26).padEnd(28)} ${v.reason ?? ''}`);
  fs.writeFileSync(OUT, JSON.stringify(prev, null, 1));
  await sleep(400);
}
console.log(`\n通過 ${prev.pass.length} / 落選 ${prev.fail.length} → ${OUT}`);
