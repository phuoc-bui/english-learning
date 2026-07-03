import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, compare } from '../js/diff.js';

test('normalize lowercases and strips punctuation', () => {
  assert.deepEqual(normalize("I'm blocked, on the API!"), ["i'm", 'blocked', 'on', 'the', 'api']);
});

test('perfect match scores 100', () => {
  const r = compare('I finished the login page.', 'i finished the login page');
  assert.equal(r.score, 100);
  assert.ok(r.words.every((w) => w.ok));
});

test('partial match marks missing words', () => {
  const r = compare('I finished the login page', 'I finished the page');
  assert.equal(r.words.find((w) => w.text === 'login').ok, false);
  assert.equal(r.score, 80);
});

test('word order is respected (LCS, not bag of words)', () => {
  const r = compare('the cat sat', 'sat cat the');
  assert.ok(r.score < 100);
});

test('empty spoken scores 0', () => {
  assert.equal(compare('hello world', '').score, 0);
});
