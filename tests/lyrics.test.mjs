import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanTitle, parseLrc, pickBest, findLyrics } from '../js/lyrics.js';

test('cleanTitle bỏ phần thừa của tiêu đề YouTube', () => {
  assert.equal(cleanTitle('Ed Sheeran - Perfect (Official Music Video)'), 'Ed Sheeran - Perfect');
  assert.equal(cleanTitle('IMAGINE DRAGONS - Believer [4K] | Lyrics'), 'IMAGINE DRAGONS - Believer');
  assert.equal(cleanTitle('Alan Walker - Faded ft. Iselin Solheim'), 'Alan Walker - Faded');
  assert.equal(cleanTitle('Perfect'), 'Perfect');
});

test('parseLrc: nhiều mốc trên 1 dòng, bỏ dòng trống và thẻ meta', () => {
  const cues = parseLrc('[ar:Ed Sheeran]\n[00:05.20]I found a love\n[00:10.00][01:10.00]Darling just dive right in\n[00:15.00]\n');
  assert.deepEqual(cues.map((c) => [c.start, c.text]), [
    [5.2, 'I found a love'], [10, 'Darling just dive right in'], [70, 'Darling just dive right in'],
  ]);
  assert.equal(cues[0].end, 10);
});

test('pickBest chọn bản có giờ, gần độ dài video', () => {
  const rs = [
    { duration: 300, syncedLyrics: '[00:01.00]a' },
    { duration: 263, syncedLyrics: '[00:01.00]b' },
    { duration: 263, plainLyrics: 'c' },
  ];
  assert.equal(pickBest(rs, 264).duration, 263);
  assert.equal(pickBest(rs, 100), null);
  assert.equal(pickBest([{ plainLyrics: 'x' }], 100), null);
  assert.equal(pickBest(rs, 0).duration, 300);
});

test('findLyrics: thành công / chỉ có lời thường / lỗi mạng', async () => {
  const ok = async () => ({ ok: true, json: async () => [{ artistName: 'Ed Sheeran', trackName: 'Perfect', duration: 263, syncedLyrics: '[00:05.00]I found a love' }] });
  const r = await findLyrics('Ed Sheeran Perfect', 263, ok);
  assert.equal(r.label, 'Ed Sheeran – Perfect');
  assert.equal(r.cues[0].text, 'I found a love');
  const plain = async () => ({ ok: true, json: async () => [{ plainLyrics: 'x' }] });
  assert.equal((await findLyrics('q', 0, plain)).reason, 'plain');
  const bad = async () => { throw new Error('offline'); };
  assert.equal((await findLyrics('q', 0, bad)).reason, 'network');
});
