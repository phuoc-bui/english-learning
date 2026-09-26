import { icon } from '../icons.js';
import { addDays } from '../dates.js';
import { DAILY_GOAL } from '../store.js';
import { isDue } from '../srs.js';
import { esc, watchHash } from '../clip.js';
import { clipStats, recentVideos } from './clips.js';

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
  const backToMon = (new Date(y, m - 1, d).getDay() + 6) % 7;
  const monday = addDays(today, -backToMon);
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    const [yy, mm, dd] = date.split('-').map(Number);
    return {
      label: DOW[new Date(yy, mm - 1, dd).getDay()],
      done: store.isDayComplete(date), isToday: date === today, dayNum: dd,
    };
  });
}

export function render(el, ctx) {
  const { store } = ctx;
  const streak = store.computeStreak(ctx.today);
  const week = weekDots(store, ctx.today);
  const got = store.minedCount(ctx.today);
  const done = got >= DAILY_GOAL;
  const { inbox } = clipStats(store);
  const { srs, wordMeta } = store.state;
  const dueCards = Object.keys(srs).filter((w) => wordMeta[w]?.track === 'clip' && isDue(srs[w], ctx.today)).length;
  const videos = recentVideos(store, 3);

  const card = (id, ico, title, desc, extra = '') => `
    <button class="card ${extra}" id="${id}">
      <span class="tile">${icon[ico](19)}</span>
      <span class="body"><b>${title}</b><small>${desc}</small></span>
      <span class="trail">${icon.chevron(20)}</span>
    </button>`;

  el.innerHTML = `
    <div class="greet">
      <div>
        <div class="eyebrow">${greeting()}</div>
        <div class="hi">Săn câu hôm nay nhé 🎬</div>
      </div>
      <button class="avatar" id="openSettings" style="color:var(--accent-light);border:none;background:none;cursor:pointer">${icon.gear(22)}</button>
    </div>

    <div class="streak-hero">
      <div class="top">
        <div class="flame">${icon.flame(30)}</div>
        <div>
          <div><span class="num">${streak}</span> <span class="unit">ngày liên tục</span></div>
          <div class="sub">Mỗi ngày bắt đủ ${DAILY_GOAL} câu để giữ streak 🔥</div>
        </div>
      </div>
      <div class="week">
        ${week.map((w) => `
          <div class="day ${w.isToday ? 'is-today' : ''}">
            <div class="dot ${w.done ? 'on' : ''} ${w.isToday ? 'today' : ''}">${w.isToday ? w.dayNum : (w.done ? icon.check(14) : '')}</div>
            <div class="lbl">${w.label}</div>
          </div>`).join('')}
      </div>
    </div>

    <div class="goal ${done ? 'done' : ''}">
      <div class="goal-head">
        <b>${done ? 'Xong mục tiêu hôm nay 🎉' : 'Mục tiêu hôm nay'}</b>
        <span class="goal-count">${got}/${DAILY_GOAL} câu</span>
      </div>
      <div class="goal-steps">${Array.from({ length: DAILY_GOAL }, (_, i) =>
        `<i class="${i < got ? 'on' : ''}"></i>`).join('')}</div>
      <small class="meta">${done
        ? (got > DAILY_GOAL ? `Đã bắt ${got} câu — tuyệt!` : 'Bắt thêm nếu còn hứng nhé.')
        : `Còn ${DAILY_GOAL - got} câu nữa. Xem video, nghe nhạc hoặc đọc tin rồi bấm vào từ lạ.`}</small>
    </div>

    <div class="section-head"><b>Bắt câu từ…</b></div>
    <div class="cards">
      ${card('goWatch', 'play', 'Video / nhạc YouTube', 'Dán link, phụ đề hoặc lời bài hát chạy bên cạnh', 'accent')}
      ${card('goNews', 'book', 'Đọc tin tiếng Anh', 'The Guardian · blog công nghệ DEV')}
      ${card('goCapture', 'pencil', 'Tự gõ câu', 'Câu gặp ở phim, web khác, ngoài đời')}
    </div>

    ${videos.length ? `
    <div class="section-head" style="margin-top:22px"><b>Xem tiếp</b></div>
    <div class="cards">${videos.map((v) => `
      <a class="card" href="${watchHash(v.id, null, v.music)}">
        <span class="tile">${icon[v.music ? 'headphones' : 'play'](18)}</span>
        <span class="body"><b>${esc(v.title)}</b><small>${v.count} câu đã bắt</small></span>
        <span class="trail">${icon.chevron(18)}</span>
      </a>`).join('')}</div>` : ''}

    ${dueCards || inbox ? `
    <div class="section-head" style="margin-top:22px"><b>Ôn lại</b></div>
    <div class="cards">
      ${dueCards ? card('goVocab', 'layers', `Ôn ${dueCards} thẻ đến hạn`, 'Thẻ từ những câu bạn đã bắt') : ''}
      ${inbox ? card('goInbox', 'help', `${inbox} câu chờ giải nghĩa`, 'Điền nghĩa để thành thẻ ôn') : ''}
    </div>` : ''}
  `;

  el.querySelector('#openSettings').onclick = () => ctx.navigate('settings');
  el.querySelector('#goWatch').onclick = () => { ctx.navigate('clips'); setTimeout(() => document.getElementById('yt')?.focus(), 50); };
  el.querySelector('#goNews').onclick = () => ctx.navigate('news');
  el.querySelector('#goCapture').onclick = () => ctx.navigate('clips?new=1');
  el.querySelector('#goVocab')?.addEventListener('click', () => ctx.navigate('vocab'));
  el.querySelector('#goInbox')?.addEventListener('click', () => ctx.navigate('clips'));
}
