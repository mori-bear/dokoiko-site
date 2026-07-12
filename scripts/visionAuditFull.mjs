#!/usr/bin/env node
/**
 * visionAuditFull.mjs — 全画像(main + spot)の Vision 総点検（Task2）
 *
 * 1枚につき以下をまとめて判定:
 *   A. 正しい場所か・日本国内か（内容不一致/海外混入/無関係）
 *   B. テキスト/ロゴ/自治体PR透かしの焼き込みがないか
 *   C. 極端なアスペクト比・不自然なトリミングがないか
 *
 * 結果: logs/vision_full_audit.json（imgPathキー・逐次保存・再開可）
 * 既存 visionVerify.js の基盤を全画像・拡張プロンプトへ発展させたもの。
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

const all = JSON.parse(fs.readFileSync('src/data/destinations.json', 'utf8'));

// ---- 画像リスト構築（実在ファイルのみ・spotはspot名の文脈付き） ----
const items = [];
for (const d of all) {
  const dir = `public/images/${d.id}`;
  if (!fs.existsSync(dir)) continue;
  const spots = Array.isArray(d.spots) ? d.spots : [];
  for (const f of fs.readdirSync(dir)) {
    if (!/\.(jpe?g|png|webp)$/i.test(f)) continue;
    let ctx = `${d.name}（${d.prefecture || d.region || ''}）`;
    const sm = f.match(/spot-(\d+)/i);
    if (sm) {
      const sp = spots[+sm[1] - 1];
      ctx += sp ? ` の見どころ「${sp.name}」` : ' の見どころ';
    } else if (/main/i.test(f)) {
      ctx += ` のメイン風景 — ${(d.description || '').slice(0, 60)}`;
    }
    items.push({ path: `${d.id}/${f}`, abs: `${dir}/${f}`, ctx });
  }
}

let results = {};
if (fs.existsSync(OUT)) { try { results = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch {} }

const SYSTEM = `あなたは日本の旅行サイト「どこ行こ？」の画像監査担当です。各画像が、指定された旅先の紹介画像として適切かを、次の3観点でまとめて判定します。

観点A（場所・内容）: 日本国内のその土地の風景・町並み・自然・名所・建物として妥当か。
  NG例: 日本国外の風景混入 / 指定地と明らかに不一致（港町なのに山岳等） / 人物アップ・料理・商品・室内・地図・イラスト・図表など「その土地の風景」でない。
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

let pending = items.filter(it => !results[it.path]);
if (process.env.LIMIT) pending = pending.slice(0, +process.env.LIMIT);
console.log(`総画像 ${items.length} / 済 ${items.length - pending.length} / 残 ${pending.length}`);

const batches = [];
for (let i = 0; i < pending.length; i += BATCH) batches.push(pending.slice(i, i + BATCH));
let done = items.length - pending.length;

async function runBatch(batch, attempt = 0) {
  try {
    const arr = await evalBatch(batch);
    arr.forEach((r, i) => {
      const it = batch[r.n ? r.n - 1 : i];
      if (!it) return;
      results[it.path] = { verdict: r.verdict, issues: r.issues || [], confidence: r.confidence || '-', reason: r.reason || '', ctx: it.ctx };
    });
    for (const it of batch) if (!results[it.path]) results[it.path] = { verdict: 'ok', issues: [], confidence: '-', reason: 'NO_RESULT', ctx: it.ctx };
  } catch (e) {
    if ((e.status === 429 || e.status === 529 || e.status === 500) && attempt < 5) {
      await new Promise(r => setTimeout(r, 4000 * (attempt + 1)));
      return runBatch(batch, attempt + 1);
    }
    for (const it of batch) if (!results[it.path]) results[it.path] = { verdict: 'err', issues: [], confidence: '-', reason: 'ERR:' + e.message.slice(0, 60), ctx: it.ctx };
  }
  done += batch.length;
}

for (let i = 0; i < batches.length; i += CONCURRENCY) {
  await Promise.all(batches.slice(i, i + CONCURRENCY).map(b => runBatch(b)));
  fs.writeFileSync(OUT, JSON.stringify(results, null, 1));
  process.stdout.write(`\r評価 ${done}/${items.length}`);
}
fs.writeFileSync(OUT, JSON.stringify(results, null, 1));

const entries = Object.entries(results);
const ng = entries.filter(([, r]) => r.verdict === 'ng');
const byIssue = { A: 0, B: 0, C: 0 };
for (const [, r] of ng) for (const is of (r.issues || [])) if (byIssue[is] != null) byIssue[is]++;
const err = entries.filter(([, r]) => r.verdict === 'err').length;
console.log(`\n完了。総 ${entries.length} / NG ${ng.length} (A場所:${byIssue.A} B焼込:${byIssue.B} C構図:${byIssue.C}) / err ${err}`);
console.log(`high:${ng.filter(([, r]) => r.confidence === 'high').length} mid:${ng.filter(([, r]) => r.confidence === 'mid').length}`);
