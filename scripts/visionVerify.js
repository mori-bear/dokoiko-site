#!/usr/bin/env node
/**
 * visionVerify.js
 * 全destinationの public/images/{id}/main.jpg を Sonnet Vision で検証し、
 * destination名の場所として不適切な画像（海外混入・内容不一致・無関係写真）を洗い出す。
 * 結果: logs/vision_eval.json（逐次保存・再開可）
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
const OUT = 'logs/vision_eval.json';

const all = JSON.parse(fs.readFileSync('src/data/destinations.json', 'utf8'));

let results = {};
if (fs.existsSync(OUT)) { try { results = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch {} }

const SYSTEM = `あなたは日本の旅行サイトの画像監査担当です。各画像が、指定されたdestination（日本国内の旅先）のメイン画像として適切かを判定します。

判定基準（NGにすべきもの）:
1. 海外の風景・建物・自然が写っている（日本国外の画像混入）
2. destinationの名前・説明と内容が明らかに一致しない（例: 港町なのに山岳、温泉地なのに無関係な都市ビル群）
3. 人物のアップ、無関係な室内・商品・料理のみ、地図やイラスト、ロゴ等で「その土地の風景」になっていない
4. 抽象的すぎる/被写体不明で、その場所と判別不能

OKにすべきもの:
- その土地の風景・町並み・自然・名所・建物として妥当なもの
- 多少汎用的でも日本国内の風景として違和感がなく、destinationのテーマ（海/山/温泉/町並み等）と整合するもの
- 判断に迷う程度なら confidence=mid の ng とし、明確な誤りのみ confidence=high

各画像について必ず判定し、入力順のJSON配列のみ返す:
[{"n":1,"verdict":"ok"|"ng","confidence":"high"|"mid","reason":"日本語で簡潔に"}]
verdictがokならconfidenceは"-"、reasonは短くてよい。`;

async function toB64(id) {
  const buf = await sharp(`public/images/${id}/main.jpg`).resize({ width: 640, withoutEnlargement: true }).jpeg({ quality: 75 }).toBuffer();
  return buf.toString('base64');
}

async function evalBatch(batch) {
  const content = [];
  for (let i = 0; i < batch.length; i++) {
    const d = batch[i];
    const desc = (d.description || '').slice(0, 80);
    content.push({ type: 'text', text: `【画像${i + 1}】${d.name || d['名前']}（${d.prefecture}）— ${desc}` });
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: await toB64(d.id) } });
  }
  content.push({ type: 'text', text: `上記${batch.length}枚を判定し、JSON配列のみ返す。` });
  const res = await client.messages.create({ model: MODEL, max_tokens: 1500, system: SYSTEM, messages: [{ role: 'user', content }] });
  let txt = res.content[0].text.trim();
  const s = txt.indexOf('['), e = txt.lastIndexOf(']');
  if (s >= 0 && e > s) txt = txt.slice(s, e + 1);
  return JSON.parse(txt);
}

const pending = all.filter(d => !results[d.id]);
console.log(`総数 ${all.length} / 評価済 ${all.length - pending.length} / 残り ${pending.length}`);

const batches = [];
for (let i = 0; i < pending.length; i += BATCH) batches.push(pending.slice(i, i + BATCH));
let done = all.length - pending.length;

async function runBatch(batch, attempt = 0) {
  try {
    const arr = await evalBatch(batch);
    arr.forEach((r, i) => {
      const d = batch[r.n ? r.n - 1 : i];
      if (!d) return;
      results[d.id] = { name: d.name || d['名前'], pref: d.prefecture, verdict: r.verdict, confidence: r.confidence, reason: r.reason || '' };
    });
    for (const d of batch) if (!results[d.id]) results[d.id] = { name: d.name || d['名前'], pref: d.prefecture, verdict: 'ok', confidence: '-', reason: 'NO_RESULT' };
  } catch (e) {
    if ((e.status === 429 || e.status === 529) && attempt < 4) {
      await new Promise(r => setTimeout(r, 4000 * (attempt + 1)));
      return runBatch(batch, attempt + 1);
    }
    for (const d of batch) if (!results[d.id]) results[d.id] = { name: d.name || d['名前'], pref: d.prefecture, verdict: 'err', confidence: '-', reason: 'ERR:' + e.message.slice(0, 50) };
  }
  done += batch.length;
}

for (let i = 0; i < batches.length; i += CONCURRENCY) {
  await Promise.all(batches.slice(i, i + CONCURRENCY).map(b => runBatch(b)));
  fs.writeFileSync(OUT, JSON.stringify(results, null, 1));
  process.stdout.write(`\r評価 ${done}/${all.length}`);
}

const ng = Object.entries(results).filter(([, r]) => r.verdict === 'ng');
const err = Object.values(results).filter(r => r.verdict === 'err').length;
console.log(`\n完了。NG ${ng.length} (high:${ng.filter(([,r])=>r.confidence==='high').length} mid:${ng.filter(([,r])=>r.confidence==='mid').length}) / err ${err}`);
