#!/usr/bin/env node
/**
 * visionHaikuCompareTest.mjs — visionAuditFull.mjs のモデル変更検証用
 * 既存 logs/vision_full_audit.json（Sonnet判定）から ok/ng 混合の8件を抽出し、
 * 新モデル（claude-haiku-4-5-20251001）で再判定して差分を表示する。
 * 本監査ファイルには書き込まない。
 */
import fs from 'fs';
import sharp from 'sharp';
import Anthropic from '@anthropic-ai/sdk';

const env = fs.readFileSync('./.env', 'utf-8');
for (const line of env.split('\n')) { const m = line.match(/^([A-Z_]+)=(.+)$/); if (m) process.env[m[1]] = m[2].trim(); }
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-haiku-4-5-20251001';

const prev = JSON.parse(fs.readFileSync('logs/vision_full_audit.json', 'utf8'));

// 実在ファイルに限定し、ng4件 + ok4件を抽出
const entries = Object.entries(prev).filter(([p]) => fs.existsSync(`public/images/${p}`));
const ngs = entries.filter(([, r]) => r.verdict === 'ng').slice(0, 4);
const oks = entries.filter(([, r]) => r.verdict === 'ok').slice(0, 4);
const sample = [...ngs, ...oks];
console.log(`比較対象 ${sample.length}件（ng ${ngs.length} / ok ${oks.length}）`);

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

const batch = sample.map(([p, r]) => ({ path: p, abs: `public/images/${p}`, ctx: r.ctx || p, sonnet: r }));
let agree = 0;
for (let i = 0; i < batch.length; i += 4) {
  const part = batch.slice(i, i + 4);
  const arr = await evalBatch(part);
  arr.forEach((r, j) => {
    const it = part[r.n ? r.n - 1 : j];
    const same = r.verdict === it.sonnet.verdict;
    if (same) agree++;
    console.log(`${same ? '一致' : '相違'} | ${it.path}`);
    console.log(`  Sonnet: ${it.sonnet.verdict} ${JSON.stringify(it.sonnet.issues)} (${it.sonnet.confidence}) ${it.sonnet.reason}`);
    console.log(`  Haiku : ${r.verdict} ${JSON.stringify(r.issues || [])} (${r.confidence || '-'}) ${r.reason || ''}`);
  });
}
console.log(`\n一致率: ${agree}/${batch.length}`);
