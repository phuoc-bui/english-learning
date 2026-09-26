// Dịch Anh -> Việt: ưu tiên bộ dịch có sẵn trong Chrome (chạy trên máy, miễn phí),
// không có thì dùng MyMemory (miễn phí, không cần key, giới hạn ~5.000 ký tự/ngày).
import { stripTags } from './news.js';

const MYMEMORY = 'https://api.mymemory.translated.net/get';
const cache = new Map();
let chromeTranslator = null;
let chromeTried = false;

async function viaChrome(text, env) {
  const T = env.Translator;
  if (!T) return null;
  if (!chromeTranslator && !chromeTried) {
    chromeTried = true;
    try {
      const opts = { sourceLanguage: 'en', targetLanguage: 'vi' };
      const avail = await T.availability(opts);
      if (avail === 'available') chromeTranslator = await T.create(opts);
      // gói ngôn ngữ chưa có: tải ngầm, lần này dịch bằng MyMemory
      else if (avail === 'downloadable' || avail === 'downloading') T.create(opts).then((t) => { chromeTranslator = t; }).catch(() => {});
    } catch { chromeTranslator = null; }
  }
  if (!chromeTranslator) return null;
  try { return await chromeTranslator.translate(text); } catch { return null; }
}

async function viaMyMemory(text, fetchFn) {
  // MyMemory nhận tối đa 500 byte mỗi lần -> cắt theo câu nếu dài
  const chunks = String(text).match(/[^.!?]+[.!?]*\s*/g) || [text];
  const parts = [];
  let buf = '';
  for (const c of chunks) {
    if (new TextEncoder().encode(buf + c).length > 450 && buf) { parts.push(buf); buf = ''; }
    buf += c;
  }
  if (buf) parts.push(buf);
  const out = [];
  for (const p of parts) {
    const res = await fetchFn(`${MYMEMORY}?q=${encodeURIComponent(p.trim())}&langpair=en|vi`);
    if (!res.ok) throw Object.assign(new Error('network'), { code: 'network' });
    const j = await res.json();
    const status = Number(j.responseStatus);
    if (status !== 200) {
      const limit = status === 429 || /quota|limit|free translations/i.test(j.responseDetails || '');
      throw Object.assign(new Error(j.responseDetails || 'error'), { code: limit ? 'limit' : 'server' });
    }
    out.push(stripTags(j.responseData?.translatedText || ''));
  }
  return out.join(' ');
}

// -> { text, engine: 'chrome' | 'mymemory' }; lỗi ném Error có code 'network' | 'limit' | 'server'
export async function translate(text, { fetchFn = fetch, env = globalThis } = {}) {
  const key = String(text).trim();
  if (!key) return { text: '', engine: 'none' };
  if (cache.has(key)) return cache.get(key);
  let r;
  const c = await viaChrome(key, env);
  if (c) r = { text: c, engine: 'chrome' };
  else {
    try { r = { text: await viaMyMemory(key, fetchFn), engine: 'mymemory' }; } catch (e) {
      if (!e.code) e.code = 'network';
      throw e;
    }
  }
  cache.set(key, r);
  return r;
}

export const ENGINE_LABEL = { chrome: 'bộ dịch Chrome (trên máy)', mymemory: 'MyMemory' };
export const TR_ERR = {
  network: 'Không dịch được — kiểm tra mạng.',
  limit: 'Hết lượt dịch miễn phí hôm nay (MyMemory). Dùng Chrome máy tính để dịch không giới hạn.',
  server: 'Dịch vụ dịch đang lỗi, thử lại sau.',
};

// cho test: xoá cache + trạng thái Chrome
export function _reset() { cache.clear(); chromeTranslator = null; chromeTried = false; }
