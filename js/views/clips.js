import { icon } from '../icons.js';
import { speak } from '../speech.js';
import {
  KIND_LABEL, esc, parseShared, parseTime, formatTime, sceneUrl, tokenize, focusFromPicks,
} from '../clip.js';

const LAST_KIND = 'office-english-clip-kind';

function lastKind() {
  try { return localStorage.getItem(LAST_KIND) || 'donghua'; } catch { return 'donghua'; }
}

export function render(el, ctx) {
  const { store } = ctx;
  // Dữ liệu chia sẻ (nếu mở app từ nút Chia sẻ) chỉ dùng 1 lần
  const shared = ctx.shared ? parseShared(ctx.shared) : null;
  ctx.shared = null;

  const st = {
    mode: shared ? 'capture' : 'list',
    msg: '',
    form: {
      text: '', picks: new Set(), meaning: '', note: '',
      title: shared?.title || '', url: shared?.url || '',
      time: shared?.t != null ? formatTime(shared.t) : '',
      kind: shared?.kind || lastKind(),
    },
  };

  const resetForm = () => {
    st.form = { ...st.form, text: '', picks: new Set(), meaning: '', note: '', time: '' };
  };

  function sourceLine(src) {
    if (!src) return '';
    const bits = [KIND_LABEL[src.kind] || '', src.title ? esc(src.title) : '', src.t != null ? formatTime(src.t) : '']
      .filter(Boolean).join(' · ');
    const link = src.url
      ? ` <a class="scene-link" href="${esc(sceneUrl(src.url, src.t))}" target="_blank" rel="noopener">${icon.play(12)} Xem lại cảnh</a>`
      : '';
    return `<small class="meta">${bits}${link}</small>`;
  }

  function drawCapture() {
    const f = st.form;
    const tokens = tokenize(f.text);
    const focus = focusFromPicks(tokens, f.picks);
    el.innerHTML = `
      <header class="page-head">
        <button class="pill" id="back">${icon.chevron(14)} Quay lại</button>
        <h1>Bắt câu</h1>
      </header>

      <label class="field"><span>Câu tiếng Anh (chép từ phụ đề / lời bài hát)</span>
        <textarea id="text" rows="3" placeholder="You're courting death!">${esc(f.text)}</textarea></label>

      <div class="field"><span>Chạm chọn từ / cụm muốn học</span>
        <div class="token-row" id="tokens">${tokens.length
          ? tokens.map((w, i) => `<button class="chip ${f.picks.has(i) ? 'on' : ''}" data-i="${i}">${esc(w)}</button>`).join('')
          : '<small class="meta">Gõ câu ở trên trước nhé.</small>'}</div>
        ${focus ? `<div class="focus-preview">Sẽ học: <b>${esc(focus)}</b></div>` : ''}
      </div>

      <label class="field"><span>Nghĩa tiếng Việt <small class="meta">(để trống nếu chưa biết — lưu vào "Chờ giải nghĩa")</small></span>
        <input id="meaning" value="${esc(f.meaning)}" placeholder="muốn chết à"></label>

      <label class="field"><span>Ghi chú <small class="meta">(tuỳ chọn: dịch cả câu, ngữ cảnh…)</small></span>
        <input id="note" value="${esc(f.note)}"></label>

      <div class="field"><span>Nguồn</span>
        <div class="chips">${Object.entries(KIND_LABEL).map(([k, l]) =>
          `<button class="chip kchip ${f.kind === k ? 'on' : ''}" data-k="${k}">${l}</button>`).join('')}</div>
      </div>
      <label class="field"><span>Tên phim / tập / bài hát</span>
        <input id="title" value="${esc(f.title)}" placeholder="Đấu Phá Thương Khung tập 12"></label>
      <div class="field-row">
        <label class="field"><span>Link</span><input id="url" value="${esc(f.url)}" placeholder="https://youtu.be/…" inputmode="url"></label>
        <label class="field time"><span>Phút:giây</span><input id="time" value="${esc(f.time)}" placeholder="12:34" inputmode="numeric"></label>
      </div>

      <p class="warn" id="msg">${esc(st.msg)}</p>
      <button class="primary" id="save">${icon.check(18)} Lưu câu</button>
    `;

    const bindInput = (id, key, redraw = false) => {
      const inp = el.querySelector(`#${id}`);
      inp.oninput = () => {
        f[key] = inp.value;
        if (redraw) { f.picks = new Set(); drawTokens(); }
      };
    };
    const drawTokens = () => {
      // vẽ lại riêng hàng từ để không mất focus ô đang gõ
      const toks = tokenize(f.text);
      el.querySelector('#tokens').innerHTML = toks.length
        ? toks.map((w, i) => `<button class="chip ${f.picks.has(i) ? 'on' : ''}" data-i="${i}">${esc(w)}</button>`).join('')
        : '<small class="meta">Gõ câu ở trên trước nhé.</small>';
      el.querySelector('.focus-preview')?.remove();
    };
    bindInput('text', 'text', true);
    bindInput('meaning', 'meaning');
    bindInput('note', 'note');
    bindInput('title', 'title');
    bindInput('url', 'url');
    bindInput('time', 'time');

    el.querySelector('#tokens').onclick = (e) => {
      const b = e.target.closest('button[data-i]');
      if (!b) return;
      const i = +b.dataset.i;
      if (f.picks.has(i)) f.picks.delete(i); else f.picks.add(i);
      st.msg = '';
      drawCapture();
    };
    el.querySelectorAll('.kchip').forEach((b) => {
      b.onclick = () => {
        f.kind = b.dataset.k;
        try { localStorage.setItem(LAST_KIND, f.kind); } catch { /* bỏ qua */ }
        drawCapture();
      };
    });
    el.querySelector('#back').onclick = () => { st.mode = 'list'; st.msg = ''; draw(); };
    el.querySelector('#save').onclick = () => {
      const toks = tokenize(f.text);
      const chosen = focusFromPicks(toks, f.picks);
      const t = parseTime(f.time);
      if (!f.text.trim()) { st.msg = 'Nhập câu tiếng Anh trước nhé.'; return drawCapture(); }
      if (!chosen) { st.msg = 'Chạm chọn ít nhất 1 từ muốn học.'; return drawCapture(); }
      if (f.time.trim() && t == null) { st.msg = 'Thời điểm dạng 12:34 nhé.'; return drawCapture(); }
      const res = store.addMined({
        text: f.text, focus: chosen, meaning_vi: f.meaning, note: f.note, createdAt: ctx.today,
        source: { kind: f.kind, title: f.title.trim(), url: f.url.trim(), t },
      });
      st.msg = {
        card: `Đã lưu "${chosen}" thành thẻ ôn ✓`,
        inbox: `Đã lưu "${chosen}" — nhớ điền nghĩa trong "Chờ giải nghĩa"`,
        exists: `"${chosen}" đã có trong sổ từ vựng — câu vẫn được lưu vào bộ sưu tập`,
      }[res];
      resetForm(); // giữ nguồn để bắt tiếp câu khác cùng tập
      drawCapture();
    };
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
      <p class="meta">Xem donghua, YouTube, nghe nhạc như bình thường. Gặp câu hay → bấm <b>Chia sẻ → Office English</b> (hoặc nút dưới) để lưu. Câu có nghĩa sẽ thành thẻ trong tab Từ vựng.</p>
      <button class="primary" id="new">${icon.pencil(18)} Bắt câu mới</button>
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
