#!/usr/bin/env node
/**
 * evalClarity.js
 * destinations.json 全件を Sonnet で「一般旅行者向けの旅先として魅力的か」評価し、
 * 「分かりにくい/ニッチすぎる」削除候補を抽出する。
 * 結果: logs/clarity_eval.json（逐次保存・再開可）
 */
import fs from 'fs';
import Anthropic from '@anthropic-ai/sdk';

const envContent = fs.readFileSync('./.env', 'utf-8');
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.+)$/);
  if (m) process.env[m[1]] = m[2].trim();
}
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-4-6';
const BATCH = 25;
const OUT = 'logs/clarity_eval.json';

const all = JSON.parse(fs.readFileSync('src/data/destinations.json', 'utf8'));

// 再開: 既存結果を読み込み、未評価分のみ処理
let results = {};
if (fs.existsSync(OUT)) {
  try { results = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch {}
}

const SYSTEM = `あなたは日本の旅行メディアの編集者です。旅先データベースから「一般旅行者が旅先として魅力を感じにくい、分かりにくいスポット」を見極めます。

各destinationを以下で評価:
- score: 1〜5 (5=多くの旅行者が「行きたい」と思う魅力的な旅先 / 1=ごく一部の専門的関心しか引かない)
- del: true=削除すべき / false=残す

【del=true にすべきもの（分かりにくい・ニッチすぎる）】
- 塩田跡・河口・干潟・湿地・産業遺産跡・採掘場跡・工場跡・河岸段丘など、一般旅行者が「何をしに行くか」分からないもの
- destination名だけ見て目的が伝わらないもの
- 魅力の軸が「産業遺産」「湿地」「野鳥」「地質」など単体で、観光的な楽しみ（絶景・温泉・グルメ・歴史的町並み・体験など）が乏しいもの

【del=false にすべきもの（残す）】
- 温泉地・有名観光地・城下町・絶景スポット・離島・海岸/ビーチ・神社仏閣・国立公園・グルメ目的地・祭り
- ニッチでも明確な観光的魅力（写真映え・体験・名物）があるもの
- 判断に迷う場合は残す（保守的に。確実に分かりにくいものだけ del=true）

必ず入力と同じ件数・同じidの JSON 配列のみを返す。形式:
[{"id":"...","score":3,"del":false,"reason":"短い理由(日本語1行)"}]`;

function trunc(s, n) { return (s || '').slice(0, n); }

async function evalBatch(batch) {
  const payload = batch.map(d => ({
    id: d.id,
    name: d.name || d['名前'],
    pref: d.prefecture,
    desc: trunc(d.description, 140),
    chips: Array.isArray(d.reasonChips) ? d.reasonChips : [],
    tags: Array.isArray(d.tags) ? d.tags : [],
  }));
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM,
    messages: [{ role: 'user', content: `次の${payload.length}件を評価し、JSON配列のみ返す:\n${JSON.stringify(payload)}` }],
  });
  let txt = res.content[0].text.trim();
  const s = txt.indexOf('['), e = txt.lastIndexOf(']');
  if (s >= 0 && e > s) txt = txt.slice(s, e + 1);
  return JSON.parse(txt);
}

const pending = all.filter(d => !results[d.id]);
console.log(`総数 ${all.length} / 評価済み ${all.length - pending.length} / 残り ${pending.length}`);

// バッチ分割
const batches = [];
for (let i = 0; i < pending.length; i += BATCH) batches.push(pending.slice(i, i + BATCH));

const CONCURRENCY = 6;
let done = all.length - pending.length;

async function runBatch(batch) {
  try {
    const arr = await evalBatch(batch);
    const byId = Object.fromEntries(arr.map(r => [r.id, r]));
    for (const d of batch) {
      const r = byId[d.id];
      results[d.id] = r
        ? { name: d.name || d['名前'], pref: d.prefecture, score: r.score, del: !!r.del, reason: r.reason || '' }
        : { name: d.name || d['名前'], pref: d.prefecture, score: null, del: false, reason: 'NO_RESULT' };
    }
  } catch (e) {
    for (const d of batch) {
      if (!results[d.id]) results[d.id] = { name: d.name || d['名前'], pref: d.prefecture, score: null, del: false, reason: 'ERROR:' + e.message.slice(0, 60) };
    }
    console.log(`\n⚠ batch err: ${e.message.slice(0, 80)}`);
  }
  done += batch.length;
}

// CONCURRENCY 件ずつ並列実行し、各波の後に逐次保存
for (let i = 0; i < batches.length; i += CONCURRENCY) {
  const wave = batches.slice(i, i + CONCURRENCY);
  await Promise.all(wave.map(runBatch));
  fs.writeFileSync(OUT, JSON.stringify(results, null, 1));
  process.stdout.write(`\r評価 ${done}/${all.length}`);
}
console.log('\n完了。');

const dels = Object.entries(results).filter(([, r]) => r.del);
console.log(`\n削除候補: ${dels.length} 件 / 全${all.length}`);
console.log(`score分布:`, [1,2,3,4,5].map(s => `${s}:${Object.values(results).filter(r=>r.score===s).length}`).join(' '));
