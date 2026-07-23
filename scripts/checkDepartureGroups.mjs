// DEPARTURE_GROUPS が DEPARTURES を完全網羅しているか検証
import { DEPARTURES, DEPARTURE_GROUPS } from '../src/scripts/dokoikoConstants.js';

const inGroups = new Set(DEPARTURE_GROUPS.flatMap(g => g.cities));
const missing = DEPARTURES.filter(c => !inGroups.has(c));
const unknown = [...inGroups].filter(c => !DEPARTURES.includes(c));

console.log(`DEPARTURES: ${DEPARTURES.length}都市 / グループ収載(重複除く): ${inGroups.size}都市`);
console.log(`グループ漏れ: ${missing.length ? missing.join(', ') : 'なし'}`);
console.log(`DEPARTURESに無い都市: ${unknown.length ? unknown.join(', ') : 'なし'}`);
process.exit(missing.length || unknown.length ? 1 : 0);
