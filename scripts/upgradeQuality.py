#!/usr/bin/env python3
"""
upgradeQuality.py
全1501件のdestinationを島旅女レベルに高品質化。
- description: 100字 → 200〜300字に拡張（記事JSONのlead+本文活用）
- spots: 説明を30〜60字以上に拡張（記事sectionsから抽出）
- reasonChips: 最低1個（tags + stayAllowedから自動生成）
- 50件ごとに進捗表示
"""
import json
import re
import os
from pathlib import Path

ROOT = Path(__file__).parent.parent
DEST_FILE = ROOT / 'src/data/destinations.json'
ART_DIR = ROOT / 'src/data/articles'

data = json.loads(DEST_FILE.read_text('utf-8'))

# 記事マップ
articles = {}
if ART_DIR.exists():
    for f in ART_DIR.glob('*.json'):
        try:
            articles[f.stem] = json.loads(f.read_text('utf-8'))
        except Exception:
            pass

# === reasonChips 自動生成ロジック ===
TAG_TO_CHIP = {
    '離島': '離島の絶景',
    '温泉': '温泉がおすすめ',
    '絶景': '絶景スポット',
    '世界遺産': '世界遺産あり',
    '寺社': '寺社めぐり',
    '城': '城下町散策',
    '街歩き': '街歩き向け',
    '歴史': '歴史を辿る',
    '海': '海を眺める',
    '山': '山岳ハイキング',
    '湖': '湖畔のんびり',
    '滝': '滝の絶景',
    '紅葉': '秋の紅葉名所',
    '桜': '春の桜名所',
    '雪': '雪景色が楽しめる',
    '高原': '高原リゾート',
    '秘境': '秘境感あり',
    'アート': 'アートの島',
    '伝統': '伝統工芸の里',
    '神話': '神話のふるさと',
    'グルメ': 'グルメ目当て',
    'リゾート': 'リゾート気分',
    '夜景': '夜景の名所',
    '美肌': '美肌の湯',
    '子連れ': '家族で楽しめる',
    'スキー': 'スキー楽しめる',
    'サイクリング': 'サイクリング向け',
    '川': '川と渓谷',
    '花': '花の名所',
    '酒': '酒蔵巡り',
    '茶': 'お茶どころ',
    '博物館': '博物館・美術館',
    '建築': '建築の名作',
    '映画': 'ロケ地巡り',
    'パワースポット': 'パワースポット',
    'キャンプ': 'キャンプ向け',
    '夕日': '夕日が美しい',
    '祭': '祭りで賑わう',
    '動物': '動物と触れあえる',
    '体験': '体験が楽しい',
    '路面電車': '路面電車の街',
    '宿坊': '宿坊体験',
}

def gen_chips(tags, stay):
    chips = []
    for t in tags or []:
        if t in TAG_TO_CHIP and TAG_TO_CHIP[t] not in chips:
            chips.append(TAG_TO_CHIP[t])
            if len(chips) >= 3:
                break
    # stayから補完
    if 'daytrip' in stay and len(chips) < 3:
        if '日帰り最適' not in chips: chips.append('日帰り最適')
    if '1night' in stay and 'daytrip' not in stay and len(chips) < 3:
        if '1泊がおすすめ' not in chips: chips.append('1泊がおすすめ')
    if any(s in stay for s in ['2night','3night+']) and len(chips) < 3:
        if 'ゆっくり滞在' not in chips: chips.append('ゆっくり滞在')
    if not chips:
        chips = ['ひとり旅向け']
    return chips[:3]

def expand_description(d, article):
    """記事ありなら lead + 本文要点を200〜300字に集約、なしなら現状維持"""
    cur = d.get('description', '')
    if not article:
        return cur  # 記事なしは現状維持（後の手動拡張対象）
    lead = (article.get('lead') or '').strip()
    if not lead:
        return cur
    # 1行ずつクリーン
    lines = [l.strip() for l in lead.split('\n') if l.strip()]
    body = ''.join(lines)
    # 既存descriptionが文学的ならlead前置きで結合
    if len(cur) >= 50 and cur not in body:
        merged = body + cur
    else:
        merged = body
    # 200〜300字に整える
    merged = re.sub(r'\s+', '', merged)
    if len(merged) < 200:
        # tipsからも引用
        tips = (article.get('tips') or '')
        if isinstance(tips, list): tips = '\n'.join(tips)
        tips_clean = re.sub(r'\s+', '', tips)
        merged = merged + tips_clean
    if len(merged) > 320:
        merged = merged[:300]
        if not merged.endswith('。'):
            last_period = merged.rfind('。')
            if last_period > 200:
                merged = merged[:last_period + 1]
    return merged

def upgrade_spots(d, article):
    """spotsのdescriptionを記事sectionsから補完"""
    spots = d.get('spots', [])
    if not article or not spots:
        return spots
    sections = article.get('sections') or []
    # spot name → section title マッピング
    name_to_section = {}
    for s in sections:
        title = s.get('title') or ''
        # 「鎌倉大仏｜...」のように｜で区切られたら前半
        base = title.split('｜')[0].split('|')[0].strip()
        if base:
            name_to_section[base] = s
    for sp in spots:
        if not isinstance(sp, dict): continue
        if sp.get('description'): continue
        name = sp.get('name', '')
        sec = name_to_section.get(name)
        if not sec:
            # 部分一致探索
            for base, s in name_to_section.items():
                if base in name or name in base:
                    sec = s
                    break
        if sec:
            body = (sec.get('body') or '').strip()
            # 改行除去、最初の文を抽出
            body_clean = re.sub(r'\s+', '', body)
            # 30〜70字に整える
            if len(body_clean) > 70:
                # 最初の「。」までで切る
                p1 = body_clean.find('。')
                if 20 <= p1 <= 80:
                    body_clean = body_clean[:p1+1]
                else:
                    body_clean = body_clean[:60] + '...'
            sp['description'] = body_clean
    return spots

# === メイン処理 ===
total = len(data)
upgraded_desc = 0
upgraded_spots = 0
added_chips = 0

for i, d in enumerate(data):
    article = articles.get(d['id'])
    # description拡張
    new_desc = expand_description(d, article)
    if new_desc and new_desc != d.get('description') and len(new_desc) >= 150:
        d['description'] = new_desc
        upgraded_desc += 1
    # spots拡張
    if upgrade_spots(d, article) is not None:
        upgraded_spots_in_d = sum(1 for s in d.get('spots',[]) if isinstance(s, dict) and s.get('description'))
        if upgraded_spots_in_d > 0:
            upgraded_spots += 1 if d.get('id') in articles else 0
    # reasonChips
    if not d.get('reasonChips'):
        d['reasonChips'] = gen_chips(d.get('tags', []), d.get('stayAllowed', []))
        added_chips += 1
    # 進捗
    if (i + 1) % 50 == 0:
        print(f'  {i+1}/{total} 完了')

DEST_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), 'utf-8')

# 結果集計
desc_lens = [len(d.get('description','')) for d in data]
short = sum(1 for L in desc_lens if L < 100)
mid = sum(1 for L in desc_lens if 100 <= L < 200)
long_d = sum(1 for L in desc_lens if L >= 200)

print('\n' + '='*60)
print('全件高品質化完了')
print('='*60)
print(f'  description拡張: {upgraded_desc}件')
print(f'  spots詳細化: {upgraded_spots}件')
print(f'  reasonChips追加: {added_chips}件')
print()
print(f'description字数分布:')
print(f'  100字未満: {short}件')
print(f'  100-200字: {mid}件')
print(f'  200字以上: {long_d}件')

# spots総覧
total_spots = 0
spots_with_desc = 0
for d in data:
    for s in d.get('spots', []):
        if isinstance(s, dict):
            total_spots += 1
            if s.get('description'): spots_with_desc += 1
print(f'\nspots: 説明あり{spots_with_desc}/{total_spots}件 ({spots_with_desc*100/total_spots:.0f}%)')

# reasonChipsカバレッジ
has_chips = sum(1 for d in data if d.get('reasonChips'))
print(f'reasonChips設定: {has_chips}/{total}件 ({has_chips*100/total:.0f}%)')
