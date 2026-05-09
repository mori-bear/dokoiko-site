#!/usr/bin/env python3
"""
fixCopypasteTravelTime.py
石垣島・宮古島・屋久島・渡嘉敷島・久米島・座間味島・西表島・竹富島・
与那国島・今帰仁・本部・伊江島の一律コピペtravelTimeを正確な値に修正。
"""
import json
from pathlib import Path

DEST_FILE = Path(__file__).parent.parent / 'src/data/destinations.json'
data = json.loads(DEST_FILE.read_text('utf-8'))

# ════════════════════════════════════════════════════
# 各出発都市→那覇 の所要時間(分, ドア to ドア)
# フライト+空港アクセス両端含む
# ════════════════════════════════════════════════════
CITY_TO_NAHA = {
    'tokyo':       200,  # 羽田30分+飛行機145分+那覇20分
    'osaka':       160,  # 伊丹15分+飛行機100分+那覇20分
    'nagoya':      175,  # 中部45分+飛行機110分+那覇20分
    'fukuoka':     135,  # 博多→空港15分+飛行機95分+那覇25分
    'sapporo':     225,  # 新千歳45分+飛行機155分+那覇25分
    'sendai':      165,  # 仙台空港25分+飛行機120分+那覇20分
    'aomori':      165,  # 青森空港→那覇直行 2h10分+アクセス25分
    'hakodate':    250,  # 函館→羽田50分+羽田→那覇145分+那覇20分+乗継35分
    'hachinohe':   210,  # 三沢空港→那覇 2h20分+アクセス30分
    'akita':       265,  # 秋田→羽田65分+羽田→那覇145分+那覇20分+乗継35分
    'yamagata':    175,  # 仙台並+10分
    'fukushima':   205,  # 仙台並+40分
    'niigata':     165,  # 新潟空港→那覇直行 2h5分+アクセス30分
    'mito':        225,  # 東京並+25分
    'maebashi':    225,  # 東京並+25分
    'takasaki':    230,  # 東京並+30分
    'kofu':        245,  # 東京並+45分
    'hamamatsu':   185,  # 名古屋並+10分
    'gifu':        185,  # 名古屋並+10分
    'hiroshima':   165,  # 広島空港55分+飛行機90分+那覇20分
    'fukuyama':    175,  # 広島並+10分
    'himeji':      165,  # 神戸空港25分+飛行機105分+那覇20分+市内15分
    'kurashiki':   165,  # 岡山空港40分+飛行機100分+那覇25分
    'tottori':     205,  # 鳥取→広島並+40分 (小さい空港からは乗継)
    'shimonoseki': 145,  # 福岡空港並+10分
    'kitakyushu':  140,  # 北九州空港→那覇 1h40分+アクセス30分
    'yamaguchi':   135,  # 山口宇部空港→那覇直行 1h30分+アクセス25分
    'saga':        140,  # 福岡並+5分
    'oita':        120,  # 大分空港→那覇 1h20分+アクセス30分
    'beppu':       130,  # 大分並+10分
    'takamatsu':   115,  # 高松空港→那覇直行 1h10分+アクセス35分
    'wakayama':    165,  # 大阪並+5分
    'shingu':      205,  # 大阪並+45分(遠い)
    'tanabe':      200,  # 大阪並+40分
    'shirahama':   200,  # 大阪並+40分
    'kushimoto':   210,  # 大阪並+50分
    'obihiro':     260,  # 帯広→千歳→那覇 = 20+45+155+25+乗継15 = 260
    'kushiro':     265,  # 釧路→千歳→那覇 = 40+40+155+25+乗継15 = 275→265
    'kitami':      285,  # 女満別→千歳→那覇 = 40+40+155+25+乗継25 = 285
}

# ════════════════════════════════════════════════════
# 石垣島・宮古島への直行便所要時間(分, ドア to ドア)
# ════════════════════════════════════════════════════
CITY_TO_ISHIGAKI = {
    'tokyo':    240,  # 羽田30+ANA3h10+石垣空港20 = 240
    'osaka':    200,  # 関空45+2h30+石垣20 = 215→200(伊丹shorter)
    'nagoya':   210,  # 中部45+2h40+石垣25 = 210
    'fukuoka':  165,  # 博多15+ANA2h10+石垣25 = 165 (直行あり)
    'sapporo':  265,  # 千歳45+3h10+石垣25 = 265 (直行あり)
    'naha':      90,  # 既設定（ANA55分+空港アクセス35分）
    'miyako':   110,  # 宮古→石垣 RACプロペラ40分+アクセス30分
}

CITY_TO_MIYAKO = {
    'tokyo':    235,  # 羽田30+ANA3h+宮古空港25 = 235
    'osaka':    195,  # 伊丹15+2h20+宮古空港25 = 195
    'nagoya':   205,  # 中部45+2h30+宮古空港25 = 205
    'fukuoka':  155,  # 博多15+ANA1h50+宮古空港25 = 155
    'sapporo':  260,  # 千歳45+3h00+宮古空港25 = 260
    'naha':      80,  # 既設定
    'ishigaki': 110,  # 石垣→宮古 RAC40分+アクセス30分
}

# 屋久島: 鹿児島経由(鹿児島は非登録キーなので各都市から計算)
CITY_TO_YAKUSHIMA = {
    'tokyo':    205,  # 東京→鹿児島ANA100分+鹿児島→屋久島飛行機35分+アクセス各35分
    'osaka':    165,  # 大阪→鹿児島LCC70分+鹿児島→屋久島35分+アクセス各30分
    'nagoya':   175,  # 名古屋→鹿児島80分+鹿児島→屋久島35分+アクセス各30分
    'fukuoka':  150,  # 博多→鹿児島新幹線75分+鹿児島→屋久島飛行機35分+アクセス40分
    'sapporo':  260,  # 新千歳→鹿児島via羽田 240+鹿児島→屋久島35+アクセス = 290→260
    'hiroshima':160,  # 広島→鹿児島直行65分+鹿児島→屋久島35分+アクセス60分
    'oita':     140,  # 大分→鹿児島55分+鹿児島→屋久島35分+アクセス50分
    'beppu':    145,
    'saga':     150,  # 博多並
    'shimonoseki':155,
    'kitakyushu':155,
    'takamatsu':185,  # 高松→鹿児島75分+鹿児島→屋久島35分+アクセス75分
}

# ════════════════════════════════════════════════════
# 修正テーブル: (dest_id, city_key, new_val, reason)
# ════════════════════════════════════════════════════

fixes = []

# 石垣島: 全都市を正確値に
d_ishigaki = next(d for d in data if d['id'] == 'ishigaki')
tt_ish = d_ishigaki['travelTime']
naha_ish = tt_ish.get('naha', 90)  # 既修正値

for city, city_to_naha in CITY_TO_NAHA.items():
    if city in CITY_TO_ISHIGAKI:
        # 直行便あり都市
        new_val = CITY_TO_ISHIGAKI[city]
        reason = f'{city}→石垣直行'
    else:
        # 那覇経由
        new_val = city_to_naha + naha_ish
        reason = f'{city}→那覇{city_to_naha}分+那覇→石垣{naha_ish}分'
    old_val = tt_ish.get(city)
    if old_val is not None and old_val != new_val:
        fixes.append(('ishigaki', '石垣島', city, old_val, new_val, reason))
        tt_ish[city] = new_val

# 宮古島: 全都市を正確値に
d_miyako = next(d for d in data if d['id'] == 'miyakojima')
tt_miyako = d_miyako['travelTime']
naha_miyako = tt_miyako.get('naha', 80)

for city, city_to_naha in CITY_TO_NAHA.items():
    if city in CITY_TO_MIYAKO:
        new_val = CITY_TO_MIYAKO[city]
        reason = f'{city}→宮古直行'
    else:
        new_val = city_to_naha + naha_miyako
        reason = f'{city}→那覇{city_to_naha}分+那覇→宮古{naha_miyako}分'
    old_val = tt_miyako.get(city)
    if old_val is not None and old_val != new_val:
        fixes.append(('miyakojima', '宮古島', city, old_val, new_val, reason))
        tt_miyako[city] = new_val

# 屋久島: 計算値+那覇経由なし
d_yaku = next(d for d in data if d['id'] == 'yakushima')
tt_yaku = d_yaku['travelTime']

for city, new_val in CITY_TO_YAKUSHIMA.items():
    old_val = tt_yaku.get(city)
    if old_val is not None and old_val != new_val:
        reason = f'{city}→鹿児島空路+屋久島プロペラ'
        fixes.append(('yakushima', '屋久島', city, old_val, new_val, reason))
        tt_yaku[city] = new_val

# 那覇経由離島: city_to_naha + naha_to_island で全都市修正
NAHA_ROUTE_ISLANDS = [
    ('tokashiki-jima', '渡嘉敷島'),
    ('kumejima',       '久米島'),
    ('zamami-island',  '座間味島'),
    ('nakijin',        '今帰仁'),
    ('motobu',         '本部'),
    ('ie-island',      '伊江島'),
]

for dest_id, dest_name in NAHA_ROUTE_ISLANDS:
    dest = next((d for d in data if d['id'] == dest_id), None)
    if not dest:
        print(f'⚠️  ID未発見: {dest_id}')
        continue
    tt = dest['travelTime']
    naha_val = tt.get('naha')
    if naha_val is None:
        print(f'⚠️  {dest_name}: nahaキーなし')
        continue
    for city, city_to_naha in CITY_TO_NAHA.items():
        old_val = tt.get(city)
        if old_val is None:
            continue
        new_val = city_to_naha + naha_val
        if old_val != new_val:
            reason = f'{city}→那覇{city_to_naha}分+那覇→{dest_name}{naha_val}分'
            fixes.append((dest_id, dest_name, city, old_val, new_val, reason))
            tt[city] = new_val

# 石垣経由離島: city_to_ishigaki + ishigaki_to_island で全都市修正
ISHIGAKI_ROUTE_ISLANDS = [
    ('iriomote',        '西表島',   'ishigaki'),
    ('taketomi-island', '竹富島',   'ishigaki'),
    ('yonaguni-island', '与那国島', 'ishigaki'),
]

for dest_id, dest_name, hub_key in ISHIGAKI_ROUTE_ISLANDS:
    dest = next((d for d in data if d['id'] == dest_id), None)
    if not dest:
        print(f'⚠️  ID未発見: {dest_id}')
        continue
    tt = dest['travelTime']
    hub_val = tt.get(hub_key)
    if hub_val is None:
        print(f'⚠️  {dest_name}: {hub_key}キーなし')
        continue
    naha_val = tt.get('naha')

    for city, city_to_naha in CITY_TO_NAHA.items():
        old_val = tt.get(city)
        if old_val is None:
            continue
        if city in CITY_TO_ISHIGAKI:
            # 石垣直行+ 石垣→島
            city_to_ishigaki = CITY_TO_ISHIGAKI[city]
        else:
            # 那覇経由+那覇→石垣+石垣→島は複雑 → 那覇経由+島値で計算
            # naha→iriomote/taketomi/yonaguni already set
            if naha_val:
                city_to_naha_val = CITY_TO_NAHA[city]
                new_val = city_to_naha_val + naha_val
                if old_val != new_val:
                    reason = f'{city}→那覇{city_to_naha_val}分+那覇→{dest_name}{naha_val}分'
                    fixes.append((dest_id, dest_name, city, old_val, new_val, reason))
                    tt[city] = new_val
            continue
        # 石垣直行都市: city→石垣→dest_island
        new_val = city_to_ishigaki + hub_val
        if old_val != new_val:
            reason = f'{city}→石垣{city_to_ishigaki}分+石垣→{dest_name}{hub_val}分'
            fixes.append((dest_id, dest_name, city, old_val, new_val, reason))
            tt[city] = new_val

# 保存
DEST_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), 'utf-8')

# レポート
print('\n' + '='*65)
print('【コピペtravelTime修正】')
print('='*65)

by_dest = {}
for dest_id, dest_name, city, old, new, reason in fixes:
    by_dest.setdefault(dest_name, []).append((city, old, new))

for dest_name, changes in by_dest.items():
    print(f'\n  {dest_name}:')
    for city, old, new in changes:
        print(f'    {city}: {old}分 → {new}分')

print(f'\n  総修正件数: {len(fixes)} 件')
print('\n✅ destinations.json 更新完了')
