import { icon } from '../icons.js';
import { speak } from '../speech.js';
import { KIND_LABEL, esc, parseShared, formatTime, sceneAnchor, youtubeId, watchHash, isMusicUrl } from '../clip.js';
import { createCaptureForm } from './capture-form.js';

export function render(el, ctx) {
  const { store } = ctx;
  // Dữ liệu chia sẻ (nếu mở app từ nút Chia sẻ) chỉ dùng 1 lần
  let shared = ctx.shared ? parseShared(ctx.shared) : null;
  ctx.shared = null;

  const st = { mode: shared ? 'capture' : 'list', msg: '' };

  function sourceLine(src) {
    if (!src) return '';
    const bits = [KIND_LABEL[src.kind] || '', src.title ? esc(src.title) : '', src.t != null ? formatTime(src.t) : '']
      .filter(Boolean).join(' · ');
    const link = sceneAnchor(src, `${icon.play(12)} Xem lại cảnh`);
    return `<small class="meta">${bits}${link ? ` ${link}` : ''}</small>`;
  }

  function drawCapture() {
    const id = shared?.url ? youtubeId(shared.url) : null;
    el.innerHTML = `
      <header class="page-head">
        <button class="pill" id="back">${icon.chevron(14)} Quay lại</button>
        <h1>Bắt câu</h1>
      </header>
      ${id ? `<a class="pill wide" href="${watchHash(id, shared.t, isMusicUrl(shared.url))}">${icon.play(14)} Xem video này trong app</a>` : ''}
      ${!id && shared?.url ? `
        <div class="ext-note">
          <p><b>Trang này không phát được trong app</b> — web phim thường chặn nhúng vào app khác (và có thể cần VPN).</p>
          <p>Mở phim ở tab mới, gặp câu tiếng Anh hay thì quay lại đây điền — link đã lưu sẵn, phút:giây tự gõ.</p>
          <p class="meta">Lưu ý: nhiều web donghua chỉ có <b>Vietsub in sẵn vào hình</b> nên không có câu tiếng Anh. Tìm bản <b>English sub</b> chính thức (WeTV, iQIYI, kênh YouTube chính thức) để có phụ đề tiếng Anh.</p>
          <a class="pill" href="${esc(shared.url)}" target="_blank" rel="noopener">${icon.external(14)} Mở trang phim</a>
        </div>` : ''}
      <div id="capture"></div>
    `;
    el.querySelector('#back').onclick = () => { st.mode = 'list'; st.msg = ''; draw(); };
    createCaptureForm(el.querySelector('#capture'), ctx, { source: shared || {} });
  }

  // Video YouTube đã từng bắt câu -> xem tiếp trong app
  function recentVideos() {
    const seen = new Map();
    for (const m of [...store.state.mined].reverse()) {
      const id = youtubeId(m.source?.url || '');
      if (id && !seen.has(id)) seen.set(id, { id, title: m.source.title || id, count: 0 });
      if (id) seen.get(id).count++;
    }
    return [...seen.values()].slice(0, 5);
  }

  function drawList() {
    const mined = [...store.state.mined].reverse();
    const inbox = mined.filter((m) => !m.meaning_vi);
    const done = mined.filter((m) => m.meaning_vi);
    el.innerHTML = `
      <header class="page-head">
        <button class="pill" id="back">${icon.chevron(14)} Hôm nay</button>
        <h1>Săn câu</h1>
      </header>
      <p class="meta">Dán link YouTube / YouTube Music để xem ngay trong app, phụ đề hoặc lời bài hát chạy bên cạnh. Link web phim khác vẫn lưu câu được (mở ở tab mới). Trên điện thoại cũng có thể bấm <b>Chia sẻ → Office English</b> từ app khác. Câu có nghĩa sẽ thành thẻ trong tab Từ vựng.</p>
      <div class="watch-open">
        <input class="inline-input" id="yt" placeholder="Dán link YouTube, YouTube Music hoặc web phim…" inputmode="url">
        <button class="pill" id="openYt">${icon.play(14)} Xem</button>
      </div>
      <p class="warn" id="ytMsg"></p>
      ${recentVideos().map((v) => `
        <a class="card" href="${watchHash(v.id)}">
          <span class="tile">${icon.play(17)}</span>
          <span class="body"><b>${esc(v.title)}</b><small>${v.count} câu đã bắt · xem tiếp</small></span>
          <span class="trail">${icon.chevron(18)}</span>
        </a>`).join('')}
      <button class="primary" id="new">${icon.pencil(18)} Bắt câu (không xem trong app)</button>
      ${st.msg ? `<p class="warn">${esc(st.msg)}</p>` : ''}

      <h2>Chờ giải nghĩa (${inbox.length})</h2>
      ${inbox.length ? inbox.map((m) => `
        <div class="clip-item" data-id="${m.id}">
          <p class="sentence">${esc(m.text)}</p>
          <div>Học: <b>${esc(m.focus)}</b></div>
          ${sourceLine(m.source)}
          <div class="row">
            <input class="inline-input" placeholder="Nghĩa tiếng Việt…">
            <button class="pill save-meaning">${icon.check(14)} Lưu</button>
            <button class="pill del" aria-label="Xoá">${icon.x(14)}</button>
          </div>
        </div>`).join('') : '<p class="meta">Không có câu nào đang chờ.</p>'}

      <h2>Bộ sưu tập (${done.length})</h2>
      ${done.length ? done.map((m) => `
        <div class="clip-item" data-id="${m.id}">
          <p class="sentence">${esc(m.text)}</p>
          <div class="row" style="margin:4px 0">
            <button class="pill say" data-say="${esc(m.focus)}">${icon.volume(14)}</button>
            <div><b>${esc(m.focus)}</b> — ${esc(m.meaning_vi)}${m.note ? `<br><small class="meta">${esc(m.note)}</small>` : ''}</div>
            <button class="pill del" aria-label="Xoá" style="margin-left:auto">${icon.x(14)}</button>
          </div>
          ${sourceLine(m.source)}
        </div>`).join('') : '<p class="meta">Chưa có câu nào. Bắt câu đầu tiên thôi!</p>'}
    `;
    el.querySelector('#back').onclick = () => ctx.navigate('today');
    el.querySelector('#new').onclick = () => { st.mode = 'capture'; st.msg = ''; draw(); };
    const yt = el.querySelector('#yt');
    const openYt = () => {
      const v = yt.value.trim();
      const id = youtubeId(v);
      if (id) { ctx.navigate(watchHash(id, null, isMusicUrl(v)).slice(1)); return; }
      if (!/^https?:\/\/\S+\.\S+/.test(v)) { el.querySelector('#ytMsg').textContent = 'Dán link đầy đủ, bắt đầu bằng https://'; return; }
      // link web phim khác: không nhúng được -> form Bắt câu có sẵn link
      shared = { url: v, title: '', t: null, kind: null };
      st.mode = 'capture';
      draw();
    };
    el.querySelector('#openYt').onclick = openYt;
    yt.onkeydown = (e) => { if (e.key === 'Enter') openYt(); };
    el.querySelectorAll('.clip-item').forEach((item) => {
      const id = item.dataset.id;
      item.querySelector('.save-meaning')?.addEventListener('click', () => {
        const v = item.querySelector('.inline-input').value;
        const res = store.setMinedMeaning(id, v);
        if (!res) return;
        const m = store.state.mined.find((x) => x.id === id);
        st.msg = res === 'exists'
          ? `"${m.focus}" đã có trong sổ từ vựng — câu vẫn nằm trong bộ sưu tập`
          : `"${m.focus}" đã thành thẻ ôn ✓`;
        draw();
      });
      item.querySelector('.del').addEventListener('click', () => {
        if (!confirm('Xoá câu này (và thẻ ôn tạo từ nó)?')) return;
        store.removeMined(id);
        st.msg = '';
        draw();
      });
      item.querySelector('.say')?.addEventListener('click', (e) => speak(e.currentTarget.dataset.say));
    });
  }

  function draw() {
    if (st.mode === 'capture') drawCapture(); else drawList();
  }
  draw();
}

// Dùng cho thẻ ở màn Hôm nay
export function clipStats(store) {
  const mined = store.state.mined || [];
  const inbox = mined.filter((m) => !m.meaning_vi).length;
  return { total: mined.length, inbox };
}
