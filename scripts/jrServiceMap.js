/**
 * jrServiceMap.js
 *
 * JR各社ネット予約サービスの対応エリアデータベース。
 * 出発県×目的地県 → 推奨サービスID の判定関数を提供。
 *
 * ── 調査ソース (2026-05 / Wikipedia + 各社公式) ──
 *  - えきねっと (JR東日本): JR東日本管内 / 北海道新幹線 / 北陸新幹線(全区間)
 *    山形・秋田新幹線も対応。JR北海道は 2017-01-31 に自社サービス終了し
 *    えきねっとへ一本化。
 *  - e5489 (JR西日本): 山陽新幹線 / 北陸新幹線(上越妙高-敦賀) /
 *    九州新幹線(2022.6.25-) / 西九州新幹線 / JR四国・JR九州在来線特急
 *  - スマートEX/EX予約 (JR東海+西+九州): 東海道・山陽・九州新幹線
 *    (東京-鹿児島中央)。北陸新幹線・西九州新幹線・在来線特急は対象外
 *  - JR九州インターネット列車予約: 九州新幹線 / 西九州新幹線 /
 *    山陽新幹線(新大阪-博多) / 東海道新幹線 / JR九州・JR西日本在来線特急
 *    (北陸新幹線・博多南線除く)
 *  - JR北海道: 2017年にえきねっと統合。独自サービスは終了。
 */

// ===== 都道府県 → 主管JR会社 =====
export const PREF_TO_COMPANY = {
  '北海道':   'hokkaido',
  '青森県':   'east', '岩手県': 'east', '宮城県': 'east', '秋田県': 'east', '山形県': 'east', '福島県': 'east',
  '茨城県':   'east', '栃木県': 'east', '群馬県': 'east', '埼玉県': 'east', '千葉県': 'east',
  '東京都':   'east', '神奈川県': 'east', '新潟県': 'east',
  '富山県':   'west', '石川県': 'west', '福井県': 'west',  // 北陸エリア(JR西日本)
  '山梨県':   'east',  // JR東日本 中央本線
  '長野県':   'east',  // 主に東日本
  '岐阜県':   'central', '静岡県': 'central', '愛知県': 'central', '三重県': 'central',  // JR東海
  '滋賀県':   'west', '京都府': 'west', '大阪府': 'west', '兵庫県': 'west',
  '奈良県':   'west', '和歌山県': 'west',
  '鳥取県':   'west', '島根県': 'west', '岡山県': 'west', '広島県': 'west', '山口県': 'west',
  '徳島県':   'shikoku', '香川県': 'shikoku', '愛媛県': 'shikoku', '高知県': 'shikoku',
  '福岡県':   'kyushu', '佐賀県': 'kyushu', '長崎県': 'kyushu', '熊本県': 'kyushu',
  '大分県':   'kyushu', '宮崎県': 'kyushu', '鹿児島県': 'kyushu',
  '沖縄県':   'okinawa',
};

// ===== 各予約サービスの対応会社 =====
export const SERVICE_COVERAGE = {
  ekinet:     ['east', 'hokkaido'],
  e5489:      ['west', 'shikoku', 'kyushu'],
  smartex:    ['central', 'west', 'kyushu'],  // 東海道-山陽-九州新幹線
  jrkyushu:   ['kyushu', 'west', 'central'],  // 九州+山陽+東海道
};

export const SERVICE_URL = {
  ekinet:   'https://www.eki-net.com/personal/wb/menu/00100.aspx',
  e5489:    'https://www.jr-odekake.net/goyoyaku/e5489/',
  smartex:  'https://smart-ex.jp/',
  jrkyushu: 'https://train.yoyaku.jrkyushu.co.jp/',
  midori:   'https://www.jr.cyber-station.ne.jp/',
};

export const SERVICE_LABEL = {
  ekinet:   'えきねっと',
  e5489:    'e5489',
  smartex:  'スマートEX',
  jrkyushu: 'JR九州ネット予約',
  midori:   'みどりの窓口',
};

/**
 * 出発県・目的地県から推奨予約サービスを判定
 * @returns {string} サービスID ('ekinet'|'e5489'|'smartex'|'jrkyushu'|'midori'|'air')
 */
export function pickJRService(origPref, destPref) {
  const o = PREF_TO_COMPANY[origPref];
  const d = PREF_TO_COMPANY[destPref];

  if (o === 'okinawa' || d === 'okinawa') return 'air';
  if (!o || !d) return 'midori';

  // ── 同一会社内 ──
  if (o === d) {
    if (o === 'east' || o === 'hokkaido') return 'ekinet';  // JR北海道は2017年統合済
    if (o === 'central')                   return 'smartex';  // 東海道新幹線中心
    if (o === 'west' || o === 'shikoku')   return 'e5489';
    if (o === 'kyushu')                    return 'jrkyushu';
  }

  const pair = [o, d].sort().join('-');

  // ── 北海道がらみ (東日本以外) ──
  // 北海道-東日本: 北海道新幹線 → ekinet
  if (pair === 'east-hokkaido')    return 'ekinet';
  // 北海道-中部/西: 東京経由でえきねっと一括予約可
  if (pair === 'central-hokkaido') return 'ekinet';
  if (pair === 'hokkaido-west')    return 'ekinet';
  // 北海道-四国/九州: 直通新幹線なし → みどりの窓口で複数会社券
  if (pair === 'hokkaido-shikoku') return 'midori';
  if (pair === 'hokkaido-kyushu')  return 'midori';

  // ── 九州がらみ ──
  if (o === 'kyushu' || d === 'kyushu') {
    // 九州-西日本(山陽新幹線): 出発側に応じて
    if (pair === 'kyushu-west')      return o === 'kyushu' ? 'jrkyushu' : 'e5489';
    // 九州-中部/東日本(東海道-山陽-九州新幹線通し)
    if (pair === 'central-kyushu')   return 'smartex';
    if (pair === 'east-kyushu')      return 'smartex';
    // 九州-四国: 山陽経由 (e5489)
    if (pair === 'kyushu-shikoku')   return 'e5489';
  }

  // ── 東海道・山陽新幹線 (本州内) ──
  if (pair === 'east-west')    return 'smartex';
  if (pair === 'central-east') return 'smartex';
  if (pair === 'central-west') return 'smartex';

  // ── 四国がらみ (本州側) ──
  if (o === 'shikoku' || d === 'shikoku') {
    if (pair === 'shikoku-west')    return 'e5489';
    if (pair === 'central-shikoku') return 'smartex';
    if (pair === 'east-shikoku')    return 'smartex';
  }

  return 'midori';
}

export function jrServiceUrl(service) {
  return SERVICE_URL[service] || SERVICE_URL.midori;
}
export function jrServiceLabel(service) {
  return SERVICE_LABEL[service] || 'みどりの窓口';
}

export const VALID_PROVIDERS = ['e5489', 'ekinet', 'east', 'kyushu', 'jrkyushu', 'central', 'hokkaido', 'west', 'shikoku'];
