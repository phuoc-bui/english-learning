// "Săn câu": xử lý link chia sẻ từ YouTube / YouTube Music / trình duyệt và dựng thẻ từ câu phụ đề.

export const KIND_LABEL = { donghua: 'Donghua', video: 'Video', music: 'Nhạc' };

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const URL_RE = /https?:\/\/[^\s]+/i;

// "83", "1:23", "1:02:03", "1m23s", "83s" -> giây; không hợp lệ -> null
export function parseTime(v) {
  const s = String(v ?? '').trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return Number(s);
  if (/^\d+(:\d{1,2}){1,2}$/.test(s)) return s.split(':').reduce((acc, p) => acc * 60 + Number(p), 0);
  const m = s.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (m && (m[1] || m[2] || m[3])) return Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0);
  return null;
}

export function formatTime(t) {
  if (t == null) return '';
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = String(t % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

export function youtubeId(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^(www|m)\./, '');
    if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
    if (host === 'youtube.com' || host === 'music.youtube.com') {
      if (u.searchParams.get('v')) return u.searchParams.get('v');
      const m = u.pathname.match(/^\/(?:shorts|live|embed)\/([^/]+)/);
      return m ? m[1] : null;
    }
  } catch { /* không phải URL */ }
  return null;
}

// Link mở lại đúng giây. YouTube: chuẩn hoá, bỏ tham số theo dõi (si=...); link khác giữ nguyên.
export function sceneUrl(url, t) {
  if (!url) return '';
  const id = youtubeId(url);
  if (!id) return url;
  const base = url.includes('music.youtube.com')
    ? `https://music.youtube.com/watch?v=${id}`
    : `https://www.youtube.com/watch?v=${id}`;
  return t ? `${base}&t=${t}s` : base;
}

// Dữ liệu từ Web Share Target: YouTube app gửi link trong `text`, tiêu đề trong `title` (có khi rỗng).
export function parseShared({ title = '', text = '', url = '' } = {}) {
  const link = (url.match(URL_RE) || text.match(URL_RE) || [''])[0];
  let name = title.trim() || text.replace(URL_RE, '').trim();
  name = name.replace(/^["“]|["”]$/g, '').trim();
  let t = null;
  try { t = parseTime(new URL(link).searchParams.get('t')); } catch { /* không có link */ }
  const kind = link.includes('music.youtube.com') ? 'music' : null;
  return { url: link, title: name, t, kind };
}

// Tách câu thành các từ bấm chọn được (giữ dấu nháy trong don't, it's).
export function tokenize(sentence) {
  return String(sentence ?? '').match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) || [];
}

// Ghép các từ đã chọn theo thứ tự trong câu.
export function focusFromPicks(tokens, picks) {
  return [...picks].sort((a, b) => a - b).map((i) => tokens[i]).filter(Boolean).join(' ');
}

export function cardKey(focus) {
  return String(focus ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

// Hash mở màn Xem trong app
export function watchHash(id, t) {
  return `#watch?v=${encodeURIComponent(id)}${t ? `&t=${t}` : ''}`;
}

// Link "Xem lại cảnh": video YouTube mở trong app, link khác mở tab mới.
export function sceneLink(src) {
  if (!src?.url) return null;
  const id = youtubeId(src.url);
  return id
    ? { href: watchHash(id, src.t), external: false }
    : { href: src.url, external: true };
}

// Link HTML "Xem lại cảnh" (đã escape); '' nếu không có link.
export function sceneAnchor(src, label, attrs = '') {
  const l = sceneLink(src);
  if (!l) return '';
  const ext = l.external ? ' target="_blank" rel="noopener"' : '';
  return `<a class="scene-link" href="${esc(l.href)}"${ext} ${attrs}>${label}</a>`;
}

// Tách câu thành đoạn để hiển thị: từ bấm được (có chỉ số khớp tokenize) và phần xen giữa.
export function tokenSegments(sentence) {
  const s = String(sentence ?? '');
  const re = /[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g;
  const out = [];
  let last = 0;
  let i = 0;
  for (const m of s.matchAll(re)) {
    if (m.index > last) out.push({ text: s.slice(last, m.index) });
    out.push({ text: m[0], i: i++ });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ text: s.slice(last) });
  return out;
}
