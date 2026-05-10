#!/usr/bin/env python3
"""
fixHotelLinksNearby.py
本土泊前提パターン（離島・小スポット・日帰りのみ）の hotelLinks を
実際に泊まる場所のキーワードに修正。
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

# (id, 検索キーワード [本当に泊まる場所])
# 離島・宿のないスポットのhotelLinksを近隣の宿泊地で検索するよう修正
NEARBY_FIXES = [
    # ── 香川 (瀬戸内アート系離島) ─────────────────────────────
    ('ibukijima',     '観音寺 香川'),       # 伊吹島 → 観音寺市
    ('ogijima',       '高松'),            # 男木島 → 高松
    ('megijima',      '高松'),            # 女木島 → 高松
    ('honjima',       '丸亀'),            # 本島 → 丸亀
    ('sanagijima',    '多度津 丸亀'),       # 佐柳島 → 多度津
    ('shijishima',    '高松'),            # 志々島 → 高松
    ('awashima-kagawa','三豊 香川'),        # 粟島(香川) → 三豊市

    # ── 岡山 ─────────────────────────────────────────────
    ('manabeshima',   '笠岡 福山'),         # 真鍋島 → 笠岡
    ('shiraishijima', '笠岡 福山'),         # 白石島 → 笠岡

    # ── 広島 ─────────────────────────────────────────────
    ('sensui-jima',   '鞆の浦 福山'),       # 仙酔島 → 鞆の浦
    ('okunoshima',    '三原'),             # 大久野島 → 三原

    # ── 山口 ─────────────────────────────────────────────
    ('mishima-yamaguchi', '萩'),           # 見島 → 萩

    # ── 愛媛 ─────────────────────────────────────────────
    ('omishima-island','今治'),            # 大三島 → 今治
    ('hakatajima',    '今治'),             # 伯方島 → 今治
    ('yugeshima',     '今治'),             # 弓削島 → 今治
    ('gogoshima',     '松山'),             # 興居島 → 松山
    ('nakajima',      '松山'),             # 中島 → 松山

    # ── 滋賀 ─────────────────────────────────────────────
    ('chikubushima',  '長浜'),             # 竹生島 → 長浜
    ('okishima',      '近江八幡'),          # 沖島 → 近江八幡
    ('yogo',          '長浜'),             # 余呉湖 → 長浜

    # ── 鳥取 ─────────────────────────────────────────────
    ('hakuto',        '鳥取'),             # 白兎海岸 → 鳥取

    # ── 関東 (日帰りスポット) ─────────────────────────────
    ('takao',         '高尾 八王子'),       # 高尾山 → 八王子
    ('hanno',         '飯能 入間'),         # 飯能
    ('sano',          '佐野'),             # 佐野（ラーメンやアウトレット）

    # ── 大阪・兵庫・奈良 ───────────────────────────────────
    ('ikeda-osaka',   '池田 大阪'),
    ('yamatokoriyama','奈良'),
    ('kashiwara-wine','大阪'),
    ('tatsuno',       '姫路'),
    ('tobe',          '松山'),

    # ── 福岡 ─────────────────────────────────────────────
    ('hiraodai',      '北九州 小倉'),       # 平尾台 → 北九州

    # ── 青森 ─────────────────────────────────────────────
    ('sannai-maruyama','青森'),

    # ── 三重・志摩離島 ────────────────────────────────────
    ('toushijima',    '鳥羽'),
    ('kamishima',     '鳥羽'),

    # ── 沖縄離島（島内宿少ない） ───────────────────────────
    ('hatoma-island', '石垣'),             # 鳩間島 → 石垣
    ('kuroshima-yaeyama', '石垣'),         # 黒島(八重山) → 石垣
    ('yubu-island',   '西表島 石垣'),       # 由布島 → 西表
    ('kurima-island', '宮古島'),           # 来間島 → 宮古
    ('ikema-island',  '宮古島'),           # 池間島 → 宮古
    ('aguni-island',  '那覇'),             # 粟国島 → 那覇
    ('kakeroma-island','奄美'),            # 加計呂麻島 → 奄美
    ('kouri-island',  '名護 沖縄'),         # 古宇利島 → 名護
    ('kudakajima',    '南城 沖縄'),         # 久高島 → 南城
    ('tonaki',        '那覇'),             # 渡名喜島 → 那覇

    # ── 北海道 (秘境) ─────────────────────────────────────
    ('teuri-island',  '羽幌'),             # 天売島 → 羽幌

    # ── 山形・宮城離島 ────────────────────────────────────
    ('tobishima-island','酒田'),           # 飛島 → 酒田
    ('tashirojima',   '石巻'),             # 田代島 → 石巻
    ('kinkasan',      '石巻 鮎川'),         # 金華山 → 鮎川

    # ── 東京離島 (一部小島) ───────────────────────────────
    ('mikurajima',    '八丈島 東京'),       # 御蔵島 → 八丈島
    ('aogashima',     '八丈島'),           # 青ヶ島 → 八丈島

    # ── 国立公園・自然 (宿泊施設限定) ──────────────────────
    ('kamikochi',     '松本 安曇野'),
    ('oze',           '沼田 片品'),
    ('shirakami-sanchi','弘前 青森'),

    # ── 京都北部 ─────────────────────────────────────────
    ('ohara',         '京都'),
    ('kifune',        '京都'),

    # ── 静岡 ─────────────────────────────────────────────
    ('mihonomatsubara','清水 静岡'),
    ('sumatakyo',     '寸又峡 川根本町'),
    ('nishi-izu',     '西伊豆 堂ヶ島'),

    # ── 鳥取・島根 ───────────────────────────────────────
    ('tottori-sakyu', '鳥取'),
    ('izumo-taisha',  '出雲'),
    ('adachi-museum', '安来 米子'),
    ('tamatsukuri-onsen', '玉造温泉'),

    # ── 神奈川 ───────────────────────────────────────────
    ('jogashima',     '三浦 三崎'),
    ('ashinoko',      '箱根'),
    ('minatomirai',   '横浜'),

    # ── 山梨 ─────────────────────────────────────────────
    ('yamanakako',    '山中湖'),
    ('motosuko',      '富士河口湖'),
    ('yatsugatake',   '清里 八ヶ岳'),

    # ── 徳島 ─────────────────────────────────────────────
    ('iya-vine-bridge','大歩危 三好'),

    # ── 宮崎 ─────────────────────────────────────────────
    ('takachiho',     '高千穂'),

    # ── 大分 ─────────────────────────────────────────────
    ('himeshima',     '国東 大分'),

    # ── 鹿児島離島 ───────────────────────────────────────
    ('kuchinoerabu',  '屋久島'),
]

data = json.loads(DEST_FILE.read_text('utf-8'))

changes = []
not_found = []
for did, kw in NEARBY_FIXES:
    d = next((x for x in data if x['id'] == did), None)
    if not d:
        not_found.append(did)
        continue
    old = (d.get('hotelLinks') or {}).get('rakuten', '')
    # キーワードを更新 + URLを再生成
    d['hotelSearch'] = kw
    d['hotelLinks'] = {
        'rakuten': build_rakuten_url(kw),
        'jalan': build_jalan_url(kw),
    }
    changes.append((d['name'], did, kw))

DEST_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), 'utf-8')

print('='*70)
print('【宿リンクを近隣町に修正】')
print('='*70)
for name, did, kw in changes:
    print(f'  {name:18} ({did:25}) → {kw}')
print(f'\n  修正: {len(changes)} 件')

if not_found:
    print('\n【ID未発見】')
    for nf in not_found:
        print(f'  - {nf}')

print('\n✅ destinations.json 更新完了')
