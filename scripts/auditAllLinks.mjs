#!/usr/bin/env node
import fs from 'fs';
const DEST_FILE = './src/data/destinations.json';
const dests = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));

const PREF_RAKUTEN = {'北海道':'hokkaido','青森県':'aomori','岩手県':'iwate','宮城県':'miyagi','秋田県':'akita','山形県':'yamagata','福島県':'fukushima','茨城県':'ibaraki','栃木県':'tochigi','群馬県':'gunma','埼玉県':'saitama','千葉県':'chiba','東京都':'tokyo','神奈川県':'kanagawa','新潟県':'niigata','富山県':'toyama','石川県':'ishikawa','福井県':'fukui','山梨県':'yamanashi','長野県':'nagano','岐阜県':'gifu','静岡県':'shizuoka','愛知県':'aichi','三重県':'mie','滋賀県':'shiga','京都府':'kyoto','大阪府':'osaka','兵庫県':'hyogo','奈良県':'nara','和歌山県':'wakayama','鳥取県':'tottori','島根県':'shimane','岡山県':'okayama','広島県':'hiroshima','山口県':'yamaguchi','徳島県':'tokushima','香川県':'kagawa','愛媛県':'ehime','高知県':'kochi','福岡県':'fukuoka','佐賀県':'saga','長崎県':'nagasaki','熊本県':'kumamoto','大分県':'oita','宮崎県':'miyazaki','鹿児島県':'kagoshima','沖縄県':'okinawa'};
const JALAN_CODE = {'北海道':'01','青森県':'02','岩手県':'03','宮城県':'04','秋田県':'05','山形県':'06','福島県':'07','茨城県':'08','栃木県':'09','群馬県':'10','埼玉県':'11','千葉県':'12','東京都':'13','神奈川県':'14','新潟県':'15','富山県':'16','石川県':'17','福井県':'18','山梨県':'19','長野県':'20','岐阜県':'21','静岡県':'22','愛知県':'23','三重県':'24','滋賀県':'25','京都府':'26','大阪府':'27','兵庫県':'28','奈良県':'29','和歌山県':'30','鳥取県':'31','島根県':'32','岡山県':'33','広島県':'34','山口県':'35','徳島県':'36','香川県':'37','愛媛県':'38','高知県':'39','福岡県':'40','佐賀県':'41','長崎県':'42','熊本県':'43','大分県':'44','宮崎県':'45','鹿児島県':'46','沖縄県':'47'};

async function check(url) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, { method:'GET', redirect:'follow', signal:ctrl.signal, headers:{'User-Agent':'Mozilla/5.0'} });
    clearTimeout(t);
    return res.status;
  } catch { return 'ERR'; }
}

const targets = dests.filter(d => d.hotelLinks);
console.log(`📦 検査: ${targets.length}件 (rakuten+jalan, 並列15)`);

let processed = 0, fixedR = 0, fixedJ = 0;
const queue = targets.slice();

async function worker() {
  while (queue.length) {
    const d = queue.shift();
    if (!d) break;
    const sR = d.hotelLinks.rakuten ? await check(d.hotelLinks.rakuten) : 200;
    const sJ = d.hotelLinks.jalan ? await check(d.hotelLinks.jalan) : 200;
    const pref = d.prefecture;
    if (sR !== 200) {
      const slug = PREF_RAKUTEN[pref] || 'japan';
      d.hotelLinks.rakuten = `https://travel.rakuten.co.jp/yado/${slug}/`;
      fixedR++;
    }
    if (sJ !== 200) {
      const code = JALAN_CODE[pref] || '13';
      d.hotelLinks.jalan = `https://www.jalan.net/${code}0000/`;
      fixedJ++;
    }
    processed++;
    if (processed % 100 === 0) {
      console.log(`  ${processed}/${targets.length} fixR=${fixedR} fixJ=${fixedJ}`);
      fs.writeFileSync(DEST_FILE, JSON.stringify(dests, null, 2));
    }
  }
}
await Promise.all(Array.from({length:15}, ()=>worker()));
fs.writeFileSync(DEST_FILE, JSON.stringify(dests, null, 2));
console.log(`\n=== 完了 === rakuten修正:${fixedR}件 / jalan修正:${fixedJ}件`);

// レンタカー1件確認
const carUrl = 'https://hb.afl.rakuten.co.jp/hgc/53ec8786.4481081e.53ec8787.6242ff45/?pc=https%3A%2F%2Ftravel.rakuten.co.jp%2Fcars%2F';
const sc = await check(carUrl);
console.log(`レンタカーURL: ${sc}`);
