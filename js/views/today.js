import { icon } from '../icons.js';
import { addDays } from '../dates.js';

const CARDS = [
  { id: 'vocab', ico: 'book', title: 'Từ vựng', desc: '8 từ · ~5 phút', tab: 'vocab' },
  { id: 'listening', ico: 'headphones', title: 'Nghe hội thoại', desc: '1 hội thoại + câu hỏi', tab: 'listening' },
  { id: 'speaking', ico: 'mic', title: 'Nói · Shadowing', desc: 'Luyện phát âm', tab: 'speaking' },
  { id: 'interview', ico: 'briefcase', title: 'Phỏng vấn', desc: 'Câu hỏi thực chiến', tab: 'interview' },
];

const DOW = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Chào buổi sáng';
  if (h < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

// 7 ô của tuần hiện tại (Thứ 2 → Chủ nhật), đánh dấu ngày đã hoàn thành.
function weekDots(store, today) {
  const [y, m, d] = today.split('-').map(Number);
  const jsDow = new Date(y, m - 1, d).getDay(); // 0=CN..6=T7
  const backToMon = (jsDow + 6) % 7;
  const monday = addDays(today, -backToMon);
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    const [yy, mm, dd] = date.split('-').map(Number);
    const label = DOW[new Date(yy, mm - 1, dd).getDay()];
    return { date, label, done: store.isDayComplete(date), isToday: date === today, dayNum: dd };
  });
}

export function render(el, ctx) {
  const { store, pack } = ctx;
  const streak = store.computeStreak(ctx.today);
  const done = (pack && store.state.days[ctx.today]) || {};
  const stale = pack && pack.date !== ctx.today;
  const doneCount = CARDS.filter((c) => done[c.id]).length;
  const week = weekDots(store, ctx.today);

  const logo = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>`;

  el.innerHTML = `
    <div class="greet">
      <div>
        <div class="eyebrow">${greeting()}</div>
        <div class="hi">Học chút nhé 👋</div>
      </div>
      <div class="avatar" style="color:var(--accent-light)">${logo}</div>
    </div>

    ${!pack ? '' : `
    <div class="streak-hero">
      <div class="top">
        <div class="flame">${icon.flame(30)}</div>
        <div>
          <div><span class="num">${streak}</span> <span class="unit">ngày liên tục</span></div>
          <div class="sub">Cứ đều đặn mỗi ngày là tiến bộ 🔥</div>
        </div>
      </div>
      <div class="week">
        ${week.map((w) => `
          <div class="day ${w.isToday ? 'is-today' : ''}">
            <div class="dot ${w.done ? 'on' : ''} ${w.isToday ? 'today' : ''}">${
              w.isToday ? w.dayNum : (w.done ? icon.check(14) : '')
            }</div>
            <div class="lbl">${w.label}</div>
          </div>`).join('')}
      </div>
    </div>`}

    ${!pack
      ? '<p class="error">Không tải được bài học. Kiểm tra kết nối mạng rồi mở lại app nhé.</p>'
      : `
      <p class="theme">Chủ đề hôm nay: <b>${pack.theme}</b>${stale ? ` <span class="stale">(bài của ngày ${pack.date})</span>` : ''}</p>
      <div class="section-head">
        <b>Hôm nay cần làm</b>
        <span class="meta">${doneCount}/${CARDS.length} xong</span>
      </div>
      <div class="cards">
        ${CARDS.map((c) => `
          <button class="card ${done[c.id] ? 'done' : ''}" data-tab="${c.tab}">
            <span class="tile">${icon[c.ico](19)}</span>
            <span class="body"><b>${c.title}</b><small>${c.desc}</small></span>
            <span class="trail">${done[c.id] ? icon.checkCircle(22) : icon.chevron(20)}</span>
          </button>`).join('')}
      </div>`}
  `;

  el.querySelectorAll('.card').forEach((b) => {
    b.addEventListener('click', () => ctx.navigate(b.dataset.tab));
  });
}
