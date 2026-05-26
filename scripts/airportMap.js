/**
 * airportMap.js
 *
 * Skyscanner 検索リンク生成用の空港コードマップ。
 * - 主要出発地 (CITY_TO_AIRPORT)
 * - destination の最寄り空港 (dest.gateways.airport[0] or dest.airportGateway) → コード
 */

// 出発地 (日本語) → IATA / 都市コード
export const CITY_TO_AIRPORT = {
  '東京':   'TYO',  // HND + NRT
  '横浜':   'TYO',
  '千葉':   'TYO',
  '埼玉':   'TYO',
  '大阪':   'OSA',  // KIX + ITM
  '京都':   'OSA',
  '神戸':   'UKB',  // 神戸空港
  '名古屋': 'NGO',  // 中部
  '札幌':   'CTS',  // 新千歳
  '函館':   'HKD',
  '旭川':   'AKJ',
  '釧路':   'KUH',
  '帯広':   'OBO',
  '稚内':   'WKJ',
  '仙台':   'SDJ',
  '青森':   'AOJ',
  '盛岡':   'HNA',  // 花巻
  '秋田':   'AXT',
  '山形':   'GAJ',
  '福島':   'FKS',
  '新潟':   'KIJ',
  '富山':   'TOY',
  '小松':   'KMQ',
  '金沢':   'KMQ',
  '福井':   'FKJ',  // 福井空港(無 → 小松KMQ)
  '広島':   'HIJ',
  '岡山':   'OKJ',
  '松山':   'MYJ',
  '高松':   'TAK',
  '徳島':   'TKS',
  '高知':   'KCZ',
  '福岡':   'FUK',
  '北九州': 'KKJ',
  '熊本':   'KMJ',
  '長崎':   'NGS',
  '大分':   'OIT',
  '宮崎':   'KMI',
  '鹿児島': 'KOJ',
  '那覇':   'OKA',
  '石垣':   'ISG',
  '宮古':   'MMY',
};

// 「○○空港」や駅名のような表記から IATA コードへ
// 値は主要なものを列挙。一致しなければ null。
export const AIRPORT_NAME_TO_CODE = {
  '羽田': 'HND', '羽田空港': 'HND', '東京国際空港': 'HND',
  '成田': 'NRT', '成田空港': 'NRT', '成田国際空港': 'NRT',
  '関西': 'KIX', '関西空港': 'KIX', '関西国際空港': 'KIX',
  '伊丹': 'ITM', '伊丹空港': 'ITM', '大阪国際空港': 'ITM',
  '神戸': 'UKB', '神戸空港': 'UKB',
  '中部': 'NGO', '中部国際空港': 'NGO', 'セントレア': 'NGO',
  '新千歳': 'CTS', '新千歳空港': 'CTS',
  '函館': 'HKD', '函館空港': 'HKD',
  '旭川': 'AKJ', '旭川空港': 'AKJ',
  '釧路': 'KUH', '釧路空港': 'KUH',
  '帯広': 'OBO', '帯広空港': 'OBO', 'とかち帯広': 'OBO',
  '稚内': 'WKJ', '稚内空港': 'WKJ',
  '女満別': 'MMB', '女満別空港': 'MMB',
  '中標津': 'SHB',
  '紋別': 'MBE',
  '奥尻': 'OIR',
  '利尻': 'RIS',
  '仙台': 'SDJ', '仙台空港': 'SDJ',
  '青森': 'AOJ', '青森空港': 'AOJ',
  '三沢': 'MSJ',
  '花巻': 'HNA', '盛岡': 'HNA', 'いわて花巻': 'HNA',
  '秋田': 'AXT', '秋田空港': 'AXT',
  '大館能代': 'ONJ',
  '庄内': 'SYO',
  '山形': 'GAJ', '山形空港': 'GAJ', 'おいしい山形': 'GAJ',
  '福島': 'FKS', '福島空港': 'FKS',
  '茨城': 'IBR', '茨城空港': 'IBR',
  '新潟': 'KIJ', '新潟空港': 'KIJ',
  '佐渡': 'SDS',
  '富山': 'TOY', '富山空港': 'TOY', '富山きときと': 'TOY',
  '小松': 'KMQ', '小松空港': 'KMQ',
  '能登': 'NTQ',
  '松本': 'MMJ', '信州まつもと': 'MMJ',
  '静岡': 'FSZ', '富士山静岡': 'FSZ',
  '名古屋': 'NGO', '中部国際': 'NGO',
  '伊丹': 'ITM', '関西': 'KIX',
  '南紀白浜': 'SHM',
  '神戸': 'UKB',
  '但馬': 'TJH',
  '岡山': 'OKJ', '岡山空港': 'OKJ', '岡山桃太郎': 'OKJ',
  '広島': 'HIJ', '広島空港': 'HIJ',
  '岩国': 'IWK', '岩国錦帯橋': 'IWK',
  '山口宇部': 'UBJ', '宇部': 'UBJ', '山口': 'UBJ',
  '出雲': 'IZO', '出雲縁結び': 'IZO',
  '米子': 'YGJ', '米子鬼太郎': 'YGJ',
  '萩・石見': 'IWJ', '石見': 'IWJ',
  '隠岐': 'OKI',
  '鳥取': 'TTJ', '鳥取砂丘コナン': 'TTJ',
  '高松': 'TAK', '高松空港': 'TAK',
  '徳島': 'TKS', '徳島阿波おどり': 'TKS',
  '松山': 'MYJ', '松山空港': 'MYJ',
  '高知': 'KCZ', '高知龍馬': 'KCZ',
  '福岡': 'FUK', '福岡空港': 'FUK',
  '北九州': 'KKJ',
  '佐賀': 'HSG', '九州佐賀国際': 'HSG',
  '長崎': 'NGS', '長崎空港': 'NGS',
  '対馬': 'TSJ',
  '壱岐': 'IKI',
  '五島福江': 'FUJ', '福江': 'FUJ',
  '熊本': 'KMJ', '阿蘇くまもと': 'KMJ',
  '天草': 'AXJ',
  '大分': 'OIT', '大分空港': 'OIT',
  '宮崎': 'KMI', '宮崎ブーゲンビリア': 'KMI',
  '鹿児島': 'KOJ', '鹿児島空港': 'KOJ',
  '屋久島': 'KUM',
  '種子島': 'TNE',
  '奄美': 'ASJ', '奄美大島': 'ASJ',
  '徳之島': 'TKN',
  '沖永良部': 'OKE',
  '与論': 'RNJ',
  '喜界': 'KKX',
  '那覇': 'OKA', '那覇空港': 'OKA',
  '石垣': 'ISG', '南ぬ島石垣': 'ISG',
  '宮古': 'MMY',
  '下地島': 'SHI',
  '与那国': 'OGN',
  '久米島': 'UEO',
  '北大東': 'KTD',
  '南大東': 'MMD',
  '多良間': 'TRA',
};

export function airportCodeForCity(city) {
  if (!city) return null;
  if (CITY_TO_AIRPORT[city]) return CITY_TO_AIRPORT[city];
  const k = city.replace(/[県府都市区]$/,'');
  return CITY_TO_AIRPORT[k] || null;
}

// dest.gateways.airport / dest.airportGateway は「○○空港」のような表記
// 「○○空港」 → IATA に変換
export function airportCodeForDest(dest) {
  const candidates = [];
  const g = dest?.gateways?.airport;
  if (Array.isArray(g)) candidates.push(...g);
  else if (typeof g === 'string') candidates.push(g);
  if (dest?.airportGateway) candidates.push(dest.airportGateway);
  if (dest?.airportHub) candidates.push(dest.airportHub);
  if (dest?.hasDirectFlight && dest?.gateway) candidates.push(dest.gateway);
  for (const raw of candidates) {
    if (!raw) continue;
    const n = String(raw).replace(/\s+/g, '');
    // 完全一致 → 部分一致の順で
    if (AIRPORT_NAME_TO_CODE[n]) return AIRPORT_NAME_TO_CODE[n];
    const base = n.replace(/空港$|国際空港$/, '');
    if (AIRPORT_NAME_TO_CODE[base]) return AIRPORT_NAME_TO_CODE[base];
    // prefix match
    for (const key of Object.keys(AIRPORT_NAME_TO_CODE)) {
      if (n.startsWith(key) && key.length >= 2) return AIRPORT_NAME_TO_CODE[key];
    }
  }
  // 県庁所在地ベースのフォールバック
  if (dest?.prefecture) {
    const pref = dest.prefecture.replace(/[県府都]$/, '').split(/[・,／\/]/)[0].trim();
    return airportCodeForCity(pref);
  }
  return null;
}

/**
 * Skyscanner 検索 URL を生成。
 *   https://www.skyscanner.jp/transport/flights/{origin}/{dest}/
 *   /transport/flights/ が正しい現行パス
 */
export function skyscannerUrl(originCity, dest) {
  const origin = airportCodeForCity(originCity);
  const destCode = airportCodeForDest(dest);
  if (!origin || !destCode || origin === destCode) return null;
  return `https://www.skyscanner.jp/flights/${origin.toLowerCase()}/${destCode.toLowerCase()}/`;
}
