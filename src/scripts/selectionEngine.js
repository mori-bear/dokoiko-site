import { calculateTravelTimeMinutes, calculateDistanceStars, haversineKm } from './distanceCalculator.js';

function isValidOnsen(dest) {
  return (dest.onsenLevel ?? 0) >= 2;
}

function matchTheme(dest, theme) {
  if (!theme) return true;
  if (theme === '温泉') return isValidOnsen(dest);
  if (theme === '海' && (dest.isIsland || dest.destType === 'island')) return true;

  const aliases = THEME_TAG_ALIASES[theme] ?? [theme];
  const primaryTags   = dest.primary   ?? [];
  const secondaryTags = dest.secondary ?? [];
  const legacyTags    = (primaryTags.length === 0 && secondaryTags.length === 0)
    ? (dest.tags ?? [])
    : [];

  return [...primaryTags, ...secondaryTags, ...legacyTags].some(t => aliases.includes(t));
}

const THEME_TAG_ALIASES = {
  '絶景':   ['絶景', '自然', '山', '渓谷', '富士山', '高原', '湖', '火山', 'アルプス', '秘境', '滝', '高山'],
  '海':     ['海', '海の幸', '離島', 'ダイビング', '港町', 'リゾート'],
  '街歩き': ['街歩き', '歴史', '城下町', '宿場町', '古都', '寺社', '城', '文化', '武家屋敷', '世界遺産'],
  'グルメ': ['グルメ', '海の幸', '食文化', '食'],
  '春':     ['春', '桜', '花見', '梅'],
  '夏':     ['夏', '海水浴', 'サーフィン', '海開き', 'ひまわり'],
  '秋':     ['秋', '紅葉', 'もみじ', 'コスモス'],
  '冬':     ['冬', '雪', 'スキー', 'スノー', 'イルミネーション'],
};

const PREF_CAPITALS = new Set([
  '札幌', '青森', '盛岡', '仙台', '秋田', '山形', '福島',
  '水戸', '宇都宮', '前橋', '東京', '横浜', '新潟',
  '富山', '金沢', '福井', '甲府', '長野', '岐阜', '静岡',
  '名古屋', '津', '大津', '京都', '大阪', '神戸', '奈良',
  '和歌山', '鳥取', '松江', '岡山', '広島', '山口',
  '徳島', '高松', '松山', '高知',
  '福岡', '佐賀', '長崎', '熊本', '大分', '宮崎', '鹿児島', '那覇',
]);

const DEPARTURE_ALIASES = {
  '福岡': ['博多'],
};

const DEPARTURE_PREFECTURE = {
  '札幌': '北海道', '函館': '北海道', '旭川': '北海道',
  '青森': '青森県', '仙台': '宮城',   '盛岡': '岩手',
  '東京': '東京',   '横浜': '神奈川', '千葉': '千葉', '大宮': '埼玉', '宇都宮': '栃木',
  '新潟': '新潟県',
  '長野': '長野',   '静岡': '静岡',   '名古屋': '愛知', '金沢': '石川', '富山': '富山',
  '大阪': '大阪',   '京都': '京都',   '神戸': '兵庫', '奈良': '奈良',
  '広島': '広島',   '岡山': '岡山',   '松江': '島根',
  '高松': '香川',   '松山': '愛媛',   '高知': '高知', '徳島': '徳島',
  '福岡': '福岡',   '熊本': '熊本',   '鹿児島': '鹿児島', '長崎': '長崎', '宮崎': '宮崎',
  '那覇': '沖縄県',
};

const DESTINATION_PREFECTURE_MAP = {
  'matsushima': '宮城',
  'onomichi':   '広島',
  'otaru':      '北海道',
};

function isSameCity(destination, departure) {
  if (destination.name === departure) return true;
  const departureAliases = DEPARTURE_ALIASES[departure] ?? [];
  if (departureAliases.includes(destination.name)) return true;
  const destAliases = destination.aliases ?? [];
  if (destAliases.includes(departure)) return true;
  return false;
}

function isSamePrefectureOvernight(destination, departure, stayType) {
  if (stayType === 'daytrip') return false;
  if (destination.isIsland || destination.destType === 'island') return false;
  const destPref = DESTINATION_PREFECTURE_MAP[destination.id];
  if (!destPref) return false;
  return destPref === DEPARTURE_PREFECTURE[departure];
}

const DEST_TYPE_BOOST = {
  onsen:     1.5,
  island:    1.3,
  mountain:  1.2,
  remote:    1.2,
  city:      1.0,
  sight:     0.9,
  peninsula: 1.0,
  hidden:    1.1,
  view:      1.0,
  weird:     0.9,
  ruins:     0.9,
  portTown:  1.1,
  railway:   0.9,
};

const THEME_DECAY = {
  '温泉':   220,
  '絶景':   250,
  '海':     200,
  '街歩き': 130,
  'グルメ': 150,
};

function travelTimeScore(minutes, theme = null) {
  if (minutes == null) return 1;
  const decay = THEME_DECAY[theme] ?? 180;
  return Math.exp(-minutes / decay);
}

function getWeight(city, theme) {
  const base = city.weight ?? 1;
  const capW = PREF_CAPITALS.has(city.name) ? 0.6 : 1;
  const dtW  = DEST_TYPE_BOOST[city.destType] ?? 1;
  const ttW  = travelTimeScore(city.travelTimeMinutes, theme);
  const nearCityW = (city.destType === 'city' && (city.travelTimeMinutes ?? 999) < 45 && base < 1.1)
    ? 0.5 : 1;
  let themeW = 1;
  if (theme) {
    themeW = matchTheme(city, theme) ? 3.0 : 0.3;
  }
  return base * capW * dtW * ttW * nearCityW * themeW;
}

function weightedShuffle(arr, theme, departure = '') {
  const result = [];
  const pool = arr.map(item => ({ item, w: getWeight(item, theme) }));
  let lastType = null;
  const typeCounts = {};

  function adjustedW(e) {
    const type = e.item.destType;
    let w = e.w;
    if (lastType != null && type === lastType)   w *= 0.75;
    if ((typeCounts[type] ?? 0) >= 3)            w *= 0.70;
    if (type === 'onsen') {
      if ((typeCounts['onsen'] ?? 0) >= 2)  w *= 0.60;
      if ((typeCounts['onsen'] ?? 0) >= 4)  w *= 0.40;
      if (departure === '札幌' && e.item.region === '北海道') {
        if ((typeCounts['onsen_hokkaido'] ?? 0) >= 2) w *= 0.10;
      }
    }
    return w;
  }

  while (pool.length > 0) {
    const total = pool.reduce((s, e) => s + adjustedW(e), 0);
    let r = Math.random() * total;
    let idx = pool.length - 1;
    let cumW = 0;
    for (let i = 0; i < pool.length; i++) {
      cumW += adjustedW(pool[i]);
      if (r <= cumW) { idx = i; break; }
    }
    const selected = pool[idx].item;
    lastType = selected.destType;
    typeCounts[lastType] = (typeCounts[lastType] ?? 0) + 1;
    if (departure === '札幌' && selected.destType === 'onsen' && selected.region === '北海道') {
      typeCounts['onsen_hokkaido'] = (typeCounts['onsen_hokkaido'] ?? 0) + 1;
    }
    result.push(selected);
    pool.splice(idx, 1);
  }
  return result;
}

const SAPPORO = [43.0642, 141.3469];

export function buildShuffledPool(destinations, stayType, theme, departure = '', nearestHub = null, excludeCar = false, situation = null) {
  function matchesDeparture(d) {
    if (!d.departures || d.departures.length === 0) return true;
    if (d.departures.includes(departure)) return true;
    if (nearestHub && d.departures.includes(nearestHub)) return true;
    return false;
  }

  function matchesSituation(d) {
    if (!situation) return true;
    if (!d.situations?.length) return true;
    return d.situations.includes(situation);
  }

  const withStars = destinations
    .filter(d => d.type !== 'spot')
    .map(d => {
      let travelTimeMinutes = calculateTravelTimeMinutes(departure, d);
      if (departure === '札幌' && travelTimeMinutes <= 60 && d.lat && d.lng) {
        const distKm = haversineKm(SAPPORO[0], SAPPORO[1], d.lat, d.lng);
        travelTimeMinutes = Math.max(30, Math.min(Math.round(distKm), 360));
      }
      return {
        ...d,
        travelTimeMinutes,
        distanceStars: calculateDistanceStars(departure, d),
      };
    });

  function matchesStayType(d) {
    const oneWay = d.travelTimeMinutes;
    if (stayType === 'daytrip' && oneWay > 120) return false;
    if (stayType === '1night'  && oneWay > 240) return false;
    return true;
  }

  const departurePool = withStars.filter(d => {
    if (stayType !== 'daytrip' && d.isStayable === false) return false;
    if (!matchesStayType(d)) return false;
    if (departure && isSameCity(d, departure)) return false;
    if (departure && isSamePrefectureOvernight(d, departure, stayType)) return false;
    if (!matchesDeparture(d)) return false;
    if (excludeCar && d.requiresCar) return false;
    if (!matchesSituation(d)) return false;
    const BAD_TYPES = new Set(['airport', 'station', 'terminal', 'transport_hub', 'access_point']);
    if (BAD_TYPES.has(d.destType)) return false;
    const dname = d.displayName || d.name || '';
    if (/空港|ターミナル/.test(dname)) return false;
    return true;
  });

  const withStayAllowed = departurePool.filter(d => {
    if (!d.stayAllowed || d.stayAllowed.length === 0) return true;
    return d.stayAllowed.includes(stayType);
  });

  const finalPool = withStayAllowed.length > 0 ? withStayAllowed : departurePool;

  if (finalPool.length > 0) {
    const themed = theme ? finalPool.filter(d => matchTheme(d, theme)) : finalPool;
    return weightedShuffle(themed.length > 0 ? themed : finalPool, theme, departure);
  }

  const BAD_TYPES_GLOBAL = new Set(['airport', 'station', 'terminal', 'transport_hub', 'access_point']);
  const globalPool = withStars.filter(d => {
    if (departure && isSameCity(d, departure)) return false;
    if (stayType !== 'daytrip' && d.isStayable === false) return false;
    if (!matchesStayType(d)) return false;
    if (excludeCar && d.requiresCar) return false;
    if (!matchesSituation(d)) return false;
    if (BAD_TYPES_GLOBAL.has(d.destType)) return false;
    const dname = d.displayName || d.name || '';
    if (/空港|ターミナル/.test(dname)) return false;
    return true;
  });

  const globalWithStayAllowed = globalPool.filter(d => {
    if (!d.stayAllowed || d.stayAllowed.length === 0) return true;
    return d.stayAllowed.includes(stayType);
  });
  const finalGlobalPool = globalWithStayAllowed.length > 0 ? globalWithStayAllowed : globalPool;

  const themedGlobal = theme ? finalGlobalPool.filter(d => matchTheme(d, theme)) : finalGlobalPool;
  return weightedShuffle(themedGlobal.length > 0 ? themedGlobal : finalGlobalPool, theme, departure);
}
