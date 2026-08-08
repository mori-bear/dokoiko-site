#!/usr/bin/env node
/**
 * auditContamination.mjs — 「他destinationのデータ混入」を全件機械検出する。
 *
 *   ① 座標が prefecture の県域(外接矩形)の外にある
 *   ② 駅名（hubStation/representativeStation/bookingStation/accessStation/railGateway/
 *      gatewayStations）の地名部分が、50km超離れた別destinationと一致
 *   ③ mainSpot / mapPoint / stayArea が 50km超離れた別destination名
 *   ④ featured_stay.name とリンク先ページの宿名が不一致（要ネットワーク）
 *   ⑤ description / catch に遠方の別destination名（②③の裏付けがある場合のみ計上）
 *
 * 除外（正当なケース）:
 *   - hub / hubName / accessHub / city / hubCity / prefecture として参照する近隣拠点
 *   - その地名が自分の description / spots に登場する場合
 *     （＝地元の同名地物。館山の沖ノ島、佐田岬の三崎、野付半島の知床、
 *       軽井沢/富士宮の白糸の滝 などはここで除外される）
 *
 * 使い方: node scripts/auditContamination.mjs [--no-net]
 */
import fs from 'fs';

const NO_NET = process.argv.includes('--no-net');
const D = JSON.parse(fs.readFileSync('src/data/destinations.json', 'utf8'));
const withGeo = D.filter(d => typeof d.lat === 'number' && typeof d.lng === 'number');
const byName = new Map(D.map(d => [d.name, d]));
// 同名destinationが複数ある名前は曖昧なので判定に使わない
const nameCount = D.reduce((a, d) => { a[d.name] = (a[d.name] || 0) + 1; return a; }, {});

/** 都道府県の外接矩形 [latMin, latMax, lngMin, lngMax]（離島含む・やや広めに取る） */
const PREF_BBOX = {
  北海道: [41.30, 45.60, 139.30, 148.95], 青森県: [40.18, 41.60, 139.45, 141.72],
  岩手県: [38.70, 40.50, 140.60, 142.12], 宮城県: [37.72, 39.05, 140.22, 141.72],
  秋田県: [38.82, 40.55, 139.65, 141.05], 山形県: [37.68, 39.25, 139.45, 140.70],
  福島県: [36.75, 38.02, 139.10, 141.10], 茨城県: [35.70, 37.00, 139.65, 140.92],
  栃木県: [36.15, 37.20, 139.28, 140.35], 群馬県: [35.93, 37.10, 138.35, 139.72],
  埼玉県: [35.70, 36.32, 138.65, 139.95], 千葉県: [34.85, 36.15, 139.70, 140.92],
  東京都: [24.15, 35.95, 138.90, 154.05], 神奈川県: [35.08, 35.72, 138.86, 139.85],
  新潟県: [36.70, 38.60, 137.58, 139.95], 富山県: [36.20, 37.02, 136.72, 137.80],
  石川県: [36.02, 37.90, 136.18, 137.42], 福井県: [35.28, 36.35, 135.40, 136.88],
  山梨県: [35.12, 36.02, 138.12, 139.20], 長野県: [35.15, 37.08, 137.27, 138.80],
  岐阜県: [35.08, 36.52, 136.22, 137.72], 静岡県: [34.50, 35.70, 137.42, 139.22],
  愛知県: [34.52, 35.48, 136.62, 137.90], 三重県: [33.67, 35.31, 135.80, 137.05],
  滋賀県: [34.74, 35.76, 135.70, 136.52], 京都府: [34.65, 35.83, 134.80, 136.12],
  大阪府: [34.22, 35.10, 135.04, 135.80], 兵庫県: [34.10, 35.73, 134.20, 135.52],
  奈良県: [33.80, 34.82, 135.50, 136.28], 和歌山県: [33.38, 34.43, 134.94, 136.08],
  鳥取県: [35.00, 35.68, 133.08, 134.56], 島根県: [34.25, 37.30, 131.60, 133.45],
  岡山県: [34.25, 35.42, 133.20, 134.48], 広島県: [33.97, 35.16, 131.98, 133.53],
  山口県: [33.67, 34.85, 130.72, 132.50], 徳島県: [33.49, 34.30, 133.58, 134.85],
  香川県: [33.95, 34.62, 133.38, 134.50], 愛媛県: [32.85, 34.36, 131.97, 133.75],
  高知県: [32.65, 33.95, 132.42, 134.38], 福岡県: [32.95, 34.05, 129.92, 131.25],
  佐賀県: [32.90, 33.66, 129.66, 130.60], 長崎県: [32.50, 34.78, 128.03, 130.45],
  熊本県: [32.04, 33.28, 129.85, 131.40], 大分県: [32.66, 33.80, 130.75, 132.15],
  宮崎県: [31.30, 32.90, 130.65, 131.95], 鹿児島県: [26.95, 32.36, 128.32, 131.14],
  沖縄県: [23.98, 27.95, 122.88, 131.40],
};

const km = (a, b) => {
  const dLat = (a.lat - b.lat) * 111;
  const dLng = (a.lng - b.lng) * 111 * Math.cos(a.lat * Math.PI / 180);
  return Math.hypot(dLat, dLng);
};
const mentions = (d, name) => {
  const hay = [d.description, d.catch, d.name, JSON.stringify(d.spots || []), d.city, d.hotelArea]
    .filter(Boolean).join(' ');
  return hay.includes(name);
};
const okNames = (d) => new Set([d.name, d.hub, d.hubName, d.accessHub, d.city, d.fallbackCity, d.hubCity, d.prefecture].filter(Boolean));

const hits = new Map();
const flag = (d, cat, detail) => {
  if (!hits.has(d.id)) hits.set(d.id, { d, items: [] });
  hits.get(d.id).items.push({ cat, detail });
};

/* ── ① 座標が県域の外接矩形の外 ── */
for (const d of withGeo) {
  const bb = PREF_BBOX[d.prefecture];
  if (!bb) continue;
  const [laMin, laMax, lnMin, lnMax] = bb;
  if (d.lat < laMin || d.lat > laMax || d.lng < lnMin || d.lng > lnMax) {
    // どの県の矩形に入るかを併記
    const inside = Object.entries(PREF_BBOX)
      .filter(([, b]) => d.lat >= b[0] && d.lat <= b[1] && d.lng >= b[2] && d.lng <= b[3])
      .map(([p]) => p);
    flag(d, '①座標×県', `prefecture=${d.prefecture} だが座標(${d.lat.toFixed(4)}, ${d.lng.toFixed(4)})は県域外`
      + (inside.length ? ` → ${inside.join('/')}の範囲内` : ''));
  }
}

/* ── ② 駅名の地理的乖離 ── */
const STATION_FIELDS = ['hubStation', 'representativeStation', 'accessStation', 'railGateway'];
for (const d of withGeo) {
  const seen = new Set();
  const check = (field, raw) => {
    if (!raw || typeof raw !== 'string') return;
    const base = raw.replace(/駅$/, '');
    if (!base || base === d.name || seen.has(base) || nameCount[base] !== 1) return;
    const other = byName.get(base);
    if (!other || typeof other.lat !== 'number') return;
    if (okNames(d).has(base) || mentions(d, base)) return;
    const dist = km(d, other);
    if (dist > 50) { seen.add(base); flag(d, '②駅乖離', `${field}=${raw} → 「${base}」は${Math.round(dist)}km離れている`); }
  };
  for (const f of STATION_FIELDS) check(f, d[f]);
  check('bookingStation', d.bookingStation?.name);
  for (const g of (d.gatewayStations || [])) check('gatewayStations', g?.name);
}

/* ── ③ mainSpot / mapPoint / stayArea ── */
for (const d of withGeo) {
  const seen = new Set();
  for (const [field, v] of [['mainSpot', d.mainSpot], ['mapPoint', d.mapPoint],
    ['stayArea.rakuten', d.stayArea?.rakuten], ['stayArea.jalan', d.stayArea?.jalan]]) {
    if (!v || typeof v !== 'string' || seen.has(v) || nameCount[v] !== 1) continue;
    const other = byName.get(v);
    if (!other || typeof other.lat !== 'number') continue;
    if (okNames(d).has(v) || mentions(d, v)) continue;
    const dist = km(d, other);
    if (dist > 50) { seen.add(v); flag(d, '③地点', `${field}=「${v}」は${Math.round(dist)}km離れた別destination`); }
  }
}

/* ── ⑤ 本文の地名（②③の裏付けがある destination のみ計上）── */
const proseFindings = new Map();
for (const d of withGeo) {
  const prose = [d.description, d.catch].filter(Boolean).join(' ');
  if (!prose) continue;
  const seen = new Set();
  for (const other of withGeo) {
    const n = other.name;
    if (n === d.name || n.length < 3 || seen.has(n) || nameCount[n] !== 1) continue;
    if (!prose.includes(n) || okNames(d).has(n)) continue;
    const dist = km(d, other);
    if (dist > 80 && other.prefecture !== d.prefecture) {
      seen.add(n);
      if (!proseFindings.has(d.id)) proseFindings.set(d.id, []);
      proseFindings.get(d.id).push(`本文に遠方の地名「${n}」（${Math.round(dist)}km・${other.prefecture}）`);
    }
  }
}
for (const [id, list] of proseFindings) {
  const h = hits.get(id);
  if (h && h.items.some(i => i.cat === '②駅乖離' || i.cat === '③地点')) {
    for (const detail of list) flag(h.d, '⑤本文', detail);
  }
}

/* ── ④ featured_stay.name とリンク先の宿名 ── */
const UA = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36', 'Accept-Language': 'ja' };
const norm = (s) => String(s || '').normalize('NFKC')
  .replace(/[\s　・･（）()「」【】〜~\-ー–—、,.。]/g, '').toLowerCase();
async function pageTitle(url) {
  try {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), 12000);
    const r = await fetch(url, { headers: UA, redirect: 'follow', signal: c.signal });
    clearTimeout(t);
    const b = Buffer.from(await r.arrayBuffer());
    let h = b.toString('utf8');
    if (/�/.test(h.slice(0, 2000))) { try { h = new TextDecoder('shift_jis').decode(b); } catch {} }
    return (h.match(/<title>([\s\S]*?)<\/title>/i) || [])[1]?.replace(/\s+/g, ' ').trim() || '';
  } catch { return null; }
}
if (!NO_NET) {
  const targets = D.filter(d => d.featured_stay?.jalanUrl || d.featured_stay?.rakutenUrl);
  process.stderr.write(`[④] featured_stay ${targets.length}件のリンク先を照合中…\n`);
  let i = 0;
  for (const d of targets) {
    const url = d.featured_stay.jalanUrl || d.featured_stay.rakutenUrl;
    const ti = await pageTitle(url);
    if (++i % 40 === 0) process.stderr.write(`   ${i}/${targets.length}\n`);
    if (ti === null) { flag(d, '④宿リンク', `リンク先を取得できず: ${url}`); continue; }
    const stay = norm(d.featured_stay.name), title = norm(ti);
    // 宿名そのもの or 先頭4文字が題名に含まれれば一致とみなす
    const head = stay.slice(0, 4);
    if (!title.includes(stay) && !(head.length >= 3 && title.includes(head))) {
      flag(d, '④宿リンク', `featured_stay.name「${d.featured_stay.name}」／リンク先の題名「${ti.slice(0, 42)}」`);
    }
    await new Promise(r => setTimeout(r, 320));
  }
}

/* ── 出力 ── */
const rows = [...hits.values()]
  .map(h => ({ ...h, cats: [...new Set(h.items.map(i => i.cat))] }))
  .sort((a, b) => b.cats.length - a.cats.length || b.items.length - a.items.length);
const catCount = {};
for (const r of rows) for (const c of r.cats) catCount[c] = (catCount[c] || 0) + 1;

console.log(`\n${'═'.repeat(72)}`);
console.log(`総destination ${D.length} 件 / 疑わしい destination: ${rows.length}件`);
console.log(`項目別: ${Object.entries(catCount).sort().map(([k, v]) => `${k} ${v}件`).join(' / ')}`);
console.log(`${'═'.repeat(72)}\n【確度の高い順（複数項目該当を優先）】\n`);
for (const [n, r] of rows.slice(0, 30).entries()) {
  console.log(`${String(n + 1).padStart(2)}. [${r.d.id}] ${r.d.name}（${r.d.prefecture ?? '-'}） — 該当${r.cats.length}項目`);
  for (const it of r.items) console.log(`      ${it.cat} ${it.detail}`);
}
if (rows.length > 30) console.log(`\n… ほか ${rows.length - 30}件（logs/contamination_audit.json に全件）`);
fs.mkdirSync('logs', { recursive: true });
fs.writeFileSync('logs/contamination_audit.json',
  JSON.stringify(rows.map(r => ({ id: r.d.id, name: r.d.name, prefecture: r.d.prefecture, cats: r.cats, items: r.items })), null, 2));
