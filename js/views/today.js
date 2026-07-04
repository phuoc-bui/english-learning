import { icon } from '../icons.js';
import { addDays } from '../dates.js';
import { requiredActivities } from '../plan.js';
import { TRACK_LABEL } from '../profile-options.js';

// Thẻ hoạt động: 3 cốt lõi + AI theo kế hoạch ngày
const CARD_META = {
  vocab: { ico: 'book', title: 'Từ vựng', desc: '8 từ · ~5 phút', tab: 'vocab' },
  listening: { ico: 'headphones', title: 'Nghe hội thoại', desc: '1 hội thoại + câu hỏi', tab: 'listening' },
  speaking: { ico: 'mic', title: 'Nói · Shadowing', desc: 'Luyện phát âm', tab: 'practice' },
  ai_conversation: { ico: 'message', title: 'Hội thoại với AI', desc: 'Nhập vai theo chủ đề hôm nay', tab: 'practice' },
  ai_speaking: { ico: 'mic', title: 'Nói tự do với AI', desc: 'Trả lời đề nói với AI', tab: 'practice' },
  ai_writing: { ico: 'pencil', title: 'Viết với AI', desc: 'Viết email/tin nhắn, AI chữa', tab: 'practice' },
};

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
  const profile = store.state.profile || {};
  const streak = store.computeStreak(ctx.today);
  const done = store.state.days[ctx.today] || {};
  const stale = pack && pack.date !== ctx.today;
  const week = weekDots(store, ctx.today);

  const activities = requiredActivities(ctx.today, profile.minutes ?? 15);
  const isDone = (a) => (a.startsWith('ai_') ? store.isAiDone(ctx.today, a.slice(3)) : !!done[a]);
  const doneCount = activities.filter(isDone).length;

  el.innerHTML = `
    <div class="greet">
      <div>
        <div class="eyebrow">${greeting()}</div>
        <div class="hi">Học chút nhé 👋</div>
      </div>
      <button class="avatar" id="openSettings" style="color:var(--accent-light);border:none;background:none;cursor:pointer">${icon.gear(22)}</button>
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
      <p class="theme">Chủ đề hôm nay: <b>${pack.theme}</b> · ${TRACK_LABEL[pack.track || 'it']}${stale ? ` <span class="stale">(bài của ngày ${pack.date})</span>` : ''}</p>
      <div class="section-head">
        <b>Hôm nay cần làm</b>
        <span class="meta">${doneCount}/${activities.length} xong</span>
      </div>
      <div class="cards">
        ${activities.map((a) => {
          const c = CARD_META[a];
          return `
          <button class="card ${isDone(a) ? 'done' : ''}" data-tab="${c.tab}">
            <span class="tile">${icon[c.ico](19)}</span>
            <span class="body"><b>${c.title}</b><small>${c.desc}</small></span>
            <span class="trail">${isDone(a) ? icon.checkCircle(22) : icon.chevron(20)}</span>
          </button>`;
        }).join('')}
      </div>`}
  `;

  el.querySelectorAll('.card').forEach((b) => {
    b.addEventListener('click', () => ctx.navigate(b.dataset.tab));
  });
  el.querySelector('#openSettings').onclick = () => ctx.navigate('settings');
}
