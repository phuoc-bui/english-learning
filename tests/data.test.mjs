import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLatestPack, normalizeIndex, packPath } from '../js/data.js';
import { makePack } from './helpers.mjs';

function stubFetch(files) {
  return async (url) => {
    if (url in files) return { ok: true, json: async () => files[url] };
    return { ok: false, json: async () => { throw new Error('404'); } };
  };
}

const IDX = 'data/index.json';

test('normalizeIndex: entry string legacy thành {date, tracks:[it]}', () => {
  const [a, b] = normalizeIndex(['2026-07-01', { date: '2026-07-02', tracks: ['office'] }]);
  assert.deepEqual({ date: a.date, tracks: a.tracks }, { date: '2026-07-01', tracks: ['it'] });
  assert.equal(packPath(a, 'it'), 'data/packs/2026-07-01.json');
  assert.equal(packPath(b, 'office'), 'data/packs/2026-07-02-office.json');
});

test('tải gói hôm nay đúng track', async () => {
  const f = stubFetch({
    [IDX]: [{ date: '2026-07-04', tracks: ['it', 'office'] }],
    'data/packs/2026-07-04-office.json': makePack('2026-07-04', 'office'),
  });
  const p = await loadLatestPack('2026-07-04', 'office', f);
  assert.equal(p.track, 'office');
});

test('bỏ ngày tương lai, ưu tiên gói cũ hơn CỦA TRACK trước khi fallback', async () => {
  const f = stubFetch({
    [IDX]: [
      { date: '2026-07-01', tracks: ['it', 'sales'] },
      { date: '2026-07-03', tracks: ['it'] },
      { date: '2026-07-09', tracks: ['it', 'sales'] },
    ],
    'data/packs/2026-07-01-sales.json': makePack('2026-07-01', 'sales'),
    'data/packs/2026-07-01-it.json': makePack('2026-07-01', 'it'),
    'data/packs/2026-07-03-it.json': makePack('2026-07-03', 'it'),
  });
  const p = await loadLatestPack('2026-07-04', 'sales', f);
  assert.equal(p.track, 'sales'); // gói sales 07-01 thắng gói it 07-03
});

test('track không có gói nào -> fallback it', async () => {
  const f = stubFetch({
    [IDX]: [{ date: '2026-07-03', tracks: ['it'] }],
    'data/packs/2026-07-03-it.json': makePack('2026-07-03', 'it'),
  });
  const p = await loadLatestPack('2026-07-04', 'finance', f);
  assert.equal(p.track, 'it');
});

test('gói lỗi schema bị bỏ qua, lấy ngày cũ hơn', async () => {
  const f = stubFetch({
    [IDX]: [{ date: '2026-07-01', tracks: ['it'] }, { date: '2026-07-02', tracks: ['it'] }],
    'data/packs/2026-07-02-it.json': { date: '2026-07-02' },
    'data/packs/2026-07-01-it.json': makePack('2026-07-01', 'it'),
  });
  const p = await loadLatestPack('2026-07-02', 'it', f);
  assert.equal(p.date, '2026-07-01');
});

test('index legacy string vẫn đọc được (đường dẫn cũ)', async () => {
  const legacy = makePack('2026-07-01');
  delete legacy.track;
  const f = stubFetch({ [IDX]: ['2026-07-01'], 'data/packs/2026-07-01.json': legacy });
  const p = await loadLatestPack('2026-07-02', 'it', f);
  assert.equal(p.date, '2026-07-01');
});

test('không có gì hợp lệ -> throw', async () => {
  const f = stubFetch({ [IDX]: [] });
  await assert.rejects(() => loadLatestPack('2026-07-02', 'it', f), /no valid pack/);
});
