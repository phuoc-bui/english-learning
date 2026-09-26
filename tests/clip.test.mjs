import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseShared, parseTime, formatTime, youtubeId, sceneUrl, tokenize, focusFromPicks, cardKey, esc,
} from '../js/clip.js';

test('parseShared: YouTube app gửi link trong text', () => {
  const r = parseShared({ title: 'Soul Land 2 EP 12', text: 'https://youtu.be/abc123XYZ?si=track', url: '' });
  assert.equal(r.url, 'https://youtu.be/abc123XYZ?si=track');
  assert.equal(r.title, 'Soul Land 2 EP 12');
  assert.equal(r.t, null);
  assert.equal(r.kind, null);
});

test('parseShared: tiêu đề lẫn trong text, có thời điểm, nhận ra YouTube Music', () => {
  const r = parseShared({ text: '"Perfect" https://music.youtube.com/watch?v=xyz&t=75' });
  assert.equal(r.title, 'Perfect');
  assert.equal(r.t, 75);
  assert.equal(r.kind, 'music');
});

test('parseShared: link web bất kỳ trong url', () => {
  const r = parseShared({ title: 'Đấu Phá tập 5', url: 'https://example.com/phim/tap-5' });
  assert.equal(r.url, 'https://example.com/phim/tap-5');
  assert.equal(r.title, 'Đấu Phá tập 5');
});

test('parseTime / formatTime', () => {
  assert.equal(parseTime('83'), 83);
  assert.equal(parseTime('1:23'), 83);
  assert.equal(parseTime('1:02:03'), 3723);
  assert.equal(parseTime('1m23s'), 83);
  assert.equal(parseTime(''), null);
  assert.equal(parseTime('abc'), null);
  assert.equal(formatTime(83), '1:23');
  assert.equal(formatTime(3723), '1:02:03');
});

test('youtubeId + sceneUrl bỏ si=, gắn giây', () => {
  assert.equal(youtubeId('https://www.youtube.com/watch?v=abc&si=x'), 'abc');
  assert.equal(youtubeId('https://youtube.com/shorts/def'), 'def');
  assert.equal(youtubeId('https://example.com/x'), null);
  assert.equal(sceneUrl('https://youtu.be/abc?si=x', 90), 'https://www.youtube.com/watch?v=abc&t=90s');
  assert.equal(sceneUrl('https://music.youtube.com/watch?v=abc', null), 'https://music.youtube.com/watch?v=abc');
  assert.equal(sceneUrl('https://example.com/x', 90), 'https://example.com/x');
});

test('tokenize + focusFromPicks giữ thứ tự câu', () => {
  const toks = tokenize("You're courting death, boy!");
  assert.deepEqual(toks, ["You're", 'courting', 'death', 'boy']);
  assert.equal(focusFromPicks(toks, new Set([2, 1])), 'courting death');
  assert.equal(cardKey('  Courting   Death '), 'courting death');
});

test('esc chặn HTML', () => {
  assert.equal(esc('<b>"x"</b>'), '&lt;b&gt;&quot;x&quot;&lt;/b&gt;');
});
