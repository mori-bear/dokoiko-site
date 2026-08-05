// STEP2対象抽出: Haikuがokと判定した画像のうち、被写体の断定要素が弱く
// Sonnet再判定が必要なグレーゾーン候補を抽出する。
//   A. 一般名詞的な建物/施設（美術館・博物館等、外観だけでは同定困難）
//   B. 複数地点から撮影可能な被写体（富士山等の遠景山岳）
//   C. 類似形状の多い自然物（滝・岩・川・渓谷等）
// 出力: logs/vision_grayzone_targets.json（path一覧）
import fs from 'fs';

const results = JSON.parse(fs.readFileSync('logs/vision_full_audit.json', 'utf8'));

// A: 一般名詞的な施設語（固有性の弱い外観になりがち）
const FACILITY = /美術館|博物館|資料館|記念館|文学館|科学館|水族館|動物園|植物園|庭園|公園|展望台|展望室|タワー|ホール|会館|センター|道の駅|市場|駅舎|港|ターミナル|学校|校舎|洋館|邸|屋敷|城跡|神社|寺|温泉街|商店街/;
// B: 広域から見える山岳・遠景被写体
const WIDEVIEW = /富士山|富士|桜島|阿蘇|岩木山|鳥海山|磐梯山|大山|開聞岳|立山|白山|御嶽|石鎚|剣山|妙高|浅間山|岩手山|筑波山/;
// C: 類似形状の多い自然物
const NATURE = /滝|渓谷|峡|渓流|奇岩|岩|洞窟|鍾乳洞|川|河|湖|沼|池|浜|海岸|砂丘|湿原|高原|棚田|林|森|草原|岬/;

const targets = [];
for (const [path, r] of Object.entries(results)) {
  if (r.verdict !== 'ok') continue;
  if (!(r.model || '').includes('haiku')) continue;   // Haiku判定分のみ
  const text = `${r.ctx || ''} ${r.reason || ''}`;
  const cats = [];
  if (FACILITY.test(text)) cats.push('A施設');
  if (WIDEVIEW.test(text)) cats.push('B遠景');
  if (NATURE.test(text)) cats.push('C自然物');
  if (cats.length) targets.push({ path, cats, ctx: r.ctx });
}

fs.writeFileSync('logs/vision_grayzone_targets.json', JSON.stringify(targets, null, 1));
const byCat = { 'A施設': 0, 'B遠景': 0, 'C自然物': 0 };
for (const t of targets) for (const c of t.cats) byCat[c]++;
const haikuTotal = Object.values(results).filter(r => (r.model || '').includes('haiku')).length;
const haikuOk = Object.values(results).filter(r => (r.model || '').includes('haiku') && r.verdict === 'ok').length;
console.log(`Haiku判定 ${haikuTotal}件（ok ${haikuOk}）→ グレーゾーン抽出 ${targets.length}件`);
console.log('内訳(重複あり):', byCat);
