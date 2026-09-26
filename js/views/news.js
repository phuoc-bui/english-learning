import { icon } from '../icons.js';
import { speak, stopSpeaking } from '../speech.js';
import { esc, tokenSegments } from '../clip.js';
import {
  TOPICS, DEV_TAGS, REGISTER_URL, ERR_TEXT, getKey, setKey,
  listNews, getArticle, listDev, getDevArticle, splitSentences,
} from '../news.js';
import { createCaptureForm } from './capture-form.js';
import { translate, ENGINE_LABEL, TR_ERR } from '../translate.js';
import { DAILY_GOAL } from '../store.js';

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
      <h1>Đọc & dịch</h1>
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
        : '<p class="meta">Chưa có câu nào — bấm vào từ lạ, xem nghĩa rồi bấm Lưu câu.</p>'}`;
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
          <p class="meta sub-tip">Bấm vào <b>từ</b> để xem nghĩa + dịch cả câu · <b>Dịch</b> cạnh mỗi đoạn để dịch cả đoạn · ${icon.volume(12)} nghe đọc.</p>
          ${sentences.map((ss, p) => `
            <div class="para">
              <div class="para-tools">
                <button class="pill say-p" data-p="${p}" aria-label="Nghe đoạn này">${icon.volume(13)}</button>
                <button class="pill tr-p" data-p="${p}" aria-label="Dịch đoạn này">Dịch</button>
              </div>
              <p>${ss.map((s, i) => `<span class="sent" data-p="${p}" data-s="${i}">${tokenSegments(s).map((g) => (g.i != null
                ? `<span class="w" data-w="${g.i}">${esc(g.text)}</span>` : esc(g.text))).join('')}</span>`).join(' ')}</p>
            </div>`).join('')}
          ${srcLabel ? `<p class="meta">Nguồn: ${srcLabel}. Nội dung chỉ hiển thị để đọc, không lưu lại.</p>` : ''}
        </article>
        <aside class="watch-side news-side" id="side">
          <div class="sheet-head"><h2 id="sideTitle">Dịch</h2><button class="pill sheet-close" id="closeSheet" aria-label="Đóng">${icon.x(14)}</button></div>
          <div id="trPane"><p class="meta sheet-hint">Bấm vào một từ trong bài để xem nghĩa của từ và bản dịch cả câu.</p></div>
          <div id="capPane" hidden>
            <button class="pill" id="backTr" style="margin-bottom:10px">${icon.chevron(12)} Quay lại bản dịch</button>
            <div id="capture"></div>
          </div>
        </aside>
        <section class="watch-list" id="mineList"></section>
      </div>`;

    form = createCaptureForm(el.querySelector('#capture'), ctx, {
      source: { url: art.url, title: art.title, kind: 'news' }, hideUrl: true, hideTime: true,
      onSaved: () => { drawList(); showPane('tr'); if (isMobile()) el.querySelector('#side').classList.remove('open'); },
    });
    drawList();

    let current = null; // { sentence, word, pick, wordVi, sentVi }
    let reqId = 0;

    function showPane(which) {
      el.querySelector('#trPane').hidden = which !== 'tr';
      el.querySelector('#capPane').hidden = which !== 'cap';
      el.querySelector('#sideTitle').textContent = which === 'tr' ? 'Dịch' : 'Sửa trước khi lưu';
    }

    function drawTr(state) {
      const pane = el.querySelector('#trPane');
      if (state.paragraph != null) {
        pane.innerHTML = `
          <p class="tr-en">${esc(art.paragraphs[state.paragraph])}</p>
          <p class="tr-vi">${state.error ? `<span class="error-inline">${esc(state.error)}</span>` : state.paraVi ? esc(state.paraVi) : '<span class="meta">Đang dịch…</span>'}</p>
          ${state.engine ? `<p class="meta tr-engine">Dịch bởi ${ENGINE_LABEL[state.engine]}</p>` : ''}`;
        return;
      }
      const segs = tokenSegments(state.sentence).map((g) => (g.i === state.pick ? `<mark>${esc(g.text)}</mark>` : esc(g.text))).join('');
      const saved = store.state.mined.some((m) => m.text === state.sentence && m.focus.toLowerCase() === state.word.toLowerCase());
      const n = store.minedCount(ctx.today);
      pane.innerHTML = `
        <div class="tr-word">
          <button class="pill say-w" aria-label="Nghe từ">${icon.volume(14)}</button>
          <div><b>${esc(state.word)}</b><div class="tr-word-vi">${state.wordVi ? esc(state.wordVi) : state.error ? '' : '<span class="meta">Đang dịch…</span>'}</div></div>
        </div>
        <div class="tr-block">
          <p class="tr-en">${segs} <button class="pill mini say-s" aria-label="Nghe câu">${icon.volume(12)}</button></p>
          <p class="tr-vi">${state.error ? `<span class="error-inline">${esc(state.error)}</span>` : state.sentVi ? esc(state.sentVi) : '<span class="meta">Đang dịch…</span>'}</p>
        </div>
        ${state.engine ? `<p class="meta tr-engine">Dịch bởi ${ENGINE_LABEL[state.engine]} — máy dịch, có thể chưa sát nghĩa.</p>` : ''}
        <div class="tr-actions">
          <button class="primary" id="quickSave" ${saved || !state.wordVi ? 'disabled' : ''}>${saved ? `${icon.check(16)} Đã lưu câu này` : `${icon.check(16)} Lưu câu (${Math.min(n, DAILY_GOAL)}/${DAILY_GOAL} hôm nay)`}</button>
          <button class="pill" id="editSave">${icon.pencil(14)} Sửa rồi lưu</button>
        </div>
        <p class="warn" id="trMsg"></p>`;
      pane.querySelector('.say-w').onclick = () => speak(state.word);
      pane.querySelector('.say-s').onclick = () => speak(state.sentence, { rate: 0.95 });
      pane.querySelector('#quickSave').onclick = () => {
        const res = store.addMined({
          text: state.sentence, focus: state.word, meaning_vi: state.wordVi, note: state.sentVi || '', createdAt: ctx.today,
          source: { kind: 'news', title: art.title, url: art.url, t: null },
        });
        drawList();
        drawTr(state);
        const cnt = store.minedCount(ctx.today);
        el.querySelector('#trMsg').textContent = (res === 'exists' ? `"${state.word}" đã có trong sổ — câu vẫn được lưu.` : `Đã lưu "${state.word}" thành thẻ ôn ✓`)
          + (cnt === DAILY_GOAL ? ` · Đủ ${DAILY_GOAL} câu hôm nay 🔥` : cnt < DAILY_GOAL ? ` · Hôm nay ${cnt}/${DAILY_GOAL}` : '');
      };
      pane.querySelector('#editSave').onclick = () => {
        form.setDraft({ text: state.sentence, pick: state.pick, title: art.title, meaning: state.wordVi || '', note: state.sentVi || '' });
        showPane('cap');
        form.focus();
      };
    }

    async function translateWord(sentence, pick, word) {
      const my = ++reqId;
      current = { sentence, pick, word };
      showPane('tr');
      drawTr(current);
      try {
        const [w, s] = await Promise.all([translate(word), translate(sentence)]);
        if (my !== reqId) return; // đã bấm từ khác
        current = { ...current, wordVi: w.text, sentVi: s.text, engine: s.engine };
      } catch (e) {
        if (my !== reqId) return;
        current = { ...current, error: TR_ERR[e.code] || TR_ERR.server };
      }
      drawTr(current);
    }

    async function translatePara(p) {
      const my = ++reqId;
      showPane('tr');
      drawTr({ paragraph: p });
      try {
        const r = await translate(art.paragraphs[p]);
        if (my === reqId) drawTr({ paragraph: p, paraVi: r.text, engine: r.engine });
      } catch (e) {
        if (my === reqId) drawTr({ paragraph: p, error: TR_ERR[e.code] || TR_ERR.server });
      }
    }

    el.querySelector('.news-article').onclick = (e) => {
      const say = e.target.closest('.say-p');
      if (say) { stopSpeaking(); speak(art.paragraphs[+say.dataset.p], { rate: 0.95 }); return; }
      const trp = e.target.closest('.tr-p');
      if (trp) {
        el.querySelectorAll('.sent.picked').forEach((x) => x.classList.remove('picked'));
        translatePara(+trp.dataset.p);
        if (isMobile()) el.querySelector('#side').classList.add('open');
        return;
      }
      const w = e.target.closest('.w');
      if (!w) return;
      const sent = w.closest('.sent');
      el.querySelectorAll('.sent.picked').forEach((x) => x.classList.remove('picked'));
      sent.classList.add('picked');
      translateWord(sentences[+sent.dataset.p][+sent.dataset.s], +w.dataset.w, w.textContent);
      if (isMobile()) el.querySelector('#side').classList.add('open');
    };
    el.querySelector('#backTr').onclick = () => showPane('tr');
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
