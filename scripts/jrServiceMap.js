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
  '富山県':   'hokuriku', '石川県': 'hokuriku', '福井県': 'hokuriku',  // 北陸エリア(独立ゾーン / 西日本から分離)
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

// ===== 各予約サービスが実際に予約できる範囲（目的地の主管会社ベース）=====
// pickJRService の判定と必ず一致させること。北陸を含める。
// （以前はここに北陸が無く、実装と食い違ったまま未使用で放置されていた）
export const SERVICE_COVERAGE = {
  // JR東日本管内 + 北海道新幹線 + 北陸新幹線(全区間)
  ekinet:   ['east', 'hokkaido', 'hokuriku'],
  // 山陽/九州/西九州新幹線・北陸新幹線(上越妙高-敦賀)・JR西日本/四国/九州の在来線特急
  e5489:    ['west', 'shikoku', 'kyushu', 'hokuriku'],
  // 東海道・山陽・九州新幹線「のみ」。在来線特急は扱えないため、
  // 出発地・目的地の双方が新幹線停車県のときしか使えない。
  smartex:  ['central', 'west', 'kyushu'],
  // 九州内 + 山陽新幹線 + 東海道新幹線
  jrkyushu: ['kyushu', 'west', 'central'],
};

// 東海道・山陽・九州新幹線が通る県（スマートEXで到達できる範囲）
export const SHINKANSEN_PREFS = new Set([
  '東京都', '神奈川県', '静岡県', '愛知県', '岐阜県', '滋賀県', '京都府', '大阪府',
  '兵庫県', '岡山県', '広島県', '山口県', '福岡県', '佐賀県', '熊本県', '鹿児島県',
]);

export const SERVICE_URL = {
  ekinet:   'https://www.eki-net.com/personal/wb/menu/00100.aspx',
  e5489:    'https://www.jr-odekake.net/goyoyaku/e5489/',
  smartex:  'https://smart-ex.jp/',
  jrkyushu: 'https://train.yoyaku.jrkyushu.co.jp/',
  // 旧 jr.cyber-station.ne.jp はサービス終了（接続不可）のため差し替え。
  // midori は北海道↔西日本など複数会社またぎ（窓口購入の案内）でのみ返る。
  midori:   'https://www.jreast.co.jp/ticket/',
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

  // スマートEXは東海道・山陽・九州新幹線しか扱えない（在来線特急は不可）。
  // 両端が新幹線停車県のときだけ提案する。
  // これを見ないと「大阪→青森」「名古屋→木曽」のように
  // スマートEXでは買えない経路に誘導してしまう。
  const exUsable = SHINKANSEN_PREFS.has(origPref) && SHINKANSEN_PREFS.has(destPref);

  // ── 北陸がらみ（最優先）──
  // 北陸新幹線(東京-金沢-敦賀)はえきねっと全区間対応。
  if (o === 'hokuriku' || d === 'hokuriku') {
    const other = o === 'hokuriku' ? d : o;
    if (other === 'hokuriku') return 'e5489';     // 北陸内
    if (other === 'east')     return 'ekinet';    // 北陸新幹線
    if (other === 'hokkaido') return 'midori';    // 飛ばしすぎ
    return 'e5489';                               // 西日本/東海/九州/四国 → サンダーバード等
  }

  // ── 北海道がらみ ──
  if (o === 'hokkaido' || d === 'hokkaido') {
    const other = o === 'hokkaido' ? d : o;
    if (other === 'hokkaido' || other === 'east') return 'ekinet';  // 北海道新幹線で通し
    return 'midori';                                                // 本州縦断は複数社
  }

  // ── 目的地の主管会社ごとに「実際に買えるサービス」を選ぶ ──
  // 目的地が JR東日本管内: 在来線特急も含めて えきねっと で完結できる。
  // （大阪→青森のように東海道区間を挟む場合も、スマートEXでは買えないため
  //   えきねっと側に寄せる。安全側の倒し方。）
  if (d === 'east') return 'ekinet';

  // 目的地が九州: JR九州ネット予約が東海道・山陽新幹線まで扱える。
  if (d === 'kyushu') {
    if (o === 'kyushu' || o === 'west' || o === 'central' || o === 'east') return 'jrkyushu';
    return 'midori';
  }

  // 目的地が西日本・四国: 在来線特急を含め e5489 で完結できる。
  // ただし新幹線だけで行ける区間（例: 東京→新大阪）はスマートEXの方が実用的。
  if (d === 'west' || d === 'shikoku') {
    if (d === 'west' && exUsable && (o === 'east' || o === 'central')) return 'smartex';
    return 'e5489';
  }

  // 目的地がJR東海管内: 新幹線停車県同士なら スマートEX、
  // それ以外（伊勢・鳥羽など在来線が必要）は乗換案内へ。
  if (d === 'central') return exUsable ? 'smartex' : 'midori';

  return 'midori';
}

export function jrServiceUrl(service) {
  return SERVICE_URL[service] || SERVICE_URL.midori;
}
export function jrServiceLabel(service) {
  return SERVICE_LABEL[service] || 'みどりの窓口';
}

export const VALID_PROVIDERS = ['e5489', 'ekinet', 'east', 'kyushu', 'jrkyushu', 'central', 'hokkaido', 'west', 'shikoku', 'hokuriku'];
