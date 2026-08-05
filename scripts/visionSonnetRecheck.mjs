#!/usr/bin/env node
/**
 * visionSonnetRecheck.mjs — STEP2: グレーゾーン画像のSonnet再判定
 * logs/vision_grayzone_targets.json（Haikuがokにした断定要素の弱い被写体）を
 * claude-sonnet-4-6 で再判定し、logs/vision_full_audit.json を上書き更新する。
 * 逐次保存・再開可（model が sonnet に更新済みのエントリはスキップ）。
 */
import fs from 'fs';
import sharp from 'sharp';
import Anthropic from '@anthropic-ai/sdk';

const env = fs.readFileSync('./.env', 'utf-8');
for (const line of env.split('\n')) { const m = line.match(/^([A-Z_]+)=(.+)$/); if (m) process.env[m[1]] = m[2].trim(); }
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-4-6';
const BATCH = 4;
const CONCURRENCY = 5;
const OUT = 'logs/vision_full_audit.json';

const targets = JSON.parse(fs.readFileSync('logs/vision_grayzone_targets.json', 'utf8'));
const results = JSON.parse(fs.readFileSync(OUT, 'utf8'));

const SYSTEM = `あなたは日本の旅行サイト「どこ行こ？」の画像監査担当です。各画像が、指定された旅先の紹介画像として適切かを、次の3観点でまとめて判定します。

観点A（場所・内容）: 日本国内のその土地の風景・町並み・自然・名所・建物として妥当か。
  NG例: 日本国外の風景混入 / 指定地と明らかに不一致（港町なのに山岳等） / 人物アップ・料理・商品・室内・地図・イラスト・図表など「その土地の風景」でない。
  ※今回は特に「被写体がその場所と断定できるか」を厳しめに検証すること（汎用的な建物外観・
    複数地点から撮影可能な山岳・類似形状の多い滝や岩など、別の場所の写真が紛れていないか）。
観点B（焼き込み）: 画像内に、後から合成されたテキスト・ロゴ・自治体PRの透かし・広告文・大きな著作権クレジットが焼き込まれていないか。
  ※建物の実在看板や自然な標識はOK。画像全面や隅に半透明で重ねられたPR文字・ウォーターマークはNG。
観点C（構図）: 極端に細長い/縦長のアスペクト比、被写体が切れた不自然なトリミング、余白の白帯/黒帯（レターボックス焼き込み）がないか。

判定方針:
- 明確な問題のみ ng とし confidence=high。判断に迷う軽微なものは ng / confidence=mid。問題なしは ok。
- issues には該当観点を配列で（例 ["A"],["B","C"]）。okなら空配列。

必ず入力順に、JSON配列のみ返す:
[{"n":1,"verdict":"ok"|"ng","issues":["A"|"B"|"C"...],"confidence":"high"|"mid"|"-","reason":"日本語で簡潔に"}]`;

async function toB64(abs) {
  const buf = await sharp(abs).resize({ width: 640, withoutEnlargement: true }).jpeg({ quality: 75 }).toBuffer();
  return buf.toString('base64');
}

async function evalBatch(batch) {
  const content = [];
  for (let i = 0; i < batch.length; i++) {
    content.push({ type: 'text', text: `【画像${i + 1}】${batch[i].ctx}` });
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: await toB64(batch[i].abs) } });
  }
  content.push({ type: 'text', text: `上記${batch.length}枚を3観点で判定し、JSON配列のみ返す。` });
  const res = await client.messages.create({ model: MODEL, max_tokens: 2000, system: SYSTEM, messages: [{ role: 'user', content }] });
  let txt = res.content[0].text.trim();
  const s = txt.indexOf('['), e = txt.lastIndexOf(']');
  if (s >= 0 && e > s) txt = txt.slice(s, e + 1);
  return JSON.parse(txt);
}

// 再開: 既にsonnetで再判定済みのものは除外
const pending = targets
  .filter(t => fs.existsSync(`public/images/${t.path}`))
  .filter(t => !(results[t.path]?.model === MODEL))
  .map(t => ({ path: t.path, abs: `public/images/${t.path}`, ctx: t.ctx || t.path }));
console.log(`STEP2対象 ${targets.length} / 済 ${targets.length - pending.length} / 残 ${pending.length}`);

const batches = [];
for (let i = 0; i < pending.length; i += BATCH) batches.push(pending.slice(i, i + BATCH));
let done = 0;

async function runBatch(batch, attempt = 0) {
  try {
    const arr = await evalBatch(batch);
    arr.forEach((r, i) => {
      const it = batch[r.n ? r.n - 1 : i];
      if (!it) return;
      results[it.path] = { verdict: r.verdict, issues: r.issues || [], confidence: r.confidence || '-', reason: r.reason || '', ctx: it.ctx, model: MODEL };
    });
  } catch (e) {
    const isConn = /connection error|ECONNRESET|ETIMEDOUT|socket hang up|fetch failed|network/i.test(e.message || '');
    if ((e.status === 429 || e.status === 529 || e.status === 500 || isConn) && attempt < 6) {
      await new Promise(r => setTimeout(r, 4000 * (attempt + 1)));
      return runBatch(batch, attempt + 1);
    }
    console.error('ERR:', batch.map(b => b.path).join(','), e.message?.slice(0, 80));
  }
  done += batch.length;
}

for (let i = 0; i < batches.length; i += CONCURRENCY) {
  await Promise.all(batches.slice(i, i + CONCURRENCY).map(b => runBatch(b)));
  fs.writeFileSync(OUT, JSON.stringify(results, null, 1));
  process.stdout.write(`\r再判定 ${done}/${pending.length}`);
}
fs.writeFileSync(OUT, JSON.stringify(results, null, 1));

// 集計: Haiku ok → Sonnet でどう変わったか
const flipped = [];
for (const t of targets) {
  const r = results[t.path];
  if (r?.model === MODEL && r.verdict === 'ng') flipped.push({ path: t.path, cats: t.cats, confidence: r.confidence, reason: r.reason });
}
fs.writeFileSync('logs/vision_step2_flipped.json', JSON.stringify(flipped, null, 1));
console.log(`\n完了。再判定 ${targets.length}件中、ok→ng 反転 ${flipped.length}件（logs/vision_step2_flipped.json）`);
