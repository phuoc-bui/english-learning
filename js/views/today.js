const CARDS = [
  { id: 'vocab', icon: '📖', title: 'Từ vựng mới', desc: '8 từ hôm nay', mins: 5, tab: 'vocab' },
  { id: 'listening', icon: '🎧', title: 'Bài nghe', desc: '1 hội thoại + 3 câu hỏi', mins: 5, tab: 'listening' },
  { id: 'speaking', icon: '🎤', title: 'Luyện nói', desc: '5 câu shadowing', mins: 5, tab: 'speaking' },
  { id: 'interview', icon: '💼', title: 'Phỏng vấn', desc: '2 câu hỏi', mins: 10, tab: 'interview' },
];

export function render(el, ctx) {
  const { store, pack } = ctx;
  const streak = store.computeStreak(ctx.today);
  const done = (pack && store.state.days[ctx.today]) || {};
  const stale = pack && pack.date !== ctx.today;

  el.innerHTML = `
    <header class="page-head">
      <h1>Office English</h1>
      <div class="streak">🔥 ${streak} ngày</div>
    </header>
    ${!pack
      ? '<p class="error">Không tải được bài học. Kiểm tra kết nối mạng rồi mở lại app nhé.</p>'
      : `
      <p class="theme">Chủ đề: <b>${pack.theme}</b>${stale ? ` <span class="stale">(bài của ngày ${pack.date})</span>` : ''}</p>
      <div class="cards">
        ${CARDS.map((c) => `
          <button class="card ${done[c.id] ? 'done' : ''}" data-tab="${c.tab}">
            <span class="icon">${c.icon}</span>
            <span class="body"><b>${c.title}</b><small>${c.desc} · ~${c.mins} phút</small></span>
            <span class="check">${done[c.id] ? '✓' : ''}</span>
          </button>`).join('')}
      </div>`}
  `;
  el.querySelectorAll('.card').forEach((b) => {
    b.addEventListener('click', () => ctx.navigate(b.dataset.tab));
  });
}
