import { addDays } from '../dates.js';

export function render(el, ctx) {
  const { store } = ctx;
  const s = store.state;
  const streak = store.computeStreak(ctx.today);
  const longest = store.computeLongestStreak();
  const totalWords = Object.keys(s.srs).length;
  const speakMins = Math.round(
    Object.values(s.days).reduce((sum, d) => sum + (d.speakingSeconds || 0), 0) / 60,
  );
  const answered = s.interviewLog.length;

  const cells = [];
  for (let i = 29; i >= 0; i--) {
    const d = addDays(ctx.today, -i);
    const cls = store.isDayComplete(d) ? 'full' : s.days[d] ? 'part' : '';
    cells.push(`<div class="cell ${cls}" title="${d}"></div>`);
  }

  el.innerHTML = `
    <header class="page-head"><h1>Tiến độ</h1></header>
    <div class="stats">
      <div class="stat"><b>🔥 ${streak}</b><small>streak hiện tại</small></div>
      <div class="stat"><b>${longest}</b><small>streak dài nhất</small></div>
      <div class="stat"><b>${totalWords}</b><small>từ đã học</small></div>
      <div class="stat"><b>${speakMins}′</b><small>phút luyện nói</small></div>
      <div class="stat"><b>${answered}</b><small>câu phỏng vấn đã trả lời</small></div>
    </div>
    <h2>30 ngày gần nhất</h2>
    <div class="grid30">${cells.join('')}</div>
    <button class="primary" id="export">⬇️ Xuất backup</button>
    <button class="primary" id="import" style="background:var(--card);border:1px solid var(--line)">⬆️ Nhập backup</button>
    <input type="file" id="file" accept="application/json" style="display:none">
    <p id="msg" class="warn"></p>
  `;

  el.querySelector('#export').onclick = () => {
    const blob = new Blob([store.exportData()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `office-english-backup-${ctx.today}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const file = el.querySelector('#file');
  el.querySelector('#import').onclick = () => file.click();
  file.onchange = async () => {
    try {
      store.importData(await file.files[0].text());
      render(el, ctx);
    } catch {
      el.querySelector('#msg').textContent = 'File backup không hợp lệ.';
    }
  };
}
