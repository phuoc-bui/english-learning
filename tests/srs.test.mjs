import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialCard, review, isDue } from '../js/srs.js';

const T = '2026-07-02';

test('new card is due immediately', () => {
  assert.equal(isDue(initialCard(), T), true);
});

test('first good review schedules 1 day out', () => {
  const c = review(initialCard(), 'good', T);
  assert.equal(c.due, '2026-07-03');
  assert.equal(c.reps, 1);
  assert.equal(isDue(c, T), false);
  assert.equal(isDue(c, '2026-07-03'), true);
});

test('second good review schedules 3 days out', () => {
  let c = review(initialCard(), 'good', T);
  c = review(c, 'good', '2026-07-03');
  assert.equal(c.interval, 3);
  assert.equal(c.due, '2026-07-06');
});

test('third good review multiplies interval by ease', () => {
  let c = review(initialCard(), 'good', T);
  c = review(c, 'good', '2026-07-03');
  c = review(c, 'good', '2026-07-06');
  assert.ok(c.interval >= 7, `interval ${c.interval} should be >= 7`);
});

test('hard lowers ease with floor 1.3', () => {
  let c = initialCard();
  for (let i = 0; i < 20; i++) c = review(c, 'hard', T);
  assert.equal(c.ease, 1.3);
});

test('forgot resets reps and makes card due today', () => {
  let c = review(initialCard(), 'good', T);
  c = review(c, 'forgot', '2026-07-03');
  assert.equal(c.reps, 0);
  assert.equal(c.due, '2026-07-03');
  assert.equal(isDue(c, '2026-07-03'), true);
});
