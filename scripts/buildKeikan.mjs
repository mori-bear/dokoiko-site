#!/usr/bin/env node
/**
 * buildKeikan.mjs — 新ジャンル「絶景」を追加する。
 *
 * 選び方: 1回目は有名な絶景を並べたが、12件中8件がすでに既存エントリのspotとして
 * 収録済みだった（親不知・天岩戸神社・備中松山城・堂ヶ島・川平湾・青池・奥津渓・瀞峡）。
 * そこで国指定名勝536件を機械照合し、既存に一度も出てこない自然景観125件を母集団にして、
 * そこから宿と結びつくものを選び直した。
 *
 * 採用条件（ユーザー指定）:
 *   ・現地または車1時間圏内に実在の宿泊施設がある
 *     → 既存destinationsの検証済みfeatured_stayが50km以内にあることで確認した
 *       （WebSearchの枠が尽きていたため、一次確認済みのデータから引いた）
 *   ・単なる展望台ではなく、周辺に滞在価値がある
 *     → 全件、温泉地・城下町・港町のいずれかが近い
 *
 * 不採用（無理に埋めない）:
 *   天龍峡      合格画像なし（8枚試行）
 *   尾鈴山瀑布群・千巌山   Commonsに候補が無い
 *   大谷の奇岩群 合格画像なし（4枚試行）
 *   豪渓        合格画像なし（8枚試行）
 *   白水滝・中山仙境      座標が2ソースで一致しなかった
 *   昇仙峡・赤目四十八滝・帝釈峡  既存に同名エントリあり
 */
import fs from 'fs';

const DATA = 'src/data/destinations.json';
const all = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const byId = (id) => all.find((d) => d.id === id);

const RAKUTEN = (pref) => `https://hb.afl.rakuten.co.jp/hgc/5113ee4b.8662cfc5.5113ee4c.119de89a/`
  + `?pc=${encodeURIComponent(`https://travel.rakuten.co.jp/yado/${pref}/`)}`;
const PREF = {
  '群馬県':   { rakuten: RAKUTEN('gunma'),     jalan: 'https://www.jalan.net/100000/', area: 'gunma' },
  '新潟県':   { rakuten: RAKUTEN('niigata'),   jalan: 'https://www.jalan.net/ikisaki/map/niigata/', area: 'niigata' },
  '富山県':   { rakuten: RAKUTEN('toyama'),    jalan: 'https://www.jalan.net/160000/', area: 'toyama' },
  '福井県':   { rakuten: RAKUTEN('fukui'),     jalan: 'https://www.jalan.net/ikisaki/map/fukui/', area: 'fukui' },
  '京都府':   { rakuten: RAKUTEN('kyoto'),     jalan: 'https://www.jalan.net/260000/', area: 'kyoto' },
  '兵庫県':   { rakuten: RAKUTEN('hyogo'),     jalan: 'https://www.jalan.net/280000/', area: 'hyogo' },
  '鳥取県':   { rakuten: RAKUTEN('tottori'),   jalan: 'https://www.jalan.net/310000/', area: 'tottori' },
  '島根県':   { rakuten: RAKUTEN('shimane'),   jalan: 'https://www.jalan.net/320000/', area: 'shimane' },
  '広島県':   { rakuten: RAKUTEN('hiroshima'), jalan: 'https://www.jalan.net/340000/', area: 'hiroshima' },
  '山口県':   { rakuten: RAKUTEN('yamaguchi'), jalan: 'https://www.jalan.net/350000/', area: 'yamaguchi' },
  '愛媛県':   { rakuten: RAKUTEN('ehime'),     jalan: 'https://www.jalan.net/380000/', area: 'ehime' },
  '沖縄県':   { rakuten: RAKUTEN('okinawa'),   jalan: 'https://www.jalan.net/470000/', area: 'okinawa' },
  '秋田県':   { rakuten: RAKUTEN('akita'),     jalan: 'https://www.jalan.net/050000/', area: 'akita' },
};

const BASE = {
  fukiware: 'gen_群馬_老神温泉', myogisan: 'karuizawa', sasagawa: 'murakami',
  shomyodaki: 'tateyama-toyama', sotomo: 'wakasa-obama', rurikei: 'tanba-sasayama',
  'kasumi-kaigan': 'uradome', ojika: 'shikano', kuniga: 'ama-island',
  dangyokei: 'iwami-ginzan', sandankyo: 'yuki-hiroshima', chomonkyo: 'yuda-onsen',
  omogokei: 'saijo', toriike: 'irabu-island', nasonoshirataki: 'kisakata', sekichukei: 'tawarayama',
};
const travelTimeFrom = (id) => Object.fromEntries(
  Object.entries(byId(BASE[id])?.travelTime || {}).filter(([, v]) => typeof v === 'number' && v > 0 && v < 900));

const IMG = JSON.parse(fs.readFileSync('logs/keikan_images.json', 'utf8')).adopted;
const creditOf = (id) => IMG.find((x) => x.id === id)?.credit ?? null;
const COORD = Object.fromEntries(JSON.parse(fs.readFileSync('logs/keikan_targets.json', 'utf8'))
  .map((t) => [t.id, { lat: t.lat, lng: t.lng, city: t.city }]));

const E = [
  {
    id: 'fukiware', name: '吹割の滝', prefecture: '群馬県',
    railGateway: '沼田駅', airportGateway: '羽田空港', hotelSearch: '沼田市',
    bestSeason: '秋', requiresCar: true, tags: ['絶景', '自然', '秋'],
    catch: '滝が下ではなく、足元の割れ目に落ちていく。',
    description: '片品川が溶結凝灰岩を削ってできたV字の裂け目に、三方から川が落ちていく。高さ七メートル、幅三十メートル。滝を上から見下ろすのではなく、岩盤の上に立って足元の割れ目に水が吸い込まれていくのを見る形になる。東洋のナイアガラと呼ばれてきたのはこの独特の姿による。九百万年前の火砕流が冷え固まった岩が、軟らかいところから削られて吹き割れたように見えることが名の由来だ。昭和十一年に国の名勝と天然記念物に指定された。周囲一キロは遊歩道が整い、下流には鱒飛の滝が続く。老神温泉まで車で十分ほど。',
    spots: [
      { name: '吹割の滝', description: '高さ七メートル、幅三十メートル。三方から水が落ちる裂け目を、岩盤の上から見下ろせる。' },
      { name: '鱒飛の滝', description: '吹割の滝の下流にある高さ八メートルの滝。遡上した鱒がここを越えられず止まるという。' },
      { name: '吹割渓谷遊歩道', description: '滝の周囲一キロに整えられた道。般若岩や獅子岩と呼ばれる岩壁を見ながら歩いていける。' },
    ],
  },
  {
    id: 'myogisan', name: '妙義山', prefecture: '群馬県',
    railGateway: '松井田駅', airportGateway: '羽田空港', hotelSearch: '富岡市',
    bestSeason: '秋', requiresCar: true, tags: ['絶景', '自然', '山', '秋'],
    catch: 'ろうそくのような岩峰が、いくつも空へ突き出す。',
    description: '赤城・榛名と並ぶ上毛三山のひとつで、日本三大奇景にも数えられる山だ。中木川をはさんで南東を表妙義、北西を裏妙義と呼び、表妙義には衝立のような岩、ろうそくのような岩が林立する。最高峰は相馬岳の千百四メートル。第一から第四までの石門をめぐる石門群コースが人気で、大砲岩や筆頭岩といった奇岩も点在する。白雲山の中腹には妙義神社が建ち、金洞山側には中之嶽神社がある。大正十二年に国の名勝に指定され、二〇二三年に指定百年を迎えた。上毛かるたには紅葉に映える妙義山と詠まれている。',
    spots: [
      { name: '石門群めぐり', description: '第一から第四まで四つの石門をたどるコース。第二石門は急で鎖が張られた中級の道になる。' },
      { name: '妙義神社', description: '白雲山の中腹に建つ社。参道の石段を登り切ると、背後に表妙義の岩峰が立ち上がってくる。' },
      { name: '大砲岩と筆頭岩', description: '表妙義に点在する奇岩。名の通りの形をしており、岩峰群のなかでも見分けやすい存在。' },
    ],
  },
  {
    id: 'sasagawa', name: '笹川流れ', prefecture: '新潟県',
    railGateway: '桑川駅', airportGateway: '新潟空港', hotelSearch: '村上市',
    bestSeason: '夏', requiresCar: false, tags: ['絶景', '海', '自然', '夏'],
    catch: '奇岩と洞窟が十一キロ、列車の窓を流れていく。',
    description: '鳥越山から狐崎まで、十一キロにわたって奇岩と絶壁と洞窟が途切れずに続く海岸である。眼鏡岩、びょうぶ岩、ニタリ岩、蓬莱山と名の付いた岩が並び、観光船で海から見て回ることもできる。名は集落名の笹川に由来し、沖の岩場まで潮の流れが見えたことからそう呼ばれるようになった。昭和二年に国の名勝と天然記念物に指定され、日本百景にも選ばれている。国道三四五号と羽越本線が海沿いを並んで走り、車窓からそのまま眺められるのがこの海岸の強みだ。桑川駅の道の駅から見る日没が特に知られている。',
    spots: [
      { name: '奇岩めぐりの遊覧船', description: '眼鏡岩やびょうぶ岩など、海からしか見えない洞窟や岩を回る観光船が港から出ている。' },
      { name: '車窓からの海', description: '羽越本線が海岸沿いを走る。週末には観光列車の海里が通り、座ったまま眺めていられる。' },
      { name: '道の駅笹川流れの夕日', description: '桑川駅に併設された道の駅。日本海に日が沈む時刻を目当てに来る人が多い場所である。' },
    ],
  },
  {
    id: 'shomyodaki', name: '称名滝', prefecture: '富山県',
    railGateway: '立山駅', airportGateway: '富山空港', hotelSearch: '立山町',
    bestSeason: '夏', requiresCar: true, tags: ['絶景', '自然', '山', '夏'],
    catch: '落差三百五十メートル。日本一の高さから水が落ちる。',
    description: '弥陀ヶ原の台地から一気に落ちる四段の滝で、落差は三百五十メートルと日本一を誇る。一段目七十メートル、二段目五十八メートル、三段目九十六メートル、四段目百二十六メートル。滝つぼは直径六十メートル、深さ六メートルある。法然が滝の音を南無阿弥陀仏と聞いたことが名の由来と伝わる。雪解けの季節には右手にハンノキ滝が現れ、水が多い日はさらにソーメン滝も加わって三本が並ぶ。十万年前は十五キロ下流にあり、岩を年十センチずつ削りながら後退してきた。立山駅から称名滝探勝バスで向かう。',
    spots: [
      { name: '四段の滝', description: '一段目七十メートルから四段目百二十六メートルまで、四段に分かれて落ちる日本一の落差。' },
      { name: 'ハンノキ滝', description: '雪解けの季節に称名滝の右手へ現れる滝。落差は約五百メートルと称名滝よりも大きい。' },
      { name: '悪城の壁', description: '滝が後退しながら削り出した高さ五百メートルの岩壁。バスの車窓から続けて見えている。' },
    ],
  },
  {
    id: 'sotomo', name: '蘇洞門', prefecture: '福井県',
    railGateway: '小浜駅', airportGateway: '小松空港', hotelSearch: '小浜市',
    bestSeason: '夏', requiresCar: false, tags: ['絶景', '海', '自然', '夏'],
    catch: '花崗岩の柱状節理を、波が六キロ削り続けた。',
    description: '内外海半島の日本海側に、洞門と断崖と滝が六キロ続く。花崗岩の柱状節理が波に削られてできた地形で、海蝕洞の大門・小門をはじめ、夫婦亀岩、獅子岩、唐船島、百畳敷といった名の付いた見どころが並ぶ。陸路では近づけないため、小浜港から出る遊覧船で海から見て回ることになる。昭和九年に若狭蘇洞門として国の名勝に指定され、若狭湾国定公園に含まれる。古くは小浜湾の外に面していることから外面と書いてそともと呼ばれた。小浜の町には鯖街道の起点があり、湯を含めて一泊の旅程が組みやすい。',
    spots: [
      { name: '大門・小門', description: '波が花崗岩を削って開けた海蝕洞。遊覧船はこの前で速度を落とし、間近まで寄ってくれる。' },
      { name: '遊覧船', description: '陸路では近づけないため、小浜港からの船で海側から眺める。冬季は運航が休みになる。' },
      { name: '鯖街道の起点', description: '小浜は若狭の海の幸を京へ運んだ道の出発点。町なかに起点の碑と資料館が残っている。' },
    ],
  },
  {
    id: 'rurikei', name: 'るり渓', prefecture: '京都府',
    railGateway: '園部駅', airportGateway: '伊丹空港', hotelSearch: '南丹市',
    bestSeason: '秋', requiresCar: true, tags: ['絶景', '自然', '秋'],
    catch: '光が当たると、流れが瑠璃色に光って見える。',
    description: '園部川の上流、四キロにわたって続く渓谷である。もとは滑と呼ばれていたが、明治三十八年に訪れた郡長の三宅樅陰が景色に感じ入って琉璃渓と改めた。通天湖から流れ出る水が光を反射して瑠璃色の石のように見えることが名の由来だ。地質は流紋岩で、浸食された奇岩と小さな滝が点在する。錦繍巌、双龍淵、座禅石、水晶簾など漢詩めいた名が付いた十二勝がある。昭和七年に国の名勝に指定され、日本の音風景百選にも選ばれた。紅葉の名所でもあり、大阪や京都から日帰りできる距離ながら、谷に入ると人の気配が消える。',
    spots: [
      { name: '十二勝', description: '錦繍巌・双龍淵・座禅石・水晶簾など、漢詩めいた名の付いた十二の見どころが谷に点在する。' },
      { name: '通天湖', description: '渓谷の上流にあるダム湖。ここから流れ出た水が光を受けて瑠璃色に見えるのが名の由来。' },
      { name: '音風景', description: '日本の音風景百選に選ばれた谷。水の音だけが岩に反響し、耳が先に景色を捉えていく。' },
    ],
  },
  {
    id: 'kasumi-kaigan', name: '香住海岸', prefecture: '兵庫県',
    railGateway: '香住駅', airportGateway: '但馬空港', hotelSearch: '香美町',
    bestSeason: '夏', requiresCar: false, tags: ['絶景', '海', '自然', 'グルメ'],
    catch: '柱状節理の岩壁が、そのまま海へ落ちている。',
    description: '但馬海岸のうち香住から西へ続く一帯で、山陰海岸ユネスコ世界ジオパークに含まれる。鎧の袖と呼ばれる柱状節理の大岩壁が海へ落ち、その先には但馬御火浦の断崖が連なる。四千万年前から日本海ができていく過程が、そのまま地形として残っている場所だ。今子浦には奇岩が並び、海食洞や入り江が入り組む。遊覧船が出ており、陸から見えない岩を海側から見て回れる。香住漁港は松葉ガニとベニズワイガニの水揚げで知られ、冬はカニ目当ての客で宿が埋まる。城崎温泉まで車で四十分ほど。',
    spots: [
      { name: '鎧の袖', description: '海へ落ちる柱状節理の大岩壁。鎧の袖のように見えることから、この名で呼ばれてきた。' },
      { name: '但馬御火浦', description: '香住の西に続く断崖の海岸。国の名勝と天然記念物で、遊覧船から海側の姿を見られる。' },
      { name: '香住漁港のカニ', description: '松葉ガニとベニズワイガニの水揚げ港。冬は宿の夕食がそのまま旅の目的になっている。' },
    ],
  },
  {
    id: 'ojika', name: '小鹿渓', prefecture: '鳥取県',
    railGateway: '倉吉駅', airportGateway: '鳥取空港', hotelSearch: '三朝町',
    bestSeason: '秋', requiresCar: true, tags: ['絶景', '自然', '秋'],
    catch: '三朝の湯から車で十五分、人のいない渓谷。',
    description: '天神川の支流の小鹿川の上流にある四キロほどの渓谷で、昭和九年に国の名勝に指定された。岩を削って淵と小さな滝が続き、両岸には広葉樹が覆いかぶさる。名の知られた三朝温泉から車で十五分ほどしか離れていないのに、遊歩道に入ると人に会わないことが多い。同じ三朝町には国宝の三佛寺投入堂があり、断崖に張り付く堂を見上げてから谷に入る組み方ができる。三朝温泉は世界有数の高濃度ラドンを含む湯で、病後の療養で通う人もいる土地だ。谷そのものに宿はないので、湯の町に泊まって足を延ばすことになる。',
    spots: [
      { name: '渓谷の遊歩道', description: '淵と小さな滝が続く道。三朝温泉から近いのに、歩いていて人に会わないことが多い場所。' },
      { name: '三佛寺投入堂', description: '同じ三朝町にある国宝。断崖の窪みに建つ堂で、参拝には険しい山道を登ることになる。' },
      { name: '三朝温泉', description: '世界有数の高濃度ラドンを含む湯。谷に宿は無いので、この湯の町に泊まって通う形になる。' },
    ],
  },
  {
    id: 'kuniga', name: '国賀海岸', prefecture: '島根県',
    railGateway: '境港駅', airportGateway: '隠岐空港', hotelSearch: '西ノ島町',
    bestSeason: '夏', requiresCar: true, tags: ['絶景', '海', '自然', '離島'],
    catch: '高さ二五七メートルの摩天崖に、牛と馬が放たれている。',
    description: '隠岐諸島の西ノ島の北西に、二百から二百五十メートルの海蝕崖が十三キロにわたって続く。中でも摩天崖は高さ二百五十七メートルあり、国内最大級の海崖として知られる。天然の洞門である通天橋や鬼ヶ城といった奇勝が並ぶ一方、崖の上は牧草地になっていて牛や馬が放たれており、荒々しい海と穏やかな草地が同じ視界に入る。昭和十三年に国の名勝、昭和三十八年に国立公園に指定された。摩天崖から国賀浜まで高低差二百五十メートルの遊歩道があり、下りで四十五分ほど。海からは定期観光船で洞窟を巡ることができる。',
    spots: [
      { name: '摩天崖', description: '高さ二百五十七メートル、国内最大級の海崖。崖の上は牧草地で牛や馬が放たれている。' },
      { name: '通天橋', description: '波が岩を貫いてできた天然の洞門。遊歩道の途中から、その全貌を見下ろすことができる。' },
      { name: '国賀海岸遊歩道', description: '摩天崖から国賀浜まで高低差二百五十メートル。下り四十五分、上りは一時間ほどかかる。' },
    ],
  },
  {
    id: 'dangyokei', name: '断魚渓', prefecture: '島根県',
    railGateway: '浜田駅', airportGateway: '萩・石見空港', hotelSearch: '邑南町',
    bestSeason: '秋', requiresCar: true, tags: ['絶景', '自然', '秋'],
    catch: '鮎が遡れなかった淵から、名が付いた渓谷。',
    description: '江の川の支流の濁川を四キロさかのぼった渓流で、流紋岩が削られてできた。高低差は百メートルほど。目立つ滝は無いが、谷底に露出した千畳敷という岩盤に、自然が掘った水路が通っている。名は下流の神楽淵にある断魚の淵に由来し、鮎の遡上をここで遮ることから付いた。嫁ガ淵、通仙橋、千畳敷、神楽淵など二十四の景勝地があり、漢学者の野田慎が断魚渓二十四景として名を定めた。昭和十年に国の名勝に指定されている。石見銀山や温泉津温泉まで車で三十分ほどの位置にあり、石見の旅程に組み込みやすい。',
    spots: [
      { name: '千畳敷', description: '谷底に広く露出した岩盤。自然が削った岩樋川という水路が、その岩の上を通っている。' },
      { name: '神楽淵', description: '鮎の遡上を遮ってきた断魚の淵がある一帯。この淵の名が渓谷そのものの名になっている。' },
      { name: '断魚渓二十四景', description: '漢学者の野田慎が定めた二十四の景勝。嫁ガ淵や通仙橋など、散策路でひとつずつ辿れる。' },
    ],
  },
  {
    id: 'sandankyo', name: '三段峡', prefecture: '広島県',
    railGateway: '広島駅', airportGateway: '広島空港', hotelSearch: '安芸太田町',
    bestSeason: '秋', requiresCar: true, tags: ['絶景', '自然', '秋'],
    catch: '渡し舟でしか進めない、切り立った淵がある。',
    description: '太田川水系の柴木川が刻んだ、総延長十六キロの峡谷である。中国山地の隆起に川の下刻が追いつき、山列を直角に横切る横谷ができた。国の特別名勝で、日本百景と日本紅葉の名所百選にも選ばれている。見どころは黒淵・猿飛・二段滝・三段滝と続き、黒淵と猿飛は道が途切れるため渡し舟に乗って進む。両岸から岩壁が迫る水面を舟で行くのが、この峡谷でいちばん知られた場面だ。フランスの旅行案内で三つ星を得たこともある。湯来温泉まで車で三十分ほど、広島市街からも一時間半で着く。',
    spots: [
      { name: '黒淵', description: '両岸から岩壁が迫り、道が途切れる淵。ここは渡し舟に乗って水面を進むことになる場所。' },
      { name: '猿飛', description: '岩と岩が迫り、猿なら飛び越えられそうな幅になる場所。ここにも渡し舟が出されている。' },
      { name: '三段滝', description: '峡谷の名の由来になった三段の滝。入口から歩くと片道三時間ほどかかる奥に懸かっている。' },
    ],
  },
  {
    id: 'chomonkyo', name: '長門峡', prefecture: '山口県',
    railGateway: '長門峡駅', airportGateway: '山口宇部空港', hotelSearch: '山口市',
    bestSeason: '秋', requiresCar: false, tags: ['絶景', '自然', '秋', 'グルメ'],
    catch: '中原中也が絶賛した、十二キロの峡谷。',
    description: '阿武川の上流、山口市阿東から萩市川上にかけて十二キロ続く峡谷である。白亜紀の流紋岩質凝灰岩とデイサイト溶岩が断崖を作り、奇岩と滝と深い淵が入れ替わりに現れる。名付けたのは郷土の画家の高島北海で、詩人の中原中也もこの谷を絶賛し、洗心橋には詩碑が立つ。洗心橋から龍宮淵まで五・五キロの遊歩道があり、獺淵や暗がり淵といった名の場所を辿って歩ける。国の名勝で、日本五大名峡に数えられることもある。阿武川の鮎が名物で、龍宮淵の入口には鮎料理の店が並ぶ。湯田温泉まで車で三十分ほど。',
    spots: [
      { name: '洗心橋の詩碑', description: '中原中也がこの谷を詠んだ詩の碑が立つ。山口市側の入口にあたり、ここから遊歩道が始まる。' },
      { name: '龍宮淵までの遊歩道', description: '洗心橋から五・五キロ。獺淵や暗がり淵など、名の付いた淵を辿りながら歩いていける。' },
      { name: '阿武川の鮎', description: '峡谷の名物になっている。龍宮淵の入口には鮎料理の店が並び、夏には鮎祭りも開かれる。' },
    ],
  },
  {
    id: 'omogokei', name: '面河渓', prefecture: '愛媛県',
    railGateway: '松山駅', airportGateway: '松山空港', hotelSearch: '久万高原町',
    bestSeason: '秋', requiresCar: true, tags: ['絶景', '自然', '山', '秋'],
    catch: '石鎚山の裏参道口に、透きとおった水が流れる。',
    description: '仁淀川の上流を九・六キロさかのぼった渓谷で、入口ですでに標高六百五十メートルある。四国山地の高い山に囲まれたV字の谷で、早瀬と深い淵と滝が続く。関門、相思渓、五色河原、亀腹、蓬莱峡といった名所は明治の探勝団が名付けたものだ。仁淀ブルーと呼ばれる水の透明度はここでも変わらず、白い岩肌と相まって水が青緑に見える。昭和八年に国の名勝に指定され、石鎚国定公園に含まれる。西日本最高峰の石鎚山へ登る裏参道口でもある。松山市街から車で一時間半、道後温泉に泊まって日帰りする人も多い。',
    spots: [
      { name: '五色河原', description: '白い岩の上を水が流れる河原。水の色が浅いところと深いところで大きく変わって見える。' },
      { name: '亀腹', description: '高さ百メートル、幅二百メートルの一枚岩。谷の入口で正面に立ちはだかる巨大な岩壁。' },
      { name: '石鎚山の裏参道', description: '西日本最高峰へ登る道がここから始まる。面河山を経て山頂に至る、古くからの参道である。' },
    ],
  },
  {
    id: 'toriike', name: '通り池', prefecture: '沖縄県',
    railGateway: '宮古空港', airportGateway: '宮古空港', hotelSearch: '宮古島市',
    bestSeason: '夏', requiresCar: true, tags: ['絶景', '海', '自然', '離島'],
    catch: '陸の池が、地下で海とつながっている。',
    description: '下地島の西岸、琉球石灰岩の台地に空いた二つの池である。もとは鍾乳洞で、天井が崩れ落ちて池になった。海側の池は地下で外洋とつながっており、上層は淡水、下層は海水という二層構造をしている。ダイバーはこの水路を通って海から池へ抜けることができ、光が差し込む瞬間は宮古のダイビングでも屈指の場面とされる。陸からは遊歩道と展望台が整い、覗き込むと深い藍色の水が動かずにたまっている。継母と子の悲しい伝説も残る。伊良部大橋が二〇一五年に開通してから、宮古島から車で行けるようになった。',
    spots: [
      { name: '二つの池', description: '鍾乳洞の天井が崩れてできた二つの池。海側の池は地下の水路で外洋とつながっている。' },
      { name: '水中の水路', description: 'ダイバーは海から水路を抜けて池へ出られる。差し込む光が宮古屈指の見どころとされる。' },
      { name: '下地島の西海岸', description: '琉球石灰岩の海食崖が続く。伊良部大橋の開通で宮古島から車のまま渡れるようになった。' },
    ],
  },
  {
    id: 'nasonoshirataki', name: '奈曽の白瀑', prefecture: '秋田県',
    railGateway: '象潟駅', airportGateway: '庄内空港', hotelSearch: 'にかほ市',
    bestSeason: '秋', requiresCar: true, tags: ['絶景', '自然', '寺社', '秋'],
    catch: '神社の石段を降りた先に、滝が待っている。',
    description: '鳥海山から流れ出る奈曽川にかかる、落差二十六メートル、幅十一メートルの直瀑である。十万年以上前の小滝溶岩を削って落ちており、一帯は鳥海国定公園に含まれる。すぐ近くの金峰神社は平安時代からの文化財を数多く収める古社で、その境内を通って長い石段を降りていくと、木々に囲まれた滝の全容が現れる。周辺はかつて鳥海山へ登る人が泊まる宿坊集落だった。社殿の南には長さ七十五メートルのねがい橋という吊り橋が架かり、対岸の道から滝の上流側へ回れる。昭和七年に奈曽の白瀑谷として国の名勝に指定された。',
    spots: [
      { name: '滝の全容', description: '落差二十六メートル、幅十一メートルの直瀑。石段を降り切ると木立の間に姿を現してくる。' },
      { name: '金峰神社', description: '平安時代からの文化財を収める古社。この境内を通らないと滝のところへは降りていけない。' },
      { name: 'ねがい橋', description: '社殿の南に架かる長さ七十五メートルの吊り橋。渡ると滝の上流側へ回ることができる。' },
    ],
  },
  {
    id: 'sekichukei', name: '石柱渓', prefecture: '山口県',
    railGateway: '小月駅', airportGateway: '山口宇部空港', hotelSearch: '下関市豊田町',
    bestSeason: '秋', requiresCar: true, tags: ['絶景', '自然', '秋'],
    catch: '四角から六角の石柱が、谷の壁に並んでいる。',
    description: '木屋川水系の大州田川にある二キロほどの渓谷である。白亜紀末期の石英斑岩が削られ、四角から六角までの不等辺の柱状節理が谷の壁一面に並ぶ。石の柱が立ち並ぶように見えることが名の由来だ。小さな滝がいくつも連なり、連理の滝と呼ばれる二筋の滝が節理の間を落ちていく。大正十五年に国の名勝と天然記念物に指定された。長門峡と同じく画家の高島北海が紹介したことで知られるようになった谷である。俵山温泉まで車で十五分、長門湯本温泉までも二十分ほどなので、湯の町に泊まって朝に立ち寄る組み方ができる。',
    spots: [
      { name: '柱状節理の壁', description: '四角から六角までの不等辺な石柱が谷の壁一面に並ぶ。名の由来になっている地形である。' },
      { name: '連理の滝', description: '石柱のあいだを二筋になって落ちる滝。谷に点在する小さな滝のなかでも特に目を引く。' },
      { name: '俵山温泉への道', description: '車で十五分ほど。外湯だけで宿に内湯を持たない湯治場が、同じ谷筋の先に控えている。' },
    ],
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
    destType: 'sight', railGateway: e.railGateway, busGateway: null, ferryGateway: null,
    airportGateway: e.airportGateway, prefecture: e.prefecture, lat: c.lat, lng: c.lng,
    stayBias: 1, city: c.city, situations: ['solo', 'couple', 'friends'], catch: e.catch,
    mainSpot: e.spots[0].name, mapPoint: e.name,
    representativeStation: e.railGateway, hubStation: e.railGateway, accessStation: e.railGateway,
    hotelArea: p.area, finalAccess: { type: e.requiresCar ? 'car' : 'walk' },
    travelTime: travelTimeFrom(e.id), stayRecommendation: '1night',
    tier: 'area', tier2: 'area', icCard: base?.icCard ?? 'suica',
    bestSeason: e.bestSeason, onsenLevel: 0, hasDirectFlight: false,
    primary: e.tags.slice(0, 2), secondary: e.tags.slice(2),
    reasonChips: ['絶景', '自然と過ごす', 'ひとり旅向け', '1泊がおすすめ', ...(e.requiresCar ? [] : ['車なしOK'])],
    images: [`/images/${e.id}/main.jpg`], imageCredit: credit,
    hotelLinks: { rakuten: p.rakuten, jalan: p.jalan },
  });
}
for (const b of built) if (all.some((d) => d.id === b.id)) throw new Error(`id重複のため中止: ${b.id}`);
const out = all.concat(built);
fs.writeFileSync(DATA, JSON.stringify(out, null, 2) + '\n');
fs.writeFileSync('public/data/destinations.json', JSON.stringify(out, null, 2) + '\n');
console.log(`追加 ${built.length}件 / 総数 ${all.length} → ${out.length}\n`);
for (const b of built) {
  console.log(`  ${b.id.padEnd(16)} ${b.name.padEnd(8)} ${b.prefecture.padEnd(4)} desc=${b.description.length}字 `
    + `spot=${b.spots.map((s) => s.description.length).join('/')} tt=${Object.keys(b.travelTime).length} ic=${b.icCard}`);
}
