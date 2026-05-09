#!/usr/bin/env python3
"""
fixDataQuality.py — destinations.json 品質修正
問題A: hubCityのtravelTimeキーが未設定（daytrip/表示に影響）
問題B: daytrip stayAllowedだが全都市travelTime > 120（daytrip候補に出ない）
問題C: stayAllowedにdaytripがあるが実質不可（鹿児島など出発地未登録）
"""
import json
from pathlib import Path

DEST_FILE = Path(__file__).parent.parent / 'src/data/destinations.json'
data = json.loads(DEST_FILE.read_text('utf-8'))

# ════════════════════════════════════════════════════
# 問題A: hubCityのtravelTimeキー追加
# (dest_id, city_key, travel_minutes, reason)
# ════════════════════════════════════════════════════
HUB_TT_ADDS = [
    # ── 仙台hub ─────────────────────────────────────────────
    # 松島: 仙台→松島海岸 JR26分+アクセス14分 = 40分
    ('matsushima',       'sendai',   40,  '仙台→松島海岸JR26分+アクセス14分'),
    # 大内宿: 仙台→郡山新幹線50分+郡山→大内宿バス80分 = 130分
    ('ouchi-juku',       'sendai',  130,  '仙台→郡山新幹線50分+郡山→大内宿バス80分'),

    # ── 広島hub ─────────────────────────────────────────────
    # 宮島: 広島→宮島口電車20分+フェリー10分 = 30分
    ('miyajima',         'hiroshima', 30,  '広島→宮島口電車20分+フェリー10分'),
    # 下関: 広島→下関 新幹線こだま38分+アクセス7分 = 45分
    ('shimonoseki',      'hiroshima', 45,  '広島→下関新幹線こだま38分+アクセス7分'),
    # 周防大島: 広島→大畠JR60分+橋・バス10分 = 70分
    ('suo-oshima',       'hiroshima', 70,  '広島→大畠JR60分+周防大島バス10分'),
    # 見島: 広島→新山口新幹線25分+萩バス70分+萩→見島フェリー100分 = 195分
    ('mishima-yamaguchi','hiroshima',200,  '広島→新山口25分+萩バス70分+萩→見島フェリー100分+待機5分'),
    # 大久野島: 広島→忠海JR60分+忠海→大久野島フェリー12分+アクセス3分 = 75分
    ('okunoshima',       'hiroshima', 75,  '広島→忠海JR60分+忠海→大久野島フェリー15分'),
    # 大崎上島: 広島→竹原JR60分+竹原→大崎上島フェリー35分 = 95分
    ('osakikamijima',    'hiroshima', 95,  '広島→竹原JR60分+竹原→大崎上島フェリー35分'),
    # 仙酔島: 広島→福山新幹線30分+鞆の浦バス25分+渡船5分 = 60分
    ('sensui-jima',      'hiroshima', 60,  '広島→福山新幹線30分+鞆の浦バス25分+渡船5分'),

    # ── 那覇hub ─────────────────────────────────────────────
    # 今帰仁: 那覇バスターミナル→今帰仁城跡 高速バス100分
    ('nakijin',          'naha',    100,  '那覇バスターミナル→今帰仁城跡高速バス100分'),
    # 恩納村: 那覇→恩納 高速バス75分
    ('onna',             'naha',     75,  '那覇→恩納高速バス75分'),

    # ── 山形hub ─────────────────────────────────────────────
    # 飛島: 山形→酒田JR特急90分+酒田→飛島フェリー85分 = 175分
    ('tobishima-island', 'yamagata',175,  '山形→酒田JR特急90分+酒田→飛島フェリー85分'),
]

# ════════════════════════════════════════════════════
# 問題B: daytrip可能なのに全都市travelTime > 120 → 値修正
# (dest_id, city_key, old_val, new_val, reason)
# selectionEngine: travelTime > 120 → daytrip除外
# ════════════════════════════════════════════════════
DAYTRIP_TT_FIXES = [
    # 鳥羽: 近鉄名古屋→鳥羽特急1h41min+アクセス9min = 110分（現130）
    ('toba',           'nagoya', 130, 110, '近鉄名古屋→鳥羽特急1h41min+アクセス9分'),
    # 佐世保: 博多→佐世保特急みどり1h20min+アクセス10分 = 90分（現140）
    ('sasebo',         'fukuoka', 140, 90, '博多→佐世保特急みどり1h20分+アクセス10分'),
    # 館山: 特急さざなみ東京→館山1h50min+アクセス = 110分（現130）
    ('tateyama-chiba', 'tokyo',  130, 110, '特急さざなみ東京→館山1h50分（アクセス込み110分）'),
]

# ════════════════════════════════════════════════════
# 問題C: daytripが全都市不可能なのにstayAllowedにdaytripあり
# → 出発地(hub)がシステムに未登録のため永久に選ばれない
# (dest_id, new_stayAllowed, reason)
# ════════════════════════════════════════════════════
STAY_FIXES = [
    # 指宿: hub=鹿児島だがkagoshima key未登録, 全都市travelTime>120
    # fukuoka=165(博多→鹿児島75+指宿53=128→実は128だが165は誤, 修正も必要)
    # 128でも>120のためdaytrip不可 → stayAllowed修正
    ('ibusuki', ['1night'], '全都市travelTime>120&鹿児島key未登録でdaytrip不可'),
]

# ════════════════════════════════════════════════════
# 問題B': 指宿のfukuoka値も修正
# ════════════════════════════════════════════════════
DAYTRIP_TT_FIXES_EXTRA = [
    # 指宿: 博多→鹿児島中央新幹線75分+JA指宿のたまて箱53分 = 128分（現165）
    ('ibusuki', 'fukuoka', 165, 128, '博多→鹿児島中央新幹線75分+JA指宿のたまて箱53分'),
]

# ════════════════════════════════════════════════════
# 実行
# ════════════════════════════════════════════════════

changes_a = []
for dest_id, city_key, travel_min, reason in HUB_TT_ADDS:
    dest = next((d for d in data if d['id'] == dest_id), None)
    if not dest:
        print(f'⚠️  ID未発見: {dest_id}')
        continue
    tt = dest.setdefault('travelTime', {})
    if city_key in tt:
        print(f'  ✓ {dest["name"]}: {city_key} 既存値={tt[city_key]} (追加不要)')
        continue
    tt[city_key] = travel_min
    changes_a.append((dest['name'], city_key, travel_min, reason))

changes_b = []
for dest_id, city_key, old_val, new_val, reason in DAYTRIP_TT_FIXES + DAYTRIP_TT_FIXES_EXTRA:
    dest = next((d for d in data if d['id'] == dest_id), None)
    if not dest:
        print(f'⚠️  ID未発見: {dest_id}')
        continue
    tt = dest.get('travelTime', {})
    cur = tt.get(city_key)
    if cur != old_val:
        print(f'⚠️  {dest["name"]} {city_key}: 期待={old_val}, 実際={cur} → 強制 {new_val} に修正')
    tt[city_key] = new_val
    changes_b.append((dest['name'], city_key, cur, new_val, reason))

changes_c = []
for dest_id, new_stay, reason in STAY_FIXES:
    dest = next((d for d in data if d['id'] == dest_id), None)
    if not dest:
        print(f'⚠️  ID未発見: {dest_id}')
        continue
    old_stay = dest.get('stayAllowed', [])
    dest['stayAllowed'] = new_stay
    changes_c.append((dest['name'], old_stay, new_stay, reason))

# 保存
DEST_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), 'utf-8')

# ════ レポート ════════════════════════════════════════
print('\n' + '='*65)
print('【問題A: hubCityのtravelTimeキー追加】')
print('='*65)
for name, city, val, reason in changes_a:
    print(f'  {name} / {city}: +{val}分')
    print(f'      {reason}')
print(f'\n  合計: {len(changes_a)} 件')

print('\n' + '='*65)
print('【問題B: daytrip矛盾travelTime修正】')
print('='*65)
for name, city, old, new, reason in changes_b:
    print(f'  {name} / {city}: {old}分 → {new}分')
    print(f'      {reason}')
print(f'\n  合計: {len(changes_b)} 件')

print('\n' + '='*65)
print('【問題C: stayAllowed修正】')
print('='*65)
for name, old, new, reason in changes_c:
    print(f'  {name}: {old} → {new}')
    print(f'      {reason}')
print(f'\n  合計: {len(changes_c)} 件')

print('\n✅ destinations.json 更新完了')
