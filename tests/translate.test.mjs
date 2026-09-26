import { test } from 'node:test';
import assert from 'node:assert/strict';
import { translate, _reset } from '../js/translate.js';

test('ưu tiên bộ dịch Chrome khi có', async () => {
  _reset();
  const env = { Translator: { availability: async () => 'available', create: async () => ({ translate: async (t) => `VI:${t}` }) } };
  const r = await translate('Hello', { env, fetchFn: async () => { throw new Error('không được gọi'); } });
  assert.deepEqual(r, { text: 'VI:Hello', engine: 'chrome' });
});

test('không có Chrome -> MyMemory, giải mã ký tự, có cache', async () => {
  _reset();
  let calls = 0;
  const fetchFn = async (url) => {
    calls++;
    assert.match(url, /langpair=en\|vi/);
    return { ok: true, json: async () => ({ responseStatus: 200, responseData: { translatedText: 'Xin chào &#39;b&#7841;n&#39;' } }) };
  };
  const r = await translate('Hello friend', { env: {}, fetchFn });
  assert.equal(r.engine, 'mymemory');
  assert.equal(r.text, "Xin chào 'bạn'");
  await translate('Hello friend', { env: {}, fetchFn });
  assert.equal(calls, 1);
});

test('MyMemory: đoạn dài được cắt nhiều lần gọi; lỗi hết lượt', async () => {
  _reset();
  let calls = 0;
  const ok = async () => { calls++; return { ok: true, json: async () => ({ responseStatus: 200, responseData: { translatedText: 'x' } }) }; };
  const long = Array(30).fill('This is a fairly long sentence for testing.').join(' ');
  const r = await translate(long, { env: {}, fetchFn: ok });
  assert.ok(calls >= 3);
  assert.match(r.text, /^x( x)+$/);
  _reset();
  const quota = async () => ({ ok: true, json: async () => ({ responseStatus: 429, responseDetails: 'YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY' }) });
  await assert.rejects(translate('Hi', { env: {}, fetchFn: quota }), (e) => e.code === 'limit');
});

test('gói Chrome chưa tải: dùng MyMemory lần này, tải ngầm cho lần sau', async () => {
  _reset();
  let created = false;
  const env = { Translator: { availability: async () => 'downloadable', create: async () => { created = true; return { translate: async (t) => `VI:${t}` }; } } };
  const mm = async () => ({ ok: true, json: async () => ({ responseStatus: 200, responseData: { translatedText: 'mm' } }) });
  const r1 = await translate('One', { env, fetchFn: mm });
  assert.equal(r1.engine, 'mymemory');
  await new Promise((res) => setTimeout(res, 0));
  assert.equal(created, true);
  const r2 = await translate('Two', { env, fetchFn: mm });
  assert.deepEqual(r2, { text: 'VI:Two', engine: 'chrome' });
});
