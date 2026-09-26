// Phụ đề cho màn Xem: đọc file .srt/.vtt hoặc bản chép lời dán từ YouTube, lưu theo video.
import { parseTime } from './clip.js';

const KEY = 'office-english-subs';
const MAX_VIDEOS = 30;

const cleanText = (s) => s
  .replace(/<[^>]+>/g, '') // thẻ <i>, <c.color>, <00:00:01.000>
  .replace(/\{\\[^}]*\}/g, '') // thẻ ASS {\an8}
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/\s+/g, ' ')
  .trim();

// "00:01:02,500" | "01:02.5" -> giây (số thực)
function stamp(s) {
  const m = s.trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?$/);
  if (!m) return null;
  return Number(m[1] || 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(`0.${m[4] || 0}`);
}

export function parseSrtVtt(text) {
  const cues = [];
  for (const block of String(text).replace(/\r/g, '').split(/\n{2,}/)) {
    const lines = block.split('\n');
    const ti = lines.findIndex((l) => l.includes('-->'));
    if (ti < 0) continue;
    const [a, b] = lines[ti].split('-->');
    const start = stamp(a);
    const end = stamp(b.trim().split(/\s+/)[0]);
    const body = cleanText(lines.slice(ti + 1).join(' '));
    if (start == null || !body) continue;
    // VTT tự sinh của YouTube lặp dòng trước -> bỏ cue trùng liền kề
    if (cues.length && cues[cues.length - 1].text === body) { cues[cues.length - 1].end = end ?? start; continue; }
    cues.push({ start, end: end ?? start, text: body });
  }
  return cues;
}

const TS_ONLY = /^(\d{1,2}(?::\d{2}){1,2})$/;
const TS_INLINE = /^(\d{1,2}(?::\d{2}){1,2})\s+(.+)$/;
// dòng đọc cho trình đọc màn hình đôi khi bị copy theo: "5 seconds", "1 minute, 3 seconds"
const A11Y = /^\d+\s+(giây|phút|seconds?|minutes?|hours?)(,\s*\d+\s+(giây|phút|seconds?|minutes?))*$/i;

// Bản chép lời copy từ YouTube: "0:05\nHello there\n0:08\nGeneral Kenobi" (hoặc "0:05 Hello there")
export function parseTranscript(text) {
  const cues = [];
  let cur = null;
  for (const raw of String(text).replace(/\r/g, '').split('\n')) {
    const line = raw.trim();
    if (!line || A11Y.test(line)) continue;
    let m = line.match(TS_ONLY);
    if (m) { cur = { start: parseTime(m[1]), text: '' }; cues.push(cur); continue; }
    m = line.match(TS_INLINE);
    if (m) { cur = { start: parseTime(m[1]), text: cleanText(m[2]) }; cues.push(cur); continue; }
    if (cur) cur.text = cleanText(`${cur.text} ${line}`);
  }
  const out = cues.filter((c) => c.text);
  out.forEach((c, i) => { c.end = out[i + 1]?.start ?? c.start + 5; });
  return out;
}

export function parseSubs(text) {
  return String(text).includes('-->') ? parseSrtVtt(text) : parseTranscript(text);
}

// Chỉ số cue đang chạy tại giây t (cue cuối cùng có start <= t), -1 nếu chưa tới cue đầu
export function cueIndexAt(cues, t) {
  let lo = 0;
  let hi = cues.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cues[mid].start <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}

function readAll(storage) {
  try { return JSON.parse(storage.getItem(KEY)) || {}; } catch { return {}; }
}

export function loadSubs(id, storage = localStorage) {
  return readAll(storage)[id]?.cues || null;
}

export function saveSubs(id, cues, storage = localStorage) {
  const all = readAll(storage);
  // savedAt luôn tăng để xếp đúng thứ tự dù lưu liên tiếp trong cùng 1 ms
  const newest = Math.max(0, ...Object.values(all).map((v) => v.savedAt || 0));
  all[id] = { cues, savedAt: Math.max(Date.now(), newest + 1) };
  // giữ 30 video gần nhất cho nhẹ localStorage
  const ids = Object.keys(all).sort((a, b) => all[b].savedAt - all[a].savedAt);
  for (const old of ids.slice(MAX_VIDEOS)) delete all[old];
  try { storage.setItem(KEY, JSON.stringify(all)); return true; } catch { return false; }
}

export function removeSubs(id, storage = localStorage) {
  const all = readAll(storage);
  delete all[id];
  try { storage.setItem(KEY, JSON.stringify(all)); } catch { /* bỏ qua */ }
}
