import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../js/store.js';

function fakeStorage(initial = {}) {
  const m = { ...initial };
  return {
    getItem: (k) => (k in m ? m[k] : null),
    setItem: (k, v) => { m[k] = String(v); },
  };
}

const ACTS = ['vocab', 'listening', 'speaking', 'interview'];
function completeDay(store, date) {
  for (const a of ACTS) store.markActivity(date, a);
}

test('fresh store has empty state', () => {
  const s = createStore(fakeStorage());
  assert.deepEqual(s.state.srs, {});
  assert.equal(s.computeStreak('2026-07-02'), 0);
});

test('corrupt storage falls back to empty state', () => {
  const s = createStore(fakeStorage({ 'office-english-v1': '{{{not json' }));
  assert.deepEqual(s.state.days, {});
});

test('day complete requires all 4 activities', () => {
  const s = createStore(fakeStorage());
  s.markActivity('2026-07-02', 'vocab');
  assert.equal(s.isDayComplete('2026-07-02'), false);
  completeDay(s, '2026-07-02');
  assert.equal(s.isDayComplete('2026-07-02'), true);
});

test('streak counts consecutive complete days; incomplete today does not break it', () => {
  const s = createStore(fakeStorage());
  completeDay(s, '2026-06-30');
  completeDay(s, '2026-07-01');
  assert.equal(s.computeStreak('2026-07-02'), 2);
  completeDay(s, '2026-07-02');
  assert.equal(s.computeStreak('2026-07-02'), 3);
});

test('gap breaks streak but longest streak remembers', () => {
  const s = createStore(fakeStorage());
  completeDay(s, '2026-06-25');
  completeDay(s, '2026-06-26');
  completeDay(s, '2026-06-27');
  completeDay(s, '2026-07-01');
  assert.equal(s.computeStreak('2026-07-02'), 1);
  assert.equal(s.computeLongestStreak(), 3);
});

test('speaking seconds accumulate', () => {
  const s = createStore(fakeStorage());
  s.addSpeakingSeconds('2026-07-02', 30);
  s.addSpeakingSeconds('2026-07-02', 15);
  assert.equal(s.state.days['2026-07-02'].speakingSeconds, 45);
});

test('export/import roundtrip persists across store instances', () => {
  const storage = fakeStorage();
  const s1 = createStore(storage);
  completeDay(s1, '2026-07-02');
  const backup = s1.exportData();
  const s2 = createStore(fakeStorage());
  s2.importData(backup);
  assert.equal(s2.isDayComplete('2026-07-02'), true);
});

test('import rejects garbage', () => {
  const s = createStore(fakeStorage());
  assert.throws(() => s.importData('not json'));
  assert.throws(() => s.importData('{"nope": true}'));
  assert.throws(() => s.importData('{"days": []}'), /File backup không hợp lệ/);
});

test('computeStreak stops at the first incomplete day, does not skip gaps', () => {
  const s = createStore(fakeStorage());
  completeDay(s, '2026-06-28');
  completeDay(s, '2026-06-29');
  // 2026-06-30 intentionally left incomplete (gap)
  completeDay(s, '2026-07-01');
  assert.equal(s.computeStreak('2026-07-02'), 1); // only 07-01 counts; 06-28/06-29 run is not reachable
});
