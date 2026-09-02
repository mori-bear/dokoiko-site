#!/usr/bin/env node
/** pingAnthropic.mjs — Vision判定が使える状態か（クレジット残高があるか）を1回だけ試す。 */
import fs from 'fs';
import Anthropic from '@anthropic-ai/sdk';
const env = fs.readFileSync('./.env', 'utf-8');
for (const line of env.split('\n')) { const m = line.match(/^([A-Z_]+)=(.+)$/); if (m) process.env[m[1]] = m[2].trim(); }
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
try {
  const r = await client.messages.create({
    model: 'claude-haiku-4-5', max_tokens: 16,
    messages: [{ role: 'user', content: 'ping とだけ返して' }],
  });
  console.log('✅ 使える:', r.content[0].text.trim());
} catch (e) {
  console.log('❌ 使えない:', String(e.message || e).slice(0, 200));
}
