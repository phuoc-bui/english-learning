import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../js/store.js';
import { requiredActivities } from '../js/plan.js';

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

test('luật v1: ngày cũ đủ 4 hoạt động (kể cả interview trong data cũ) vẫn complete', () => {
  const s = createStore(fakeStorage({
    'office-english-v1': JSON.stringify({
      days: { '2026-07-01': { vocab: true, listening: true, speaking: true, interview: true } },
    }),
  }));
  assert.equal(s.isDayComplete('2026-07-01'), true);
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

test('markActivity bỏ qua activity không hợp lệ (interview không còn markable)', () => {
  const s = createStore(fakeStorage());
  s.markActivity('2026-07-04', 'interview');
  assert.equal(s.state.days['2026-07-04'], undefined);
});

test('luật v2 15p: đủ 3 hoạt động cốt lõi là complete', () => {
  const s = createStore(fakeStorage());
  s.setProfile({ track: 'it', level: 'b1', goals: [], minutes: 15, aiApp: 'chatgpt', onboardedAt: '2026-07-04' });
  for (const a of ['vocab', 'listening', 'speaking']) s.markActivity('2026-07-04', a);
  assert.equal(s.isDayComplete('2026-07-04'), true);
});

test('luật v2 30p: cần thêm hoạt động AI theo kế hoạch của ngày', () => {
  const s = createStore(fakeStorage());
  s.setProfile({ track: 'it', level: 'b1', goals: [], minutes: 30, aiApp: 'chatgpt', onboardedAt: '2026-07-04' });
  for (const a of ['vocab', 'listening', 'speaking']) s.markActivity('2026-07-04', a);
  assert.equal(s.isDayComplete('2026-07-04'), false);
  const kind = requiredActivities('2026-07-04', 30).find((a) => a.startsWith('ai_')).slice(3);
  s.setAiDone('2026-07-04', kind, true);
  assert.equal(s.isDayComplete('2026-07-04'), true);
  s.setAiDone('2026-07-04', kind, false); // toggle được (phòng bấm nhầm)
  assert.equal(s.isDayComplete('2026-07-04'), false);
});

test('setProfile lưu và tồn tại qua reload store', () => {
  const storage = fakeStorage();
  const p = { track: 'sales', level: 'a2', goals: ['work'], minutes: 30, aiApp: 'claude', onboardedAt: '2026-07-04' };
  createStore(storage).setProfile(p);
  assert.deepEqual(createStore(storage).state.profile, p);
});

test('addTestResult + markTestAiDone', () => {
  const s = createStore(fakeStorage());
  s.addTestResult({ date: '2026-07-10', kind: 'week', score: 8, total: 10 });
  assert.equal(s.state.tests.length, 1);
  s.markTestAiDone('2026-07-10', 'week');
  assert.equal(s.state.tests[0].ai, true);
});

test('import backup v1 (không có profile/aiDone/tests) vẫn hợp lệ, dùng mặc định', () => {
  const s = createStore(fakeStorage());
  s.importData(JSON.stringify({ days: { '2026-07-01': { vocab: true } }, srs: {} }));
  assert.equal(s.state.profile, null);
  assert.deepEqual(s.state.aiDone, {});
  assert.deepEqual(s.state.tests, []);
});

test('import từ chối profile/aiDone/tests sai kiểu', () => {
  const s = createStore(fakeStorage());
  assert.throws(() => s.importData('{"days":{},"profile":"x"}'));
  assert.throws(() => s.importData('{"days":{},"tests":{}}'));
});
