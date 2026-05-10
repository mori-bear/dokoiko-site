#!/usr/bin/env python3
"""
addMissingDestinations.py
人気観光地で destinations.json に未掲載のものを追加。
"""
import json
from urllib.parse import quote
from pathlib import Path

DEST_FILE = Path(__file__).parent.parent / 'src/data/destinations.json'
JALAN_AFF = 'https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=3764408&pid=892559858&vc_url='
RAKUTEN_AFF = 'https://hb.afl.rakuten.co.jp/hgc/5113ee4b.8662cfc5.5113ee4c.119de89a/'

def build_jalan_url(keyword):
    kw_bytes = keyword.encode('shift_jis')
    kw_pct = ''.join(f'%{b:02X}' for b in kw_bytes)
    inner = f'https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword={kw_pct}'
    return JALAN_AFF + quote(inner, safe='')

def build_rakuten_url(keyword):
    inner = f'https://travel.rakuten.co.jp/yado/japan.html?f_query={quote(keyword)}'
    return f'{RAKUTEN_AFF}?pc={quote(inner)}'

# ════════════════════════════════════════════════════
# 追加リスト
# (id, name, prefecture, region, hub_name, hub_tt, stayAllowed,
#  spots, description, lat, lng, tags, hotel_keyword, extras_tt)
# extras_tt = hub以外の主要都市からのtravelTime
# ════════════════════════════════════════════════════
HUB_TT_DEFAULTS = {
    'tokyo':   {'osaka': 165, 'nagoya': 105, 'fukuoka': 305, 'sendai': 95},
    'osaka':   {'tokyo': 165, 'nagoya': 60,  'fukuoka': 165, 'hiroshima': 90},
    'nagoya':  {'tokyo': 105, 'osaka': 60,   'fukuoka': 215, 'sendai': 145},
    'fukuoka': {'tokyo': 305, 'osaka': 165, 'nagoya': 215, 'hiroshima': 75},
    'sendai':  {'tokyo': 95,  'osaka': 175, 'nagoya': 145, 'fukuoka': 195},
    'hiroshima':{'tokyo': 235, 'osaka': 90, 'nagoya': 135, 'fukuoka': 75},
    'kanazawa':{'tokyo': 175, 'osaka': 165, 'nagoya': 165, 'fukuoka': 320},
    'kushiro': {'tokyo': 145, 'osaka': 195, 'sapporo': 240, 'fukuoka': 285},
    'sapporo': {'tokyo': 145, 'osaka': 165, 'nagoya': 165, 'fukuoka': 175},
    'akita':   {'tokyo': 230, 'osaka': 285, 'nagoya': 270, 'fukuoka': 360},
    'aomori':  {'tokyo': 200, 'osaka': 320, 'nagoya': 290, 'fukuoka': 380},
    'kofu':    {'tokyo': 95,  'osaka': 220, 'nagoya': 195, 'fukuoka': 360},
    'takamatsu':{'tokyo': 245, 'osaka': 105, 'nagoya': 165, 'fukuoka': 175},
    'oita':    {'tokyo': 320, 'osaka': 215, 'nagoya': 280, 'fukuoka': 130},
}

ADDS = [
    # ── 世界遺産・国立公園 ──────────────────────────────────
    ('shirakami-sanchi', '白神山地', '青森県', '東北', 'aomori', '青森', 90,
     ['1night', '2night'],
     ['十二湖', 'マザーツリー', '青池'],
     '青森・秋田にまたがるブナ原生林の世界自然遺産。十二湖の青池は神秘の絶景。',
     40.486, 140.069, ['世界遺産','自然','絶景'], '十二湖 白神山地', {}),
    ('mihonomatsubara', '三保の松原', '静岡県', '中部', 'tokyo', '東京', 165,
     ['daytrip', '1night'],
     ['御穂神社', '羽衣の松', '神の道'],
     '富士山世界遺産の構成資産。3万本の松と富士山の絶景が広がる。羽衣伝説の舞台。',
     35.001, 138.524, ['世界遺産','海','絶景'], '清水 静岡', {'nagoya': 130, 'osaka': 175}),
    ('shimokitahanto', '下北半島', '青森県', '東北', 'aomori', '青森', 120,
     ['1night', '2night'],
     ['仏ヶ浦', '恐山', '大間崎'],
     '本州最北端の半島。霊場・恐山と仏ヶ浦の奇岩、本マグロで有名な大間。',
     41.385, 141.214, ['自然','絶景','秘境','歴史'], 'むつ 下北', {}),

    # ── 富士五湖周辺 ──────────────────────────────────────
    ('yamanakako', '山中湖', '山梨県', '中部', 'kofu', '甲府', 60,
     ['daytrip', '1night', '2night'],
     ['パノラマ台', '花の都公園', 'ダイヤモンド富士'],
     '富士五湖最大の湖。湖畔から富士山を一望でき、紅富士・ダイヤモンド富士が名物。',
     35.421, 138.873, ['湖','富士山','絶景','リゾート'], '山中湖 富士', {'tokyo': 130}),
    ('motosuko', '本栖湖', '山梨県', '中部', 'kofu', '甲府', 70,
     ['daytrip', '1night'],
     ['竜ヶ岳', '本栖湖キャンプ場', '中ノ倉峠'],
     '富士五湖の最西端。1000円札裏面の富士山が映る場所として知られる。',
     35.466, 138.595, ['湖','富士山','絶景','キャンプ'], '富士河口湖 本栖湖', {'tokyo': 145}),
    ('yatsugatake', '八ヶ岳', '山梨県', '中部', 'kofu', '甲府', 60,
     ['1night', '2night'],
     ['清里高原','大泉高原','八ヶ岳ジャージーハット'],
     '南北30kmにわたる高原リゾート。清里・大泉の牧場と高原野菜、星空が魅力。',
     35.974, 138.371, ['高原','自然','リゾート'], '清里 八ヶ岳', {'tokyo': 165, 'nagoya': 195}),

    # ── 京都北部 ──────────────────────────────────────────
    ('ohara', '大原', '京都府', '近畿', 'osaka', '大阪', 90,
     ['daytrip', '1night'],
     ['三千院', '寂光院', '宝泉院'],
     '京都北部の山里。三千院・寂光院など天台宗の古刹と、田畑が織りなす隠れ里。',
     35.117, 135.836, ['寺社','自然','歴史'], '大原 京都', {'nagoya': 100, 'tokyo': 195}),
    ('kifune', '貴船', '京都府', '近畿', 'osaka', '大阪', 90,
     ['daytrip', '1night'],
     ['貴船神社', '川床料理', '奥宮'],
     '京都の奥座敷。貴船神社と夏の川床料理、紅葉と雪景色の四季が美しい。',
     35.123, 135.762, ['寺社','自然','グルメ'], '貴船 京都', {'nagoya': 100}),

    # ── 静岡・山静岡 ──────────────────────────────────────
    ('sumatakyo', '寸又峡', '静岡県', '中部', 'tokyo', '東京', 200,
     ['1night'],
     ['夢の吊り橋', '寸又峡温泉', '尾崎坂展望台'],
     '大井川上流の秘境。エメラルドグリーンの湖面に架かる夢の吊り橋が絶景。',
     35.253, 138.155, ['秘境','自然','温泉','絶景'], '寸又峡 川根本町', {'nagoya': 145}),
    ('nishi-izu', '西伊豆', '静岡県', '中部', 'tokyo', '東京', 180,
     ['1night', '2night'],
     ['堂ヶ島', '黄金崎', '土肥金山'],
     '伊豆半島西海岸。海蝕洞窟・堂ヶ島と日本一の夕日、土肥温泉が楽しめる。',
     34.872, 138.776, ['温泉','海','絶景','夕日'], '西伊豆', {'nagoya': 200, 'osaka': 290}),

    # ── 富山 ──────────────────────────────────────────────
    ('toyama-city', '富山', '富山県', '中部', 'kanazawa', '金沢', 25,
     ['daytrip', '1night'],
     ['富山城', '富岩運河環水公園', 'ガラス美術館'],
     '北陸新幹線の終着駅都市。立山連峰を望み、寿司・白海老・富山ブラックが名物。',
     36.696, 137.214, ['城下町','街歩き','グルメ'], '富山', {'tokyo': 130, 'osaka': 170, 'nagoya': 165}),

    # ── 関東 ──────────────────────────────────────────────
    ('ashinoko', '芦ノ湖', '神奈川県', '関東', 'tokyo', '東京', 110,
     ['daytrip', '1night', '2night'],
     ['箱根海賊船', '箱根神社', '元箱根'],
     '箱根のシンボル湖。海賊船と平和の鳥居、富士山の絶景が一度に楽しめる。',
     35.213, 139.014, ['湖','温泉','富士山','絶景'], '元箱根 芦ノ湖', {}),
    ('minatomirai', '横浜みなとみらい', '神奈川県', '関東', 'tokyo', '東京', 40,
     ['daytrip', '1night'],
     ['ランドマークタワー', 'コスモワールド', '赤レンガ倉庫'],
     '横浜港の都市リゾートエリア。ランドマークタワー・観覧車・赤レンガ倉庫の夜景が圧巻。',
     35.456, 139.631, ['街歩き','夜景','リゾート','グルメ'], '横浜 みなとみらい',
     {'osaka': 180, 'nagoya': 130}),
    ('kawaji-onsen', '川治温泉', '栃木県', '関東', 'tokyo', '東京', 165,
     ['1night', '2night'],
     ['川治温泉郷','龍王峡','黄金橋'],
     '鬼怒川と男鹿川の合流点に湧く静かな温泉地。鬼怒川温泉とセットで楽しめる。',
     36.876, 139.704, ['温泉','秘境','自然'], '川治温泉', {'sendai': 220}),

    # ── 関西 ──────────────────────────────────────────────
    ('mt-koya', '高野山', '和歌山県', '近畿', 'osaka', '大阪', 130,
     ['1night', '2night'],
     ['奥之院', '金剛峯寺', '壇上伽藍'],
     '空海開創の真言密教の聖地。世界遺産で、宿坊体験と精進料理が人気。',
     34.213, 135.589, ['世界遺産','寺社','歴史','宿坊'], '高野山', {'nagoya': 195}),

    # ── 中国 ──────────────────────────────────────────────
    ('izumo-taisha', '出雲大社', '島根県', '中国', 'osaka', '大阪', 360,
     ['1night', '2night'],
     ['本殿', '神楽殿', 'うさぎ像'],
     '縁結びの神様として全国から参拝者が集まる古社。神在月の神事が有名。',
     35.402, 132.685, ['寺社','歴史','パワースポット'], '出雲大社', {'tottori': 100, 'hiroshima': 220}),
    ('adachi-museum', '足立美術館', '島根県', '中国', 'osaka', '大阪', 350,
     ['daytrip', '1night'],
     ['足立美術館庭園', '横山大観コレクション'],
     '米国専門誌で20年連続庭園日本一に選ばれる名園美術館。山陰の山里にある。',
     35.382, 133.214, ['美術館','庭園','絶景'], '足立美術館 安来', {'tottori': 90, 'hiroshima': 200}),
    ('tottori-sakyu', '鳥取砂丘', '鳥取県', '中国', 'osaka', '大阪', 180,
     ['daytrip', '1night'],
     ['砂丘センター', '砂の美術館', 'らくだライド'],
     '日本最大級の海岸砂丘。砂の美術館と砂丘体験、ラクダ乗りが楽しめる。',
     35.541, 134.232, ['自然','絶景','体験'], '鳥取砂丘',
     {'tokyo': 250, 'fukuoka': 285, 'hiroshima': 200, 'tottori': 25}),
    ('tamatsukuri-onsen', '玉造温泉', '島根県', '中国', 'osaka', '大阪', 360,
     ['1night', '2night'],
     ['玉作湯神社', '宮橋', '湯薬師広場'],
     '美肌の湯として知られる出雲の名湯。勾玉発祥の地で、神在月の神事に縁深い。',
     35.413, 133.011, ['温泉','美肌','歴史'], '玉造温泉', {'tottori': 90}),

    # ── 四国 ──────────────────────────────────────────────
    ('iya-vine-bridge', '祖谷のかずら橋', '徳島県', '四国', 'takamatsu', '高松', 120,
     ['daytrip', '1night'],
     ['かずら橋', '琵琶の滝', '祖谷渓'],
     '平家落人伝説の秘境。かずら橋を渡るスリルと祖谷渓の絶景が楽しめる。',
     33.871, 133.847, ['秘境','自然','歴史','絶景'], '祖谷 三好', {}),

    # ── 九州 ──────────────────────────────────────────────
    ('takachiho', '高千穂', '宮崎県', '九州', 'fukuoka', '福岡', 230,
     ['1night', '2night'],
     ['高千穂峡', '天岩戸神社', '高千穂神社'],
     '神話発祥の地。高千穂峡の真名井の滝と神楽、天岩戸神社が見どころ。',
     32.713, 131.310, ['神話','自然','絶景','寺社'], '高千穂', {}),

    # ── 北海道 ──────────────────────────────────────────────
    ('jozankei-onsen', '定山渓温泉', '北海道', '北海道', 'sapporo', '札幌', 70,
     ['daytrip', '1night', '2night'],
     ['定山渓温泉郷', '二見吊橋', '豊平峡ダム'],
     '札幌から1時間の奥座敷温泉。紅葉と雪景色が美しく、札幌市民の癒しの湯。',
     42.972, 141.171, ['温泉','自然','紅葉'], '定山渓温泉', {}),
    ('akan', '阿寒湖', '北海道', '北海道', 'sapporo', '札幌', 270,
     ['1night', '2night'],
     ['阿寒湖アイヌコタン', 'マリモ', 'オンネトー'],
     'マリモとアイヌ文化の湖。湖畔の温泉とアイヌコタン、原生林に囲まれた静寂。',
     43.448, 144.099, ['湖','温泉','自然','文化'], '阿寒湖温泉', {'kushiro': 80}),
]

# ════════════════════════════════════════════════════
# 実行
# ════════════════════════════════════════════════════

def build_travel_time(hub_key, hub_tt, extras):
    tt = {hub_key: hub_tt}
    if hub_key in HUB_TT_DEFAULTS:
        for city, c2h in HUB_TT_DEFAULTS[hub_key].items():
            tt[city] = c2h + hub_tt
    for city, val in extras.items():
        tt[city] = val
    return tt

data = json.loads(DEST_FILE.read_text('utf-8'))
existing_ids = {d['id'] for d in data}
existing_names = {d['name'] for d in data}

added = []
skipped = []

for (iid, name, pref, region, hub, hub_name, hub_tt, stay,
     spots, desc, lat, lng, tags, hotel_kw, extras) in ADDS:
    if iid in existing_ids:
        skipped.append(f'{name} (id重複: {iid})')
        continue
    if name in existing_names:
        skipped.append(f'{name} (同名既存)')
        continue

    travel_time = build_travel_time(hub, hub_tt, extras)
    new_dest = {
        'id': iid,
        'name': name,
        'type': 'destination',
        'region': region,
        'prefecture': pref,
        'hub': hub_name,
        'hubName': hub_name,
        'hubCity': hub_name,
        'stayAllowed': stay,
        'departures': [hub_name],
        'weight': 1.0,
        'description': desc,
        'tags': tags,
        'spots': spots,
        'shinkansenAccess': False,
        'requiresCar': False,
        'isIsland': False,
        'destType': 'sight',
        'hotelSearch': hotel_kw,
        'lat': lat,
        'lng': lng,
        'travelTime': travel_time,
        'stayRecommendation': stay[0] if stay else 'daytrip',
        'gateways': {
            'rail': [],
            'airport': [],
            'bus': [],
            'ferry': [],
        },
        'hotelLinks': {
            'rakuten': build_rakuten_url(hotel_kw),
            'jalan': build_jalan_url(hotel_kw),
        },
    }
    data.append(new_dest)
    added.append((name, pref, hub_name, hub_tt))

DEST_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), 'utf-8')

print('='*70)
print('【追加した目的地】')
print('='*70)
for name, pref, hub, tt in added:
    print(f'  {pref:8} | {name:18} | hub={hub:6} {tt:>3}分')
print(f'\n  追加: {len(added)} 件')

if skipped:
    print('\n【スキップ】')
    for s in skipped:
        print(f'  - {s}')

print(f'\n✅ destinations.json 更新完了 (合計 {len(data)} 件)')
