// 【検査A】同名異所の混同 + 【検査B】滞在日数の妥当性 一括機械検査 (v2: 誤検知除去)
// 使い方: node scripts/auditSameNameStay.mjs
// 出力: logs/same_name_stay_audit.json + コンソールに確度順一覧
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dests = JSON.parse(fs.readFileSync(path.join(root, 'src/data/destinations.json'), 'utf8'));

const PREF_CENTER = {
  '北海道': [43.06, 141.35], '青森県': [40.82, 140.74], '岩手県': [39.70, 141.15], '宮城県': [38.27, 140.87],
  '秋田県': [39.72, 140.10], '山形県': [38.24, 140.36], '福島県': [37.75, 140.47], '茨城県': [36.34, 140.45],
  '栃木県': [36.57, 139.88], '群馬県': [36.39, 139.06], '埼玉県': [35.86, 139.65], '千葉県': [35.61, 140.12],
  '東京都': [35.69, 139.69], '神奈川県': [35.45, 139.64], '新潟県': [37.90, 139.02], '富山県': [36.70, 137.21],
  '石川県': [36.59, 136.63], '福井県': [36.07, 136.22], '山梨県': [35.66, 138.57], '長野県': [36.65, 138.18],
  '岐阜県': [35.39, 136.72], '静岡県': [34.98, 138.38], '愛知県': [35.18, 136.91], '三重県': [34.73, 136.51],
  '滋賀県': [35.00, 135.87], '京都府': [35.02, 135.76], '大阪府': [34.69, 135.52], '兵庫県': [34.69, 135.18],
  '奈良県': [34.69, 135.83], '和歌山県': [34.23, 135.17], '鳥取県': [35.50, 134.24], '島根県': [35.47, 133.05],
  '岡山県': [34.66, 133.93], '広島県': [34.40, 132.46], '山口県': [34.19, 131.47], '徳島県': [34.07, 134.56],
  '香川県': [34.34, 134.04], '愛媛県': [33.84, 132.77], '高知県': [33.56, 133.53], '福岡県': [33.61, 130.42],
  '佐賀県': [33.25, 130.30], '長崎県': [32.74, 129.87], '熊本県': [32.79, 130.74], '大分県': [33.24, 131.61],
  '宮崎県': [31.91, 131.42], '鹿児島県': [31.56, 130.56], '沖縄県': [26.21, 127.68],
};
// 実測誤検知を踏まえた許容(度): 道東・小笠原・先島・トカラ等は正当に遠い
const PREF_TOL = { '北海道': 5.0, '鹿児島県': 6.5, '沖縄県': 6.0, '東京都': 10.0, '島根県': 2.0, '長崎県': 2.0, '新潟県': 2.0 };

const km = (a, b, c, d) => {
  const R = 6371, dLat = (c - a) * Math.PI / 180, dLng = (d - b) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a * Math.PI / 180) * Math.cos(c * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};

// 厳格な島判定（データ構造上の島）とタグ上の島(検索フィルタに効く)を区別
const strictIsland = (d) => !!d.isIsland || d.destType === 'island' || d.subType === 'island';
const tagIsland = (d) => (d.tags || []).includes('離島') || (d.primary || []).includes('離島');

const findings = { A: [], B: [] };
const push = (bucket, sev, id, name, issue, detail) =>
  findings[bucket].push({ severity: sev, id, name, issue, detail });

// A-1: 同名destinationが複数
const byName = new Map();
for (const d of dests) {
  const n = d.displayName || d.name;
  (byName.get(n) || byName.set(n, []).get(n)).push(d);
}
for (const [n, arr] of byName) {
  if (arr.length > 1) {
    const dist = arr.length === 2 ? km(arr[0].lat, arr[0].lng, arr[1].lat, arr[1].lng).toFixed(0) : '-';
    push('A', 'mid', arr.map(x => x.id).join(','), n, '同名destinationが複数存在',
      `${arr.map(x => `${x.id}(${x.prefecture}/${x.destType})`).join(' vs ')} 距離${dist}km`);
  }
}

// A-2: 県と座標の不整合
for (const d of dests) {
  const c = PREF_CENTER[d.prefecture];
  if (!c || d.lat == null) continue;
  const tol = PREF_TOL[d.prefecture] || 1.6;
  const dlat = Math.abs(d.lat - c[0]), dlng = Math.abs(d.lng - c[1]);
  if (dlat > tol || dlng > tol) {
    push('A', 'high', d.id, d.name, '座標がprefectureから大きく乖離',
      `lat=${d.lat},lng=${d.lng} / ${d.prefecture} Δlat=${dlat.toFixed(2)} Δlng=${dlng.toFixed(2)}`);
  }
}

// A-3: 厳格島なのに鉄道到達扱い（橋・鉄道のある島は除外）
const BRIDGED_RE = /淡路|宮島|厳島|しまなみ|向島|因島|生口島|大三島|伯方島|大島|角島|江田島|倉橋|能美|平戸|生月|志賀島|桜島|天草|瀬長|海の中道|城ヶ島|江の島|竹島|大根島|小豆島大橋|池間|来間|伊良部|古宇利|瀬底|浜比嘉|宮城島|平安座|奥武|屋我地/;
for (const d of dests) {
  if (!strictIsland(d)) continue;
  const bridged = BRIDGED_RE.test(d.name) || /橋で(渡|結|つな)|車で渡れ/.test(d.description || '');
  if (bridged) continue;
  const issues = [];
  const ferries = d.gateways?.ferry || [];
  if (d.railGateway && !d.ferryGateway) issues.push(`railGateway=${d.railGateway}のみでferryGatewayなし`);
  if ((d.gateways?.rail || []).length && !ferries.length) issues.push(`gateways.rail=[${d.gateways.rail}]だがferry空`);
  const finalStation = d.accessStation || d.representativeStation || '';
  if (/駅$/.test(finalStation) && !ferries.length && !d.ferryGateway) issues.push(`accessStation=${finalStation}(駅)だがferryなし`);
  const steps = d.access?.steps || [];
  if (steps.length && !steps.some(s => s.type === 'ferry') && !ferries.length && !d.ferryGateway) issues.push('access.stepsにferry無し');
  if (issues.length) push('A', 'high', d.id, d.name, '離島(strict)に鉄道到達データ疑い', issues.join(' / '));
}

// A-4: 離島タグの誤付与（本土・半島に「離島」タグ → テーマ検索に混入）
const MAINLAND_OK_RE = /淡路|天草|しまなみ|平戸|島原|能登島|大根島|江田島|周防大島|宮島|厳島/;
for (const d of dests) {
  if (tagIsland(d) && !strictIsland(d) && !MAINLAND_OK_RE.test(d.name)) {
    push('A', 'high', d.id, d.name, '非離島に「離島」タグ付与(テーマ検索混入)',
      `destType=${d.destType} subType=${d.subType} primary=[${d.primary}] tags=[${d.tags}]`);
  }
}

// A-5: 離島スポットに駅系コンテンツ（Roadside Station=道の駅は除外）
for (const d of dests) {
  if (!strictIsland(d)) continue;
  const hits = [];
  for (const s of d.spots || []) {
    if (/駅$|駅前|停留場/.test(s.name || '') && !/道の駅/.test(s.name || '')) hits.push(`spot「${s.name}」`);
    const u = s.imageUrl || '';
    if (/station|_eki/i.test(u) && !/Roadside_Station|port|ferry|Weather_Station/i.test(u)) hits.push(`spot画像URL: …${u.slice(-70)}`);
  }
  if (hits.length) push('A', 'mid', d.id, d.name, '離島スポットに駅系コンテンツ疑い', hits.join(' / '));
}

// A-6: 主要瀬戸内諸島の既知座標との照合
const KNOWN = {
  naoshima: [34.460, 133.995], shodoshima: [34.500, 134.283], teshima: [34.483, 134.083],
  megijima: [34.395, 134.062], ogijima: [34.423, 134.060], inujima: [34.568, 134.100],
  shamijima: [34.350, 133.820], honjima: [34.386, 133.789], ibukijima: [34.126, 133.510],
};
for (const d of dests) {
  const k = KNOWN[d.id];
  if (!k || d.lat == null) continue;
  const dist = km(d.lat, d.lng, k[0], k[1]);
  // 小豆島など大きい島は島内ならOK: 8km超のみ&島外らしさで報告
  if (dist > 8 && !(d.id === 'shodoshima' && dist < 15)) {
    push('A', 'high', d.id, d.name, '瀬戸内主要島の座標がWikipedia座標と乖離',
      `${dist.toFixed(1)}km乖離 (data: ${d.lat},${d.lng} / wiki: ${k}) — 本土側を指している可能性`);
  }
}

// ── 検査B ──────────────────────────────────
const flightAccess = (d) => d.hasDirectFlight || d.secondaryTransport === 'flight' || (d.gateways?.airport || []).length > 0 || d.airportGateway;
for (const d of dests) {
  const sa = d.stayAllowed || [];
  const tt = d.travelTime || {};
  const times = Object.values(tt).filter(v => typeof v === 'number' && v < 700);
  const minTime = times.length ? Math.min(...times) : null;
  const island = strictIsland(d);

  // B-1: フェリー島で最寄り出発地から近いのにdaytrip無し（飛行機アクセス島は対象外）
  if (island && !flightAccess(d) && (d.ferryGateway || (d.gateways?.ferry || []).length)) {
    if (minTime != null && minTime <= 90 && !sa.includes('daytrip')) {
      push('B', 'high', d.id, d.name, 'フェリー日帰り圏なのにdaytrip無し',
        `minTravel=${minTime}分 hub=${d.hub} stayAllowed=[${sa}] stayRec=${d.stayRecommendation}`);
    }
  }
  // B-2: 遠方(全出発地180分超)なのにdaytrip専用
  if (minTime != null && minTime >= 180 && sa.length === 1 && sa[0] === 'daytrip') {
    push('B', 'high', d.id, d.name, '遠方なのにdaytrip専用', `minTravel=${minTime}分`);
  }
  // B-3: stayRecommendationとstayAllowedの矛盾
  if (d.stayRecommendation === 'daytrip' && !sa.includes('daytrip')) {
    push('B', island ? 'high' : 'mid', d.id, d.name, 'stayRec=daytripなのにstayAllowedにdaytrip無し',
      `stayAllowed=[${sa}]${island ? ' 離島' : ''} minTravel=${minTime}分`);
  }
  if (d.stayRecommendation && /night/.test(d.stayRecommendation) && sa.length === 1 && sa[0] === 'daytrip') {
    push('B', 'mid', d.id, d.name, `stayRec=${d.stayRecommendation}なのにdaytrip専用`, `stayAllowed=[${sa}]`);
  }
}

const order = { high: 0, mid: 1, low: 2 };
findings.A.sort((a, b) => order[a.severity] - order[b.severity]);
findings.B.sort((a, b) => order[a.severity] - order[b.severity]);
fs.writeFileSync(path.join(root, 'logs/same_name_stay_audit.json'), JSON.stringify(findings, null, 1));
console.log(`===== 検査A (${findings.A.length}件) =====`);
for (const f of findings.A) console.log(`[${f.severity}] ${f.id} ${f.name} — ${f.issue}: ${f.detail}`);
console.log(`\n===== 検査B (${findings.B.length}件) =====`);
for (const f of findings.B) console.log(`[${f.severity}] ${f.id} ${f.name} — ${f.issue}: ${f.detail}`);
