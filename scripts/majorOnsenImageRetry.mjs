#!/usr/bin/env node
/**
 * majorOnsenImageRetry.mjs — 目視で落とした温泉地の画像を、検索語を変えて拾い直す。
 *   飯坂温泉   … 一発目が駅舎＋マンションで温泉地に見えない
 *   新穂高温泉 … 山だけで温泉地の要素が無く、全体に暗い
 *   妙見温泉   … 候補が0件だった
 * 候補を全部落として並べ、2段階Visionの判定を添えて最後は目視で選ぶ。
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import Anthropic from '@anthropic-ai/sdk';
import { placeCheck } from './commonsPlaceCheck.mjs';

const env = fs.readFileSync('./.env', 'utf-8');
for (const line of env.split('\n')) { const m = line.match(/^([A-Z_]+)=(.+)$/); if (m) process.env[m[1]] = m[2].trim(); }
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const HAIKU = 'claude-haiku-4-5', SONNET = 'claude-sonnet-4-6';
const UA = { 'User-Agent': 'DokoIko-DataAudit/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TARGETS = [
  { id: 'iizaka', name: '飯坂温泉', prefecture: '福島県', words: ['飯坂', '福島'],
    queries: ['飯坂温泉 共同浴場', '鯖湖湯', 'Iizaka Onsen', '飯坂温泉 摺上川'] },
  { id: 'shinhotaka', name: '新穂高温泉', prefecture: '岐阜県', words: ['新穂高', '奥飛騨', '高山'],
    queries: ['新穂高ロープウェイ', '新穂高温泉 露天風呂', 'Shinhotaka Ropeway', '奥飛騨温泉郷 新穂高'] },
  { id: 'myoken-kagoshima', name: '妙見温泉', prefecture: '鹿児島県', words: ['妙見', '霧島', '天降川', '牧園'],
    queries: ['妙見温泉', '天降川 霧島市', 'Myoken Onsen', '妙見温泉 鹿児島'] },
];

const SYSTEM = `あなたは旅行サイトの画像審査担当です。指定された旅先の紹介画像として使えるかを判定します。
不可の例: 別の場所の写真、屋内の資料展示だけ、人物のポートレート、文字やロゴの焼き込み、
地図・図表・イラスト、極端に暗い/ブレている、被写体が小さすぎて何か分からない、
駅舎や駐車場だけで旅先の魅力が伝わらないもの。
JSONのみで返答: {"verdict":"ok"|"ng","identifiable":true|false,"subject":"写っているものを20字で","reason":"40字以内"}
identifiable は「その場所だと断定できる手がかり（看板・特徴的建造物・地形・湯屋の造り）が写っているか」。`;

async function judge(model, buf, ctx) {
  const b64 = (await sharp(buf).resize({ width: 640, withoutEnlargement: true }).jpeg({ quality: 75 }).toBuffer()).toString('base64');
  const res = await client.messages.create({ model, max_tokens: 300, system: SYSTEM,
    messages: [{ role: 'user', content: [
      { type: 'text', text: `旅先: ${ctx}\nこの画像は紹介画像として適切か判定。` },
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } }] }] });
  let t = res.content[0].text.trim();
  const s = t.indexOf('{'), e = t.lastIndexOf('}');
  if (s >= 0) t = t.slice(s, e + 1);
  try { return JSON.parse(t); } catch { return { verdict: 'ng', identifiable: false, reason: 'JSON解析不可' }; }
}

async function search(query, limit = 8) {
  const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search`
    + `&gsrsearch=${encodeURIComponent('filetype:bitmap ' + query)}&gsrnamespace=6&gsrlimit=${limit * 2}`
    + `&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1600`;
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

const report = [];
for (const t of TARGETS) {
  const dir = `logs/retry_${t.id}`;
  fs.mkdirSync(dir, { recursive: true });
  const seen = new Set();
  let n = 0;
  console.log(`\n■ ${t.name}`);
  for (const q of t.queries) {
    for (const c of await search(q)) {
      if (seen.has(c.title)) continue;
      seen.add(c.title);
      const pc = await placeCheck(c.title, t.prefecture, t.words).catch(() => ({ verdict: 'weak' }));
      await sleep(300);
      if (pc.verdict === 'ng') { console.log(`   -- place=ng  ${c.title.replace('File:', '').slice(0, 44)}`); continue; }
      let buf;
      try { buf = Buffer.from(await (await fetch(c.url, { headers: UA })).arrayBuffer()); }
      catch { continue; }
      const h = await judge(HAIKU, buf, `${t.name}（${t.prefecture}）`);
      const s = (h.verdict === 'ok' && (h.identifiable === false || pc.verdict === 'weak')) ? await judge(SONNET, buf, `${t.name}（${t.prefecture}）`) : null;
      const v = s || h;
      const file = path.join(dir, `${String(++n).padStart(2, '0')}.jpg`);
      await sharp(buf).resize({ width: 1200, withoutEnlargement: true }).jpeg({ quality: 82 }).toFile(file);
      report.push({ id: t.id, n, file, title: c.title, descurl: c.descurl,
        author: (c.em.Artist?.value || '').replace(/<[^>]*>/g, '').split(/\n|This photo was taken/)[0].replace(/\s+/g, ' ').trim() || 'unknown',
        license: c.em.LicenseShortName?.value || 'unknown', place: pc.verdict, verdict: v.verdict, subject: v.subject, reason: v.reason });
      console.log(`   ${String(n).padStart(2)} ${v.verdict === 'ok' ? '✅' : '❌'} place=${String(pc.verdict).padEnd(4)} ${c.title.replace('File:', '').slice(0, 42).padEnd(44)} ${v.subject || ''}`);
      await sleep(500);
    }
  }
}
fs.writeFileSync('logs/major_retry.json', JSON.stringify(report, null, 2));
console.log(`\n候補 ${report.length}件 → logs/major_retry.json`);
