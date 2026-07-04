// tests/quiz.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dueTest, generateQuiz } from '../js/quiz.js';
import { makePack } from './helpers.mjs';

// rng tuần hoàn cho kết quả xác định
const seqRng = () => { let i = 0; return () => ((i += 7) % 100) / 100; };

function studiedState(nDays, tests = []) {
  const days = {};
  for (let i = 1; i <= nDays; i++) {
    days[`2026-07-${String(i).padStart(2, '0')}`] = { vocab: true };
  }
  return { days, tests };
}

test('dueTest: chưa đủ 7 ngày học -> null', () => {
  assert.equal(dueTest(studiedState(6), '2026-07-10'), null);
});

test('dueTest: đủ 7 ngày -> week, đủ 30 -> month (ưu tiên month)', () => {
  assert.equal(dueTest(studiedState(7), '2026-07-10'), 'week');
  assert.equal(dueTest(studiedState(30), '2026-07-31'), 'month');
});

test('dueTest: chỉ đếm ngày học SAU lần test gần nhất cùng loại', () => {
  const s = studiedState(10, [{ date: '2026-07-08', kind: 'week', score: 7, total: 10 }]);
  assert.equal(dueTest(s, '2026-07-10'), null); // chỉ còn 07-09, 07-10 sau test
});

function bigPack(date) {
  const p = makePack(date);
  p.vocab = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot'].map((w, i) => ({
    word: `${w}-${date}`, ipa: '/x/', meaning_vi: `nghĩa ${w} ${date}`, example: `We use ${w}-${date} in the report.`, example_vi: 'ví dụ',
  }));
  return p;
}

test('generateQuiz: tuần 10 câu, tháng 20 câu, mỗi câu có 4 lựa chọn và answer đúng phạm vi', () => {
  const packs = [bigPack('2026-07-01'), bigPack('2026-07-02')];
  for (const [kind, n] of [['week', 10], ['month', 20]]) {
    const qs = generateQuiz({ packs, kind, level: 'b1', rng: seqRng() });
    assert.equal(qs.length, n);
    for (const q of qs) {
      assert.equal(q.options.length, 4);
      assert.ok(q.answer >= 0 && q.answer < 4);
      assert.equal(new Set(q.options).size, 4, 'options không trùng nhau');
      assert.ok(['en2vi', 'vi2en', 'fill', 'listen'].includes(q.type));
    }
  }
});

test('generateQuiz: câu fill che từ trong câu ví dụ, câu listen có tts', () => {
  const qs = generateQuiz({ packs: [bigPack('2026-07-01')], kind: 'week', level: 'b1', rng: seqRng() });
  const fill = qs.find((q) => q.type === 'fill');
  assert.ok(fill && fill.prompt.includes('____'));
  const listen = qs.find((q) => q.type === 'listen');
  assert.ok(listen && listen.tts && listen.tts.length > 0);
});

test('generateQuiz: level lệch phân bố (a2 không có vi2en, b2 có nhiều vi2en hơn en2vi)', () => {
  const packs = [bigPack('2026-07-01'), bigPack('2026-07-02')];
  const a2 = generateQuiz({ packs, kind: 'month', level: 'a2', rng: seqRng() });
  assert.equal(a2.filter((q) => q.type === 'vi2en').length, 0);
  const b2 = generateQuiz({ packs, kind: 'month', level: 'b2', rng: seqRng() });
  assert.ok(b2.filter((q) => q.type === 'vi2en').length > b2.filter((q) => q.type === 'en2vi').length);
});

test('generateQuiz: dưới 4 từ -> mảng rỗng', () => {
  assert.deepEqual(generateQuiz({ packs: [makePack('2026-07-01')], kind: 'week' }), []);
});
