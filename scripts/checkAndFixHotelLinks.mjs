#!/usr/bin/env node
/**
 * checkAndFixHotelLinks.mjs
 * 全 destination の hotelLinks (rakuten/jalan) をGETでチェック。
 * 200以外を「正しい」フォーマットに差し替え:
 *  - 楽天: https://travel.rakuten.co.jp/place/{都道府県名}/
 *  - じゃらん: https://www.jalan.net/kankou/prf{コード}/
 */
import fs from 'fs';

const DEST_FILE = './src/data/destinations.json';
const dests = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));

// 都道府県名→楽天place slug
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
// 都道府県→じゃらんコード (01-47)
const PREF_JALAN = {
  '北海道':'01','青森県':'02','岩手県':'03','宮城県':'04','秋田県':'05','山形県':'06','福島県':'07',
  '茨城県':'08','栃木県':'09','群馬県':'10','埼玉県':'11','千葉県':'12','東京都':'13','神奈川県':'14',
  '新潟県':'15','富山県':'16','石川県':'17','福井県':'18','山梨県':'19','長野県':'20','岐阜県':'21','静岡県':'22','愛知県':'23',
  '三重県':'24','滋賀県':'25','京都府':'26','大阪府':'27','兵庫県':'28','奈良県':'29','和歌山県':'30',
  '鳥取県':'31','島根県':'32','岡山県':'33','広島県':'34','山口県':'35',
  '徳島県':'36','香川県':'37','愛媛県':'38','高知県':'39',
  '福岡県':'40','佐賀県':'41','長崎県':'42','熊本県':'43','大分県':'44','宮崎県':'45','鹿児島県':'46',
  '沖縄県':'47',
};

function newRakuten(pref) {
  const slug = PREF_RAKUTEN[pref] || 'japan';
  return `https://travel.rakuten.co.jp/place/${slug}/`;
}
function newJalan(pref) {
  const code = PREF_JALAN[pref] || '13';
  return `https://www.jalan.net/kankou/prf${code}/`;
}

async function check(url) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, { method: 'GET', redirect: 'follow', signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0' } });
    clearTimeout(t);
    return res.status;
  } catch (e) {
    return e.name === 'AbortError' ? 'TIMEOUT' : 'ERR';
  }
}

const CONCURRENCY = 15;
const targets = dests.filter(d => d.hotelLinks);
console.log(`📦 検査: ${targets.length}件 × 2リンク = ${targets.length*2}`);

let processed = 0, badRakuten = 0, badJalan = 0;
const queue = targets.slice();

async function worker() {
  while (queue.length) {
    const d = queue.shift();
    if (!d) break;
    const [r, j] = await Promise.all([
      check(d.hotelLinks.rakuten),
      check(d.hotelLinks.jalan),
    ]);
    if (r !== 200) {
      d.hotelLinks.rakuten = newRakuten(d.prefecture);
      badRakuten++;
    }
    if (j !== 200) {
      d.hotelLinks.jalan = newJalan(d.prefecture);
      badJalan++;
    }
    processed++;
    if (processed % 100 === 0) {
      console.log(`  ${processed}/${targets.length} (bad rakuten=${badRakuten} jalan=${badJalan})`);
      fs.writeFileSync(DEST_FILE, JSON.stringify(dests, null, 2));
    }
  }
}

await Promise.all(Array.from({length:CONCURRENCY}, () => worker()));
fs.writeFileSync(DEST_FILE, JSON.stringify(dests, null, 2));
console.log(`\n=== 完了 ===`);
console.log(`  楽天 差替: ${badRakuten}件`);
console.log(`  jalan 差替: ${badJalan}件`);
