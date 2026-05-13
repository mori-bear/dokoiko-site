import fs from 'fs';

const destinations = JSON.parse(fs.readFileSync('./src/data/destinations.json', 'utf8'));

const proper = destinations.filter(d => {
  const desc = d.description || '';
  return desc.length >= 200 && d.spots && d.spots.length >= 3;
});

const weak = destinations.filter(d => {
  const desc = d.description || '';
  return desc.length < 150 || /を代表するスポット|は必見の場所/.test(desc);
});

const middle = destinations.filter(d => !proper.includes(d) && !weak.includes(d));

console.log(`=== 全目的地分類 ===\n`);
console.log(`✨ 記事になってる: ${proper.length}件`);
console.log(`📍 スポット紹介だけ: ${weak.length}件`);
console.log(`🔄 その他: ${middle.length}件\n`);

const csv = [['分類', '名前', '都道府県', 'description長', 'spots数', 'reasonChips数']];
proper.forEach(d => csv.push(['✨記事', d.name, d.prefecture, d.description.length, d.spots.length, d.reasonChips?.length || 0]));
weak.forEach(d => csv.push(['📍スポット', d.name, d.prefecture, (d.description || '').length, d.spots?.length || 0, d.reasonChips?.length || 0]));
middle.forEach(d => csv.push(['🔄その他', d.name, d.prefecture, (d.description || '').length, d.spots?.length || 0, d.reasonChips?.length || 0]));

fs.writeFileSync('/tmp/classification.csv', csv.map(r => r.join(',')).join('\n'));
console.log('✅ 分類結果を CSV で出力しました');
console.log('\n【サマリー】');
console.log(`記事になってる率: ${(proper.length/destinations.length*100).toFixed(1)}%`);
console.log(`改善必要な率: ${(weak.length/destinations.length*100).toFixed(1)}%`);

console.log('\n【都道府県別（記事になってる件数 上位10）】');
const prefs = {};
proper.forEach(d => { prefs[d.prefecture] = (prefs[d.prefecture] || 0) + 1; });
Object.entries(prefs).sort((a,b)=>b[1]-a[1]).slice(0,10).forEach(([p,c]) => console.log(`${p}: ${c}件`));
