import { icon } from '../icons.js';
import { speak, stopSpeaking } from '../speech.js';
import { esc, tokenSegments } from '../clip.js';
import {
  TOPICS, DEV_TAGS, REGISTER_URL, ERR_TEXT, getKey, setKey,
  listNews, getArticle, listDev, getDevArticle, splitSentences,
} from '../news.js';
import { createCaptureForm } from './capture-form.js';

const PREF = 'office-english-news';
const SOURCES = { guardian: 'The Guardian', dev: 'Blog công nghệ (DEV)' };
let pasted = null; // bài dán tay, chỉ giữ trong phiên

function loadPref() {
  try { return { src: 'guardian', guardian: 'technology', dev: 'programming', ...JSON.parse(localStorage.getItem(PREF)) }; } catch { return { src: 'guardian', guardian: 'technology', dev: 'programming' }; }
}
function savePref(p) {
  try { localStorage.setItem(PREF, JSON.stringify(p)); } catch { /* bỏ qua */ }
}

const readMins = (words) => (words ? `~${Math.max(1, Math.round(words / 200))} phút đọc` : '');

export function render(el, ctx) {
  const src = ctx.params.get('src');
  const id = ctx.params.get('id');
  if (src && id) renderReader(el, ctx, src, id);
  else renderList(el, ctx);
}

// ================= DANH SÁCH =================
function renderList(el, ctx) {
  const pref = loadPref();
  const st = { items: [], page: 1, pages: 1, loading: false, error: '', q: '' };

  function head() {
    const topics = pref.src === 'dev' ? DEV_TAGS : TOPICS;
    const needKey = pref.src === 'guardian' && !getKey();
    return `
      <header class="page-head">
        <button class="pill" id="back">${icon.chevron(14)} Hôm nay</button>
        <h1>Đọc tin</h1>
      </header>
      <div class="seg">${Object.entries(SOURCES).map(([k, l]) =>
        `<button class="${pref.src === k ? 'on' : ''}" data-src="${k}">${l}</button>`).join('')}</div>
      ${needKey ? `
        <div class="ext-note">
          <p><b>Cần key miễn phí của The Guardian</b> (đăng ký 2 phút, chỉ lưu trong máy này).</p>
          <p>Vào <a class="scene-link" href="${REGISTER_URL}" target="_blank" rel="noopener">open-platform.theguardian.com ${icon.external(12)}</a> → <b>Register developer key</b> → key được gửi qua email → dán vào đây.</p>
          <div class="watch-open"><input class="inline-input" id="gkey" placeholder="Dán key…"><button class="pill" id="saveKey">${icon.check(14)} Lưu key</button></div>
          <p class="meta">Chưa có key? Chọn tab <b>Blog công nghệ (DEV)</b> — đọc được ngay, không cần key.</p>
        </div>` : `
        <div class="chips">${topics.map((t) =>
          `<button class="chip topic ${!st.q && pref[pref.src] === t.id ? 'on' : ''}" data-t="${t.id}">${t.label}</button>`).join('')}</div>
        ${pref.src === 'guardian' ? `<div class="searchbar">${icon.search(16)}<input id="q" placeholder="Tìm tin theo từ khoá tiếng Anh (vd: electric cars)…" value="${esc(st.q)}"></div>` : ''}`}
    `;
  }

  function body() {
    if (pref.src === 'guardian' && !getKey()) return '';
    if (st.error) {
      return `<p class="error">${esc(st.error)}</p>${pasteBox()}`;
    }
    if (st.loading && !st.items.length) return '<p class="meta">Đang tải tin…</p>';
    if (!st.items.length) return '<p class="meta">Không có bài nào.</p>';
    return `
      ${st.items.map((a) => `
        <a class="news-item" href="#news?src=${pref.src}&id=${encodeURIComponent(a.id)}">
          ${a.thumb ? `<img src="${esc(a.thumb)}" alt="" loading="lazy">` : ''}
          <span class="body"><b>${esc(a.title)}</b>
            <small>${[a.date, esc(a.section), readMins(a.words)].filter(Boolean).join(' · ')}</small>
            ${a.trail ? `<span class="trail-text">${esc(a.trail)}</span>` : ''}</span>
        </a>`).join('')}
      ${st.page < st.pages ? `<button class="pill wide" id="more">${st.loading ? 'Đang tải…' : 'Xem thêm'}</button>` : ''}
      ${pasteBox()}`;
  }

  function pasteBox() {
    return `
      <details class="acc paste-acc">
        <summary><span class="lead">${icon.pencil(16)}</span>Dán bài báo từ trang khác<span class="chev">${icon.chevronDown(16)}</span></summary>
        <div class="acc-body">
          <input class="inline-input" id="pTitle" placeholder="Tiêu đề (tuỳ chọn)" style="width:100%;margin-bottom:8px">
          <input class="inline-input" id="pUrl" placeholder="Link bài gốc (tuỳ chọn)" style="width:100%;margin-bottom:8px" inputmode="url">
          <textarea id="pText" rows="6" placeholder="Dán nội dung bài báo tiếng Anh…"></textarea>
          <button class="primary" id="pRead">${icon.book(16)} Đọc bài này</button>
        </div>
      </details>`;
  }

  function draw() {
    el.innerHTML = head() + body();
    el.querySelector('#back').onclick = () => ctx.navigate('today');
    el.querySelectorAll('.seg button').forEach((b) => {
      b.onclick = () => { pref.src = b.dataset.src; savePref(pref); st.q = ''; reload(); };
    });
    el.querySelector('#saveKey')?.addEventListener('click', () => {
      const k = el.querySelector('#gkey').value.trim();
      if (!k) return;
      setKey(k);
      reload();
    });
    el.querySelectorAll('.topic').forEach((b) => {
      b.onclick = () => { pref[pref.src] = b.dataset.t; savePref(pref); st.q = ''; reload(); };
    });
    const q = el.querySelector('#q');
    if (q) q.onkeydown = (e) => { if (e.key === 'Enter') { st.q = q.value.trim(); reload(); } };
    el.querySelector('#more')?.addEventListener('click', () => { if (!st.loading) load(st.page + 1); });
    el.querySelector('#pRead')?.addEventListener('click', () => {
      const text = el.querySelector('#pText').value.trim();
      if (!text) return;
      pasted = {
        id: 'local',
        title: el.querySelector('#pTitle').value.trim() || 'Bài báo đã dán',
        url: el.querySelector('#pUrl').value.trim(),
        byline: '', date: ctx.today,
        paragraphs: text.split(/\n+/).map((x) => x.trim()).filter(Boolean),
      };
      ctx.navigate('news?src=paste&id=local');
    });
  }

  async function load(page) {
    st.loading = true;
    st.error = '';
    draw();
    try {
      const opts = { topic: pref[pref.src], q: st.q, page };
      const r = pref.src === 'dev' ? await listDev(opts) : await listNews(opts, getKey());
      st.items = page === 1 ? r.items : [...st.items, ...r.items];
      st.page = page;
      st.pages = r.pages;
    } catch (e) {
      if (e.code === 'key') setKey('');
      st.error = pref.src === 'dev' && e.code === 'network'
        ? 'Không kết nối được DEV.to — kiểm tra mạng. Có thể dán bài báo vào ô bên dưới để đọc.'
        : ERR_TEXT[e.code] || ERR_TEXT.server;
    }
    st.loading = false;
    draw();
  }

  function reload() {
    st.items = [];
    if (pref.src === 'guardian' && !getKey()) { draw(); return; }
    load(1);
  }
  reload();
}

// ================= ĐỌC BÀI =================
function renderReader(el, ctx, src, id) {
  const { store } = ctx;
  document.body.classList.add('wide');
  ctx.cleanup = () => stopSpeaking();
  let art = null;
  let sentences = []; // sentences[p][s] = câu
  let form = null;

  el.innerHTML = `
    <header class="page-head">
      <button class="pill" id="back">${icon.chevron(14)} Đọc tin</button>
      <h1>Đọc & bắt câu</h1>
    </header>
    <div id="reader"><p class="meta">Đang tải bài…</p></div>`;
  el.querySelector('#back').onclick = () => ctx.navigate('news');

  const isMobile = () => window.matchMedia('(max-width: 899px)').matches;

  function drawList() {
    const box = el.querySelector('#mineList');
    if (!box) return;
    const mine = store.state.mined.filter((m) => m.source?.url && m.source.url === art.url);
    box.innerHTML = `
      <h2>Câu đã bắt trong bài (${mine.length})</h2>
      ${mine.length ? mine.map((m) => `
        <div class="clip-item"><p class="sentence">${esc(m.text)}</p>
        <div><b>${esc(m.focus)}</b>${m.meaning_vi ? ` — ${esc(m.meaning_vi)}` : ' <small class="meta">(chờ giải nghĩa)</small>'}</div></div>`).join('')
        : '<p class="meta">Chưa có câu nào — bấm vào từ lạ trong bài để bắt câu.</p>'}`;
  }

  function drawArticle() {
    sentences = art.paragraphs.map(splitSentences);
    const srcLabel = src === 'dev' ? 'DEV.to' : src === 'guardian' ? 'The Guardian' : '';
    el.querySelector('#reader').innerHTML = `
      <div class="watch-grid">
        <article class="watch-player news-article">
          <h2 class="news-title">${esc(art.title)}</h2>
          <p class="meta">${[esc(art.byline), art.date, srcLabel].filter(Boolean).join(' · ')}
            ${art.url ? ` · <a class="scene-link" href="${esc(art.url)}" target="_blank" rel="noopener">Bài gốc ${icon.external(12)}</a>` : ''}</p>
          <p class="meta sub-tip">Bấm vào <b>từ</b> để bắt cả câu · ${icon.volume(12)} nghe đọc đoạn văn.</p>
          ${sentences.map((ss, p) => `
            <div class="para">
              <button class="pill say-p" data-p="${p}" aria-label="Nghe đoạn này">${icon.volume(13)}</button>
              <p>${ss.map((s, i) => `<span class="sent" data-p="${p}" data-s="${i}">${tokenSegments(s).map((g) => (g.i != null
                ? `<span class="w" data-w="${g.i}">${esc(g.text)}</span>` : esc(g.text))).join('')}</span>`).join(' ')}</p>
            </div>`).join('')}
          ${srcLabel ? `<p class="meta">Nguồn: ${srcLabel}. Nội dung chỉ hiển thị để đọc, không lưu lại.</p>` : ''}
        </article>
        <aside class="watch-side news-side" id="side">
          <div class="sheet-head"><h2>Bắt câu</h2><button class="pill sheet-close" id="closeSheet" aria-label="Đóng">${icon.x(14)}</button></div>
          <p class="meta sheet-hint">Bấm vào từ trong bài — câu chứa từ đó sẽ được điền sẵn.</p>
          <div id="capture"></div>
        </aside>
        <section class="watch-list" id="mineList"></section>
      </div>`;

    form = createCaptureForm(el.querySelector('#capture'), ctx, {
      source: { url: art.url, title: art.title, kind: 'news' }, hideUrl: true, hideTime: true,
      onSaved: () => { drawList(); if (isMobile()) el.querySelector('#side').classList.remove('open'); },
    });
    drawList();

    el.querySelector('.news-article').onclick = (e) => {
      const say = e.target.closest('.say-p');
      if (say) { stopSpeaking(); speak(art.paragraphs[+say.dataset.p], { rate: 0.95 }); return; }
      const w = e.target.closest('.w');
      if (!w) return;
      const sent = w.closest('.sent');
      el.querySelectorAll('.sent.picked').forEach((x) => x.classList.remove('picked'));
      sent.classList.add('picked');
      form.setDraft({ text: sentences[+sent.dataset.p][+sent.dataset.s], pick: +w.dataset.w, title: art.title });
      if (isMobile()) el.querySelector('#side').classList.add('open');
      form.focus();
    };
    el.querySelector('#closeSheet').onclick = () => el.querySelector('#side').classList.remove('open');
  }

  (async () => {
    try {
      if (src === 'paste') {
        if (!pasted) { ctx.navigate('news'); return; }
        art = pasted;
      } else if (src === 'dev') {
        art = await getDevArticle(id);
      } else {
        const key = getKey();
        if (!key) { ctx.navigate('news'); return; }
        art = await getArticle(id, key);
      }
      if (!art.paragraphs.length) throw Object.assign(new Error('empty'), { code: 'empty' });
      drawArticle();
    } catch (e) {
      const r = el.querySelector('#reader');
      if (r) {
        r.innerHTML = `<p class="error">${e.code === 'empty'
          ? 'Bài này không có nội dung chữ (có thể là video/ảnh).'
          : esc(ERR_TEXT[e.code] || ERR_TEXT.server)}</p>`;
      }
    }
  })();
}
