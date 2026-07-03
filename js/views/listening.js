import { speak, stopSpeaking } from '../speech.js';

export function render(el, ctx) {
  const { store, pack } = ctx;
  if (!pack) {
    el.innerHTML = '<p class="error">Chưa tải được bài học.</p>';
    return;
  }
  const L = pack.listening;
  // Xen kẽ accent theo ngày: ngày chẵn en-US, ngày lẻ en-GB
  const lang = Number(pack.date.slice(8)) % 2 === 0 ? 'en-US' : 'en-GB';
  let showScript = false;
  let playing = false;
  const answers = {};

  function draw() {
    el.innerHTML = `
      <header class="page-head"><h1>🎧 ${L.title}</h1></header>
      <div class="row">
        <button class="primary" style="width:auto;margin:0" id="playAll">${playing ? '🔊 Đang phát...' : '▶ Nghe hội thoại'}</button>
        <button id="stop">⏹ Dừng</button>
        <button id="toggleScript">${showScript ? 'Ẩn script' : 'Hiện script'}</button>
      </div>
      ${showScript ? `<div class="script">${L.lines.map((l) => `<p><b>${l.speaker}:</b> ${l.text}</p>`).join('')}</div>` : ''}
      <h2>Câu hỏi</h2>
      ${L.questions.map((q, qi) => `
        <div class="question">
          <p>${qi + 1}. ${q.q}</p>
          ${q.options.map((o, oi) => {
            const answered = answers[qi] != null;
            let cls = '';
            if (answered && oi === q.answer) cls = 'right';
            else if (answered && answers[qi] === oi) cls = 'wrong';
            return `<button class="option ${cls}" data-q="${qi}" data-o="${oi}" ${answered ? 'disabled' : ''}>${o}</button>`;
          }).join('')}
        </div>`).join('')}
    `;

    el.querySelector('#playAll').onclick = async () => {
      if (playing) return;
      playing = true;
      draw();
      for (const line of L.lines) {
        if (!playing) return;
        await speak(line.text, { gender: line.voice, lang });
      }
      playing = false;
      draw();
    };
    el.querySelector('#stop').onclick = () => { playing = false; stopSpeaking(); draw(); };
    el.querySelector('#toggleScript').onclick = () => { showScript = !showScript; draw(); };
    el.querySelectorAll('.option:not([disabled])').forEach((b) => {
      b.onclick = () => {
        answers[+b.dataset.q] = +b.dataset.o;
        if (Object.keys(answers).length === L.questions.length) {
          store.markActivity(ctx.today, 'listening');
        }
        draw();
      };
    });
  }
  draw();
}
