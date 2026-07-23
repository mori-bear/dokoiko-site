// APIキー疎通確認 — visionAuditFull.mjs と同一設定で1リクエスト投げ、完全なエラーを表示
import fs from 'fs';
import Anthropic from '@anthropic-ai/sdk';

const env = fs.readFileSync('./.env', 'utf-8');
for (const line of env.split('\n')) { const m = line.match(/^([A-Z_]+)=(.+)$/); if (m) process.env[m[1]] = m[2].trim(); }
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const model = process.argv[2] || 'claude-sonnet-4-6';
try {
  const res = await client.messages.create({ model, max_tokens: 20, messages: [{ role: 'user', content: 'ping。1文字で返答。' }] });
  console.log(`OK model=${model}:`, res.content[0].text);
} catch (e) {
  console.log(`NG model=${model} status=${e.status}`);
  console.log(String(e.message).slice(0, 400));
}
