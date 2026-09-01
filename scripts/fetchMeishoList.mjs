#!/usr/bin/env node
/**
 * fetchMeishoList.mjs — 「日本国指定名勝の一覧」のウィキテキストから名勝名と所在地を拾う。
 * 絶景ジャンルの候補母集団にする。重伝建と同じく、要約でなく生のウィキテキストを解析する。
 */
import fs from 'fs';
const UA = { 'User-Agent': 'DokoIko-DataAudit/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const title = '日本国指定名勝の一覧';
const url = `https://ja.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}`
  + `&prop=wikitext&format=json&formatversion=2`;
const j = await (await fetch(url, { headers: UA })).json();
if (j.error) { console.log('取得失敗:', j.error.info); process.exit(1); }
const wt = j.parse.wikitext;
fs.writeFileSync('logs/meisho_wikitext.txt', wt);
console.log(`ウィキテキスト ${wt.length}文字`);

// 都道府県ごとの節（== 北海道 == 等）の下に「* [[名勝名]]（市町村）」の形で並ぶ
const PREFS = ['北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県', '茨城県', '栃木県',
  '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県', '新潟県', '富山県', '石川県', '福井県', '山梨県',
  '長野県', '岐阜県', '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県',
  '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県', '徳島県', '香川県', '愛媛県', '高知県',
  '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'];
const clean = (s) => s.replace(/\{\{[^}]*\}\}/g, '').replace(/<[^>]*>/g, '')
  .replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, '$2').replace(/'''?/g, '').trim();

let pref = null;
const rows = [];
for (const line of wt.split('\n')) {
  const h = line.match(/^==+\s*(.+?)\s*==+$/);
  if (h) { const t = clean(h[1]); if (PREFS.includes(t)) pref = t; continue; }
  if (!pref || !/^[*#]/.test(line)) continue;
  const t = clean(line.replace(/^[*#]+\s*/, ''));
  if (!t || t.length < 2) continue;
  const m = t.match(/^([^（(]+)[（(]([^）)]*)[）)]/);
  rows.push({ prefecture: pref, name: (m ? m[1] : t).trim(), where: m ? m[2].trim() : '' });
}
console.log(`拾えた名勝 ${rows.length}件（${new Set(rows.map((r) => r.prefecture)).size}都道府県）`);
fs.writeFileSync('logs/meisho_rows.json', JSON.stringify(rows, null, 1));
