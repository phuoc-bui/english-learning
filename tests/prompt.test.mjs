import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AI_APPS, buildPrompt, taskDesc, buildAiTestPrompt } from '../js/prompt.js';
import { makePack } from './helpers.mjs';

const profile = { track: 'it', level: 'b1', goals: ['work', 'email'], minutes: 30, aiApp: 'chatgpt' };

test('buildPrompt chứa theme, từ vựng, trình độ và yêu cầu tổng kết tiếng Việt', () => {
  const pack = makePack('2026-07-04');
  for (const kind of ['conversation', 'speaking', 'writing']) {
    const p = buildPrompt(kind, pack, profile);
    assert.ok(p.includes(pack.theme), `${kind} thiếu theme`);
    assert.ok(p.includes(pack.vocab[0].word), `${kind} thiếu vocab`);
    assert.ok(/B1/.test(p), `${kind} thiếu level`);
    assert.ok(/Vietnamese/.test(p), `${kind} thiếu yêu cầu tổng kết`);
  }
});

test('AI_APPS: chatgpt/claude prefill qua ?q=, gemini không prefill, other không mở url', () => {
  assert.ok(AI_APPS.chatgpt.url('hello world').startsWith('https://chatgpt.com/?q=hello%20world'));
  assert.ok(AI_APPS.claude.url('xin chào').startsWith('https://claude.ai/new?q=xin%20ch'));
  assert.equal(AI_APPS.gemini.url('abc'), 'https://gemini.google.com/app');
  assert.equal(AI_APPS.other.url('abc'), null);
});

test('taskDesc trả mô tả tiếng Việt có theme', () => {
  const pack = makePack('2026-07-04');
  assert.ok(taskDesc('writing', pack).includes(pack.theme));
});

test('buildAiTestPrompt gồm từ vựng và chủ đề của kỳ', () => {
  const p = buildAiTestPrompt(['blocker', 'deploy'], ['Daily standup', 'Code review'], profile);
  assert.ok(p.includes('blocker') && p.includes('Code review'));
});
