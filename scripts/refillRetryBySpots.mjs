#!/usr/bin/env node
/**
 * refillRetryBySpots.mjs — 厳格審査で落ちたページの画像を拾い直す。
 *
 * 1回目の検索語は「地名＋県名」だったため、駅舎・市役所・空港のような
 * 「地名で引くと出てくるが旅先の絵にならないもの」が上位に来ていた。
 * ここではそのページ自身の spots に書かれている見どころの名前を検索語にする。
 * 紹介文で挙げている場所こそ、トップに出すべき被写体だという考え方。
 *
 * 判定は placeCheck → Haiku → Sonnet（strictImageReview と同じ厳しい基準）の順。
 * usage: node scripts/refillRetryBySpots.mjs <strict.json> <images.json> [出力先]
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

const STRICT = process.argv[2] || 'logs/refill_images1_strict.json';
const IMAGES = process.argv[3] || 'logs/refill_images1.json';
const OUT = process.argv[4] || 'logs/refill_retry1.json';

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

async function judge(model, buf, ctx) {
  const b64 = (await sharp(buf).resize({ width: 640, withoutEnlargement: true })
    .jpeg({ quality: 75 }).toBuffer()).toString('base64');
  const res = await client.messages.create({
    model, max_tokens: 250, system: SYSTEM,
    messages: [{ role: 'user', content: [
      { type: 'text', text: `旅先: ${ctx}\nこの写真をトップの1枚に使えるか判定。` },
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } },
    ] }],
  });
  let t = res.content[0].text.trim();
  const s = t.indexOf('{'), e = t.lastIndexOf('}');
  if (s >= 0) t = t.slice(s, e + 1);
  try { return JSON.parse(t); } catch { return { verdict: 'ng', reason: 'JSON解析不可' }; }
}

// Commons への接続は ECONNRESET で落ちることがあるので、少し待って数回やり直す
async function fetchRetry(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try { return await fetch(url, { headers: UA }); }
    catch (e) { if (i === tries - 1) throw e; await sleep(1500 * (i + 1)); }
  }
}

async function search(query, limit = 6) {
  const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search`
    + `&gsrsearch=${encodeURIComponent('filetype:bitmap ' + query)}&gsrnamespace=6&gsrlimit=${limit * 2}`
    + `&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1600`;
  let j;
  try { j = await (await fetchRetry(api)).json(); }
  catch { return []; }
  const out = [];
  for (const p of Object.values(j.query?.pages || {}).sort((a, b) => a.index - b.index)) {
    const ii = p.imageinfo?.[0];
    if (!ii || ii.width < 1200 || ii.width <= ii.height) continue;
    out.push({ title: p.title, url: ii.thumburl || ii.url, descurl: ii.descriptionurl, em: ii.extmetadata || {} });
    if (out.length >= limit) break;
  }
  return out;
}

const creditOf = (c) => {
  const lic = c.em.LicenseShortName?.value || 'unknown';
  return {
    author: (c.em.Artist?.value || '').replace(/<[^>]*>/g, '').split(/\n|This photo was taken/)[0].replace(/\s+/g, ' ').trim() || 'unknown',
    license: lic,
    url: c.descurl,
    attributionRequired: !/^(CC0|Public domain)/i.test(lic),
  };
};

const strict = JSON.parse(fs.readFileSync(STRICT, 'utf8'));
const images = JSON.parse(fs.readFileSync(IMAGES, 'utf8'));
const all = JSON.parse(fs.readFileSync('src/data/destinations.json', 'utf8'));
const byId = Object.fromEntries(all.map((d) => [d.id, d]));

const report = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { adopted: [], rejected: [] };
const done = new Set([...report.adopted.map((x) => x.id), ...report.rejected.map((x) => x.id)]);

// 落選したものに加え、そもそも候補が無かったものも対象にする
const targets = [...strict.fail.map((x) => x.id), ...images.rejected.map((x) => x.id)];

for (const id of targets) {
  if (done.has(id)) continue;
  const d = byId[id];
  if (!d) { console.log(`  -- ${id}: destinationが無い`); continue; }
  const pref = d.prefecture || '';
  const words = [d.city, (d.name || '').replace(/温泉$/, ''), pref.replace(/[都道府県]$/, '')].filter(Boolean);
  const spots = (d.spots || []).filter((s) => s && s.name).map((s) => s.name);
  // 見どころ名を優先し、最後に地名を残す
  const queries = [...spots.map((s) => `${s} ${pref}`), ...spots, `${d.name} 風景`, `${d.name} ${pref}`];

  let picked = null; const tried = [];
  try {
  for (const q of queries) {
    for (const c of await search(q)) {
      if (tried.some((t) => t.title === c.title)) continue;
      const pc = await placeCheck(c.title, pref, words).catch(() => ({ verdict: 'weak' }));
      await sleep(250);
      if (pc.verdict === 'ng') { tried.push({ title: c.title, stage: 'placeCheck', verdict: 'ng' }); continue; }
      let buf;
      try { buf = Buffer.from(await (await fetchRetry(c.url)).arrayBuffer()); }
      catch { continue; }
      const h = await judge(HAIKU, buf, `${d.name}（${pref}）`);
      if (h.verdict !== 'ok') { tried.push({ title: c.title, stage: 'haiku', ...h }); continue; }
      await sleep(300);
      const s = await judge(SONNET, buf, `${d.name}（${pref}）`);
      tried.push({ title: c.title, stage: 'sonnet', haiku: h, sonnet: s });
      if (s.verdict !== 'ok') continue;
      picked = { c, buf, pc, verdict: { haiku: h, sonnet: s } };
      break;
    }
    if (picked) break;
  }
  } catch (e) {
    console.log(`  !! ${id}: ${String(e).slice(0, 70)}`);
  }

  if (!picked) {
    report.rejected.push({ id, name: d.name, reason: '合格画像なし', triedCount: tried.length });
    console.log(`❌ ${id.padEnd(22)} ${String(d.name).padEnd(12)} 合格なし（${tried.length}枚試行）`);
  } else {
    fs.mkdirSync(path.join('public/images', id), { recursive: true });
    await sharp(picked.buf).resize({ width: 1600, withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true, progressive: true })
      .toFile(path.join('public/images', id, 'main.jpg'));
    report.adopted.push({ id, name: d.name, title: picked.c.title, placeCheck: picked.pc.verdict,
      credit: creditOf(picked.c), verdict: picked.verdict });
    console.log(`✅ ${id.padEnd(22)} ${String(d.name).padEnd(12)} ${picked.c.title.replace('File:', '').slice(0, 40)} … ${picked.verdict.sonnet.subject ?? ''}`);
  }
  fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
  await sleep(600);
}
console.log(`\n再取得 採用 ${report.adopted.length} / 不採用 ${report.rejected.length} → ${OUT}`);
