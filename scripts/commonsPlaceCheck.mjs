#!/usr/bin/env node
/**
 * commonsPlaceCheck.mjs — Wikimedia Commons のカテゴリ・説明文から
 * 「その画像が本当に目的の都道府県のものか」を機械的に照合する。
 *
 * なぜ必要か（2026-08-26 実測）:
 *   Vision（Haiku）は同名異所を見抜けない。実際に
 *     南房総白浜 ← File:Shirahama onsen zenkei.JPG（カテゴリ: Nanki-Shirahama Onsen ＝和歌山）
 *     弘法山     ← File:Gongen-yama01.jpg（説明: 写っているのは権現山。弘法山は写っていない）
 *   の2件を「identifiable: true」で通してしまった。
 *   画素だけ見て断定させるのは限界があるので、Commons側のメタデータで裏を取る。
 *   API は無料・キー不要で、Vision より確実。
 *
 * 判定:
 *   ng   … 目的地と異なる都道府県名が出てくる（同名異所）
 *   weak … 目的の県も市町村名も出てこない（根拠なし）→ Sonnet 再判定へ回す
 *   ok   … 目的の県名 or 市町村名 or 施設名が出てくる
 */
import fs from 'fs';

const UA = { 'User-Agent': 'DokoIko-DataAudit/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// 県名 → Commons カテゴリで使われる英語表記（日本語表記も併せて見る）
const PREF_EN = {
  '東京都':'Tokyo','埼玉県':'Saitama','千葉県':'Chiba','神奈川県':'Kanagawa','和歌山県':'Wakayama',
  '北海道':'Hokkaido','青森県':'Aomori','岩手県':'Iwate','宮城県':'Miyagi','秋田県':'Akita','山形県':'Yamagata',
  '福島県':'Fukushima','茨城県':'Ibaraki','栃木県':'Tochigi','群馬県':'Gunma','新潟県':'Niigata','富山県':'Toyama',
  '石川県':'Ishikawa','福井県':'Fukui','山梨県':'Yamanashi','長野県':'Nagano','岐阜県':'Gifu','静岡県':'Shizuoka',
  '愛知県':'Aichi','三重県':'Mie','滋賀県':'Shiga','京都府':'Kyoto','大阪府':'Osaka','兵庫県':'Hyogo',
  '奈良県':'Nara','鳥取県':'Tottori','島根県':'Shimane','岡山県':'Okayama','広島県':'Hiroshima','山口県':'Yamaguchi',
  '徳島県':'Tokushima','香川県':'Kagawa','愛媛県':'Ehime','高知県':'Kochi','福岡県':'Fukuoka','佐賀県':'Saga',
  '長崎県':'Nagasaki','熊本県':'Kumamoto','大分県':'Oita','宮崎県':'Miyazaki','鹿児島県':'Kagoshima','沖縄県':'Okinawa',
};

export async function placeCheck(fileTitle, prefecture, localityWords = []) {
  const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json` +
    `&prop=categories|imageinfo&iiprop=extmetadata&cllimit=50&titles=${encodeURIComponent(fileTitle)}`;
  const j = await (await fetch(api, { headers: UA })).json();
  const p = Object.values(j.query?.pages || {})[0] || {};
  const cats = (p.categories || []).map((c) => c.title.replace('Category:', ''));
  const em = p.imageinfo?.[0]?.extmetadata || {};
  const desc = (em.ImageDescription?.value || '').replace(/<[^>]*>/g, '');
  const hay = [...cats, desc].join(' | ');

  const selfJa = prefecture;
  const selfEn = PREF_EN[prefecture];
  // 自県の言及
  const hitsSelf = hay.includes(selfJa.replace(/[都道府県]$/, '')) ||
                   (selfEn && new RegExp(`\\b${selfEn}`, 'i').test(hay));
  // 他県の言及（自県を除く）
  const others = Object.entries(PREF_EN)
    .filter(([ja]) => ja !== prefecture)
    .filter(([ja, en]) => hay.includes(ja.replace(/[都道府県]$/, '')) || new RegExp(`\\b${en}`, 'i').test(hay))
    .map(([ja]) => ja);
  const hitsLocal = localityWords.some((w) => w && hay.includes(w));

  let verdict = 'weak';
  if (others.length && !hitsSelf) verdict = 'ng';
  else if (hitsSelf || hitsLocal) verdict = 'ok';

  return { verdict, hitsSelf, hitsLocal, others, cats, desc: desc.slice(0, 200) };
}

// CLI: 採用済み画像を一括再監査する
if (import.meta.url === `file://${process.argv[1]}`) {
  const rep = JSON.parse(fs.readFileSync('logs/new_dest_images.json', 'utf8'));
  const targets = JSON.parse(fs.readFileSync('logs/new_dest_targets.json', 'utf8'));
  const LOCAL = {
    jindaiji:['深大寺','調布'], kunitachi:['国立'], 'todoroki-keikoku':['等々力','世田谷'],
    gyoda:['行田','忍城','Oshi'], kinchakuda:['巾着田','日高'], 'soka-matsubara':['草加'],
    fukaya:['深谷'], higashichichibu:['東秩父','和紙'], kisarazu:['木更津'],
    'futtsu-misaki':['富津'], 'kasamori-kannon':['笠森','長南','Kasamori'],
    'shirahama-boso':['南房総','野島','安房'], 'kawasaki-daishi':['川崎','平間寺','Kawasaki Daishi'],
    miyagase:['宮ヶ瀬','清川'], kobouyama:['弘法山','秦野','Hadano'],
    'oyama-afuri':['阿夫利','伊勢原','Afuri'], shomyoji:['称名寺','金沢区','Shomyo'],
  };
  const out = [];
  for (const a of rep.adopted) {
    const t = targets.find((x) => x.id === a.id);
    const r = await placeCheck(a.title, t.prefecture, LOCAL[a.id] || []);
    const mark = r.verdict === 'ok' ? '✅' : r.verdict === 'weak' ? '⚠️ ' : '❌';
    console.log(`${mark} ${a.name.padEnd(10)} ${r.verdict.padEnd(4)} 自県=${r.hitsSelf} 地名=${r.hitsLocal} 他県=${r.others.join(',')||'-'}`);
    if (r.verdict !== 'ok') console.log(`     cats: ${r.cats.join(' | ').slice(0,150)}\n     desc: ${r.desc.slice(0,120)}`);
    out.push({ id: a.id, name: a.name, file: a.title, ...r });
    await sleep(400);
  }
  fs.writeFileSync('logs/new_dest_place_check.json', JSON.stringify(out, null, 1));
  const ng = out.filter(x=>x.verdict==='ng'), weak = out.filter(x=>x.verdict==='weak');
  console.log(`\nok ${out.length-ng.length-weak.length} / weak ${weak.length} / ng ${ng.length}`);
}
