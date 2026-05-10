#!/usr/bin/env python3
"""
fixIslandDuplicatesAndTags.py
- addInhabitedIslands.py で発生した重複を解消
- 既存島データに 離島 タグを追加（離島タグなしの観光島）
"""
import json
import re
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

# 私が追加した重複IDを削除（既存の方を残す）
DUPLICATE_IDS_TO_REMOVE = [
    'iheya-island',     # tomari-okinawa が既存
    'okushiri-island',  # gen_北海_奥尻島 が既存
    'yagishiri-island', # gen_北海_焼尻島 が既存
    'kudaka-island',    # kudakajima が既存
    'mikurashima',      # mikurajima が既存
    'tonaki-island',    # tonaki が既存
    'nokonoshima',      # noko-island が既存
]

# 既存IDに離島タグ追加 + island化
# (既存id, 表示名)
EXISTING_TO_FIX = [
    ('tomari-okinawa', '伊平屋島'),
    ('gen_北海_奥尻島', '奥尻島'),
    ('gen_北海_焼尻島', '焼尻島'),
    ('kudakajima', '久高島'),
    ('mikurajima', '御蔵島'),
    ('tonaki', '渡名喜島'),
    ('noko-island', '能古島'),
    ('toshima', '利島'),
    ('aogashima', '青ヶ島'),
    ('enoshima', '江の島'),
    ('sakushima', '佐久島'),
    ('himakajima', '日間賀島'),
    ('shinojima', '篠島'),
    ('nishinoshima', '西ノ島'),
    ('innoshima', '因島'),
    ('ikuchijima', '生口島'),
    ('tsunoshima', '角島'),
    ('himeshima', '姫島'),
    ('kuchinoerabu', '口永良部島'),
]

data = json.loads(DEST_FILE.read_text('utf-8'))

# 1. 重複削除
removed = []
new_data = []
for d in data:
    if d['id'] in DUPLICATE_IDS_TO_REMOVE:
        removed.append(d['name'] + ' (' + d['id'] + ')')
    else:
        new_data.append(d)
data = new_data

# 2. 既存島に離島タグ追加・必要フィールド補完
fixed = []
for did, expected_name in EXISTING_TO_FIX:
    d = next((x for x in data if x['id'] == did), None)
    if not d:
        print(f'⚠️  既存ID未発見: {did}')
        continue
    changes = []
    # 離島タグ追加
    tags = d.get('tags', [])
    if '離島' not in tags:
        tags = ['離島'] + tags
        d['tags'] = tags
        changes.append('tags+=[離島]')
    # isIsland
    if not d.get('isIsland'):
        d['isIsland'] = True
        changes.append('isIsland=True')
    # destType
    if d.get('destType') != 'island':
        d['destType'] = 'island'
        changes.append('destType=island')
    # hotelLinks（無ければ生成）
    if not d.get('hotelLinks'):
        d['hotelLinks'] = {
            'rakuten': build_rakuten_url(d['name']),
            'jalan': build_jalan_url(d['name']),
        }
        changes.append('hotelLinks+')
    fixed.append((d['name'], did, changes))

# 保存
DEST_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), 'utf-8')

# レポート
print('='*70)
print('【削除した重複ID】')
print('='*70)
for r in removed:
    print(f'  - {r}')
print(f'  合計: {len(removed)} 件')

print()
print('='*70)
print('【既存島に離島タグ・island化】')
print('='*70)
for name, did, changes in fixed:
    print(f'  ✓ {name:12} ({did}): {", ".join(changes) if changes else "(変更なし)"}')
print(f'  合計: {len(fixed)} 件')

print(f'\n✅ destinations.json 更新完了 (合計 {len(data)} 件)')
