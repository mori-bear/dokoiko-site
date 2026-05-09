#!/usr/bin/env python3
"""
fixDaytripContradictions.py
非離島のdaytrip矛盾45件を修正:
- stayAllowedにdaytripがあるが全都市travelTime > 120 の destinations を修正
- 実移動時間に基づきtravelTime値を修正 or 近傍hub都市のキーを追加
- どう頑張っても120分以内にならないものはdaytripを削除
"""
import json
from pathlib import Path

DEST_FILE = Path(__file__).parent.parent / 'src/data/destinations.json'
data = json.loads(DEST_FILE.read_text('utf-8'))

# ════════════════════════════════════════════════════
# A: 既存travelTime値の修正 (dest_id, city, old, new, reason)
# ════════════════════════════════════════════════════
TT_FIXES = [
    # 日光: 東京→日光 東武特急スペーシア110分+アクセス5分 = 115分
    ('nikko',       'tokyo',       125, 115, '東武特急スペーシア 浅草→東武日光110分+アクセス5分'),
    # 阿蘇: 博多→熊本新幹線33分+熊本→阿蘇特急62分 = 95分
    ('aso',         'fukuoka',     130,  95, '博多→熊本新幹線33分+熊本→阿蘇特急くまがわ62分'),
    # 人吉: 博多→熊本33分+熊本→人吉特急くまがわ55分+アクセス12分 = 100分
    ('hitoyoshi',   'fukuoka',     150, 100, '博多→熊本新幹線33分+熊本→人吉特急55分+アクセス12分'),
    # 奈良井宿: 名古屋→奈良井 特急しなの65分+アクセス10分 = 75分
    ('narai-juku',  'nagoya',      125,  75, '名古屋→奈良井 特急しなの65分+アクセス10分'),
    # 桜島: 博多→鹿児島中央新幹線75分+桜島フェリー15分 = 90分
    ('sakurajima',  'fukuoka',     150,  90, '博多→鹿児島中央新幹線75分+桜島フェリー15分'),
    # 三方五湖: 大阪→敦賀新快速85分+敦賀→三方小浜線25分+アクセス10分 = 120分
    ('mikatagoko',  'osaka',       140, 120, '大阪→敦賀新快速85分+敦賀→三方小浜線25分+アクセス10分'),
    # 美瑛: 札幌→旭川特急80分+旭川→美瑛JR15分+アクセス20分 = 115分
    ('biei',        'sapporo',     140, 115, '札幌→旭川特急80分+旭川→美瑛JR15分+アクセス20分'),
    # 益子: 東京→宇都宮新幹線50分+宇都宮→益子バス60分 = 110分
    ('mashiko',     'tokyo',       160, 110, '東京→宇都宮新幹線50分+宇都宮→益子バス60分'),
    # 足利: 東京→桐生 特急りょうもう90分+桐生→足利10分 = 100分
    ('ashikaga',    'tokyo',       150, 100, '東京→桐生 特急りょうもう90分+桐生→足利10分'),
    # 波佐見: 博多→佐世保特急みどり80分+波佐見バス25分 = 105分
    ('hasami',      'fukuoka',     145, 105, '博多→佐世保特急みどり80分+佐世保→波佐見バス25分'),
    # 青島: 博多→宮崎空港飛行機45分+宮崎→青島バス30分+アクセス35分 = 110分
    ('aoshima',     'fukuoka',     145, 110, '博多→宮崎空港ANA45分+宮崎→青島バス30分+市内アクセス35分'),
    # 出雲: 鳥取→米子特急55分+米子→出雲市特急45分+アクセス15分 = 115分
    ('izumo',       'tottori',     385, 115, '鳥取→米子特急55分+米子→出雲市特急45分+アクセス15分'),
    # 白兎: 鳥取→白兎海岸 バス25分 (鳥取から車で25分)
    ('hakuto',      'tottori',     300,  25, '鳥取駅→白兎海岸 路線バス25分'),
    # 西条（愛媛）: 高松→西条 特急しおかぜ55分+アクセス5分 = 60分
    ('saijo',       'takamatsu',   250,  60, '高松→西条 特急しおかぜ55分+アクセス5分'),
    # 臼杵: 大分→臼杵 JR15分+アクセス30分 = 45分
    ('usuki',       'oita',        220,  45, '大分→臼杵 JR日豊本線15分+アクセス30分'),
    # 杵築: 大分→杵築 JR40分+アクセス10分 = 50分
    ('kitsuki',     'oita',        220,  50, '大分→杵築 JR日豊本線40分+アクセス10分'),
    # 昇仙峡: 甲府→昇仙峡 バス40分 = 40分
    ('shosenkyo',   'kofu',        220,  40, '甲府駅→昇仙峡 路線バス40分'),
    # 身延山: 甲府→身延 身延線50分+アクセス5分 = 55分
    ('minobu',      'kofu',        240,  55, '甲府→身延 身延線50分+アクセス5分'),
    # 境港: 鳥取→境港 JR境線45分 = 45分
    ('sakaiminato', 'tottori',     295,  45, '鳥取→境港 JR境線45分'),
]

# ════════════════════════════════════════════════════
# B: 新キー追加 (dest_id, city, value, reason)
# ════════════════════════════════════════════════════
TT_ADDS = [
    # 平泉: 仙台→一ノ関新幹線25分+JR5分+平泉アクセス15分 = 45分
    ('hiraizumi',  'sendai',  45, '仙台→一ノ関新幹線25分+JR平泉駅5分+中尊寺アクセス15分'),
    # 花巻: 仙台→花巻 新幹線はやぶさ30分+アクセス20分 = 50分
    ('hanamaki',   'sendai',  50, '仙台→花巻 東北新幹線30分+アクセス20分'),
    # 北上: 仙台→北上 新幹線30分+アクセス30分 = 60分
    ('kitakami',   'sendai',  60, '仙台→北上 東北新幹線30分+アクセス30分'),
    # 山寺: 山形→山寺 仙山線15分+アクセス20分 = 35分
    ('yamadera',  'yamagata', 35, '山形→山寺 仙山線15分+アクセス20分'),
    # 岩国: 広島→岩国 JR新幹線+在来線24分+アクセス11分 = 35分
    ('iwakuni',   'hiroshima', 35, '広島→岩国 JR24分+アクセス11分'),
    # 津和野: 広島→新山口新幹線25分+スーパーおき津和野50分+アクセス15分 = 90分
    ('tsuwano',   'hiroshima', 90, '広島→新山口新幹線25分+スーパーおき津和野50分+アクセス15分'),
    # 柳井: 広島→柳井 JR山陽本線80分+アクセス10分 = 90分
    ('yanai',     'hiroshima', 90, '広島→柳井 JR山陽本線80分+アクセス10分'),
]

# ════════════════════════════════════════════════════
# C: stayAllowedからdaytripを削除 (どう頑張っても120分超)
# ════════════════════════════════════════════════════
DAYTRIP_REMOVES = [
    ('miyako-iwate',   '全都市min=240分、三陸遠隔地'),
    ('tateyama-kurobe','全都市min=210分、立山は黒部峡谷経由で遠い'),
    ('himi',           '全都市min=200分、氷見はどこからも遠い'),
    ('muroto',         '全都市min=215分、室戸岬は高知からも車で2時間'),
    ('obi',            '全都市min=330分、飫肥は宮崎から特急+バスで遠い'),
    ('kamikochi',      '全都市min=150分、上高地は最短でも名古屋→松本→バスで150分超'),
    ('gokayama',       '全都市min=160分、五箇山は最寄り駅からバス70分'),
    ('eiheiji',        '大阪min=210分、大阪→福井特急100分+永平寺バス30分=130分超'),
    ('echizen-kaigan', '大阪min=145分、大阪→敦賀新快速85分+越前海岸バス45分=130分超'),
    ('iwami-ginzan',   '全都市min=230分、石見銀山は広島からも特急3時間'),
    ('misaki-kochi',   '全都市min=200分、足摺岬は高知からも車で2時間'),
    ('shishikui',      '高松min=150分、宍喰は高松から特急+牟岐線で150分'),
    ('ikoma-kogen',    '全都市min=160分、生駒高原は宮崎県の山中'),
    ('chiran',         '福岡min=155分、知覧は博多→鹿児島75分+バス50分=125分超'),
    ('tonami',         '全都市min=180分、砺波は北陸新幹線なく遠い'),
    ('misumi-shimane', '全都市min=200分、三隅島根は山陰の僻地'),
    ('daisetsuzan',    '札幌min=130分、大雪山は札幌→旭川80分+バス50分=130分超'),
]

# ════════════════════════════════════════════════════
# D: stayAllowed全体を変更 (daytripのみだったが全て>120のため1nightに変更)
# ════════════════════════════════════════════════════
STAY_REPLACEMENTS = [
    # 下灘駅: 高松min=130分、daytrip不可 → 1night
    ('shimonada', ['1night'], '高松min=130分>120、愛媛の秘境駅は日帰り不可'),
    # 仁摩: 広島min=175分、daytrip不可 → 1night
    ('nima',      ['1night'], '広島min=175分>120、砂の丘は島根の僻地'),
]

# ════════════════════════════════════════════════════
# 実行
# ════════════════════════════════════════════════════

fix_changes = []
for dest_id, city, old_val, new_val, reason in TT_FIXES:
    dest = next((d for d in data if d['id'] == dest_id), None)
    if not dest:
        print(f'⚠️  ID未発見: {dest_id}')
        continue
    tt = dest.get('travelTime', {})
    cur = tt.get(city)
    if cur is None:
        print(f'⚠️  {dest["name"]} {city}: キーなし')
        continue
    if cur != old_val:
        print(f'⚠️  {dest["name"]} {city}: 期待={old_val}, 実際={cur} → 強制{new_val}に修正')
    tt[city] = new_val
    fix_changes.append((dest['name'], city, cur, new_val, reason))

add_changes = []
for dest_id, city, val, reason in TT_ADDS:
    dest = next((d for d in data if d['id'] == dest_id), None)
    if not dest:
        print(f'⚠️  ID未発見: {dest_id}')
        continue
    tt = dest.setdefault('travelTime', {})
    if city in tt:
        print(f'  ✓ {dest["name"]}: {city}={tt[city]} 既存値あり → {val}に更新')
        old = tt[city]
        tt[city] = val
        add_changes.append((dest['name'], city, f'{old}→{val}', reason))
    else:
        tt[city] = val
        add_changes.append((dest['name'], city, f'追加{val}', reason))

remove_changes = []
for dest_id, reason in DAYTRIP_REMOVES:
    dest = next((d for d in data if d['id'] == dest_id), None)
    if not dest:
        print(f'⚠️  ID未発見: {dest_id}')
        continue
    old_stay = dest.get('stayAllowed', [])
    if 'daytrip' not in old_stay:
        print(f'  ✓ {dest["name"]}: daytrip既に無し')
        continue
    new_stay = [s for s in old_stay if s != 'daytrip']
    if not new_stay:
        new_stay = ['1night']
    dest['stayAllowed'] = new_stay
    remove_changes.append((dest['name'], old_stay, new_stay, reason))

replace_changes = []
for dest_id, new_stay, reason in STAY_REPLACEMENTS:
    dest = next((d for d in data if d['id'] == dest_id), None)
    if not dest:
        print(f'⚠️  ID未発見: {dest_id}')
        continue
    old_stay = dest.get('stayAllowed', [])
    dest['stayAllowed'] = new_stay
    replace_changes.append((dest['name'], old_stay, new_stay, reason))

# 保存
DEST_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), 'utf-8')

# ════ レポート ════
print('\n' + '='*65)
print('【A: travelTime値修正】')
print('='*65)
for name, city, old, new, reason in fix_changes:
    print(f'  {name} / {city}: {old}分 → {new}分')
    print(f'    {reason}')
print(f'\n  合計: {len(fix_changes)} 件')

print('\n' + '='*65)
print('【B: hub都市travelTimeキー追加/修正】')
print('='*65)
for name, city, val_str, reason in add_changes:
    print(f'  {name} / {city}: {val_str}分')
    print(f'    {reason}')
print(f'\n  合計: {len(add_changes)} 件')

print('\n' + '='*65)
print('【C: stayAllowedからdaytrip削除】')
print('='*65)
for name, old, new, reason in remove_changes:
    print(f'  {name}: {old} → {new}')
    print(f'    {reason}')
print(f'\n  合計: {len(remove_changes)} 件')

print('\n' + '='*65)
print('【D: stayAllowed全体変更】')
print('='*65)
for name, old, new, reason in replace_changes:
    print(f'  {name}: {old} → {new}')
    print(f'    {reason}')
print(f'\n  合計: {len(replace_changes)} 件')

total = len(fix_changes) + len(add_changes) + len(remove_changes) + len(replace_changes)
print(f'\n✅ destinations.json 更新完了 (総修正: {total} 件)')
