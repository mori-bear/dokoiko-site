#!/usr/bin/env python3
"""
fillTravelTimeGaps.py
主要hubから近隣目的地への travelTime を補完・修正。
"""
import json
from pathlib import Path

DEST = Path(__file__).parent.parent / 'src/data/destinations.json'
data = json.loads(DEST.read_text('utf-8'))

# (hub_key, dest_id, time_min, also_add_daytrip)
# 高松からのアクセス改善
TAKAMATSU_FIXES = [
    # 未設定の4件
    ('shimanami-kaido', 200, False),  # 高松→今治→しまなみ
    ('etajima', 180, False),
    ('hakatajima', 180, False),
    ('yugeshima', 180, False),
    # 過大設定の修正
    ('onomichi', 100, True),       # 高松→岡山新幹線→新尾道
    ('imabari', 120, True),         # 特急しおかぜ
    ('uwajima', 210, False),        # 特急しおかぜ+宇和海
    # 兵庫西部
    ('ako', 130, False),             # 赤穂は140超なので 130 daytripギリ
    # 高知方面
    ('nakatosa', 180, False),
    ('shimanto', 250, False),
    # 徳島方面
    ('tokushima-city', 70, True),
    ('miyoshi-tokushima', 90, True),
    ('iya', 130, False),
    ('mugi', 130, False),
    ('mima', 90, True),
    # 愛媛方面
    ('kawanoe', 75, True),
    ('niihama', 95, True),
    ('saijo', 60, True),
    ('ozu', 180, False),
    # 岡山方面
    ('bizen', 90, True),
    ('soja', 80, True),
    ('seto', 75, True),
    ('kasaoka', 95, True),
    ('mimasaka', 130, False),
    # 広島方面
    ('mihara', 100, True),
    ('takehara', 130, False),
    ('higashi-hiroshima', 130, False),
    ('shobara', 200, False),
    ('miyoshi', 200, False),
    # 兵庫
    ('tatsuno', 130, False),
    ('aioi', 130, False),
]

OSAKA_FIXES = [
    # 大阪→近畿圏で抜けている可能性のあるところ
    ('kushimoto', 240, False),  # 既存値あれば変更なし
    ('shingu-wakayama', 240, False),
    ('koyasan', 130, False),
    ('tanabe', 150, False),
    ('shirahama', 160, False),
    ('mihama', 145, False),
    ('amanohashidate', 130, False),
    ('ine', 165, False),
    ('miyama', 110, True),
    ('ohara', 90, True),
    ('kifune', 90, True),
]

TOKYO_FIXES = [
    # 東京から関東近郊
    ('enoshima', 80, True),
    ('jogashima', 110, True),
    ('miura', 100, True),
    ('yokosuka', 60, True),
    ('hayama', 80, True),
    ('mashiko', 110, True),
    ('ashikaga', 100, True),
    ('sano', 80, True),
    ('takao', 80, True),
    ('hanno', 60, True),
    ('chichibu', 120, True),
    ('nagatoro', 130, False),
    ('mt-mitake', 110, True),
    ('okutama', 90, True),
    ('kawagoe', 60, True),
    ('boso', 120, True),
    ('kamogawa', 130, False),
    ('tateyama-chiba', 110, True),
    ('mihonomatsubara', 110, True),
    ('atami', 60, True),
    ('ito', 100, True),
    ('izu-kogen', 130, False),
    ('shimoda', 180, False),
]

FUKUOKA_FIXES = [
    ('dazaifu', 50, True),
    ('itoshima', 60, True),
    ('yanagawa', 60, True),
    ('asakura', 70, True),
    ('hisayama', 50, True),
    ('chikugo', 60, True),
    ('munakata', 50, True),
    ('beppu', 130, False),
    ('yufuin', 130, False),
    ('takeo', 80, True),
    ('ureshino', 90, True),
    ('sasebo', 90, True),
    ('hirado', 180, False),
    ('shimabara', 180, False),
]

NAGOYA_FIXES = [
    ('inuyama', 50, True),
    ('seki', 75, True),
    ('takayama', 130, False),
    ('shirakawago', 180, False),
    ('gero', 130, False),
    ('ise', 100, True),
    ('toba', 130, False),
    ('shima', 140, False),
    ('matsusaka', 90, True),
    ('iga', 90, True),
    ('atsuta', 30, True),
    ('toyota', 60, True),
    ('okazaki', 50, True),
    ('hamamatsu-city', 50, True),
    ('sakushima', 110, True),
    ('himakajima', 90, True),
    ('shinojima', 100, True),
    ('narai-juku', 90, True),
    ('magome', 100, True),
]

SAPPORO_FIXES = [
    ('otaru', 50, True),
    ('jozankei-onsen', 70, True),
    ('niseko', 130, False),
    ('rusutsu', 130, False),
    ('shikotsu', 60, True),
    ('toya', 110, True),
    ('noboribetsu', 90, True),
    ('shiraoi', 80, True),
    ('hakodate', 240, False),
    ('asahikawa', 90, True),
    ('biei', 115, True),
    ('furano', 130, False),
    ('tomakomai', 60, True),
    ('yoichi', 65, True),
    ('shakotan', 130, False),
]

HIROSHIMA_FIXES = [
    ('miyajima', 30, True),
    ('iwakuni', 35, True),
    ('onomichi', 90, True),
    ('fukuyama', 30, True),
    ('mihara', 60, True),
    ('takehara', 95, True),
    ('shimonoseki', 45, True),
    ('higashi-hiroshima', 40, True),
    ('kure', 35, True),
    ('miyoshi', 100, True),
    ('hagi', 180, False),
    ('tsuwano', 90, True),
    ('yanai', 90, True),
    ('innoshima', 100, True),
    ('ikuchijima', 110, True),
    ('hakatajima', 120, True),
    ('omishima-island', 120, True),
    ('imabari', 120, True),  # 高速バス
    ('matsuyama-city', 150, False),  # 高速バス3時間
]

NAHA_FIXES = [
    ('shuri', 30, True),
    ('motobu', 90, True),
    ('nakijin', 100, True),
    ('onna', 75, True),
    ('okinawa-world', 60, True),
    ('chinen', 50, True),
    ('itoman', 40, True),
    ('zamami-island', 80, False),
    ('tokashiki-jima', 65, True),
    ('kumejima', 70, True),
    ('aguni-island', 130, False),
    ('iheya-island', 270, False),
    ('izena-island', 240, False),
]

ALL_FIXES = [
    ('takamatsu', TAKAMATSU_FIXES),
    ('osaka', OSAKA_FIXES),
    ('tokyo', TOKYO_FIXES),
    ('fukuoka', FUKUOKA_FIXES),
    ('nagoya', NAGOYA_FIXES),
    ('sapporo', SAPPORO_FIXES),
    ('hiroshima', HIROSHIMA_FIXES),
    ('naha', NAHA_FIXES),
]

results = {}
not_found = []

for hub, fixes in ALL_FIXES:
    cnt_added = 0
    cnt_fixed = 0
    cnt_daytrip = 0
    for did, time, add_daytrip in fixes:
        d = next((x for x in data if x['id'] == did), None)
        if not d:
            not_found.append((hub, did))
            continue
        tt = d.setdefault('travelTime', {})
        prev = tt.get(hub)
        tt[hub] = time
        if prev is None:
            cnt_added += 1
        elif prev != time:
            cnt_fixed += 1
        # daytrip追加
        if add_daytrip and time <= 120:
            stay = d.setdefault('stayAllowed', [])
            if 'daytrip' not in stay:
                stay.insert(0, 'daytrip')
                cnt_daytrip += 1
    results[hub] = (cnt_added, cnt_fixed, cnt_daytrip)

DEST.write_text(json.dumps(data, ensure_ascii=False, indent=2))

print('='*60)
print('【travelTime補完結果】')
print('='*60)
for hub, (a, f, d) in results.items():
    print(f'  {hub:12} : 追加{a}件 / 修正{f}件 / daytrip+{d}件')
print(f'\n見つからなかったid: {len(not_found)}件')
for hub, did in not_found:
    print(f'  {hub}: {did}')
