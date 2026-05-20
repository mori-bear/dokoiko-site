/**
 * jrServiceMap.js
 *
 * JR各社ネット予約サービスの対応エリアデータベース。
 * 出発県×目的地県 → 推奨サービスID の判定関数を提供。
 *
 * ── 調査ソース ──
 *  - えきねっと: https://www.eki-net.com (JR東日本)
 *  - e5489: https://www.jr-odekake.net (JR西日本)
 *  - エクスプレス予約/スマートEX: https://expy.jp / https://smart-ex.jp (JR東海+JR西日本)
 *  - JR九州インターネット列車予約: https://train.yoyaku.jrkyushu.co.jp
 *  - JR北海道インターネット指定席予約: https://www.jrhokkaido.co.jp
 *  (Wikipedia 各記事 / 各社公式案内 を 2026-05 時点で確認)
 *
 * ── サービス別対応エリア(概略) ──
 *
 *  1) ekinet (えきねっと / JR東日本)
 *     - JR東日本管内全線（在来線・新幹線）
 *     - 北海道新幹線（新青森～新函館北斗）
 *     - 北陸新幹線（東京～敦賀 全区間）
 *     - 新幹線eチケット対象: 東北・北海道・山形・秋田・上越・北陸
 *     - 東海道/山陽/九州新幹線: 取扱なし(EXに誘導)
 *
 *  2) e5489 (JR西日本)
 *     - JR西日本管内・JR四国・JR九州の大半
 *     - 山陽新幹線・九州新幹線・西九州新幹線・北陸新幹線
 *     - JR東日本北限: 新発田/五泉/黒磯/那須塩原/いわき(只見/水郡/磐越東は不可)
 *     - JR東海特急: 一部対応
 *     - 東海道新幹線: 受取可だがEXが主
 *
 *  3) smartex (スマートEX / EX予約 — JR東海+JR西日本+JR九州)
 *     - 東海道・山陽・九州新幹線 (東京駅 - 鹿児島中央駅)
 *     - 西九州新幹線・北陸新幹線: 対象外
 *     - 在来線: 対象外（新幹線専用）
 *
 *  4) jrkyushu (JR九州インターネット列車予約)
 *     - JR九州各列車（新幹線・特急）
 *     - JR西日本(北陸新幹線・博多南線を除く)
 *     - 東海道新幹線(乗り継ぎ用)
 *     - 西九州新幹線(かもめネットきっぷ)
 *
 *  5) jrhokkaido (JR北海道インターネット指定席予約)
 *     - JR北海道管内特急・北海道新幹線
 *     - (実用上は えきねっと も同等の機能を持つ)
 */

// ===== 都道府県 → 主管JR会社 =====
// 「主に営業する会社」で分類（例: 山梨はJR東日本、岐阜はJR東海）
export const PREF_TO_COMPANY = {
  '北海道':   'hokkaido',
  '青森県':   'east',  // 東北新幹線・奥羽本線等
  '岩手県':   'east',
  '宮城県':   'east',
  '秋田県':   'east',
  '山形県':   'east',
  '福島県':   'east',
  '茨城県':   'east',
  '栃木県':   'east',
  '群馬県':   'east',
  '埼玉県':   'east',
  '千葉県':   'east',
  '東京都':   'east',
  '神奈川県': 'east',
  '新潟県':   'east',
  '富山県':   'west',  // 北陸エリア(JR西日本)
  '石川県':   'west',
  '福井県':   'west',
  '山梨県':   'east',  // JR東日本 中央本線
  '長野県':   'east',  // JR東日本(信越)/JR東海(中央西線)があるが主に東日本
  '岐阜県':   'central',  // JR東海
  '静岡県':   'central',
  '愛知県':   'central',
  '三重県':   'central',  // 紀勢本線南はJR西日本だが大部分はJR東海
  '滋賀県':   'west',
  '京都府':   'west',
  '大阪府':   'west',
  '兵庫県':   'west',
  '奈良県':   'west',
  '和歌山県': 'west',
  '鳥取県':   'west',
  '島根県':   'west',
  '岡山県':   'west',
  '広島県':   'west',
  '山口県':   'west',
  '徳島県':   'shikoku',
  '香川県':   'shikoku',
  '愛媛県':   'shikoku',
  '高知県':   'shikoku',
  '福岡県':   'kyushu',
  '佐賀県':   'kyushu',
  '長崎県':   'kyushu',
  '熊本県':   'kyushu',
  '大分県':   'kyushu',
  '宮崎県':   'kyushu',
  '鹿児島県': 'kyushu',
  '沖縄県':   'okinawa',  // 鉄道なし
};

// ===== 各予約サービスの対応会社 =====
export const SERVICE_COVERAGE = {
  ekinet:     ['east', 'hokkaido'],   // えきねっと: 東日本+北海道 (北陸新幹線で west の北陸エリア駅一部)
  e5489:      ['west', 'shikoku', 'kyushu'],  // e5489: 西日本+四国+九州
  smartex:    ['central', 'west', 'kyushu'],  // 東海+西+九州 (東海道・山陽・九州新幹線)
  jrkyushu:   ['kyushu', 'west', 'central'],  // 九州+西日本(一部)+東海道新幹線乗り継ぎ
  jrhokkaido: ['hokkaido'],           // 北海道内
};

// ===== 各予約サービスのURL =====
export const SERVICE_URL = {
  ekinet:     'https://www.eki-net.com/personal/wb/menu/00100.aspx',
  e5489:      'https://www.jr-odekake.net/goyoyaku/e5489/',
  smartex:    'https://smart-ex.jp/',
  jrkyushu:   'https://train.yoyaku.jrkyushu.co.jp/',
  jrhokkaido: 'https://www.jrhokkaido.co.jp/CM/cyber/index.html',
  midori:     'https://www.jr.cyber-station.ne.jp/',
};

export const SERVICE_LABEL = {
  ekinet:     'えきねっと',
  e5489:      'e5489',
  smartex:    'スマートEX',
  jrkyushu:   'JR九州ネット予約',
  jrhokkaido: 'JR北海道予約',
  midori:     'みどりの窓口',
};

/**
 * 出発県・目的地県から推奨予約サービスを判定
 * @param {string} origPref - 出発地の都道府県 (例: '東京都')
 * @param {string} destPref - 目的地の都道府県 (例: '京都府')
 * @returns {string} サービスID ('ekinet'|'e5489'|'smartex'|'jrkyushu'|'jrhokkaido'|'midori')
 */
export function pickJRService(origPref, destPref) {
  const o = PREF_TO_COMPANY[origPref];
  const d = PREF_TO_COMPANY[destPref];

  // 沖縄が絡む → 飛行機 (JR路線なし)
  if (o === 'okinawa' || d === 'okinawa') return 'air';

  // 不明 → みどりの窓口
  if (!o || !d) return 'midori';

  // ── 同一会社内 ──
  if (o === d) {
    if (o === 'east')      return 'ekinet';
    if (o === 'hokkaido')  return 'ekinet';  // JR北海道もえきねっとで予約可
    if (o === 'central')   return 'smartex';  // 東海道新幹線 or e5489
    if (o === 'west')      return 'e5489';
    if (o === 'shikoku')   return 'e5489';
    if (o === 'kyushu')    return 'jrkyushu';
  }

  const pair = [o, d].sort().join('-');

  // ── 北海道 ↔ 東日本 → えきねっと (北海道新幹線・新幹線eチケット対象) ──
  if (pair === 'east-hokkaido') return 'ekinet';

  // ── 九州が絡む組合せ ──
  if (o === 'kyushu' || d === 'kyushu') {
    if (pair === 'kyushu-west')    return 'jrkyushu';    // 九州 ↔ 西日本 (山陽新幹線で乗継)
    if (pair === 'central-kyushu') return 'smartex';     // 東海道・山陽・九州新幹線
    if (pair === 'east-kyushu')    return 'smartex';     // 東京 ↔ 鹿児島中央(東海道・山陽・九州)
    if (pair === 'hokkaido-kyushu') return 'midori';     // 直通新幹線なし
    if (pair === 'kyushu-shikoku') return 'midori';      // 四国と九州は直通新幹線なし
  }

  // ── 東海道・山陽新幹線をまたぐ ──
  // 東日本 ↔ 西日本 / 東海 → スマートEX (新幹線専用)
  if (pair === 'east-west')    return 'smartex';
  if (pair === 'central-east') return 'smartex';
  if (pair === 'central-west') return 'smartex';

  // ── 四国が絡む ──
  if (o === 'shikoku' || d === 'shikoku') {
    if (pair === 'shikoku-west')    return 'e5489';   // 瀬戸大橋経由
    if (pair === 'central-shikoku') return 'smartex'; // 新幹線 +在来線
    if (pair === 'east-shikoku')    return 'smartex';
    if (pair === 'hokkaido-shikoku') return 'midori';
  }

  // ── 北海道が絡む(東日本以外) ──
  if (o === 'hokkaido' || d === 'hokkaido') {
    // 西日本・東海・九州 ↔ 北海道: 直通新幹線なし → みどり
    return 'midori';
  }

  return 'midori';  // フォールバック
}

/**
 * 推奨サービスのURLを取得
 */
export function jrServiceUrl(service) {
  return SERVICE_URL[service] || SERVICE_URL.midori;
}

/**
 * 推奨サービスのラベル(日本語)を取得
 */
export function jrServiceLabel(service) {
  return SERVICE_LABEL[service] || 'みどりの窓口';
}

// ===== 既存データの検証用 =====
// destinations.json の railProvider フィールドと整合性確認用
export const VALID_PROVIDERS = ['e5489', 'ekinet', 'east', 'kyushu', 'jrkyushu', 'central', 'hokkaido', 'west', 'shikoku'];
