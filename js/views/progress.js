import { addDays } from '../dates.js';
import { icon } from '../icons.js';

export function render(el, ctx) {
  const { store } = ctx;
  const s = store.state;
  const streak = store.computeStreak(ctx.today);
  const longest = store.computeLongestStreak();
  const totalWords = Object.keys(s.srs).length;
  const speakMins = Math.round(
    Object.values(s.days).reduce((sum, d) => sum + (d.speakingSeconds || 0), 0) / 60,
  );

  const cells = [];
  for (let i = 29; i >= 0; i--) {
    const d = addDays(ctx.today, -i);
    const cls = store.isDayComplete(d) ? 'full' : s.days[d] ? 'part' : '';
    cells.push(`<div class="cell ${cls}" title="${d}"></div>`);
  }

  const stat = (cls, ico, value, label) =>
    `<div class="stat"><div class="ic ${cls}">${ico}</div><b>${value}</b><small>${label}</small></div>`;

  el.innerHTML = `
    <header class="page-head"><h1>Tiến độ</h1></header>
    <div class="stats">
      ${stat('ic-amber', icon.flame(18), streak, 'ngày streak')}
      ${stat('ic-accent', icon.layers(18), totalWords, 'từ đã học')}
      ${stat('ic-green', icon.clock(18), speakMins, 'phút luyện nói')}
      ${stat('ic-purple', icon.target(18), longest, 'streak dài nhất')}
    </div>

    <div class="contrib">
      <div class="head">
        <b>30 ngày qua</b>
      </div>
      <div class="grid30">${cells.join('')}</div>
      <div class="legend">
        <span><i style="background:var(--accent)"></i>Hoàn thành</span>
        <span><i style="background:rgba(245,166,35,0.55)"></i>Dở dang</span>
        <span><i style="background:rgba(255,255,255,0.05);border:1px solid var(--line)"></i>Chưa học</span>
      </div>
    </div>

    <button class="primary" id="export">${icon.download(16)} Xuất backup</button>
    <button class="pill" id="import" style="width:100%;justify-content:center;margin-top:10px;padding:13px">${icon.upload(16)} Nhập backup</button>
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
