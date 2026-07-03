import { readFileSync, readdirSync } from 'node:fs';
import { validatePack } from '../js/pack.js';

const index = JSON.parse(readFileSync('data/index.json', 'utf8'));
const files = readdirSync('data/packs').filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''));
let failed = false;
const seenWords = new Set();

for (const f of files) {
  if (!index.includes(f)) {
    console.error(`data/packs/${f}.json exists but is missing from index.json`);
    failed = true;
  }
}

for (const date of index) {
  if (!files.includes(date)) {
    console.error(`index.json lists ${date} but pack file is missing`);
    failed = true;
    continue;
  }
  const pack = JSON.parse(readFileSync(`data/packs/${date}.json`, 'utf8'));
  const errors = validatePack(pack);
  if (pack.date !== date) errors.push(`date field "${pack.date}" != filename "${date}"`);
  for (const v of pack.vocab || []) {
    const w = v.word?.toLowerCase();
    if (seenWords.has(w)) errors.push(`duplicate word across packs: "${v.word}"`);
    seenWords.add(w);
  }
  if (errors.length) {
    console.error(`${date}:`);
    for (const e of errors) console.error(`  - ${e}`);
    failed = true;
  }
}

if (failed) {
  console.error('FAILED');
  process.exit(1);
}
console.log(`OK: ${index.length} packs, ${seenWords.size} unique words`);
