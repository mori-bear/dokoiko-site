#!/usr/bin/env node
/**
 * fixSpotImages.mjs — spots[].imageUrl が実ファイル不在の分を Commons から取得し直す。
 * Haiku で一次選抜 → Sonnet で最終確認の2段階 Vision を通過したものだけ採用する。
 * どちらかが ng なら採用せず、当該 spot の imageUrl を削除（壊れた参照を残さない）。
 *
 * 保存先: public/images/spots/<destId>/<index>.jpg
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
const UA = { 'User-Agent': 'DokoIko/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const DEST = 'src/data/destinations.json';

const CRITERIA = `次をすべて満たすときのみ ok:
- 指定された施設・名所そのもの、またはその敷地内の風景である
- 別の施設・別の土地・人物アップ・料理・商品・室内の小物・地図やイラスト・図表ではない
- 文字やロゴ、PR透かしの焼き込みがない
- 極端な縦長/横長や不自然な見切れがない
判断に迷う場合は ng。`;

async function judge(model, buf, ctx, extra = '') {
  const b64 = (await sharp(buf).resize({ width: 720, withoutEnlargement: true }).jpeg({ quality: 78 }).toBuffer()).toString('base64');
  const res = await client.messages.create({
    model, max_tokens: 250,
    system: `あなたは日本の旅行サイトの画像監査担当です。${CRITERIA}\nJSONのみ返す: {"verdict":"ok"|"ng","reason":"日本語で簡潔に"}`,
    messages: [{ role: 'user', content: [
      { type: 'text', text: `対象: ${ctx}\n${extra}この画像を紹介画像として採用してよいか判定。` },
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
    + `&gsrsearch=${encodeURIComponent('filetype:bitmap ' + q)}&gsrnamespace=6&gsrlimit=10`
    + `&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1600`;
  try {
    const j = await (await fetch(api, { headers: UA })).json();
    return Object.values(j.query?.pages || {}).sort((a, b) => a.index - b.index);
  } catch { return []; }
}

const D = JSON.parse(fs.readFileSync(DEST, 'utf8'));
// 対象: ローカル参照なのに実ファイルが無い spot
const targets = [];
for (const d of D) {
  (d.spots || []).forEach((s, i) => {
    const u = String(s.imageUrl || '');
    if (u.startsWith('/images/') && !fs.existsSync('public' + u)) targets.push({ d, s, i });
  });
}
console.log(`対象 spot: ${targets.length} 件\n`);

let fixed = 0, removed = 0;
for (const { d, s, i } of targets) {
  const ctx = `${s.name}（${d.prefecture ?? ''}${d.city ? ' ' + d.city : ''}／${d.name}の見どころ）`;
  const queries = [`${s.name} ${d.prefecture ?? ''}`.trim(), s.name, `${s.name} ${d.name}`];
  let adopted = null;
  const seen = new Set();

  outer:
  for (const q of queries) {
    for (const p of await search(q)) {
      const ii = p.imageinfo?.[0];
      if (!ii || seen.has(p.title)) continue;
      seen.add(p.title);
      if (ii.width < 900 || ii.width <= ii.height) continue;
      await sleep(700);
      let buf;
      try {
        const dl = await fetch(ii.thumburl || ii.url, { headers: UA });
        if (!dl.ok) continue;
        buf = Buffer.from(await dl.arrayBuffer());
      } catch { continue; }

      const h = await judge(HAIKU, buf, ctx);
      if (!h.ok) continue;
      const so = await judge(SONNET, buf, ctx, '一次審査は通過済み。厳しめに最終判断すること。');
      if (!so.ok) continue;

      const em = ii.extmetadata || {};
      adopted = { buf, title: p.title, credit: {
        author: (em.Artist?.value || '').replace(/<[^>]*>/g, '').trim() || 'unknown',
        license: em.LicenseShortName?.value || 'unknown',
        url: ii.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title)}`,
      }, haiku: h.reason, sonnet: so.reason };
      break outer;
    }
  }

  if (adopted) {
    const dir = `public/images/spots/${d.id}`;
    fs.mkdirSync(dir, { recursive: true });
    const rel = `/images/spots/${d.id}/${i}.jpg`;
    await sharp(adopted.buf).jpeg({ quality: 86 }).toFile(path.join('public', rel));
    s.imageUrl = rel;
    s.imageCredit = adopted.credit;
    fixed++;
    console.log(`✅ [${d.id}] ${s.name} ← ${adopted.title.replace('File:', '').slice(0, 50)}`);
  } else {
    delete s.imageUrl;     // 壊れた参照は残さない（テンプレは imageUrl 無しで正常描画）
    removed++;
    console.log(`— [${d.id}] ${s.name}: 2段階検証を通る画像なし → imageUrl を削除`);
  }
  fs.writeFileSync(DEST, JSON.stringify(D, null, 2));   // 逐次保存
}
console.log(`\n完了: 差し替え ${fixed}件 / 参照削除 ${removed}件（対象 ${targets.length}件）`);
