#!/usr/bin/env node
/**
 * mergeAwaraOnsen.mjs — 既存の「芦原温泉共同浴場群」(niche_福井_3) を
 * 「あわら温泉」として温泉街の水準に書き換える（統合）。
 *
 * 判断:
 *   あわら温泉を別立てすると、既存エントリと3.46kmの同一温泉地に2ページができる。
 *   座標を測り直すとwikipediaの点(36.225,136.1944)だけが西にずれており、
 *   OSMの厳密一致点(36.2146,136.2351)は既存エントリの0.6km以内。同じ場所である。
 *   一方、既存は tier=spot で「共同浴場文化」という一側面しか扱っておらず、
 *   宿30軒規模の温泉地としては収録されていなかった。
 *   そこで別立てではなく、既存エントリを温泉地の水準へ格上げして一本にまとめる。
 *   idは据え置く。変えると既存URLが404になるため。
 *
 * 差し替える中身:
 *   ・spot「清明乃湯」… 実在を確認できなかった（観光協会・Wikipediaのどちらにも
 *     記載が無い）。実在を確認できたセントピアあわら・芦湯・湯けむり横丁に入れ替える。
 *   ・main.jpg が宣言されているのに実体が無かったので、画像を取得して入れる。
 *   ・featured_stay が空だったので「光風湯圃 べにや」を入れる
 *     （あわら市観光協会の宿泊一覧に掲載、明治17年開業、営業中を確認）。
 */
import fs from 'fs';

const DATA = ['src/data/destinations.json', 'public/data/destinations.json'];
const ID = 'niche_福井_3';

const IMG = JSON.parse(fs.readFileSync('logs/awara_images.json', 'utf8'));

const DESCRIPTION = 'えちぜん鉄道のあわら湯のまち駅を降りると、碁盤目に区切られた通りに宿が並んでいる。明治十六年、田んぼの灌漑用の井戸を掘っていて湯が出たのが始まりで、以来ここは関西の奥座敷と呼ばれてきた。宿がそれぞれ自前の源泉を持っているのがこの土地の特徴で、その数は七十四本、泉温は三十三度から七十七度まで幅がある。昭和三十一年の大火で街ごと焼けたあと、いまの整然とした街並みに作り直された。駅前には無料の足湯「芦湯」があり、日が落ちると軒下の提灯に灯が入る。芦原温泉駅には北陸新幹線が停まる。';

const SPOTS = [
  { name: '芦湯', description: 'あわら湯のまち駅前にある無料の足湯。大正ロマン風の湯屋に五つの湯船が並び、夜は提灯が灯る。' },
  { name: 'セントピアあわら', description: '街の公衆浴場。二つの浴室を男女で日替わりに入れ替えており、泊まらずに湯だけ立ち寄れる。' },
  { name: '湯けむり横丁', description: '駅前に屋台が並ぶ一角。小さな店が肩を寄せ、湯上がりに一杯やってから宿へ戻る客が多い。' },
];

const FEATURED = {
  name: 'あわら温泉 光風湯圃 べにや',
  catchcopy: '明治十七年開業。十七室すべてに源泉かけ流しの半露天風呂を備える',
  hasShuttle: false,
  accessStation: 'えちぜん鉄道あわら湯のまち駅',
};

for (const f of DATA) {
  const all = JSON.parse(fs.readFileSync(f, 'utf8'));
  const d = all.find((x) => x.id === ID);
  if (!d) throw new Error(`${ID} が無い: ${f}`);
  d.name = 'あわら温泉';
  d.catch = '宿がそれぞれ自前の源泉を持つ、七十四本の湯。';
  d.description = DESCRIPTION;
  d.spots = SPOTS;
  d.tags = ['温泉', '歴史', '街歩き', '湯治'];
  d.primary = ['温泉', '歴史'];
  d.secondary = ['街歩き', '湯治'];
  d.tier = 'area';
  d.tier2 = 'area';
  d.onsenLevel = 3;
  d.destType = 'onsen';
  d.hotelSearch = 'あわら温泉';
  d.mainSpot = '芦湯';
  d.mapPoint = '芦湯';
  d.lat = 36.2146;                 // OSMの厳密一致点。従来値(36.2114,136.2292)とも0.6km以内
  d.lng = 136.2351;
  d.city = 'あわら市';
  d.railGateway = 'あわら湯のまち駅';
  d.gateways = { rail: ['あわら湯のまち駅'], airport: ['小松空港'], bus: [], ferry: [] };
  d.airportGateway = '小松空港';
  d.representativeStation = 'あわら湯のまち駅';
  d.hubStation = 'あわら湯のまち駅';
  d.accessStation = 'あわら湯のまち駅';
  d.requiresCar = false;
  d.finalAccess = { type: 'walk' };
  d.bestSeason = '通年';
  d.reasonChips = ['温泉', 'ひとり旅向け', 'カップル向け', '1泊がおすすめ', '車なしOK'];
  d.images = [`/images/${ID}/main.jpg`];
  d.imageCredit = IMG.credit;
  d.featured_stay = FEATURED;
  fs.writeFileSync(f, JSON.stringify(all, null, 2) + '\n');
  if (f === DATA[0]) {
    console.log(`■ ${ID} を「${d.name}」に書き換えた`);
    console.log(`   description ${d.description.length}字`);
    for (const s of d.spots) console.log(`   spot ${s.name} … ${s.description.length}字`);
    console.log(`   座標 ${d.lat},${d.lng} / tier=${d.tier} / featured_stay=${d.featured_stay.name}`);
    console.log(`   画像 ${IMG.title} (${IMG.credit.author} / ${IMG.credit.license})`);
  }
}
