// 3件監査の確定修正を一括適用
// 【1】重大5件 【2】離島タグ10件+笠岡諸島 【3】daytrip3島 【4】hubHotelOnly 75件
// 使い方: node scripts/fixTripleAuditFindings.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, 'src/data/destinations.json');
const dests = JSON.parse(fs.readFileSync(file, 'utf8'));
const byId = new Map(dests.map(d => [d.id, d]));
const log = [];

// ── 【1】-1 大根島: 牡丹園の画像を由志園の池泉牡丹(FIND/47, CC BY-SA 4.0)へ差替
{
  const d = byId.get('daikonshima');
  const spot = d.spots.find(s => s.name === '牡丹園');
  spot.imageUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Shimane-Yushien-xl.jpg/1280px-Shimane-Yushien-xl.jpg';
  spot.imageCredit = {
    author: 'tanaka (FIND/47, Photo METI Project)',
    license: 'CC BY-SA 4.0',
    url: 'https://commons.wikimedia.org/wiki/File:Shimane-Yushien-xl.jpg',
    attributionRequired: true,
  };
  log.push('daikonshima: 牡丹園画像を由志園「池泉牡丹」(Shimane-Yushien-xl.jpg)へ差替');
}

// ── 【1】-2 奥尻島: 稚内空港誤り → 江差港フェリー/函館空港
{
  const d = byId.get('gen_北海_奥尻島');
  d.access = { steps: [
    { type: 'rail', to: '函館駅', provider: 'えきねっと' },
    { type: 'local', from: '函館駅', to: '江差港', method: 'バス' },
    { type: 'ferry', from: '江差港', to: '奥尻港', operator: 'ハートランドフェリー', bookingUrl: 'https://heartlandferry.jp/' },
  ] };
  d.gateways = { rail: [], airport: ['函館空港'], bus: [], ferry: ['江差港'] };
  d.ferryGateway = '江差港';
  d.accessStation = '奥尻港';
  d.representativeStation = '函館駅';
  d.transportHubs = { rail: '函館駅', city: '函館' };
  d.finalAccess = { type: 'ferry', line: null, to: '奥尻島' };
  d.description = d.description.replace(
    '拠点は札幌駅で、現地へのアクセスはバスが中心となる。',
    '拠点は函館。江差港からフェリーで約2時間10分、函館空港からの空路（1日1便・約30分）でも渡れる。'
  );
  log.push('gen_北海_奥尻島: アクセスを江差港フェリー/函館空港に修正');
}

// ── 【1】-3 焼尻島: 稚内空港誤り → 羽幌港フェリー
{
  const d = byId.get('gen_北海_焼尻島');
  d.access = { steps: [
    { type: 'rail', to: '札幌駅', provider: 'えきねっと' },
    { type: 'local', from: '札幌駅', to: '羽幌港', method: '沿岸バス' },
    { type: 'ferry', from: '羽幌港', to: '焼尻港', operator: '羽幌沿海フェリー', bookingUrl: 'https://www.haboro-enkai.com/' },
  ] };
  d.gateways = { rail: [], airport: [], bus: ['羽幌'], ferry: ['羽幌港'] };
  d.ferryGateway = '羽幌港';
  d.accessStation = '焼尻港';
  d.finalAccess = { type: 'ferry', line: null, to: '焼尻島' };
  d.description = d.description
    .replace('フェリーで2時間、たどり着くのは', '羽幌港からフェリーで約1時間、たどり着くのは')
    .replace('拠点は札幌駅で、現地へのアクセスはバスが中心となる。', '拠点は羽幌港。札幌から沿岸バスで羽幌へ向かい、フェリー約1時間（高速船なら約35分）で渡る。');
  log.push('gen_北海_焼尻島: アクセスを羽幌港フェリーに修正');
}

// ── 【1】-4 犬島: 座標を実際の島位置へ
{
  const d = byId.get('inujima');
  d.lat = 34.568; d.lng = 134.100;
  log.push('inujima: 座標を34.568,134.100へ修正');
}

// ── 【1】-5 tendo: 中身は寒河江で一貫 → id/名前を寒河江に改名(tendouと重複解消)
{
  const d = byId.get('tendo');
  d.id = 'sagae';
  d.name = '寒河江';
  if (d.displayName) d.displayName = '寒河江';
  d.catch = 'さくらんぼの季節、寒河江の農村は甘い空気に包まれていた。';
  log.push('tendo→sagae: 名前を「寒河江」に改名(内容は元々寒河江・慈恩寺・寒河江ダムで一貫)');
}

// ── 【2】離島タグ誤付与10件を除去 + 笠岡諸島にisIsland付与
{
  const REMOVE = ['wajima', 'ibusuki', 'sasebo', 'ouchi-juku', 'magome', 'wakura-onsen', 'shakotan', 'itoshima', 'motobu', 'onna'];
  for (const id of REMOVE) {
    const d = byId.get(id);
    const before = [...(d.primary || [])];
    d.primary = (d.primary || []).filter(t => t !== '離島');
    d.tags = (d.tags || []).filter(t => t !== '離島');
    d.secondary = (d.secondary || []).filter(t => t !== '離島');
    log.push(`${id}: primary[${before}]→[${d.primary}] 離島タグ除去`);
  }
  const k = byId.get('kasaoka-islands');
  k.isIsland = true;
  log.push('kasaoka-islands: isIsland=true付与(正しい離島のstrictフラグ欠落を補完)');
}

// ── 【3】直島・小豆島・伊豆大島にdaytrip追加
{
  for (const id of ['naoshima', 'shodoshima', 'izu-oshima']) {
    const d = byId.get(id);
    if (!d.stayAllowed.includes('daytrip')) d.stayAllowed.unshift('daytrip');
    log.push(`${id}: stayAllowed=[${d.stayAllowed}]`);
  }
}

// ── 【4】宿泊不適地75件(両宿リンク県トップ&キュレーション宿なし)にhubHotelOnly付与
{
  const audit = JSON.parse(fs.readFileSync(path.join(root, 'logs/non_lodging_audit.json'), 'utf8'));
  const targets = audit.filter(r => r.bothPrefTop && !r.featuredStay);
  let n = 0;
  for (const r of targets) {
    const d = byId.get(r.id);
    if (!d) { log.push(`WARN: ${r.id} not found`); continue; }
    d.hubHotelOnly = true; n++;
  }
  log.push(`hubHotelOnly=true を${n}件に付与`);
}

fs.writeFileSync(file, JSON.stringify(dests, null, 1));
for (const l of log) console.log('✔', l);
console.log('done. total destinations:', dests.length);
