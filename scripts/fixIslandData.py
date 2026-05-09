#!/usr/bin/env python3
"""
fixIslandData.py
問題1: 離島の不正な travelTime を修正
問題2: じゃらんキーワードが本島都市の離島を島名キーワードに修正
"""
import json, re
from urllib.parse import quote, unquote
from pathlib import Path

DEST_FILE = Path(__file__).parent.parent / 'src/data/destinations.json'
JALAN_AFF = 'https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=3764408&pid=892559858&vc_url='

data = json.loads(DEST_FILE.read_text('utf-8'))

def build_jalan_url(keyword: str) -> str:
    """キーワード（日本語）からじゃらんアフィリエイトURLを生成"""
    kw_bytes = keyword.encode('shift_jis')
    kw_pct = ''.join(f'%{b:02X}' for b in kw_bytes)
    jalan_inner = f'https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword={kw_pct}'
    # vc_url パラメータ用にエンコード（%→%25 を含む）
    return JALAN_AFF + quote(jalan_inner, safe='')

def decode_jalan_kw(url: str) -> str:
    """現在のじゃらんURLからキーワードをShift-JISデコード"""
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
# 問題1: travelTime 修正
# ════════════════════════════════════════════════════
TRAVEL_FIXES = [
    # (id, city, expected_old, new_val, reason)
    ('shodoshima',    'takamatsu', 5,   65,  '高松港→土庄港 フェリー最速35分＋港アクセス30分'),
    ('naoshima',      'takamatsu', 5,   50,  '高松港→宮浦港 高速艇25分＋港アクセス25分'),
    ('teshima',       'takamatsu', 15,  40,  '高松港→豊島家浦港 フェリー約35分'),
    ('kouzushima',    'tokyo',     20, 145,  '竹芝→神津島 ジェット船約2時間20分＋竹芝まで5分'),
    ('izu-oshima',    'tokyo',     20, 115,  '竹芝→大島 ジェット船約1時間45分＋竹芝まで30分'),
    ('goto',          'fukuoka',   20,  90,  '博多→福江 高速船約85分'),
    ('tsushima',      'fukuoka',   20,  50,  '福岡空港→対馬空港 空路約40分＋空港アクセス10分'),
    ('iki-island',    'fukuoka',   20,  75,  '博多港→芦辺港 ジェット船65分＋港アクセス10分'),
    ('ie-island',     'naha',      30, 100,  '那覇→本部バス70分＋本部→伊江島フェリー30分'),
    ('sado-island',   'tokyo',    110, 170,  '東京→新潟新幹線95分＋ジェットフォイル67分＋乗換8分'),
]

tt_changes = []
for dest_id, city, old_val, new_val, reason in TRAVEL_FIXES:
    dest = next((d for d in data if d['id'] == dest_id), None)
    if not dest:
        print(f'⚠️  ID未発見: {dest_id}')
        continue
    tt = dest.get('travelTime', {})
    cur = tt.get(city)
    if cur is None:
        print(f'⚠️  {dest["name"]}: city "{city}" なし')
        continue
    if cur != old_val:
        print(f'⚠️  {dest["name"]} {city}: 期待値={old_val}, 実際={cur} → そのまま {new_val} に修正')
    tt[city] = new_val
    tt_changes.append((dest['name'], city, cur, new_val, reason))

# ════════════════════════════════════════════════════
# 問題2: じゃらんキーワード修正
# ════════════════════════════════════════════════════
# (id, 正しいキーワード)
JALAN_FIXES = [
    ('mihonoseki',        '美保関'),
    ('amakusa',           '天草'),
    ('wajima',            '輪島'),
    ('shakotan',          '積丹'),
    ('itoshima',          '糸島'),
    ('shimabara',         '島原'),
    ('shijishima',        '志々島'),
    ('minami-izu',        '南伊豆'),
    ('nakijin',           '今帰仁'),
    ('motobu',            '本部'),
    ('onna',              '恩納'),
    ('hateruma-island',   '波照間島'),
    ('kakeroma-island',   '加計呂麻島'),
    ('tobishima-island',  '飛島'),
    ('awashima-island',   '粟島'),
    ('tarama-island',     '多良間島'),
    ('mishima-yamaguchi', '見島'),
    ('omishima-island',   '大三島'),
    ('ibukijima',         '伊吹島'),
    ('ogijima',           '男木島'),
    ('megijima',          '女木島'),
    ('honjima',           '本島'),
    ('sanagijima',        '佐柳島'),
    ('awashima-kagawa',   '粟島'),
    ('sensui-jima',       '仙酔島'),
    ('manabeshima',       '真鍋島'),
]

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
    new_url = build_jalan_url(new_kw)
    hl['jalan'] = new_url
    jalan_changes.append((dest['name'], old_kw, new_kw))

# ════════════════════════════════════════════════════
# 保存 & レポート
# ════════════════════════════════════════════════════
DEST_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), 'utf-8')

print('\n' + '='*60)
print('【問題1: travelTime 修正】')
print('='*60)
for name, city, old, new, reason in tt_changes:
    print(f'  {name} / {city}: {old}分 → {new}分')
    print(f'      理由: {reason}')

print(f'\n  合計: {len(tt_changes)} 件\n')

print('='*60)
print('【問題2: じゃらんキーワード修正】')
print('='*60)
for name, old, new in jalan_changes:
    print(f'  {name}: 「{old}」 → 「{new}」')

print(f'\n  合計: {len(jalan_changes)} 件')
print('\n✅ destinations.json 更新完了')
