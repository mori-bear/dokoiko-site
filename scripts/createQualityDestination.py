#!/usr/bin/env python3
"""
createQualityDestination.py
高品質destinationを作成するテンプレート・ユーティリティ。

【高品質パターン分析（30件平均値より）】
- description: 50〜80字、文学的トーン、句読点2つ以上
- spots: 3〜4件、各spotに20〜60字の説明
- tags: 4〜6個（地理・自然・歴史・グルメ・季節など多様性）
- reasonChips: 3個推奨（用途別の助言）
- 画像: Unsplash + 各spotにWikipedia Commons画像

【使い方】
1. このファイル内の DEST_TEMPLATE を編集
2. python3 scripts/createQualityDestination.py で実行
3. Wikipedia/Unsplash画像が自動取得され destinations.json に追加
"""

import json
import urllib.request
import urllib.parse
import time
from pathlib import Path

DEST_FILE = Path(__file__).parent.parent / 'src/data/destinations.json'
ENV_FILE = Path(__file__).parent.parent / '.env'
JALAN_AFF = 'https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=3764408&pid=892559858&vc_url='
RAKUTEN_AFF = 'https://hb.afl.rakuten.co.jp/hgc/5113ee4b.8662cfc5.5113ee4c.119de89a/'

# ════════════════════════════════════════════════════
# 編集対象: 新規destination定義
# ════════════════════════════════════════════════════
DEST_TEMPLATE = {
    'id': 'matsuyama',
    'name': '松山',
    'prefecture': '愛媛県',
    'region': '四国',
    'hub': '松山',  # hubCities.jsonに同名hubがあれば自動連携
    # description: 50〜80字、別府風の文学的トーン
    # 「。」を2つ以上、終わり方は「そんな街」「時間がここにある」「光景」など
    'description': '道後の湯気が朝の路地をぼかし、坂の上にゆらりと雲の影。3000年の湯と現存天守の城下町を、路面電車が一日かけて結ぶ、そんな街。',
    'tags': ['温泉', '歴史', '城', '街歩き'],  # 4〜6個
    'reasonChips': ['温泉がおすすめ', '城下町散策', 'ひとり旅向け'],  # 3個推奨
    'stayAllowed': ['1night', '2night'],
    'lat': 33.846,
    'lng': 132.766,
    'hotelKeyword': '道後温泉',  # hotelLinks生成キーワード
    'destType': 'city',
    'isIsland': False,
    'rentalCarRecommended': False,
    # spots: 3〜4件、各 description 20〜60字
    'spots': [
        {
            'name': '道後温泉本館',
            'description': '日本最古とされる温泉。明治27年築の木造楼閣建築は国の重要文化財、夏目漱石「坊っちゃん」ゆかりの湯。',
            'wikiQuery': '道後温泉本館',  # Wikipedia検索用
        },
        {
            'name': '松山城',
            'description': '標高132mの勝山に建つ現存12天守の一つ。ロープウェイ・リフトで気軽に登城でき、瀬戸内海と市街を一望。',
            'wikiQuery': '松山城',
        },
        {
            'name': '坂の上の雲ミュージアム',
            'description': '司馬遼太郎の同名小説を軸に明治期の松山と日本近代化を辿る博物館。建築は安藤忠雄設計の三角形。',
            'wikiQuery': '坂の上の雲ミュージアム',
        },
        {
            'name': '大街道商店街',
            'description': '路面電車の通る松山市中心のアーケード商店街。鯛めし・坊っちゃん団子・じゃこ天など愛媛グルメも揃う。',
            'wikiQuery': '大街道商店街',
        },
    ],
    # travelTime: 各hubCityからの分（実態に近い値、JR四国/航空時刻表で確認）
    'travelTime': {
        'tokyo': 180,     # 羽田→松山空港 飛行機+空港アクセス両端
        'osaka': 130,     # 伊丹→松山空港
        'nagoya': 135,    # 中部→松山空港
        'fukuoka': 160,   # 福岡空港→松山空港
        'sapporo': 280,   # 経由便
        'sendai': 240,
        'hiroshima': 100, # 広島港→松山港 スーパージェット高速船
        'takamatsu': 165, # 特急いしづち
        'naha': 320,
        'kanazawa': 270,
        'shimonoseki': 145,
        'kitakyushu': 155,
        'oita': 240,
        'beppu': 240,
    },
    # ゲートウェイ駅/空港/港
    'gateways': {
        'rail': ['松山駅'],
        'airport': ['松山空港'],
        'bus': [],
        'ferry': ['松山観光港'],
    },
}

# ════════════════════════════════════════════════════
# ヘルパー
# ════════════════════════════════════════════════════
def jalan_url(kw):
    b = kw.encode('shift_jis')
    p = ''.join(f'%{x:02X}' for x in b)
    return JALAN_AFF + urllib.parse.quote(f'https://www.jalan.net/uw/uwp2011/uww2011init.do?keyword={p}', safe='')

def rakuten_url(kw):
    return f'{RAKUTEN_AFF}?pc={urllib.parse.quote(f"https://travel.rakuten.co.jp/yado/japan.html?f_query={urllib.parse.quote(kw)}")}'

def load_unsplash_key():
    if not ENV_FILE.exists(): return None
    for line in ENV_FILE.read_text().splitlines():
        if line.startswith('UNSPLASH_ACCESS_KEY='):
            return line.split('=', 1)[1].strip()
    return None

def fetch_wikipedia_image(query):
    url = f'https://ja.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&piprop=thumbnail&pithumbsize=400&generator=search&gsrsearch={urllib.parse.quote(query)}&gsrlimit=1&origin=*'
    req = urllib.request.Request(url, headers={'User-Agent': 'dokoiko/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            j = json.loads(r.read().decode('utf-8'))
            pages = j.get('query', {}).get('pages')
            if not pages: return None, None
            page = list(pages.values())[0]
            return page.get('title'), page.get('thumbnail', {}).get('source')
    except Exception:
        return None, None

def fetch_unsplash_image(query, access_key):
    url = f'https://api.unsplash.com/search/photos?query={urllib.parse.quote(query)}&per_page=1&orientation=landscape'
    req = urllib.request.Request(url, headers={'Authorization': f'Client-ID {access_key}'})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            j = json.loads(r.read().decode('utf-8'))
            photo = (j.get('results') or [None])[0]
            if photo:
                return {
                    'unsplashUrl': photo['urls']['regular'],
                    'unsplashThumbUrl': photo['urls']['small'],
                    'unsplashCredit': photo['user']['name'],
                    'unsplashCreditUrl': f'{photo["user"]["links"]["html"]}?utm_source=dokoiko&utm_medium=referral',
                    'unsplashPhotoUrl': f'{photo["links"]["html"]}?utm_source=dokoiko&utm_medium=referral',
                }
    except Exception:
        pass
    return None

# ════════════════════════════════════════════════════
# 検証ヘルパー
# ════════════════════════════════════════════════════
def validate(t):
    issues = []
    L = len(t['description'])
    if not (40 <= L <= 100): issues.append(f'description字数 {L} (推奨50〜80)')
    if t['description'].count('。') < 2: issues.append('description句読点が少ない（2つ以上推奨）')
    if not (3 <= len(t['spots']) <= 5): issues.append(f'spots数 {len(t["spots"])} (推奨3〜4)')
    for s in t['spots']:
        if 'description' not in s: issues.append(f'spot "{s["name"]}" に description なし')
        elif not (15 <= len(s['description']) <= 70): issues.append(f'spot "{s["name"]}" 説明 {len(s["description"])}字')
    if not (4 <= len(t['tags']) <= 6): issues.append(f'tags数 {len(t["tags"])} (推奨4〜6)')
    if not t.get('reasonChips'): issues.append('reasonChips 未設定')
    return issues

# ════════════════════════════════════════════════════
# 実行
# ════════════════════════════════════════════════════
def main():
    t = DEST_TEMPLATE

    # 検証
    issues = validate(t)
    if issues:
        print('⚠️  検証警告:')
        for i in issues:
            print(f'  - {i}')
    else:
        print('✅ 検証OK')

    # 画像取得
    print('\n🖼️  Wikipedia画像取得...')
    for s in t['spots']:
        title, img = fetch_wikipedia_image(s.get('wikiQuery', s['name']))
        if img:
            s['imageUrl'] = img
            print(f'  ✓ {s["name"]} (Wikipedia "{title}")')
        else:
            print(f'  ✗ {s["name"]}: 未取得')
        s.pop('wikiQuery', None)
        time.sleep(0.5)

    print('\n📸 Unsplash画像取得...')
    key = load_unsplash_key()
    if key:
        u = fetch_unsplash_image(f'{t["name"]} {t["hotelKeyword"]}', key)
        if u:
            t.update(u)
            print(f'  ✓ {t["name"]} → {u["unsplashUrl"][:70]}')
        else:
            print(f'  ✗ {t["name"]}: 未取得')

    # destinations.json に追加/更新
    data = json.loads(DEST_FILE.read_text('utf-8'))
    data = [x for x in data if x['id'] != t['id']]  # 既存削除
    kw = t.pop('hotelKeyword')
    new_dest = {
        'id': t['id'],
        'name': t['name'],
        'type': 'destination',
        'region': t['region'],
        'prefecture': t['prefecture'],
        'hub': t['hub'],
        'hubName': t['hub'],
        'hubCity': t['hub'],
        'stayAllowed': t['stayAllowed'],
        'departures': [t['hub']],
        'weight': 1.5,
        'description': t['description'],
        'tags': t['tags'],
        'reasonChips': t['reasonChips'],
        'spots': t['spots'],
        'shinkansenAccess': False,
        'requiresCar': t.get('requiresCar', False),
        'isIsland': t['isIsland'],
        'destType': t['destType'],
        'hotelSearch': kw,
        'lat': t['lat'],
        'lng': t['lng'],
        'travelTime': t['travelTime'],
        'stayRecommendation': t['stayAllowed'][0],
        'gateways': t['gateways'],
        'hotelLinks': {
            'rakuten': rakuten_url(kw),
            'jalan': jalan_url(kw),
        },
        'rentalCarRecommended': t['rentalCarRecommended'],
    }
    # 画像フィールドを引き継ぎ
    for k in ['unsplashUrl','unsplashThumbUrl','unsplashCredit','unsplashCreditUrl','unsplashPhotoUrl']:
        if k in t: new_dest[k] = t[k]

    data.append(new_dest)
    DEST_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    print(f'\n✅ {t["name"]} を destinations.json に追加 (合計 {len(data)} 件)')

if __name__ == '__main__':
    main()
