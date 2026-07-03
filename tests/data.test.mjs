import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLatestPack } from '../js/data.js';
import { makePack } from './helpers.mjs';

function stubFetch(files) {
  return async (url) => {
    if (url in files) return { ok: true, json: async () => files[url] };
    return { ok: false, json: async () => { throw new Error('404'); } };
  };
}

test("loads today's pack when available", async () => {
  const f = stubFetch({
    'data/index.json': ['2026-07-01', '2026-07-02'],
    'data/packs/2026-07-02.json': makePack('2026-07-02'),
  });
  const p = await loadLatestPack('2026-07-02', f);
  assert.equal(p.date, '2026-07-02');
});

test('ignores future dates, picks latest past pack', async () => {
  const f = stubFetch({
    'data/index.json': ['2026-07-01', '2026-07-05'],
    'data/packs/2026-07-01.json': makePack('2026-07-01'),
    'data/packs/2026-07-05.json': makePack('2026-07-05'),
  });
  const p = await loadLatestPack('2026-07-02', f);
  assert.equal(p.date, '2026-07-01');
});

test('skips invalid pack and falls back to older one', async () => {
  const f = stubFetch({
    'data/index.json': ['2026-07-01', '2026-07-02'],
    'data/packs/2026-07-02.json': { date: '2026-07-02' },
    'data/packs/2026-07-01.json': makePack('2026-07-01'),
  });
  const p = await loadLatestPack('2026-07-02', f);
  assert.equal(p.date, '2026-07-01');
});

test('throws when nothing valid exists', async () => {
  const f = stubFetch({ 'data/index.json': [] });
  await assert.rejects(() => loadLatestPack('2026-07-02', f), /no valid pack/);
});
