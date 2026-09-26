// Form "Bắt câu" dùng chung cho màn Săn câu và màn Xem trong app.
import { icon } from '../icons.js';
import { KIND_LABEL, esc, parseTime, formatTime, tokenize, focusFromPicks } from '../clip.js';
import { DAILY_GOAL } from '../store.js';

const LAST_KIND = 'office-english-clip-kind';

function lastKind() {
  try { return localStorage.getItem(LAST_KIND) || 'donghua'; } catch { return 'donghua'; }
}

// box: phần tử chứa form. source: { title, url, t, kind }.
// hideUrl: ẩn ô link (màn Xem đã biết video). hideTime: ẩn phút:giây (bài báo).
// onSaved(result) gọi sau mỗi lần lưu.
export function createCaptureForm(box, ctx, { source = {}, hideUrl = false, hideTime = false, onSaved } = {}) {
  const f = {
    text: '', picks: new Set(), meaning: '', note: '',
    title: source.title || '', url: source.url || '',
    time: source.t != null ? formatTime(source.t) : '',
    kind: source.kind || lastKind(),
  };
  let msg = '';

  const tokenChips = () => {
    const toks = tokenize(f.text);
    return toks.length
      ? toks.map((w, i) => `<button type="button" class="chip ${f.picks.has(i) ? 'on' : ''}" data-i="${i}">${esc(w)}</button>`).join('')
      : '<small class="meta">Gõ câu ở trên trước nhé.</small>';
  };

  function draw() {
    const focus = focusFromPicks(tokenize(f.text), f.picks);
    box.innerHTML = `
      <label class="field"><span>Câu tiếng Anh (chép từ phụ đề / lời bài hát)</span>
        <textarea id="cf-text" rows="3" placeholder="You're courting death!">${esc(f.text)}</textarea></label>

      <div class="field"><span>Chạm chọn từ / cụm muốn học</span>
        <div class="token-row" id="cf-tokens">${tokenChips()}</div>
        ${focus ? `<div class="focus-preview">Sẽ học: <b>${esc(focus)}</b></div>` : ''}
      </div>

      <label class="field"><span>Nghĩa tiếng Việt <small class="meta">(để trống nếu chưa biết — lưu vào "Chờ giải nghĩa")</small></span>
        <input id="cf-meaning" value="${esc(f.meaning)}" placeholder="muốn chết à"></label>

      <label class="field"><span>Ghi chú <small class="meta">(tuỳ chọn: dịch cả câu, ngữ cảnh…)</small></span>
        <input id="cf-note" value="${esc(f.note)}"></label>

      <div class="field"><span>Nguồn</span>
        <div class="chips">${Object.entries(KIND_LABEL).map(([k, l]) =>
          `<button type="button" class="chip kchip ${f.kind === k ? 'on' : ''}" data-k="${k}">${l}</button>`).join('')}</div>
      </div>
      <label class="field"><span>Tên phim / tập / bài hát</span>
        <input id="cf-title" value="${esc(f.title)}" placeholder="Đấu Phá Thương Khung tập 12"></label>
      <div class="field-row">
        ${hideUrl ? '' : `<label class="field"><span>Link</span><input id="cf-url" value="${esc(f.url)}" placeholder="https://youtu.be/…" inputmode="url"></label>`}
        ${hideTime ? '' : `<label class="field time"><span>Phút:giây</span><input id="cf-time" value="${esc(f.time)}" placeholder="12:34" inputmode="numeric"></label>`}
      </div>

      <p class="warn" id="cf-msg">${esc(msg)}</p>
      <button class="primary" id="cf-save">${icon.check(18)} Lưu câu</button>
    `;

    const bind = (id, key, onChange) => {
      const inp = box.querySelector(`#cf-${id}`);
      if (!inp) return;
      inp.oninput = () => { f[key] = inp.value; onChange?.(); };
    };
    bind('text', 'text', () => {
      // vẽ lại riêng hàng từ để không mất con trỏ ô đang gõ
      f.picks = new Set();
      box.querySelector('#cf-tokens').innerHTML = tokenChips();
      box.querySelector('.focus-preview')?.remove();
    });
    bind('meaning', 'meaning');
    bind('note', 'note');
    bind('title', 'title');
    bind('url', 'url');
    bind('time', 'time');

    box.querySelector('#cf-tokens').onclick = (e) => {
      const b = e.target.closest('button[data-i]');
      if (!b) return;
      const i = +b.dataset.i;
      if (f.picks.has(i)) f.picks.delete(i); else f.picks.add(i);
      msg = '';
      draw();
    };
    box.querySelectorAll('.kchip').forEach((b) => {
      b.onclick = () => {
        f.kind = b.dataset.k;
        try { localStorage.setItem(LAST_KIND, f.kind); } catch { /* bỏ qua */ }
        draw();
      };
    });
    box.querySelector('#cf-save').onclick = save;
  }

  function save() {
    const chosen = focusFromPicks(tokenize(f.text), f.picks);
    const t = parseTime(f.time);
    if (!f.text.trim()) { msg = 'Nhập câu tiếng Anh trước nhé.'; return draw(); }
    if (!chosen) { msg = 'Chạm chọn ít nhất 1 từ muốn học.'; return draw(); }
    if (f.time.trim() && t == null) { msg = 'Thời điểm dạng 12:34 nhé.'; return draw(); }
    const res = ctx.store.addMined({
      text: f.text, focus: chosen, meaning_vi: f.meaning, note: f.note, createdAt: ctx.today,
      source: { kind: f.kind, title: f.title.trim(), url: f.url.trim(), t },
    });
    msg = {
      card: `Đã lưu "${chosen}" thành thẻ ôn ✓`,
      inbox: `Đã lưu "${chosen}" — nhớ điền nghĩa trong "Chờ giải nghĩa"`,
      exists: `"${chosen}" đã có trong sổ từ vựng — câu vẫn được lưu vào bộ sưu tập`,
    }[res];
    // tiến độ mục tiêu ngày
    const n = ctx.store.minedCount(ctx.today);
    msg += n === DAILY_GOAL ? ` · Đủ ${DAILY_GOAL} câu hôm nay, giữ được streak 🔥` : n < DAILY_GOAL ? ` · Hôm nay ${n}/${DAILY_GOAL} câu` : ` · Hôm nay ${n} câu`;
    // giữ nguồn để bắt tiếp câu khác cùng tập
    Object.assign(f, { text: '', picks: new Set(), meaning: '', note: '', time: '' });
    draw();
    onSaved?.(res);
  }

  draw();
  return {
    // Màn Xem cập nhật giây/tiêu đề khi bấm Bắt câu; không xoá câu đang gõ dở
    setSource({ title, url, t }) {
      if (title && !f.title) f.title = title;
      if (url) f.url = url;
      if (t != null) f.time = formatTime(t);
      msg = '';
      draw();
    },
    // Điền câu từ phụ đề (bấm vào dòng/từ trong khung phụ đề); pick = chỉ số từ chọn sẵn
    setDraft({ text, pick = null, t = null, title, meaning, note }) {
      f.text = text;
      f.picks = new Set(pick != null ? [pick] : []);
      if (meaning != null) f.meaning = meaning;
      if (note != null) f.note = note;
      if (t != null) f.time = formatTime(t);
      if (title && !f.title) f.title = title;
      msg = '';
      draw();
    },
    focus() { box.querySelector('#cf-text')?.focus({ preventScroll: true }); },
  };
}
