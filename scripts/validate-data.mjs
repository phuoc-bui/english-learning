import { readFileSync, readdirSync } from 'node:fs';
import { validatePack, TRACKS } from '../js/pack.js';

const raw = JSON.parse(readFileSync('data/index.json', 'utf8'));
let failed = false;
const fail = (msg) => { console.error(msg); failed = true; };

// entry string legacy = { date, tracks: ['it'] } tại đường dẫn cũ
const entries = raw.map((e) => (typeof e === 'string' ? { date: e, tracks: ['it'], legacy: true } : e));
const expected = new Set();
const seenWords = Object.fromEntries(TRACKS.map((t) => [t, new Set()]));
let packCount = 0;

for (const e of entries) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) fail(`index: bad date "${e.date}"`);
  if (!Array.isArray(e.tracks) || e.tracks.length === 0) { fail(`index ${e.date}: tracks missing`); continue; }
  for (const t of e.tracks) {
    if (!TRACKS.includes(t)) { fail(`index ${e.date}: unknown track "${t}"`); continue; }
    const file = e.legacy ? `${e.date}.json` : `${e.date}-${t}.json`;
    expected.add(file);
    let pack;
    try {
      pack = JSON.parse(readFileSync(`data/packs/${file}`, 'utf8'));
    } catch {
      fail(`index lists ${e.date} (${t}) but data/packs/${file} is missing/bad JSON`);
      continue;
    }
    const errors = validatePack(pack, { requireTrack: !e.legacy });
    if (pack.date !== e.date) errors.push(`date field "${pack.date}" != index "${e.date}"`);
    if (!e.legacy && pack.track !== t) errors.push(`track field "${pack.track}" != filename track "${t}"`);
    for (const v of pack.vocab || []) {
      const w = v.word?.toLowerCase();
      if (seenWords[t].has(w)) errors.push(`duplicate word in track ${t}: "${v.word}"`);
      seenWords[t].add(w);
    }
    if (errors.length) {
      fail(`${file}:`);
      for (const er of errors) console.error(`  - ${er}`);
    }
    packCount++;
  }
}

for (const f of readdirSync('data/packs').filter((f) => f.endsWith('.json'))) {
  if (!expected.has(f)) fail(`data/packs/${f} exists but is missing from index.json`);
}

if (failed) { console.error('FAILED'); process.exit(1); }
console.log(`OK: ${packCount} packs across ${entries.length} dates`);
