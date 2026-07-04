// tests/plan.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AI_KINDS, dayIndex, aiKindsFor, requiredActivities } from '../js/plan.js';

test('dayIndex tăng 1 mỗi ngày', () => {
  assert.equal(dayIndex('2026-07-05') - dayIndex('2026-07-04'), 1);
  assert.equal(dayIndex('2026-08-01') - dayIndex('2026-07-31'), 1);
});

test('15 phút: không có hoạt động AI', () => {
  assert.deepEqual(aiKindsFor('2026-07-04', 15), []);
  assert.deepEqual(requiredActivities('2026-07-04', 15), ['vocab', 'listening', 'speaking']);
});

test('30 phút: 1 hoạt động AI, xoay vòng theo ngày', () => {
  const kinds = ['2026-07-04', '2026-07-05', '2026-07-06'].map((d) => aiKindsFor(d, 30)[0]);
  assert.deepEqual([...kinds].sort(), [...AI_KINDS].sort()); // 3 ngày liên tiếp đủ 3 loại
  assert.equal(aiKindsFor('2026-07-04', 30).length, 1);
});

test('45 phút: 2 hoạt động AI khác nhau', () => {
  const kinds = aiKindsFor('2026-07-04', 45);
  assert.equal(kinds.length, 2);
  assert.notEqual(kinds[0], kinds[1]);
  assert.deepEqual(
    requiredActivities('2026-07-04', 45),
    ['vocab', 'listening', 'speaking', `ai_${kinds[0]}`, `ai_${kinds[1]}`],
  );
});

test('minutes lạ/undefined coi như 15', () => {
  assert.deepEqual(requiredActivities('2026-07-04', undefined), ['vocab', 'listening', 'speaking']);
});
