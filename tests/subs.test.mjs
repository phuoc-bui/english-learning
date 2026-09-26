import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSrtVtt, parseTranscript, parseSubs, cueIndexAt, loadSubs, saveSubs } from '../js/subs.js';
import { tokenSegments, tokenize } from '../js/clip.js';

test('parseSrtVtt: SRT có thẻ, nhiều dòng', () => {
  const srt = `1\n00:00:01,000 --> 00:00:03,500\n<i>You're courting</i>\ndeath!\n\n2\n00:01:02,250 --> 00:01:04,000\nHold back.\n`;
  assert.deepEqual(parseSrtVtt(srt), [
    { start: 1, end: 3.5, text: "You're courting death!" },
    { start: 62.25, end: 64, text: 'Hold back.' },
  ]);
});

test('parseSrtVtt: VTT, bỏ cue trùng liền kề', () => {
  const vtt = `WEBVTT\n\n00:05.000 --> 00:07.000 align:start\nHello there\n\n00:07.000 --> 00:08.000\nHello there\n\n00:08.000 --> 00:10.000\nGeneral Kenobi`;
  const cues = parseSubs(vtt);
  assert.equal(cues.length, 2);
  assert.deepEqual(cues[0], { start: 5, end: 8, text: 'Hello there' });
});

test('parseTranscript: bản chép lời YouTube (giờ dòng riêng + dòng a11y)', () => {
  const t = `0:05\n5 seconds\nWho dares to enter\nthe Tang Sect?\n1:02\n1 minute, 2 seconds\nStand back!\n`;
  assert.deepEqual(parseTranscript(t), [
    { start: 5, end: 62, text: 'Who dares to enter the Tang Sect?' },
    { start: 62, end: 67, text: 'Stand back!' },
  ]);
});

test('parseTranscript: giờ cùng dòng, có giờ:phút:giây', () => {
  const cues = parseSubs('0:03 First line\n1:00:00 Last line');
  assert.equal(cues[1].start, 3600);
  assert.equal(cues[0].text, 'First line');
});

test('cueIndexAt', () => {
  const cues = [{ start: 1 }, { start: 5 }, { start: 9 }];
  assert.equal(cueIndexAt(cues, 0.5), -1);
  assert.equal(cueIndexAt(cues, 1), 0);
  assert.equal(cueIndexAt(cues, 7), 1);
  assert.equal(cueIndexAt(cues, 100), 2);
});

test('saveSubs/loadSubs giữ tối đa 30 video', () => {
  const m = {};
  const st = { getItem: (k) => m[k] ?? null, setItem: (k, v) => { m[k] = v; } };
  for (let i = 0; i < 32; i++) saveSubs(`v${i}`, [{ start: i, end: i + 1, text: 'x' }], st);
  assert.equal(loadSubs('v0', st), null);
  assert.equal(loadSubs('v31', st)[0].start, 31);
  assert.equal(Object.keys(JSON.parse(m['office-english-subs'])).length, 30);
});

test('tokenSegments khớp chỉ số với tokenize', () => {
  const s = "Stand back, don't move!";
  const segs = tokenSegments(s);
  assert.equal(segs.map((x) => x.text).join(''), s);
  const toks = tokenize(s);
  for (const seg of segs.filter((x) => x.i != null)) assert.equal(toks[seg.i], seg.text);
});
