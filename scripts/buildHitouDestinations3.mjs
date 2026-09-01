#!/usr/bin/env node
/**
 * buildHitouDestinations3.mjs — 西日本中心の温泉16件を追加する（第3バッチ）。
 *
 * 営業確認は Wikipedia → 公式サイト の順に WebFetch した（2026-09-01時点）。
 *
 * 不採用: 鳩ヶ湯温泉(福井) … 公式が2025-07-08付で「長期休業中。日帰り入浴・
 *         ご宿泊ともに営業を休止。再開の目処は未定」と告知。宿として紹介できない。
 *
 * 季節営業・注意点は description に明記する。
 *   中宮温泉 11月下旬〜4月上旬は冬季休業
 *   鈍川温泉 「鈍川温泉ホテル」は取り壊し中との情報があるため featured_stay に使わない
 */
import fs from 'fs';

const DATA = 'src/data/destinations.json';
const all = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const byId = (id) => all.find((d) => d.id === id);

const PREF = {
  '三重県': { rakuten: 'https://travel.rakuten.co.jp/yado/mie/',      jalan: 'https://www.jalan.net/240000/', area: 'mie' },
  '兵庫県': { rakuten: 'https://travel.rakuten.co.jp/yado/hyogo/',    jalan: 'https://www.jalan.net/280000/', area: 'hyogo' },
  '島根県': { rakuten: 'https://travel.rakuten.co.jp/yado/shimane/',  jalan: 'https://www.jalan.net/320000/', area: 'shimane' },
  '鳥取県': { rakuten: 'https://travel.rakuten.co.jp/yado/tottori/',  jalan: 'https://www.jalan.net/310000/', area: 'tottori' },
  '広島県': { rakuten: 'https://travel.rakuten.co.jp/yado/hiroshima/',jalan: 'https://www.jalan.net/340000/', area: 'hiroshima' },
  '山口県': { rakuten: 'https://travel.rakuten.co.jp/yado/yamaguchi/',jalan: 'https://www.jalan.net/350000/', area: 'yamaguchi' },
  '愛媛県': { rakuten: 'https://travel.rakuten.co.jp/yado/ehime/',    jalan: 'https://www.jalan.net/380000/', area: 'ehime' },
  '石川県': { rakuten: 'https://travel.rakuten.co.jp/yado/ishikawa/', jalan: 'https://www.jalan.net/ikisaki/map/ishikawa/', area: 'ishikawa' },
};

const BASE = {
  'yunoyama': 'seki-juku', 'yumura-hyogo': 'uradome', 'shioda': 'tatsuno',
  'sumoto-onsen': 'awaji', 'shikano': 'hakuto', 'togo': 'kurayoshi', 'yoshioka': 'hakuto',
  'arifuku': 'hamada-shimane', 'izumoyumura': 'izumo', 'miyahama': 'miyajima',
  'nagatoyumoto': 'nagato-yamaguchi', 'tawarayama': 'nagato-yamaguchi',
  'yuno-yamaguchi': 'hofu', 'nibukawa': 'imabari', 'yunoura': 'imabari', 'chugu': 'hakusan',
};
const travelTimeFrom = (id) => Object.fromEntries(
  Object.entries(byId(BASE[id])?.travelTime || {}).filter(([, v]) => typeof v === 'number' && v > 0 && v < 900));

const IMG = JSON.parse(fs.readFileSync('logs/hitou_images3.json', 'utf8')).adopted;
const creditOf = (id) => IMG.find((x) => x.id === id)?.credit ?? null;
const COORD = Object.fromEntries(JSON.parse(fs.readFileSync('logs/hitou_targets3.json', 'utf8'))
  .map((t) => [t.id, { lat: t.lat, lng: t.lng, city: t.city }]));

const E = [
  {
    id: 'yunoyama', name: '湯の山温泉', prefecture: '三重県',
    railGateway: '湯の山温泉駅', airportGateway: '中部国際空港', hotelSearch: '湯の山温泉',
    bestSeason: '秋', requiresCar: false, tags: ['温泉', '絶景', '自然', '秋'],
    catch: '傷ついた鹿が湯に浸かっていた、という古湯。',
    description: '鈴鹿の山あいに、養老二年の発見と伝わる古い湯がある。傷ついた鹿が湯で傷を癒していたことから鹿ノ湯とも呼ばれてきた。泉質はアルカリ性のラジウム泉で、宿は十四軒ほど。歓楽街にならず、家族連れの行楽地として育ってきた経緯があり、日帰り入浴を受けている宿も十二軒ある。御在所ロープウェイで一気に標高千メートルまで上がると、伊勢湾から知多半島まで見渡せる。夏の僧兵まつりは五十年以上続く。近鉄湯の山温泉駅からバスで十分、名古屋から高速バスなら一時間ほどで着いてしまう近さだ。',
    spots: [
      { name: '御在所ロープウェイ', description: '標高千二百メートル近くまで一気に上がる。晴れた日は伊勢湾から知多半島まで見渡せる。' },
      { name: '日帰り入浴の宿めぐり', description: '十四軒のうち十二軒が日帰り入浴を受けている。泊まらずに湯だけ味わうこともできる。' },
      { name: '僧兵まつり', description: '五十回以上続く秋の火祭り。かつてこの一帯に勢力を持った僧兵にちなむ行事で、松明が谷を照らす。' },
    ],
    featured_stay: { name: '湯の山温泉 寿亭', catchcopy: '養老二年開湯と伝わる鹿ノ湯。鈴鹿の渓谷に建つ老舗', hasShuttle: false, accessStation: '近鉄湯の山温泉駅' },
  },
  {
    id: 'yumura-hyogo', name: '湯村温泉', prefecture: '兵庫県',
    railGateway: '浜坂駅', airportGateway: '但馬空港', hotelSearch: '湯村温泉 兵庫',
    bestSeason: '冬', requiresCar: false, tags: ['温泉', '湯治', '歴史', '冬'],
    catch: '九十八度の荒湯で、玉子と野菜を茹でて食べる。',
    description: '春来川のほとりに荒湯と呼ばれる源泉地がある。湧いている湯は九十八度、日本でも有数の高温泉で、湯だまりに籠を沈めれば玉子も野菜もそのまま茹だってしまう。地元の人が野菜を持ち込む姿がふつうに見られる場所だ。嘉祥元年、慈覚大師の開湯と伝わる古い湯で、泉質はナトリウム炭酸水素塩・塩化物・硫酸塩泉、毎分四百七十リットルが湧く。外湯の薬師湯と、七十人以上が同時に浸かれる公衆足湯もある。宿は十七施設ほど。ドラマ夢千代日記の舞台になった町でもある。浜坂駅から町民バスで二十五分。',
    spots: [
      { name: '荒湯', description: '九十八度の源泉が音を立てて湧く源泉地。籠に入れた玉子や野菜をその場で茹でられる。' },
      { name: '外湯 薬師湯', description: '観光交流センターに併設された外湯。荒湯のすぐ近くにあり、町の湯めぐりの起点になっている。' },
      { name: '足湯 ふれ愛の湯', description: '七十人以上が同時に浸かれる公衆足湯。春来川沿いにあり、通りがかりにそのまま座れる。' },
    ],
    featured_stay: { name: '湯村温泉 佳泉郷 井づつや', catchcopy: '九十八度の荒湯が湧く町の宿。日本有数の高温泉を引く', hasShuttle: false, accessStation: 'JR浜坂駅' },
  },
  {
    id: 'shioda', name: '塩田温泉', prefecture: '兵庫県',
    railGateway: '姫路駅', airportGateway: '伊丹空港', hotelSearch: '塩田温泉',
    bestSeason: '秋', requiresCar: false, tags: ['温泉', '湯治', '自然'],
    catch: '姫路から三十分、宿が二軒だけの奥座敷。',
    description: '姫路の市街地からバスで三十分ほど、夢前川をさかのぼった里山に宿が二軒だけある。含二酸化炭素のナトリウム炭酸水素塩冷鉱泉で、飲むこともできる湯として古くから知られ、三百年前には湯治客が来ていたという記録が残る。明治七年創業の湯元上山旅館と、姫路ゆめさき川温泉夢乃井の二軒。姫路の奥座敷と呼ばれるだけあって、川と山しかない静かな場所だ。春は桜、夏は鮎と蛍、秋は紅葉と松茸、冬はぼたん鍋と、季節がはっきり分かれる。夢前スマートインターから五分と、車なら意外に近い。',
    spots: [
      { name: '飲める湯', description: '含二酸化炭素の冷鉱泉で、飲用にも使われてきた。三百年前から湯治客が通ったと伝わる。' },
      { name: '夢前川の里山', description: '宿の前を流れる川と、その両側の山だけという環境。夏は蛍が出て、秋になると谷が紅葉する。' },
      { name: '季節の食卓', description: '夏は鮎、秋は松茸、冬はぼたん鍋。姫路の奥座敷と呼ばれ、料理を目当てに通う客も多い。' },
    ],
    featured_stay: { name: '塩田温泉 湯元上山旅館', catchcopy: '明治七年創業。飲める冷鉱泉を守る、二軒だけの湯治宿のひとつ', hasShuttle: false, accessStation: 'JR姫路駅' },
  },
  {
    id: 'sumoto-onsen', name: '洲本温泉', prefecture: '兵庫県',
    railGateway: '舞子駅', airportGateway: '神戸空港', hotelSearch: '洲本温泉',
    bestSeason: '通年', requiresCar: false, tags: ['温泉', '絶景', 'グルメ'],
    catch: '淡路島の海沿いに湧く、まだ新しい湯。',
    description: '淡路島の東側、大阪湾に面した海沿いに宿が並ぶ。開湯は昭和で、一九九三年に新しい泉源が掘られた比較的新しい温泉地だ。泉質はラドンを含む単純アルカリ泉、源泉は三十七度。海に向いた露天からは、天気がよければ紀伊水道の向こうまで見える。島のものが食卓に出るのもこの土地の強みで、鱧、玉ねぎ、淡路牛と季節ごとに主役が変わる。鉄道は通っておらず、神戸や大阪から高速バスで来るのが一般的。洲本の市街地が近いので、湯だけでなく城下町の散歩と合わせられる。',
    spots: [
      { name: '海に向いた露天', description: '大阪湾に面した宿の露天風呂。天気がよければ、紀伊水道の向こうまで見渡すことができる。' },
      { name: '洲本の城下町', description: '温泉街から歩いて行ける市街地。洲本城跡やレトロな商店街が残り、散歩がそのまま観光になる。' },
      { name: '島の食材', description: '鱧、玉ねぎ、淡路牛と季節ごとに主役が変わる。宿の食事がそのまま旅の目当てになっている。' },
    ],
    featured_stay: { name: 'ホテルニューアワジ', catchcopy: '大阪湾を望む洲本温泉の代表格。自家源泉のにごり湯も併せ持つ', hasShuttle: false, accessStation: 'JR舞子駅' },
  },
  {
    id: 'arifuku', name: '有福温泉', prefecture: '島根県',
    railGateway: '江津駅', airportGateway: '萩・石見空港', hotelSearch: '有福温泉',
    bestSeason: '通年', requiresCar: false, tags: ['温泉', '歴史', '街歩き'],
    catch: '一度は宿が減った町に、新しい宿が戻ってきた。',
    description: '斜面に石段が折り重なる小さな温泉町で、坂の途中に外湯が三つある。中でも御前湯は昭和三年に建てられたタイル張りの洋風建築で、この町の顔になっている。白雉二年、天竺から渡来した法道仙人が見つけたと伝わる古い湯だ。二〇一〇年代には火災と豪雨、旅館の廃業が続いて宿の数が大きく減ったが、二〇二一年以降、廃業した建物をゲストハウスや露天風呂付きの宿に改装する再生が進み、いまは十軒前後まで戻っている。湯は無色透明の単純温泉で、美人の湯と呼ばれてきた。江津駅からバスで三十五分ほど。',
    spots: [
      { name: '御前湯', description: '昭和三年に建てられたタイル張りの洋風建築の外湯。町のいちばん目立つ場所に建っている。' },
      { name: '弥生湯と早月湯', description: '御前湯のほかにある二つの外湯。どちらも坂の途中にあり、三つを歩いて回ることができる。' },
      { name: '石段の町並み', description: '斜面に石段が折り重なる小さな町。改装された新しい宿とカフェが少しずつ混じり始めている。' },
    ],
    featured_stay: { name: '有福温泉 旅館ぬしや', catchcopy: '外湯三つが徒歩圏の石段の町。再生が進む有福の宿', hasShuttle: false, accessStation: 'JR江津駅' },
  },
  {
    id: 'izumoyumura', name: '出雲湯村温泉', prefecture: '島根県',
    railGateway: '木次駅', airportGateway: '出雲空港', hotelSearch: '出雲湯村温泉',
    bestSeason: '通年', requiresCar: true, tags: ['温泉', '湯治', '歴史', '自然'],
    catch: '出雲国風土記に「漆仁の川辺の薬湯」と書かれた湯。',
    description: '斐伊川のほとりに宿が二軒だけある。天平五年に編まれた出雲国風土記に漆仁の川辺の薬湯として登場する、記録の残る中ではかなり古い湯だ。泉質はアルカリ性単純温泉、源泉は四十四・一度、pH八・〇の無色透明。江戸時代開業の湯乃上館は今の建物で築百四十年ほど、もう一軒の国民宿舎清嵐荘は二〇一九年に建て直された。日帰りの漆仁の湯は年中無休で家族風呂もある。川べりには足元から湯が湧く野湯もあるが、管理されていないので入るなら自己責任になる。木次駅から市民バスで十五分ほど。',
    spots: [
      { name: '漆仁の湯', description: '年中無休の日帰り入浴施設。家族風呂もあり、斐伊川の流れを眺めながら湯に浸かれる。' },
      { name: '湯乃上館', description: '江戸時代開業の宿。いまの建物は築百四十年ほどで、廊下も柱も当時のまま使われている。' },
      { name: '斐伊川の川辺', description: '足元から湯が湧く野湯があるが管理されていない。入らずに眺めるだけにしておくのが無難。' },
    ],
    featured_stay: { name: '出雲湯村温泉 国民宿舎 清嵐荘', catchcopy: '風土記に載る古湯。二〇一九年に建て直された斐伊川沿いの宿', hasShuttle: false, accessStation: 'JR木次駅' },
  },
  {
    id: 'shikano', name: '鹿野温泉', prefecture: '鳥取県',
    railGateway: '浜村駅', airportGateway: '鳥取空港', hotelSearch: '鹿野温泉',
    bestSeason: '通年', requiresCar: false, tags: ['温泉', '歴史', '街歩き'],
    catch: '城下町の町並みの脇に、宿が二軒だけ湧いている。',
    description: '鹿野は戦国期に亀井氏が治めた城下町で、いまも碁盤目の道と白壁の土蔵が残っている。その町のはずれに温泉があり、宿は二軒ほど。もともと田んぼから湯が湧いてけがの治療に使われていた土地で、本格的に掘り当てたのは一九五四年と新しい。泉質は単純泉と放射能泉、源泉は五十六度前後。一九六六年に国民保養温泉地に指定された。日帰りならホットピア鹿野があり、夜十時まで開いている。城下町を歩いてから湯に入る、という組み立てができる場所だ。浜村駅からバスで十五分ほど。',
    spots: [
      { name: '鹿野城下町', description: '戦国期に亀井氏が治めた町。碁盤目の道と白壁の土蔵が今も残り、歩いて一周して回れる。' },
      { name: 'ホットピア鹿野', description: '夜十時まで開いている日帰り入浴施設。第一木曜が休みで、入浴料は大人五百五十円になる。' },
      { name: '国民宿舎の湯', description: '五十六度前後の単純泉と放射能泉。宿泊しなくても外来入浴を受け付けてくれる宿がある。' },
    ],
    featured_stay: { name: '国民宿舎 山紫苑', catchcopy: '鹿野城下町のはずれに立つ宿。外来入浴も受けている', hasShuttle: false, accessStation: 'JR浜村駅' },
  },
  {
    id: 'togo', name: '東郷温泉', prefecture: '鳥取県',
    railGateway: '松崎駅', airportGateway: '鳥取空港', hotelSearch: '東郷温泉',
    bestSeason: '通年', requiresCar: false, tags: ['温泉', '絶景', '自然'],
    catch: '湖の底から湯が湧く。だから湖畔に宿が建った。',
    description: '東郷湖の南岸に宿が並ぶ。この湖は底からも湯が湧いていて、江戸時代にはすでにそのことが知られていた。一七四九年の文書に温泉への言及があり、本格的に使われ始めたのは一八六八年ごろ、一八八四年には旅館業が始まっている。泉質はナトリウム・カルシウムの塩化物・硫酸塩泉、源泉は八十五度から九十四度と高い。湖をはさんだ対岸ははわい温泉で、二つ合わせて旅館組合を作っている。湖畔には足湯が二か所あり、水鳥を眺めながら足だけ浸かれる。松崎駅を降りればすぐ、倉吉駅からも車で十分ほどだ。',
    spots: [
      { name: '東郷湖', description: '湖の底からも湯が湧く汽水湖。江戸時代からそのことが知られ、湖畔に宿が建っていった。' },
      { name: '湖畔の足湯', description: '東郷湖畔公園と臨海公園に一か所ずつある。水鳥を眺めながら足だけ浸かることができる。' },
      { name: '対岸のはわい温泉', description: '湖をはさんだ向かい側の温泉地。二つ合わせて旅館組合を作っており、行き来もしやすい。' },
    ],
    featured_stay: { name: '国民宿舎 水明荘', catchcopy: '東郷湖に面した宿。湖底からも湧く高温泉を引く', hasShuttle: false, accessStation: 'JR松崎駅' },
  },
  {
    id: 'yoshioka', name: '吉岡温泉', prefecture: '鳥取県',
    railGateway: '鳥取駅', airportGateway: '鳥取空港', hotelSearch: '吉岡温泉',
    bestSeason: '通年', requiresCar: false, tags: ['温泉', '湯治', '歴史'],
    catch: '犬専用の貸切風呂まである、千年の共同浴場。',
    description: '湖山池の西、鳥取市街から車で二十分ほどの小さな温泉町。開湯は千年以上前とされ、応和二年に葦岡長者が湯を見つけたという伝承が残る。旅館は八軒ほど。町の中心にある共同浴場「一ノ湯」は源泉かけ流しで、露天とサウナのほかに犬専用の貸切風呂まで備えている。朝八時から夜九時まで開いていて、年二回のメンテナンス以外は休まない。泉質は単純温泉、源泉は三十度から五十五度。足湯も二か所ある。山陰道の吉岡温泉インターを降りれば一ノ湯まで二分と、車での立ち寄りやすさは相当なものだ。',
    spots: [
      { name: '共同浴場 一ノ湯', description: '源泉かけ流しの共同浴場。露天とサウナに加え、犬専用の貸切風呂まで備えているのが珍しい。' },
      { name: '二つの足湯', description: '町なかに華湯とやすらぎ湯の二か所。湯めぐりの合間に腰を下ろせる場所になっている。' },
      { name: '湖山池のほとり', description: '温泉町のすぐ東に広がる池。鳥取市街から二十分とは思えないほど静かな水辺が続いている。' },
    ],
    featured_stay: { name: '湯守の宿 田中屋', catchcopy: '開湯千年の吉岡温泉。共同浴場「一ノ湯」まで歩いてすぐ', hasShuttle: false, accessStation: 'JR鳥取駅' },
  },
  {
    id: 'miyahama', name: '宮浜温泉', prefecture: '広島県',
    railGateway: '大野浦駅', airportGateway: '広島空港', hotelSearch: '宮浜温泉',
    bestSeason: '通年', requiresCar: false, tags: ['温泉', '絶景', '海'],
    catch: '宮島から一番近い温泉。露天から鳥居の側の海が見える。',
    description: '大野瀬戸をはさんで宮島の真向かいに湧く。開湯は一九六四年と新しく、宮島を臨む大野の浜辺という土地柄からこの名がついた。宿は七軒ほどで、屋上に露天を持つものもあり、湯に浸かったまま厳島の島影と行き交うフェリーを眺められる。泉質は単純弱放射能温泉、源泉は二十二・一度の低温泉なので加温して使う。日帰りなら、べにまんさくの湯が夜十時まで開いている。大野浦駅からタクシーで五分、大野インターからも六分と近い。宮島を見て帰るのではなく、対岸に一泊するという選び方ができる場所だ。',
    spots: [
      { name: '宮島を望む露天', description: '大野瀬戸の対岸に厳島が横たわる。湯に浸かったまま、行き交うフェリーを眺めていられる。' },
      { name: 'べにまんさくの湯', description: '夜十時まで開いている日帰り入浴施設。第三火曜が休みで、入浴料は大人八百円になる。' },
      { name: '宮島への船', description: '対岸まで目と鼻の先。朝いちばんの船で渡れば、混み合う前の厳島神社にたどり着ける。' },
    ],
    featured_stay: { name: '庭園の宿 石亭', catchcopy: '大野瀬戸ごしに宮島を望む宿。宮島から一番近い温泉郷', hasShuttle: false, accessStation: 'JR大野浦駅' },
  },
  {
    id: 'nagatoyumoto', name: '長門湯本温泉', prefecture: '山口県',
    railGateway: '長門湯本駅', airportGateway: '山口宇部空港', hotelSearch: '長門湯本温泉',
    bestSeason: '通年', requiresCar: false, tags: ['温泉', '街歩き', '歴史'],
    catch: '川沿いを丸ごと作り直した、山口最古の湯。',
    description: '応永三十四年、大寧寺の住職が住吉大明神の神託を受けて見つけたと伝わる山口県最古の温泉。長らく静かな湯治場だったが、二〇一七年に始まった観光まちづくり計画で音信川の一帯が作り直された。川沿いに県内初の川テラスが設けられ、飛び石が置かれ、夜は町全体がライトアップされる。二〇二〇年には外湯の恩湯が建て直され、岩盤から湯が流れ出る様子を見ながら入れる浴場になった。同じ年に星野リゾートの宿も開いている。宿は十一軒ほど、泉質はアルカリ性単純泉で源泉は三十九度。土木学会デザイン賞とグッドデザイン賞を受けた町並みだ。',
    spots: [
      { name: '外湯 恩湯', description: '二〇二〇年に建て直された外湯。岩盤から湯が流れ出る様子を眺めながら浸かることができる。' },
      { name: '音信川の川テラス', description: '県内初の川テラスと飛び石。夜はライトアップされ、川沿いを歩くこと自体が目的になる。' },
      { name: '大寧寺', description: '住職が神託を受けて湯を見つけたと伝わる寺。温泉街から歩いて行ける距離に残っている。' },
    ],
    featured_stay: { name: '長門湯本温泉 大谷山荘', catchcopy: '音信川に面した宿。再整備された外湯と川テラスまで歩いて回れる', hasShuttle: false, accessStation: 'JR長門湯本駅' },
  },
  {
    id: 'tawarayama', name: '俵山温泉', prefecture: '山口県',
    railGateway: '長門湯本駅', airportGateway: '山口宇部空港', hotelSearch: '俵山温泉',
    bestSeason: '通年', requiresCar: false, tags: ['温泉', '湯治', '歴史', '街歩き'],
    catch: '宿に内湯が無い。だから浴衣で外湯に通う。',
    description: '十六軒ある宿のうち、内湯を持つのは一軒だけ。あとの宿はすべて、泊まった人が浴衣で外湯に通う。日本でも数少なくなった湯治場そのままの形が、いまも動いている温泉地だ。外湯は町の湯と白猿の湯の二つ。宿泊者は一泊千五百円の宿泊手形を買えば、どちらにも何度でも入れる。応永年間、白猿が湯を見つけたという伝説が開湯の由来で、一九五五年に国民保養温泉地に指定された。泉質はアルカリ性単純温泉、源泉は四十一度。細い通りの両側に宿が並び、朝も夜も下駄の音がする。長門湯本駅からバスで二十五分。',
    spots: [
      { name: '外湯 町の湯', description: '朝六時から夜十時まで開く外湯。貸切の家族湯もあり、こちらは事前の予約が必要になる。' },
      { name: '外湯 白猿の湯', description: 'もうひとつの外湯。開湯伝説の白猿にちなむ名で、宿泊手形があれば何度でも入り直せる。' },
      { name: '浴衣で歩く通り', description: '細い通りの両側に宿が並ぶ。内湯が無いので、朝も夜も外湯へ向かう下駄の音が絶えない。' },
    ],
    featured_stay: { name: '俵山温泉 松屋旅館', catchcopy: '内湯を持たない湯治宿。一泊千五百円の手形で外湯二つに通える', hasShuttle: false, accessStation: 'JR長門湯本駅' },
  },
  {
    id: 'yuno-yamaguchi', name: '湯野温泉', prefecture: '山口県',
    railGateway: '戸田駅', airportGateway: '山口宇部空港', hotelSearch: '湯野温泉',
    bestSeason: '通年', requiresCar: false, tags: ['温泉', '歴史', '自然'],
    catch: '日露戦争の負傷兵が療養に送られてきた湯。',
    description: '夜市川の谷あいに宿が三軒。天正年間に河村三五兵衛が見つけたと伝わり、日露戦争のとき広島の陸軍病院から負傷兵の転地療養地に指定されたことで全国に名が知られた。泉質は含弱放射能のアルカリ性硫黄温泉で、源泉は二十八度から三十三度と低い。ぬるりとした湯ざわりから美肌の湯と呼ばれる。昭和十年に自噴泉を掘り当てて開かれた天松閣が、いまの紫水園になっている。二〇二二年に閉じた国民宿舎湯野荘は、二〇二三年に日帰り施設として作り直された。徳山駅からバスで来られる距離で、周南の市街地からも近い。',
    spots: [
      { name: '美肌の湯', description: '含弱放射能のアルカリ性硫黄温泉。二十八度から三十三度と低く、ぬるりとした湯ざわり。' },
      { name: '夜市川の谷', description: '宿の前を流れる川。周南の市街地から近いのに、谷に一歩入ると聞こえてくる音が変わる。' },
      { name: '療養地の歴史', description: '日露戦争のとき広島の陸軍病院から負傷兵の転地療養地に指定され、全国に名が知られた。' },
    ],
    featured_stay: { name: '湯野温泉 紫水園', catchcopy: '昭和十年開業の天松閣を継ぐ宿。低温の硫黄泉をゆっくり使う', hasShuttle: false, accessStation: 'JR戸田駅' },
  },
  {
    id: 'nibukawa', name: '鈍川温泉', prefecture: '愛媛県',
    railGateway: '今治駅', airportGateway: '松山空港', hotelSearch: '鈍川温泉',
    bestSeason: '秋', requiresCar: false, tags: ['温泉', '湯治', '自然', '秋'],
    catch: '道後・本谷と並ぶ伊予の三湯、そのいちばん静かな一つ。',
    description: '鈍川渓谷に沿って宿が数軒。道後、本谷と並んで伊予の三湯に数えられるが、三つの中ではいちばん静かだ。湧出は平安時代にさかのぼるとされ、江戸期には今治藩の湯治場として使われていた。明治二年に藩知事が開発を始め、大正十年に組合ができている。泉質はラドンを含むアルカリ性の単純泉で、源泉は二十度ほどの冷鉱泉を加温して使う。ぬるりとした肌ざわりから美人の湯と呼ばれてきた。奥道後玉川県立自然公園の中にあり、秋は渓谷が色づく。日帰りなら皆楽荘とせせらぎ交流館。今治駅からバスで三十分ほど。',
    spots: [
      { name: '鈍川渓谷', description: '宿が並ぶ谷そのものが県立自然公園の中にある。秋は水面にまで紅葉が映り込んでくる。' },
      { name: '美人の湯', description: 'ラドンを含むアルカリ性の単純泉。ぬるりとした肌ざわりで、伊予の三湯に数えられている。' },
      { name: 'せせらぎ交流館', description: '日帰り入浴のできる施設。渓谷沿いにあり、泊まらずに湯だけ立ち寄ることもできる場所。' },
    ],
    featured_stay: { name: '鈍川温泉 美賀登', catchcopy: '鈍川渓谷に面した宿。伊予の三湯のひとつを静かに使う', hasShuttle: false, accessStation: 'JR今治駅' },
  },
  {
    id: 'yunoura', name: '湯ノ浦温泉', prefecture: '愛媛県',
    railGateway: '今治駅', airportGateway: '松山空港', hotelSearch: '湯ノ浦温泉',
    bestSeason: '通年', requiresCar: false, tags: ['温泉', '家族', '自然'],
    catch: '四国で最初に国民保養温泉地になった湯。',
    description: '今治の市街地から車で二十分ほど、丘に囲まれた一角に湧く。開発されたのは一九七六年と新しいが、一九九四年に四国で最初の国民保養温泉地に指定された。泉質は単純弱放射能冷鉱泉で、ラドンとフッ素を含み、源泉は十九度なので加温して使う。中心にあるクアハウス今治は十八種類の浴槽とプールを備えた大きな保養施設で、水着で入るゾーンやスライダーもあり、子ども連れでも一日いられる。宿泊はホテルアジュール汐の丸の一軒で、二〇二五年に大浴場が新しくなった。今治湯ノ浦インターから三分、しまなみ海道の入口にも近い。',
    spots: [
      { name: 'クアハウス今治', description: '十八種類の浴槽とプールを備えた保養施設。水着ゾーンやスライダーもあり一日過ごせる。' },
      { name: '道の駅 今治湯ノ浦温泉', description: '温泉スタンドがあり、湯を持ち帰れる。しまなみ海道へ向かう途中の休憩地点にもなる。' },
      { name: 'しまなみ海道の入口', description: '今治インターまで二十分ほど。島を渡る前後に一泊する拠点として使いやすい位置にある。' },
    ],
    featured_stay: { name: 'ホテルアジュール汐の丸', catchcopy: '湯ノ浦でただ一軒の宿。二〇二五年に大浴場を新しくした', hasShuttle: false, accessStation: 'JR今治駅' },
  },
  {
    id: 'chugu', name: '中宮温泉', prefecture: '石川県',
    railGateway: '金沢駅', airportGateway: '小松空港', hotelSearch: '中宮温泉',
    bestSeason: '秋', requiresCar: true, tags: ['温泉', '秘湯', '湯治', '自然'],
    catch: '飲むと胃腸に効くという、白山の懐の二軒宿。',
    description: '白山の谷あいに旅館が二軒あるだけ。開湯から千二百年、白山を開いた泰澄大師が傷ついた白鳩を見て見つけたと伝わる。泉質はナトリウム塩化物・炭酸水素塩泉で源泉は六十一度、湧いたときは無色透明だが酸化して黄褐色に変わる。とろみのある湯で飲むこともでき、胃腸に効くとして湯治客が通ってきた。共同の露天「薬師の湯」もある。ただしここは雪深く、営業は四月中旬ごろから十一月下旬まで。冬は道が閉ざされ、宿も休む。一九六一年に国民保養温泉地に指定された。金沢から車で一時間二十分ほどかかる。',
    spots: [
      { name: '飲泉', description: 'とろみのある湯を飲むことができる。胃腸に効くとされ、湯治客が長く通ってきた湯である。' },
      { name: '共同露天「薬師の湯」', description: '温泉組合などが管理する露天風呂。二軒の宿とは別に、谷あいに設けられている湯船になる。' },
      { name: '色の変わる湯', description: '湧いたときは無色透明で、空気に触れて酸化するとしだいに黄褐色へ変わっていく湯である。' },
    ],
    featured_stay: { name: '中宮温泉 にしやま旅館', catchcopy: '白山の谷に二軒だけ。飲める湯を守る、四月中旬から十一月下旬の宿', hasShuttle: false, accessStation: 'JR金沢駅' },
  },
];

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
  console.log(`  ${b.id.padEnd(15)} ${b.name.padEnd(7)} ${b.prefecture.padEnd(4)} desc=${b.description.length}字 tt=${Object.keys(b.travelTime).length} ic=${b.icCard} stay=${b.featured_stay.name}`);
}
