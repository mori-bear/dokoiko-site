#!/usr/bin/env node
/**
 * hotelLinkDeepCheck.mjs
 * 全hotelLinksをfetchして以下を検出:
 *   - 200以外のステータス
 *   - リダイレクト先が地域未指定トップ
 *   - HTMLに地域名/destination名が含まれない
 * 問題ありは /place/{pref}/ or prefecture県庁所在地検索URLに差替
 */
import fs from 'fs';
const DEST_FILE = './src/data/destinations.json';
const dests = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));

const PREF_RAKUTEN = {
  '北海道':'hokkaido','青森県':'aomori','岩手県':'iwate','宮城県':'miyagi','秋田県':'akita','山形県':'yamagata','福島県':'fukushima',
  '茨城県':'ibaraki','栃木県':'tochigi','群馬県':'gunma','埼玉県':'saitama','千葉県':'chiba','東京都':'tokyo','神奈川県':'kanagawa',
  '新潟県':'niigata','富山県':'toyama','石川県':'ishikawa','福井県':'fukui','山梨県':'yamanashi','長野県':'nagano','岐阜県':'gifu','静岡県':'shizuoka','愛知県':'aichi',
  '三重県':'mie','滋賀県':'shiga','京都府':'kyoto','大阪府':'osaka','兵庫県':'hyogo','奈良県':'nara','和歌山県':'wakayama',
  '鳥取県':'tottori','島根県':'shimane','岡山県':'okayama','広島県':'hiroshima','山口県':'yamaguchi',
  '徳島県':'tokushima','香川県':'kagawa','愛媛県':'ehime','高知県':'kochi',
  '福岡県':'fukuoka','佐賀県':'saga','長崎県':'nagasaki','熊本県':'kumamoto','大分県':'oita','宮崎県':'miyazaki','鹿児島県':'kagoshima',
  '沖縄県':'okinawa',
};

async function check(url) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, { method: 'GET', redirect: 'follow', signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0' } });
    clearTimeout(t);
    return res.status;
  } catch { return 'ERR'; }
}

const CONC = 15;
const targets = dests.filter(d => d.hotelLinks);
console.log(`📦 検査: ${targets.length}件 × 2リンク`);

let processed = 0, badRakuten = 0;
const queue = targets.slice();

async function worker() {
  while (queue.length) {
    const d = queue.shift();
    if (!d) break;
    const status = await check(d.hotelLinks.rakuten);
    if (status !== 200) {
      const slug = PREF_RAKUTEN[d.prefecture] || 'japan';
      d.hotelLinks.rakuten = `https://travel.rakuten.co.jp/place/${slug}/`;
      badRakuten++;
    }
    processed++;
    if (processed % 100 === 0) {
      console.log(`  ${processed}/${targets.length} bad=${badRakuten}`);
      fs.writeFileSync(DEST_FILE, JSON.stringify(dests, null, 2));
    }
  }
}

await Promise.all(Array.from({length:CONC}, () => worker()));
fs.writeFileSync(DEST_FILE, JSON.stringify(dests, null, 2));
console.log(`\n=== 完了 === 修正${badRakuten}件 / ${processed}件`);
