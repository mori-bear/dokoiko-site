import { readFileSync, writeFileSync } from 'fs';

const path = './src/data/destinations.json';
const data = JSON.parse(readFileSync(path, 'utf8'));

// railGateway（私鉄・モノレール含む）→ ICカード判定テーブル
// null = JR非対応圏または鉄道アクセス不可
const STATION_IC = {
  '犬山駅':     null,     // 名鉄（Toica圏）
  '高野山駅':   'icoca',  // 南海（ICOCA圏）
  '詫間駅':     'icoca',  // JR四国（e5489圏）
  '橿原神宮前駅': 'icoca', // 近鉄（ICOCA圏）
  '那覇空港駅': null,     // ゆいレール（JRなし）
  '秩父駅':     'suica',  // 西武・秩父鉄道（Suica圏）
  '賢島駅':     'icoca',  // 近鉄（ICOCA圏）
  '鬼怒川温泉駅': 'suica', // 東武（Suica圏）
  '常滑駅':     null,     // 名鉄（Toica圏）
  '豊田市駅':   null,     // 名鉄（Toica圏）
  '嵐山駅':     'icoca',  // 阪急・嵯峨野線（ICOCA圏）
};

let stats = { suica: 0, icoca: 0, nimoca: 0, null: 0 };

for (const d of data) {
  // railProvider 正規化: east → ekinet、kyushu → jrkyushu
  if (d.railProvider === 'east')   d.railProvider = 'ekinet';
  if (d.railProvider === 'kyushu') d.railProvider = 'jrkyushu';

  let ic;
  switch (d.railProvider) {
    case 'ekinet':   ic = 'suica';  break;
    case 'e5489':    ic = 'icoca';  break;
    case 'jrkyushu': ic = 'nimoca'; break;
    default: {
      // railProvider 未設定の85件：railGateway駅名で個別判定
      const gw = d.railGateway;
      if (!gw) {
        ic = null; // null / キー欠損 → 鉄道アクセス不可
      } else if (gw in STATION_IC) {
        ic = STATION_IC[gw];
      } else {
        ic = null; // 判定不能
      }
    }
  }

  d.icCard = ic;
  stats[ic === null ? 'null' : ic]++;
}

writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
console.log('✅ icCard追加・railProvider正規化完了');
console.log(`  suica:  ${stats.suica}件`);
console.log(`  icoca:  ${stats.icoca}件`);
console.log(`  nimoca: ${stats.nimoca}件`);
console.log(`  null:   ${stats.null}件`);
console.log(`  合計:   ${data.length}件`);

// railProvider正規化後の内訳
const rp = {};
for (const d of data) {
  const k = d.railProvider ?? '__undefined__';
  rp[k] = (rp[k] || 0) + 1;
}
console.log('\nrailProvider 正規化後:');
Object.entries(rp).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>console.log(`  ${v} ${k}`));
