#!/usr/bin/env node
import fs from 'fs';
import Anthropic from '@anthropic-ai/sdk';
const envContent = fs.readFileSync('./.env', 'utf-8');
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.+)$/);
  if (m) process.env[m[1]] = m[2].trim();
}
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const DEST_FILE = './src/data/destinations.json';
const dests = JSON.parse(fs.readFileSync(DEST_FILE, 'utf-8'));
const targets = JSON.parse(fs.readFileSync('/tmp/audit_low_score.json', 'utf-8'));
console.log(`📝 リライト: ${targets.length}件`);

const SYSTEM = `日本の旅情ライター。各destinationを220-280字で:
- 固有名詞5つ以上, 五感表現1つ以上, 「ます/です」3回以下, 200字以上
- 紋切り型禁止
出力: 純粋なJSONのみ`;

async function rewrite(d) {
  const userMsg = `次のdestinationを220-280字でリライト。
- name: ${d.name}（${d.prefecture}）
- tags: ${(d.tags||[]).slice(0,4).join('・')}
- spots: ${(d.spots||[]).map(s=>s.name).slice(0,3).join('・')}

形式: {"description":"..."}`;
  const res = await client.messages.create({
    model: 'claude-sonnet-4-6', max_tokens: 1500, system: SYSTEM,
    messages: [{ role: 'user', content: userMsg }],
  });
  const t = res.content[0].text.trim();
  const m = t.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('no JSON');
  return JSON.parse(m[0]).description;
}

let success = 0;
for (const t of targets) {
  const d = dests.find(x => x.id === t.id);
  if (!d) continue;
  try {
    const desc = await rewrite(d);
    if (desc && desc.length >= 200) {
      d.description = desc.slice(0, 320);
      success++;
      console.log(`✓ ${t.id}`);
    }
  } catch (e) { console.log(`✗ ${t.id}: ${e.message}`); }
  await new Promise(r => setTimeout(r, 1200));
}
fs.writeFileSync(DEST_FILE, JSON.stringify(dests, null, 2));
console.log(`\n=== ${success}/${targets.length}件成功 ===`);
