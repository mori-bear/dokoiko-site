#!/usr/bin/env node
/**
 * newDestCandidates2.mjs — 1回目に落ちた候補の再判定＋差し替え候補。
 * Wikipedia は記事名を複数試し、座標を持つ記事に当たった時点で採用する
 * （「等々力渓谷」のように記事はあっても座標プロパティを持たない項目があるため）。
 */
import fs from 'fs';
const UA = { 'User-Agent': 'DokoIko-DataAudit/1.0 (tabidokoiko.com; contact@tabidokoiko.com)' };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const kmBetween = (a,b,c,d) => Math.hypot((a-c)*111,(b-d)*111*Math.cos(a*Math.PI/180));

// [id, 名前, 県, [Wikipedia候補...], OSM検索語]
const CANDIDATES = [
  ['todoroki-keikoku','等々力渓谷','東京都', ['等々力渓谷','等々力不動尊','等々力渓谷公園'], '等々力渓谷 東京都世田谷区'],
  ['yanaka',          '谷中',      '東京都', ['谷中霊園','谷中銀座商店街','谷中 (台東区)'], '谷中銀座商店街 東京都台東区'],
  ['kiyosumi',        '清澄庭園',  '東京都', ['清澄庭園'], '清澄庭園 東京都江東区'],
  ['miyagase',        '宮ヶ瀬湖',  '神奈川県', ['宮ヶ瀬湖','宮ヶ瀬ダム'], '宮ヶ瀬湖 神奈川県'],
  ['kobouyama',       '弘法山',    '神奈川県', ['弘法山 (神奈川県)','弘法山公園','弘法山'], '弘法山 神奈川県秦野市'],
  ['nagareyama-honcho','流山本町', '千葉県', ['流山市','流山本町'], '流山本町 江戸回廊 千葉県流山市'],
  ['oyama-afuri',     '大山阿夫利神社','神奈川県', ['大山阿夫利神社','大山 (神奈川県)'], '大山阿夫利神社 神奈川県伊勢原市'],
  ['shomyoji',        '称名寺',    '神奈川県', ['称名寺 (横浜市)','称名寺'], '称名寺 神奈川県横浜市金沢区'],
];

const existing = JSON.parse(fs.readFileSync('src/data/destinations.json','utf8'));
const norm = (s)=>String(s||'').replace(/[\s　・（）()「」【】]/g,'').replace(/(市|町|村|区|駅|温泉|公園|神社|寺|大橋)$/g,'');

async function wikiCoords(title){
  const url=`https://ja.wikipedia.org/w/api.php?action=query&prop=coordinates&titles=${encodeURIComponent(title)}&format=json&formatversion=2&redirects=1`;
  const r=await fetch(url,{headers:UA}); if(!r.ok) return null;
  const p=(await r.json())?.query?.pages?.[0]; const c=p?.coordinates?.[0];
  return c?{lat:c.lat,lng:c.lon,title:p.title}:null;
}
async function osmCoords(q){
  const r=await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=jp`,{headers:UA});
  if(!r.ok) return null; const j=await r.json();
  return j?.[0]?{lat:+j[0].lat,lng:+j[0].lon}:null;
}

const out=[];
for (const [id,name,pref,titles,osmQuery] of CANDIDATES){
  const rec={id,name,prefecture:pref,osmQuery,checks:{}};
  let w=null;
  for (const t of titles){ w=await wikiCoords(t); await sleep(350); if(w) break; }
  const o=await osmCoords(osmQuery); await sleep(1100);
  rec.wiki=w; rec.osm=o; rec.wikiTitle=w?.title??null;

  const dupName=existing.find(d=>d.name===name);
  const dupNorm=existing.filter(d=>norm(d.name)===norm(name)&&d.name!==name);
  const dupId=existing.find(d=>d.id===id);
  rec.checks.duplicate = dupId?`id重複:${dupId.name}`:dupName?`同名:${dupName.name}`:dupNorm.length?`類似名:${dupNorm.map(d=>d.name).join(',')}`:'なし';

  if(!w||!o){ rec.checks.coords=`取得不可 (wiki=${w?'o':'x'} osm=${o?'o':'x'})`; }
  else{
    const d=kmBetween(w.lat,w.lng,o.lat,o.lng); rec.distanceKm=+d.toFixed(2);
    rec.checks.coords = d<=5?`一致 ${d.toFixed(2)}km`:`不一致 ${d.toFixed(2)}km`;
    if(d<=5){ rec.lat=+((w.lat+o.lat)/2).toFixed(5); rec.lng=+((w.lng+o.lng)/2).toFixed(5); }
  }
  if(rec.lat!=null){
    const near=existing.filter(d=>typeof d.lat==='number').map(d=>({name:d.name,km:kmBetween(rec.lat,rec.lng,d.lat,d.lng)})).filter(x=>x.km<3).sort((a,b)=>a.km-b.km);
    rec.checks.nearby = near.length?near.map(x=>`${x.name}(${x.km.toFixed(1)}km)`).join(', '):'なし';
  }
  rec.pass = rec.checks.duplicate==='なし' && String(rec.checks.coords).startsWith('一致') && (rec.checks.nearby==='なし');
  out.push(rec);
  console.log(`${rec.pass?'✅':'❌'} ${name.padEnd(10)} ${pref.padEnd(4)} wiki=${rec.wikiTitle??'-'} 座標=${rec.checks.coords} 重複=${rec.checks.duplicate} 近接=${rec.checks.nearby??'-'}`);
}
fs.writeFileSync('logs/new_dest_candidates2.json', JSON.stringify(out,null,2));
console.log(`\n合格 ${out.filter(o=>o.pass).length} / ${out.length} 件`);
