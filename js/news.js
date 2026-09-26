// Tin tiếng Anh từ The Guardian Open Platform (key miễn phí, người dùng tự đăng ký, lưu trong máy).
const API = 'https://content.guardianapis.com';
const KEY_STORE = 'office-english-guardian-key';
export const REGISTER_URL = 'https://open-platform.theguardian.com/access/';

export const TOPICS = [
  { id: 'technology', label: 'Công nghệ' },
  { id: 'business', label: 'Kinh doanh' },
  { id: 'science', label: 'Khoa học' },
  { id: 'film', label: 'Phim' },
  { id: 'music', label: 'Âm nhạc' },
  { id: 'games', label: 'Game' },
  { id: 'sport', label: 'Thể thao' },
  { id: 'world', label: 'Thế giới' },
  { id: 'environment', label: 'Môi trường' },
  { id: 'lifeandstyle', label: 'Đời sống' },
];

export function getKey(storage = localStorage) {
  try { return storage.getItem(KEY_STORE) || ''; } catch { return ''; }
}
export function setKey(key, storage = localStorage) {
  try {
    if (key) storage.setItem(KEY_STORE, key.trim()); else storage.removeItem(KEY_STORE);
  } catch { /* bỏ qua */ }
}

export function searchUrl({ topic, q, page = 1 }, key) {
  const p = new URLSearchParams({
    'api-key': key, 'page-size': '15', page: String(page), 'order-by': 'newest',
    'show-fields': 'trailText,thumbnail,wordcount', type: 'article',
  });
  if (q) p.set('q', q); else if (topic) p.set('section', topic);
  return `${API}/search?${p}`;
}

export function articleUrl(id, key) {
  const p = new URLSearchParams({ 'api-key': key, 'show-fields': 'headline,byline,trailText,body,wordcount' });
  return `${API}/${id.split('/').map(encodeURIComponent).join('/')}?${p}`;
}

async function call(url, fetchFn, guardian = true) {
  let res;
  try {
    res = await fetchFn(url);
  } catch {
    throw Object.assign(new Error('network'), { code: 'network' }); // mất mạng hoặc bị chặn CORS
  }
  if (res.status === 401 || res.status === 403) throw Object.assign(new Error('key'), { code: 'key' });
  if (res.status === 429) throw Object.assign(new Error('limit'), { code: 'limit' });
  if (!res.ok) throw Object.assign(new Error(String(res.status)), { code: 'server' });
  const data = await res.json();
  return guardian ? data.response : data;
}

export async function listNews(opts, key, fetchFn = fetch) {
  const r = await call(searchUrl(opts, key), fetchFn);
  return {
    pages: r.pages || 1,
    items: (r.results || []).map((a) => ({
      id: a.id,
      title: a.webTitle,
      url: a.webUrl,
      date: (a.webPublicationDate || '').slice(0, 10),
      section: a.sectionName,
      trail: stripTags(a.fields?.trailText || ''),
      thumb: a.fields?.thumbnail || '',
      words: Number(a.fields?.wordcount || 0),
    })),
  };
}

export async function getArticle(id, key, fetchFn = fetch) {
  const r = await call(articleUrl(id, key), fetchFn);
  const c = r.content;
  return {
    id: c.id,
    title: c.fields?.headline || c.webTitle,
    byline: c.fields?.byline || '',
    date: (c.webPublicationDate || '').slice(0, 10),
    url: c.webUrl,
    paragraphs: htmlToParagraphs(c.fields?.body || ''),
  };
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', mdash: '—', ndash: '–', hellip: '…' };
function decode(s) {
  return s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENT[e.toLowerCase()] ?? m;
  });
}
export function stripTags(html) {
  return decode(String(html).replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

// Lấy chữ trong các thẻ <p> (bỏ ảnh, embed, quảng cáo); không chèn HTML của nguồn vào trang
export function htmlToParagraphs(html) {
  return [...String(html).matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => stripTags(m[1]))
    .filter((t) => t.length > 1);
}

// Tách đoạn thành câu (giữ dấu câu và ngoặc kép cuối câu)
export function splitSentences(text) {
  const out = String(text).match(/[^.!?]+(?:[.!?]+["'”’)\]]*|$)\s*/g) || [];
  // gộp mảnh quá ngắn do viết tắt (Mr. / U.S.) vào câu trước
  const merged = [];
  for (const raw of out) {
    if (!raw.trim()) continue;
    const prev = merged[merged.length - 1]?.trimEnd();
    // viết tắt (Mr. / Dr.), chữ cái viết tắt (U.S. / J.K.), hoặc mảnh sau bắt đầu bằng chữ thường
    if (prev && (/\b(Mr|Mrs|Ms|Dr|St|vs|Inc|Ltd|Jr|Sr|No|e\.g|i\.e)\.$/i.test(prev) || /(^|[\s.])[A-Z]\.$/.test(prev) || /^\s*[a-z]/.test(raw))) {
      merged[merged.length - 1] += raw; // ghép nguyên văn, giữ khoảng trắng gốc
    } else merged.push(raw);
  }
  return merged.map((x) => x.trim());
}

// ---------- DEV.to: blog công nghệ, không cần key ----------
const DEV_API = 'https://dev.to/api/articles';

export const DEV_TAGS = [
  { id: 'programming', label: 'Lập trình' },
  { id: 'webdev', label: 'Web' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'ai', label: 'AI' },
  { id: 'career', label: 'Nghề nghiệp' },
  { id: 'productivity', label: 'Năng suất' },
  { id: 'beginners', label: 'Người mới' },
  { id: 'python', label: 'Python' },
];

export function devListUrl({ topic, page = 1 }) {
  const p = new URLSearchParams({ per_page: '15', page: String(page), top: '7' });
  if (topic) p.set('tag', topic);
  return `${DEV_API}?${p}`;
}

export async function listDev(opts, fetchFn = fetch) {
  const r = await call(devListUrl(opts), fetchFn, false);
  return {
    pages: r.length < 15 ? opts.page || 1 : (opts.page || 1) + 1,
    items: r.map((a) => ({
      id: String(a.id),
      title: a.title,
      url: a.url,
      date: (a.published_at || '').slice(0, 10),
      section: a.user?.name || 'DEV',
      trail: a.description || '',
      thumb: a.cover_image || '',
      words: (a.reading_time_minutes || 0) * 230,
    })),
  };
}

export async function getDevArticle(id, fetchFn = fetch) {
  const a = await call(`${DEV_API}/${encodeURIComponent(id)}`, fetchFn, false);
  return {
    id: String(a.id),
    title: a.title,
    byline: a.user?.name || '',
    date: (a.published_at || '').slice(0, 10),
    url: a.url,
    // bài blog: lấy cả tiêu đề mục và gạch đầu dòng, bỏ khối code
    paragraphs: htmlToParagraphs(String(a.body_html || '')
      .replace(/<pre[\s\S]*?<\/pre>/gi, '')
      .replace(/<(h[1-4]|li)\b[^>]*>([\s\S]*?)<\/\1>/gi, '<p>$2</p>')),
  };
}

export const ERR_TEXT = {
  key: 'Key The Guardian không đúng hoặc chưa kích hoạt — kiểm tra lại trong ô key.',
  limit: 'Đã dùng hết lượt gọi hôm nay của key miễn phí (5.000 lượt/ngày). Thử lại sau nhé.',
  network: 'Không kết nối được The Guardian (mất mạng, hoặc trình duyệt chặn gọi trực tiếp). Có thể dán bài báo vào ô bên dưới để đọc.',
  server: 'The Guardian đang lỗi, thử lại sau.',
};
