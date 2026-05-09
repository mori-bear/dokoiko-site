#!/usr/bin/env python3
"""
fixIslandDataComplete.py
離島データの徹底修正:
1. travelTime の実態に合わせた修正（沖縄離島の石垣/宮古/那覇、北海道/長崎/鹿児島/新潟）
2. じゃらんキーワードの修正（礼文島・利尻島・男鹿・佐渡島・小値賀島）
3. stayAllowed の修正（粟島新潟）
4. hub の修正（男鹿: 仙台→秋田）
"""
import json, re
from urllib.parse import quote, unquote
from pathlib import Path

DEST_FILE = Path(__file__).parent.parent / 'src/data/destinations.json'
JALAN_AFF = 'https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=3764408&pid=892559858&vc_url='

data = json.loads(DEST_FILE.read_text('utf-8'))

def build_jalan_url(keyword: str) -> str:
    kw_bytes = keyword.encode('shift_jis')
    kw_pct = ''.join(f'%{b:02X}' for b in kw_bytes)
    jalan_inner = f'https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword={kw_pct}'
    return JALAN_AFF + quote(jalan_inner, safe='')

def decode_jalan_kw(url: str) -> str:
    if 'vc_url=' not in url:
        return ''
    vc_decoded = unquote(url[url.find('vc_url=')+7:])
    m = re.search(r'keyword=([^&]+)', vc_decoded)
    if not m:
        return ''
    kw_bytes = bytes(int(x, 16) for x in re.findall(r'%([0-9A-Fa-f]{2})', m.group(1)))
    try:
        return kw_bytes.decode('shift_jis')
    except Exception:
        return ''

# ════════════════════════════════════════════════════
# 1. travelTime 修正
# ════════════════════════════════════════════════════
# (dest_id, city_key, new_val, reason)
TRAVEL_FIXES = [
    # ── 那覇からの各島 ──────────────────────────────────────────
    # 石垣島: 那覇空港→石垣空港55分 + 空港アクセス各15分 = 85→90分
    ('ishigaki',        'naha',    90, '那覇空港→石垣空港55分+空港アクセス35分'),
    # 宮古島: 那覇空港→宮古空港45分 + 空港アクセス35分 = 80分
    ('miyakojima',      'naha',    80, '那覇空港→宮古空港45分+空港アクセス35分'),
    # 久米島: 那覇空港→久米島空港35分 + 空港アクセス35分 = 70分
    ('kumejima',        'naha',    70, '那覇空港→久米島空港35分+空港アクセス35分'),
    # 渡嘉敷島: 泊港→渡嘉敷高速艇35分 + 泊港アクセス25分 + 到着後5分 = 65分
    ('tokashiki-jima',  'naha',    65, '泊港→渡嘉敷高速艇35分+港アクセス30分'),
    # 座間味島: 泊港→座間味高速艇50分 + 泊港アクセス25分 + 到着後5分 = 80分
    ('zamami-island',   'naha',    80, '泊港→座間味高速艇50分+港アクセス30分'),

    # ── 西表島 ──────────────────────────────────────────────
    # 那覇→石垣90 + 石垣→西表(上原港)高速艇50+港15 = 155分
    ('iriomote',        'naha',   155, '那覇→石垣90分+石垣→西表上原港高速艇50分+港アクセス15分'),
    # 石垣→西表(上原港): 高速船50分 + 港アクセス15分 = 65分
    ('iriomote',        'ishigaki', 65, '石垣港→西表上原港高速艇50分+港アクセス15分'),

    # ── 竹富島 ──────────────────────────────────────────────
    # 那覇→石垣90 + 石垣→竹富30 = 120分
    ('taketomi-island', 'naha',   120, '那覇→石垣90分+石垣→竹富30分'),
    # 石垣→竹富: 連絡船10分 + 港アクセス20分 = 30分
    ('taketomi-island', 'ishigaki', 30, '石垣港→竹富港連絡船10分+港アクセス20分'),

    # ── 与那国島 ──────────────────────────────────────────────
    # 那覇→石垣90 + 石垣→与那国飛行機30+アクセス30 = 150分
    ('yonaguni-island', 'naha',   150, '那覇→石垣90分+石垣→与那国飛行機30分+アクセス30分'),
    # 石垣→与那国: RAC飛行機30分 + 空港アクセス30分 = 60分
    ('yonaguni-island', 'ishigaki', 60, '石垣→与那国RAC飛行機30分+空港アクセス30分'),

    # ── 波照間島 ──────────────────────────────────────────────
    # 那覇→石垣90 + 石垣→波照間高速船60+港20 = 170分
    ('hateruma-island', 'naha',   170, '那覇→石垣90分+石垣→波照間高速船60分+港アクセス20分'),
    # 石垣→波照間: 高速船60分 + 港アクセス20分 = 80分
    ('hateruma-island', 'ishigaki', 80, '石垣→波照間高速船60分+港アクセス20分'),

    # ── 小浜島 ──────────────────────────────────────────────
    # 那覇→石垣90 + 石垣→小浜高速船25+港20 = 135分
    ('kohama-island',   'naha',   135, '那覇→石垣90分+石垣→小浜高速船25分+港アクセス20分'),
    # 石垣→小浜: 高速船25分 + 港アクセス20分 = 45分
    ('kohama-island',   'ishigaki', 45, '石垣→小浜高速船25分+港アクセス20分'),

    # ── 多良間島 ──────────────────────────────────────────────
    # 那覇→宮古80 + 宮古→多良間プロペラ機25+アクセス30 = 135分
    ('tarama-island',   'naha',   135, '那覇→宮古80分+宮古→多良間プロペラ機25分+アクセス30分'),
    # 宮古→多良間: RACプロペラ機25分 + 空港アクセス30分 = 55分
    ('tarama-island',   'miyako',  55, '宮古→多良間RACプロペラ機25分+空港アクセス30分'),
    # 石垣→宮古飛行機40+アクセス25 + 宮古→多良間55 = 120分
    ('tarama-island',   'ishigaki', 120, '石垣→宮古飛行機40分+アクセス25分+宮古→多良間55分'),

    # ── 伊良部島 ──────────────────────────────────────────────
    # 那覇→宮古80 + 宮古空港→伊良部（伊良部大橋）30 = 110分
    ('irabu-island',    'naha',   110, '那覇→宮古80分+宮古空港→伊良部大橋経由30分'),
    # 宮古空港→伊良部島: 伊良部大橋経由15分+空港アクセス15分 = 30分
    ('irabu-island',    'miyako',  30, '宮古空港→伊良部大橋経由15分+空港送迎15分'),
    # 石垣→宮古飛行機65 + 宮古→伊良部30 = 95分
    ('irabu-island',    'ishigaki', 95, '石垣→宮古飛行機65分+宮古→伊良部30分'),

    # ── 北海道 ──────────────────────────────────────────────
    # 天売島: 札幌→旭川特急80+旭川→羽幌バス120+羽幌→天売フェリー100 = 300分
    ('teuri-island',    'sapporo', 300, '札幌→旭川特急80分+旭川→羽幌バス120分+羽幌→天売フェリー100分'),

    # ── 長崎 ──────────────────────────────────────────────
    # 小値賀島: 博多→佐世保特急90+佐世保→小値賀フェリー150 = 240分
    ('ojika-island',    'fukuoka', 240, '博多→佐世保特急90分+佐世保→小値賀フェリー150分'),

    # ── 鹿児島 ──────────────────────────────────────────────
    # 甑島: 博多→鹿児島新幹線75+鹿児島→川内30+川内→串木野港30+高速船85 = 220分
    ('koshikijima',     'fukuoka', 220, '博多→鹿児島新幹線75分+鹿児島→串木野港60分+高速船85分'),

    # ── 新潟 ──────────────────────────────────────────────
    # 粟島(新潟): 新潟→岩船港電車+バス45分+フェリー95分 = 140分
    ('awashima-island', 'niigata', 140, '新潟→岩船港電車+バス45分+岩船港→粟島フェリー95分'),
]

# ════════════════════════════════════════════════════
# 2. stayAllowed 修正
# ════════════════════════════════════════════════════
# (dest_id, new_stayAllowed, reason)
STAY_FIXES = [
    # 粟島（新潟）: フェリー1日2-3便で往復は実質日帰り不可
    ('awashima-island', ['1night'], 'フェリー本数少なく（1日2-3便）往復日帰りは実質不可'),
]

# ════════════════════════════════════════════════════
# 3. hub 修正
# ════════════════════════════════════════════════════
# (dest_id, new_hub_key, new_hub_name, hub_travel_time)
HUB_FIXES = [
    # 男鹿: 男鹿半島は秋田県。秋田からJR男鹿線50分+市内アクセス10分=60分
    ('oga', 'akita', '秋田', 60),
]

# ════════════════════════════════════════════════════
# 4. じゃらんキーワード修正
# ════════════════════════════════════════════════════
# (dest_id, 正しいキーワード)
JALAN_FIXES = [
    ('rebun-island',   '礼文島'),   # 礼文 → 礼文島
    ('rishiri-island', '利尻島'),   # 利尻 → 利尻島
    ('oga',            '男鹿'),     # 秋田県 男鹿温泉 → 男鹿
    ('sado-island',    '佐渡島'),   # 佐渡 → 佐渡島
    ('ojika-island',   '小値賀島'), # 小値賀 → 小値賀島
]

# ════════════════════════════════════════════════════
# 実行
# ════════════════════════════════════════════════════
tt_changes = []
for dest_id, city, new_val, reason in TRAVEL_FIXES:
    dest = next((d for d in data if d['id'] == dest_id), None)
    if not dest:
        print(f'⚠️  ID未発見: {dest_id}')
        continue
    tt = dest.get('travelTime', {})
    cur = tt.get(city)
    if cur is None:
        print(f'⚠️  {dest["name"]}: city "{city}" なし')
        continue
    old_val = cur
    tt[city] = new_val
    tt_changes.append((dest['name'], city, old_val, new_val, reason))

stay_changes = []
for dest_id, new_stay, reason in STAY_FIXES:
    dest = next((d for d in data if d['id'] == dest_id), None)
    if not dest:
        print(f'⚠️  ID未発見: {dest_id}')
        continue
    old_stay = dest.get('stayAllowed', [])
    dest['stayAllowed'] = new_stay
    stay_changes.append((dest['name'], old_stay, new_stay, reason))

hub_changes = []
for dest_id, new_hub_key, new_hub_name, travel_time in HUB_FIXES:
    dest = next((d for d in data if d['id'] == dest_id), None)
    if not dest:
        print(f'⚠️  ID未発見: {dest_id}')
        continue
    old_hub = dest.get('hub', '')
    old_hub_name = dest.get('hubName', '')
    dest['hub'] = new_hub_key
    dest['hubName'] = new_hub_name
    # travelTimeにhub都市の時間を追加
    if travel_time and new_hub_key not in dest.get('travelTime', {}):
        dest.setdefault('travelTime', {})[new_hub_key] = travel_time
    hub_changes.append((dest['name'], old_hub, new_hub_key, old_hub_name, new_hub_name))

jalan_changes = []
for dest_id, new_kw in JALAN_FIXES:
    dest = next((d for d in data if d['id'] == dest_id), None)
    if not dest:
        print(f'⚠️  ID未発見: {dest_id}')
        continue
    hl = dest.get('hotelLinks', {})
    jal = hl.get('jalan', '')
    if not jal:
        print(f'⚠️  {dest["name"]}: じゃらんURL未設定')
        continue
    old_kw = decode_jalan_kw(jal)
    if old_kw == new_kw:
        print(f'  ✓ {dest["name"]}: すでに正しい ({new_kw})')
        continue
    hl['jalan'] = build_jalan_url(new_kw)
    jalan_changes.append((dest['name'], old_kw, new_kw))

# 保存
DEST_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), 'utf-8')

# レポート
print('\n' + '='*65)
print('【1. travelTime 修正】')
print('='*65)
for name, city, old, new, reason in tt_changes:
    print(f'  {name} / {city}: {old}分 → {new}分')
    print(f'      {reason}')
print(f'\n  合計: {len(tt_changes)} 件')

print('\n' + '='*65)
print('【2. stayAllowed 修正】')
print('='*65)
for name, old, new, reason in stay_changes:
    print(f'  {name}: {old} → {new}')
    print(f'      {reason}')
print(f'\n  合計: {len(stay_changes)} 件')

print('\n' + '='*65)
print('【3. hub 修正】')
print('='*65)
for name, old_hub, new_hub, old_name, new_name in hub_changes:
    print(f'  {name}: hub {old_hub}({old_name}) → {new_hub}({new_name})')
print(f'\n  合計: {len(hub_changes)} 件')

print('\n' + '='*65)
print('【4. じゃらんキーワード修正】')
print('='*65)
for name, old, new in jalan_changes:
    print(f'  {name}: 「{old}」 → 「{new}」')
print(f'\n  合計: {len(jalan_changes)} 件')

print('\n✅ destinations.json 更新完了')
