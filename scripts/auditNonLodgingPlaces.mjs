// 【2】宿泊施設が実質存在しない場所の宿リンク検査
// 名称が宿泊不適キーワードに該当 かつ 宿リンクが県汎用トップ着地のものを抽出
// 使い方: node scripts/auditNonLodgingPlaces.mjs → logs/non_lodging_audit.json
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dests = JSON.parse(fs.readFileSync(path.join(root, 'src/data/destinations.json'), 'utf8'));

// 宿泊不適な地形・施設キーワード（名称ベース）
const KW = /渓谷|峡谷|渓$|峡$|展望台|展望公園|展望|公園$|峠|道の駅|湿原|湿地|鍾乳洞|洞窟|滝$|滝(?!沢)|岬$|岬(?!町)|棚田|並木|大橋|橋$|ダム|沙丘|砂丘|海岸$|ビーチ|洞$|鳥居|城跡|遺跡|古墳|磨崖仏|石仏|廃線|線路|庭園|neighborhood|花畑|お花畑|高原(?!温泉)|湖$|池$|沼$|川$|渓流|噴水|灯台|離宮|牧場|農場|花公園|群生地|自生地|藤棚|雪渓|氷穴|風穴|滝群/;

const isPrefTopJalan = (u) => /^https:\/\/www\.jalan\.net\/\d{6}\/?$/.test(u || '');
const isPrefTopRakuten = (u) => /^https:\/\/travel\.rakuten\.co\.jp\/yado\/[a-z_]+\/?$/.test(u || '');

const rows = [];
for (const d of dests) {
  const name = d.displayName || d.name;
  if (!KW.test(name)) continue;
  const hl = d.hotelLinks || {};
  const jalanTop = isPrefTopJalan(hl.jalan);
  const rakutenTop = isPrefTopRakuten(hl.rakuten);
  rows.push({
    id: d.id, name, destType: d.destType, prefecture: d.prefecture,
    stayAllowed: d.stayAllowed, hub: d.hubCity || d.hubName || d.hub || '',
    stayArea: d.stayArea?.jalan || null,
    hotelKeyword: d.hotelKeyword || d.hotelSearch || null,
    featuredStay: d.featured_stay?.name || null,
    jalan: hl.jalan || null, rakuten: hl.rakuten || null,
    jalanIsPrefTop: jalanTop, rakutenIsPrefTop: rakutenTop,
    bothPrefTop: jalanTop && rakutenTop,
  });
}

// 深刻度: 両方とも県トップ > 片方 > ディープリンクあり
rows.sort((a, b) => (b.bothPrefTop - a.bothPrefTop) || (b.jalanIsPrefTop + b.rakutenIsPrefTop) - (a.jalanIsPrefTop + a.rakutenIsPrefTop));
fs.writeFileSync(path.join(root, 'logs/non_lodging_audit.json'), JSON.stringify(rows, null, 1));

const both = rows.filter(r => r.bothPrefTop);
const partial = rows.filter(r => !r.bothPrefTop && (r.jalanIsPrefTop || r.rakutenIsPrefTop));
const ok = rows.filter(r => !r.jalanIsPrefTop && !r.rakutenIsPrefTop);
console.log(`該当キーワードdestination: ${rows.length}件`);
console.log(`├ 両リンクとも県汎用トップ(実質機能せず): ${both.length}件`);
console.log(`├ 片方のみ県トップ: ${partial.length}件`);
console.log(`└ ディープリンクあり(問題なし寄り): ${ok.length}件\n`);
console.log('--- 両方県トップ(重症) ---');
for (const r of both) console.log(`${r.id} ${r.name} [${r.destType}/${r.prefecture}] hub=${r.hub} stayArea=${r.stayArea} featured=${r.featuredStay} stayAllowed=[${r.stayAllowed}]`);
console.log('\n--- 片方県トップ ---');
for (const r of partial) console.log(`${r.id} ${r.name} [${r.prefecture}] jalanTop=${r.jalanIsPrefTop} rakutenTop=${r.rakutenIsPrefTop} hub=${r.hub}`);
