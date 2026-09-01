#!/usr/bin/env node
/**
 * buildMajorOnsen.mjs — 全国区の知名度がありながら未掲載だった主要温泉地（優先度A）を追加する。
 * 「秘湯・一軒宿」ではなく「名湯・温泉街」枠。
 *
 * 営業確認は ja.Wikipedia → 宿の公式サイト / 温泉旅館組合の公式サイト の順に確認した（2026-09-01時点）。
 *
 * 不採用:
 *   道後温泉(愛媛) … 既存「松山」から2.0km。松山のスポット6件中3件が道後関連で収録済み。
 *   鉄輪温泉(大分) … 既存「別府」から1.1km。別府のスポットに「鉄輪温泉」がある。
 *                    かつwikidataとgsiの座標が4.35km離れており座標の質も低い。
 *   妙見温泉(鹿児島) … Commons に使える画像が無い。唯一の合格候補は「妙見発電所」の
 *                      建物で、Visionが湯舎と誤判定したものだった（目視で棄却）。
 *
 * featured_stay はすべて公式サイトか温泉旅館組合の一覧で実在と営業を確認した。
 *   皆生温泉の東光園は組合の加盟一覧に無く、公式ドメインも証明書が切れていたため使わない。
 */
import fs from 'fs';

const DATA = 'src/data/destinations.json';
const all = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const byId = (id) => all.find((d) => d.id === id);

const RAKUTEN = (pref) => `https://hb.afl.rakuten.co.jp/hgc/5113ee4b.8662cfc5.5113ee4c.119de89a/`
  + `?pc=${encodeURIComponent(`https://travel.rakuten.co.jp/yado/${pref}/`)}`;
const PREF = {
  '和歌山県': { rakuten: RAKUTEN('wakayama'),  jalan: 'https://www.jalan.net/300000/', area: 'wakayama' },
  '福島県':   { rakuten: RAKUTEN('fukushima'), jalan: 'https://www.jalan.net/070000/', area: 'fukushima' },
  '石川県':   { rakuten: RAKUTEN('ishikawa'),  jalan: 'https://www.jalan.net/ikisaki/map/ishikawa/', area: 'ishikawa' },
  '岐阜県':   { rakuten: RAKUTEN('gifu'),      jalan: 'https://www.jalan.net/210000/', area: 'gifu' },
  '鳥取県':   { rakuten: RAKUTEN('tottori'),   jalan: 'https://www.jalan.net/310000/', area: 'tottori' },
};

// travelTime と icCard を引き継ぐ最寄りの既存エントリ
const BASE = {
  // 飯坂は同じ福島市の高湯温泉を土台にする。福島市エントリのtravelTimeは
  // 未算出を表す999が多く、絞り込むと8件しか残らないため。
  yunomine: 'kumano-hongu', iizaka: 'takayu-onsen', 'higashiyama-aizu': 'aizu',
  'yamanaka-onsen': 'kaga-onsen2', hirayu: 'norikura', shinhotaka: 'okuhida-onsen', kaike: 'yonago',
};
const travelTimeFrom = (id) => Object.fromEntries(
  Object.entries(byId(BASE[id])?.travelTime || {}).filter(([, v]) => typeof v === 'number' && v > 0 && v < 900));

const IMG = JSON.parse(fs.readFileSync('logs/major_images.json', 'utf8')).adopted;
const creditOf = (id) => IMG.find((x) => x.id === id)?.credit ?? null;
const COORD = Object.fromEntries(JSON.parse(fs.readFileSync('logs/major_targets.json', 'utf8'))
  .map((t) => [t.id, { lat: t.lat, lng: t.lng, city: t.city }]));

const E = [
  {
    id: 'yunomine', name: '湯の峰温泉', prefecture: '和歌山県',
    railGateway: '新宮駅', airportGateway: '南紀白浜空港', hotelSearch: '湯の峰温泉',
    bestSeason: '秋', requiresCar: false, tags: ['温泉', '歴史', '世界遺産', '湯治'],
    catch: '世界遺産に登録された、たった一つの湯。',
    description: '熊野本宮大社へ向かう参詣道の途中、谷あいに十数軒の宿が身を寄せている。四世紀の発見と伝わる千八百年の湯で、二〇〇四年に紀伊山地の霊場と参詣道の一部として世界遺産に登録された。世界遺産に入っている温泉は、いまのところここだけだ。岩をくり抜いた小さなつぼ湯は二人も入れば一杯になる大きさで、一日に七度も湯の色が変わると言い伝えられてきた。泉質は含硫黄の炭酸水素塩泉、源泉は九十二・五度と熱く、川べりの湯筒では玉子や野菜が茹だる。新宮駅からバスで一時間ほど。',
    spots: [
      { name: 'つぼ湯', description: '岩をくり抜いた二人でいっぱいの湯船。世界遺産に登録された唯一の温泉で、湯の色が変わると伝わる。' },
      { name: '湯筒', description: '九十二度の源泉が自噴する川べりの湯だまり。売店で買った玉子や野菜をその場で茹でて食べられる。' },
      { name: '公衆浴場', description: '一般湯・くすり湯・貸切湯の三つを備える。十リットル百円で湯を汲んで持ち帰ることもできる。' },
    ],
    featured_stay: { name: '湯の峰温泉 旅館あづまや', catchcopy: '世界遺産の湯を引く老舗。総檜の大浴場で九十二度の源泉に浸かる', hasShuttle: false, accessStation: 'JR新宮駅' },
  },
  {
    id: 'iizaka', name: '飯坂温泉', prefecture: '福島県',
    railGateway: '飯坂温泉駅', airportGateway: '仙台空港', hotelSearch: '飯坂温泉',
    bestSeason: '通年', requiresCar: false, tags: ['温泉', '歴史', '街歩き', '湯治'],
    catch: '百円玉一枚で入れる共同浴場が、九つ。',
    description: '摺上川の谷に宿が三十軒あまり並び、そのあいだに共同浴場が点在する。中でも鯖湖湯は日本でも古い木造の共同浴場を復元したもので、大きな一枚屋根と黒光りする板壁が通りの目印になっている。入浴料は百円台から三百円ほど、地元の人が桶を持って通う光景がいまも残る。日本武尊が見つけたと伝わる古い湯で、松尾芭蕉が元禄二年に泊まり、ヘレン・ケラーも二度訪れている。泉質は単純温泉。福島駅から飯坂線で二十三分と、新幹線からの乗り継ぎがいい。',
    spots: [
      { name: '鯖湖湯', description: '飯坂を代表する共同浴場。古い木造湯屋を復元したもので、大きな屋根と板壁が通りの目印になる。' },
      { name: '波来湯', description: '摺上川のほとりに建つもう一つの共同浴場。川面より低い位置に湯船があり、窓の外を水が流れる。' },
      { name: '摺上川の谷', description: '宿と共同浴場が両岸に並ぶ。桶を提げて湯へ向かう地元の人の姿が、いまも日常として見られる。' },
    ],
    featured_stay: { name: '飯坂温泉 摺上亭 大鳥', catchcopy: '摺上川を見下ろす宿。九つの共同浴場めぐりの拠点にできる', hasShuttle: false, accessStation: '飯坂温泉駅' },
  },
  {
    id: 'higashiyama-aizu', name: '東山温泉', prefecture: '福島県',
    railGateway: '会津若松駅', airportGateway: '福島空港', hotelSearch: '東山温泉',
    bestSeason: '秋', requiresCar: false, tags: ['温泉', '歴史', '自然', '秋'],
    catch: '会津の奥座敷。芸妓の三味線がまだ聞こえる。',
    description: '会津若松の市街地からバスで十五分、湯川の細い谷に二十軒あまりの宿が石垣の上に積み重なっている。奈良時代に行基が見つけたと伝わり、江戸期には会津藩の指定する湯治場として整えられ、藩の奥座敷と呼ばれてきた。泉質は硫酸塩泉、四十五度から五十八度の湯が毎分千五百リットル湧く。谷には東山四大滝がかかり、秋は宿の窓がそのまま紅葉の額縁になる。からころ芸妓と呼ばれる芸妓がいまも座敷に出る土地でもある。八月中旬には盆踊りで温泉街が埋まる。',
    spots: [
      { name: '向瀧', description: '明治六年創業、建物が国の登録有形文化財。会津藩指定の湯治場だった時代から続く宿である。' },
      { name: '東山四大滝', description: '湯川の谷にかかる伏見ヶ滝・雨降り滝など四つの滝。宿の窓や散歩道から眺めることができる。' },
      { name: '東山温泉盆踊り', description: '八月中旬、温泉街の通りが提灯と踊りの輪で埋まる。宿泊客も浴衣のまま輪に入れる行事。' },
    ],
    featured_stay: { name: '会津東山温泉 向瀧', catchcopy: '明治六年創業の登録有形文化財。回遊式庭園と自家源泉かけ流し', hasShuttle: false, accessStation: 'JR会津若松駅' },
  },
  {
    id: 'yamanaka-onsen', name: '山中温泉', prefecture: '石川県',
    railGateway: '加賀温泉駅', airportGateway: '小松空港', hotelSearch: '山中温泉',
    bestSeason: '秋', requiresCar: false, tags: ['温泉', '自然', '歴史', '秋'],
    catch: '芭蕉が八泊した渓谷の湯。扶桑三名泉のひとつ。',
    description: '大聖寺川がえぐった鶴仙渓に沿って、二十数軒の宿が建つ。元禄二年に松尾芭蕉が八泊し、扶桑三名泉のひとつに数えて句を残した湯だ。総湯の菊の湯は男湯と女湯が別棟になっており、壁面には九谷焼のタイルで山中温泉縁起絵巻が写されている。泉質はナトリウム・カルシウムの硫酸塩泉、四十八・三度。渓谷には総ヒノキのこおろぎ橋とS字にうねるあやとり橋が架かり、川床が出る季節もある。山中漆器の産地でもあり、木地屋の工房が今も通りに残っている。加賀温泉駅からバスで三十分。',
    spots: [
      { name: '総湯 菊の湯', description: '男湯と女湯が別棟に建つ総湯。壁の九谷焼タイルに山中温泉縁起絵巻が写し取られている。' },
      { name: '鶴仙渓', description: '大聖寺川がえぐった渓谷。遊歩道が川沿いに続き、季節によっては川床が出て茶を飲める。' },
      { name: 'こおろぎ橋', description: '総ヒノキで架けられた渓谷の橋。少し下流のあやとり橋はS字にうねる現代的な造りで対照的。' },
    ],
    featured_stay: { name: '山中温泉 かよう亭', catchcopy: '鶴仙渓の山あいに建つ静かな宿。芭蕉が八泊した湯を引く', hasShuttle: false, accessStation: 'JR加賀温泉駅' },
  },
  {
    id: 'hirayu', name: '平湯温泉', prefecture: '岐阜県',
    railGateway: '高山駅', airportGateway: '富山空港', hotelSearch: '平湯温泉',
    bestSeason: '秋', requiresCar: false, tags: ['温泉', '自然', '絶景', '秋'],
    catch: '源泉四十本。奥飛騨でいちばん湯量が多い。',
    description: '奥飛騨温泉郷の入口にあたる標高千二百メートルの盆地で、源泉が四十本ほど、毎分一万三千リットルが湧く。炭酸水素塩泉・塩化物泉・単純温泉・硫黄泉と泉質が入り混じり、宿ごとに湯の性格が違う。宿は二十六軒、外湯が四つ。戦国のころ疲れた兵を白い猿が湯へ導いたという伝説が残り、昭和三十九年に国民保養温泉地に指定された。上高地と乗鞍岳へのマイカー規制が始まってからは、車を停めてバスに乗り換える拠点にもなっている。落差六十四メートルの平湯大滝が谷の奥にかかる。',
    spots: [
      { name: '平湯大滝', description: '落差六十四メートル、幅六メートルの滝。冬は凍りつき、二月には夜間のライトアップがある。' },
      { name: '平湯民俗館', description: '国の登録文化財である豊坂家住宅を移築した施設。併設の露天風呂に入ることもできる。' },
      { name: '平湯バスターミナル', description: '上高地・乗鞍岳へのマイカー規制の乗り換え地点。ここに車を停めてバスに乗り継ぐことになる。' },
    ],
    featured_stay: { name: '平湯温泉 ひらゆの森', catchcopy: '広い露天風呂群と素泊まりも通る宿。奥飛騨の湯量を実感できる', hasShuttle: false, accessStation: '平湯温泉バスターミナル' },
  },
  {
    id: 'shinhotaka', name: '新穂高温泉', prefecture: '岐阜県',
    railGateway: '高山駅', airportGateway: '富山空港', hotelSearch: '新穂高温泉',
    bestSeason: '秋', requiresCar: false, tags: ['温泉', '絶景', '自然', '山'],
    catch: '露天風呂の正面に、槍ヶ岳と穂高が立つ。',
    description: '蒲田川をさかのぼった谷の最奥に、宿が五十軒あまり点在する。奥飛騨温泉郷でも標高が高く、蒲田・中尾・新穂高の三地区で泉質が分かれ、中尾の高いところでは硫黄泉が湧く。武田信玄の家来が浸かったとも言い伝えられるが、開湯の年ははっきりしない。谷の奥から新穂高ロープウェイが標高二千百五十六メートルまで一気に上がり、西穂高口の展望台に立つと槍ヶ岳から笠ヶ岳まで北アルプスの稜線が並ぶ。北アルプス登山の玄関口でもあり、無料で入れる公衆露天風呂も残っている。高山駅からバスで九十分。',
    spots: [
      { name: '新穂高ロープウェイ', description: '二階建てのゴンドラで標高二千百五十六メートルへ。西穂高口の展望台から槍ヶ岳が見える。' },
      { name: '蒲田川沿いの露天', description: '川のすぐ横に湯船を切った宿が並ぶ。湯に浸かったまま北アルプスの稜線を見上げられる。' },
      { name: '北アルプスの登山口', description: '槍ヶ岳・笠ヶ岳・双六岳への道がここから始まる。下山後にそのまま湯へ入れる立地である。' },
    ],
    featured_stay: { name: '新穂高温泉 槍見舘', catchcopy: '蒲田川沿いの古民家造り。露天から槍ヶ岳を望むかけ流しの宿', hasShuttle: false, accessStation: '高山駅からバス' },
  },
  {
    id: 'kaike', name: '皆生温泉', prefecture: '鳥取県',
    railGateway: '米子駅', airportGateway: '米子鬼太郎空港', hotelSearch: '皆生温泉',
    bestSeason: '夏', requiresCar: false, tags: ['温泉', '絶景', 'ビーチ', '夏'],
    catch: '海のなかから湧いた湯。正面に大山が立つ。',
    description: '日本海に面した弓ヶ浜の砂浜沿いに、宿が十六軒ほど並ぶ山陰最大の温泉地だ。明治三十三年、漁師が海中に湧く湯を見つけたのが始まりで、大正期に有本松太郎が本格的に開発した。泉質はナトリウム・カルシウムの塩化物泉、八十九度の湯が日に五十六万リットル湧く。海水浴と温泉を同じ日に楽しめる場所は国内でも数えるほどしかない。美保湾越しに中国地方最高峰の大山が立ち、宿の展望風呂からその姿を眺められる。昭和五十六年には日本で最初のトライアスロン大会がここで開かれた。米子駅からバスで十九分。',
    spots: [
      { name: '皆生海岸', description: '白砂と松林が続く弓ヶ浜の一角。海水浴と温泉を同じ日に楽しめる、国内でも珍しい浜である。' },
      { name: '大山の眺め', description: '美保湾の向こうに中国地方最高峰が立つ。宿の展望風呂から見えることを売りにする宿も多い。' },
      { name: 'トライアスロン発祥の地', description: '昭和五十六年、日本初のトライアスロン大会がここで開かれた。夏には今も大会が続いている。' },
    ],
    featured_stay: { name: '皆生温泉 華水亭', catchcopy: '日本海に面した宿。海に湧いた塩化物泉と大山の眺めを併せ持つ', hasShuttle: false, accessStation: 'JR米子駅' },
  },
];

// ── 投入前に字数を機械測定する（description 200〜300字 / spot 40〜80字）──
const bad = [];
for (const e of E) {
  if (e.description.length < 200 || e.description.length > 300) bad.push(`${e.name} description ${e.description.length}字`);
  if (e.spots.length !== 3) bad.push(`${e.name} spotが${e.spots.length}件`);
  for (const s of e.spots) {
    if (s.description.length < 40 || s.description.length > 80) bad.push(`${e.name} spot「${s.name}」${s.description.length}字`);
  }
}
if (bad.length) {
  console.log('■ 字数が範囲外');
  for (const b of bad) console.log(`  ❌ ${b}`);
  console.log(`\n投入を中止した（${bad.length}件）`);
  process.exit(1);
}

const built = [];
for (const e of E) {
  const c = COORD[e.id];
  const p = PREF[e.prefecture];
  const credit = creditOf(e.id);
  if (!c) throw new Error(`座標なし: ${e.id}`);
  if (!p) throw new Error(`県設定なし: ${e.prefecture}`);
  if (!credit) throw new Error(`画像クレジットなし: ${e.id}`);
  const base = byId(BASE[e.id]);
  built.push({
    id: e.id, name: e.name, type: 'destination',
    region: base?.region ?? null, hub: base?.hub ?? null,
    stayAllowed: ['1night'], departures: base?.hub ? [base.hub] : [], weight: 1,
    description: e.description, tags: e.tags, spots: e.spots,
    shinkansenAccess: false, requiresCar: e.requiresCar, hotelSearch: e.hotelSearch,
    gateways: { rail: [e.railGateway], airport: [e.airportGateway], bus: [], ferry: [] },
    destType: 'onsen', railGateway: e.railGateway, busGateway: null, ferryGateway: null,
    airportGateway: e.airportGateway, prefecture: e.prefecture, lat: c.lat, lng: c.lng,
    stayBias: 1, city: c.city, situations: ['solo', 'couple'], catch: e.catch,
    mainSpot: e.spots[0].name, mapPoint: e.spots[0].name,
    representativeStation: e.railGateway, hubStation: e.railGateway, accessStation: e.railGateway,
    hotelArea: p.area, finalAccess: { type: e.requiresCar ? 'car' : 'walk' },
    travelTime: travelTimeFrom(e.id), stayRecommendation: '1night',
    tier: 'area', tier2: 'area', icCard: base?.icCard ?? 'icoca',
    bestSeason: e.bestSeason, onsenLevel: 3, hasDirectFlight: false,
    primary: e.tags.slice(0, 2), secondary: e.tags.slice(2),
    reasonChips: ['温泉', 'ひとり旅向け', 'カップル向け', '1泊がおすすめ', ...(e.requiresCar ? [] : ['車なしOK'])],
    images: [`/images/${e.id}/main.jpg`], imageCredit: credit,
    hotelLinks: { rakuten: p.rakuten, jalan: p.jalan },
    featured_stay: e.featured_stay,
  });
}
for (const b of built) if (all.some((d) => d.id === b.id)) throw new Error(`id重複のため中止: ${b.id}`);
const out = all.concat(built);
fs.writeFileSync(DATA, JSON.stringify(out, null, 2) + '\n');
fs.writeFileSync('public/data/destinations.json', JSON.stringify(out, null, 2) + '\n');
console.log(`追加 ${built.length}件 / 総数 ${all.length} → ${out.length}\n`);
for (const b of built) {
  console.log(`  ${b.id.padEnd(17)} ${b.name.padEnd(7)} ${b.prefecture.padEnd(4)} desc=${b.description.length}字 `
    + `spot=${b.spots.map((s) => s.description.length).join('/')} tt=${Object.keys(b.travelTime).length} ic=${b.icCard} stay=${b.featured_stay.name}`);
}
