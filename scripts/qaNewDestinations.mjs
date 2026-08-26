#!/usr/bin/env node
/** qaNewDestinations.mjs — 追加した新規destinationの妥当性を機械チェックする。 */
import fs from 'fs';
const NEW = JSON.parse(fs.readFileSync('scripts/newDestContent.json','utf8')).map(x=>x.id);
const d = JSON.parse(fs.readFileSync('src/data/destinations.json','utf8'));
const byId = Object.fromEntries(d.map(x=>[x.id,x]));
const PREF_BOX = { // 都県のおおよその緯度経度範囲（座標が県外に飛んでいないかの粗いチェック）
 '東京都':[35.5,36.0,138.9,139.95],'埼玉県':[35.75,36.3,138.7,139.95],
 '千葉県':[34.85,36.15,139.7,140.9],'神奈川県':[35.1,35.7,138.9,139.8]};
let ng=0;
const fail=(id,m)=>{console.log(`  ❌ ${byId[id]?.name??id}: ${m}`);ng++;};

console.log('■ 新規16件のQA');
for (const id of NEW){
  const x = byId[id];
  if(!x){ fail(id,'destinations.json に存在しない'); continue; }
  if(d.filter(v=>v.id===id).length>1) fail(id,'id重複');
  // 画像
  if(!fs.existsSync(`public/images/${id}/main.jpg`)) fail(id,'main.jpg が無い');
  for(const p of x.images||[]) if(!fs.existsSync('public'+p)) fail(id,`画像ファイル欠損 ${p}`);
  // spots に imageUrl があるならファイルもあるはず
  (x.spots||[]).forEach((s,i)=>{
    const has = !!s.imageUrl, file = fs.existsSync(`public/images/${id}/spot-${i+1}.jpg`);
    if(has!==file) fail(id,`spot-${i+1} の imageUrl とファイルが不一致 (url=${has} file=${file})`);
  });
  // 座標
  const b=PREF_BOX[x.prefecture];
  if(!b) fail(id,'想定外の都道府県');
  else if(!(x.lat>=b[0]&&x.lat<=b[1]&&x.lng>=b[2]&&x.lng<=b[3])) fail(id,`座標が県の範囲外 ${x.lat},${x.lng}`);
  // 必須フィールド
  for(const k of ['name','description','tags','spots','prefecture','lat','lng','railGateway','hotelSearch','travelTime','hotelLinks','imageCredit','catch','mainSpot'])
    if(x[k]==null||(Array.isArray(x[k])&&!x[k].length)) fail(id,`${k} が空`);
  // 文字数
  if(x.description.length<200||x.description.length>300) fail(id,`description ${x.description.length}字`);
  (x.spots||[]).forEach(s=>{ if(s.description.length<40||s.description.length>80) fail(id,`spot「${s.name}」${s.description.length}字`); });
  if((x.spots||[]).length!==3) fail(id,`spots ${x.spots?.length}件`);
  // 宿リンク（同県の既存と同じであること）
  const sib=d.find(v=>v.prefecture===x.prefecture&&!NEW.includes(v.id)&&v.hotelLinks);
  if(sib && JSON.stringify(sib.hotelLinks)!==JSON.stringify(x.hotelLinks)) fail(id,'hotelLinks が同県の既存と不一致');
  // クレジット
  if(!x.imageCredit?.url?.startsWith('https://commons.wikimedia.org/')) fail(id,'imageCredit.url が Commons でない');
  if(!x.imageCredit?.license || x.imageCredit.license==='unknown') fail(id,'ライセンス不明');
}
console.log(ng?`\nNG ${ng}件`:'\n✅ 全項目パス');

console.log('\n■ 追加後の都県別件数');
for(const p of ['東京都','埼玉県','千葉県','神奈川県'])
  console.log(`  ${p} ${d.filter(v=>(v.prefecture||'').includes(p)).length}件`);
console.log(`  総件数 ${d.length}`);
process.exit(ng?1:0);
