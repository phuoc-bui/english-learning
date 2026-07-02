import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePack } from '../js/pack.js';
import { makePack } from './helpers.mjs';

test('valid pack has no errors', () => {
  assert.deepEqual(validatePack(makePack('2026-07-02')), []);
});

test('non-object pack is rejected', () => {
  assert.ok(validatePack(null).length > 0);
  assert.ok(validatePack('hi').length > 0);
});

test('bad date format is rejected', () => {
  const p = makePack('2026-07-02');
  p.date = '02/07/2026';
  assert.ok(validatePack(p).some((e) => e.includes('date')));
});

test('vocab item missing field is rejected', () => {
  const p = makePack('2026-07-02');
  delete p.vocab[0].meaning_vi;
  assert.ok(validatePack(p).some((e) => e.includes('meaning_vi')));
});

test('listening answer index out of range is rejected', () => {
  const p = makePack('2026-07-02');
  p.listening.questions[0].answer = 9;
  assert.ok(validatePack(p).some((e) => e.includes('answer')));
});

test('invalid voice is rejected', () => {
  const p = makePack('2026-07-02');
  p.listening.lines[0].voice = 'robot';
  assert.ok(validatePack(p).some((e) => e.includes('voice')));
});

test('empty shadowing is rejected', () => {
  const p = makePack('2026-07-02');
  p.shadowing = [];
  assert.ok(validatePack(p).some((e) => e.includes('shadowing')));
});

test('interview with bad type is rejected', () => {
  const p = makePack('2026-07-02');
  p.interview[0].type = 'weird';
  assert.ok(validatePack(p).some((e) => e.includes('type')));
});
