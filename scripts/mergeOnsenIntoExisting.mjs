#!/usr/bin/env node
/**
 * mergeOnsenIntoExisting.mjs — こんぴら温泉郷・あしずり温泉郷を別立てせず、
 * すでにその場所を扱っている既存エントリに温泉の要素を足して統合する。
 *
 * 判断:
 *   こんぴら温泉郷 → 既存「琴平」(kotohira) が同じ町を扱っており、
 *     featured_stay の琴平花壇もこんぴら温泉の宿。別立てすると同じ町に2ページになる。
 *     ただし琴平は onsenLevel=0 で温泉に一言も触れておらず、温泉地として探す人には
 *     見つからない。onsenLevel と tags に温泉を足し、spot を1件加えて解消する。
 *   あしずり温泉郷 → 既存「足摺岬」(ashizuri) が同じ岬を扱っており、
 *     featured_stay の TheMana Village もあしずり温泉郷の宿。こちらも同じ扱いにする。
 *
 * spot は4件になるが、既存エントリの spot 件数は場所によってばらつきがあり
 * （琴平は元から4件）、[id].astro は件数を固定していない。
 */
import fs from 'fs';

const DATA = ['src/data/destinations.json', 'public/data/destinations.json'];

const PATCH = {
  kotohira: {
    addTags: ['温泉'],
    onsenLevel: 2,
    addChips: ['温泉'],
    spot: { name: 'こんぴら温泉郷',
      description: '参道の坂に沿って湧く温泉。石段を登り切ったあとの脚を、宿の湯でほどいて帰るのが定番になっている。' },
  },
  ashizuri: {
    addTags: ['温泉'],
    onsenLevel: 2,
    addChips: ['温泉'],
    spot: { name: 'あしずり温泉郷',
      description: '岬の宿が引く四国最南端の温泉。弘法大師が発見したと伝わり、湯に浸かったまま太平洋を望む宿もある。' },
  },
};

const bad = [];
for (const [id, p] of Object.entries(PATCH)) {
  if (p.spot.description.length < 40 || p.spot.description.length > 80) {
    bad.push(`${id} spot「${p.spot.name}」${p.spot.description.length}字`);
  }
}
if (bad.length) {
  for (const b of bad) console.log(`  ❌ ${b}`);
  process.exit(1);
}

for (const f of DATA) {
  const all = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const [id, p] of Object.entries(PATCH)) {
    const d = all.find((x) => x.id === id);
    if (!d) throw new Error(`${id} が無い`);
    for (const t of p.addTags) if (!(d.tags || []).includes(t)) d.tags = [...(d.tags || []), t];
    for (const c of p.addChips) if (!(d.reasonChips || []).includes(c)) d.reasonChips = [c, ...(d.reasonChips || [])];
    d.onsenLevel = p.onsenLevel;
    if (!(d.spots || []).some((s) => s && s.name === p.spot.name)) d.spots = [...(d.spots || []), p.spot];
    if (f === DATA[0]) {
      console.log(`■ ${id} / ${d.name}`);
      console.log(`   onsenLevel=${d.onsenLevel} tags=${d.tags.join(',')}`);
      console.log(`   spot追加 ${p.spot.name}（${p.spot.description.length}字）→ 計${d.spots.length}件`);
    }
  }
  fs.writeFileSync(f, JSON.stringify(all, null, 2) + '\n');
}
