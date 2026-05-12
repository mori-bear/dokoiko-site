import fs from 'fs';

const destinations = JSON.parse(fs.readFileSync('./src/data/destinations.json', 'utf8'));

let fixed = 0;

destinations.forEach(dest => {
  if (dest.spots) {
    dest.spots.forEach(spot => {
      // description がない or 短すぎたら修正
      if (!spot.description || spot.description.length < 15) {
        // spot.name と spot.category から自動生成
        spot.description = `${dest.name}を代表する${spot.category || 'スポット'}。${spot.name}は必見の場所です。`;
        fixed++;
      }
    });
  }
});

fs.writeFileSync('./src/data/destinations.json', JSON.stringify(destinations, null, 2));
console.log(`✅ ${fixed}個の spots を修正しました`);
