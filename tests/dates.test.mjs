import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localDateStr, addDays } from '../js/dates.js';

test('localDateStr formats local date with zero padding', () => {
  assert.equal(localDateStr(new Date(2026, 6, 2)), '2026-07-02');
  assert.equal(localDateStr(new Date(2026, 11, 31)), '2026-12-31');
});

test('addDays crosses month and year boundaries', () => {
  assert.equal(addDays('2026-07-31', 1), '2026-08-01');
  assert.equal(addDays('2026-07-01', -1), '2026-06-30');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-07-02', 0), '2026-07-02');
});
