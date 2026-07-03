import { speak, stopSpeaking } from '../speech.js';
import { icon } from '../icons.js';

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

  // Gán màu speaker theo thứ tự xuất hiện (tối đa 2 giọng: a/b)
  const speakers = [...new Set(L.lines.map((l) => l.speaker))];
  const barClass = (spk) => (speakers.indexOf(spk) === 0 ? 'a' : 'b');

  function draw() {
    el.innerHTML = `
      <header class="page-head"><h1>${L.title}</h1></header>
      <div class="row">
        <button class="primary" style="width:auto;margin:0" id="playAll">${playing ? `${icon.volume(15)} Đang phát…` : `${icon.play(15)} Nghe hội thoại`}</button>
        <button class="pill" id="stop">${icon.stop(14)} Dừng</button>
        <button class="pill" id="toggleScript">${showScript ? 'Ẩn script' : 'Hiện script'}</button>
      </div>
      ${showScript ? `<div class="script">${L.lines.map((l) => `
        <div class="line">
          <div class="bar ${barClass(l.speaker)}"></div>
          <div class="txt"><div class="spk">${l.speaker}</div>${l.text}</div>
        </div>`).join('')}</div>` : ''}
      <h2>Câu hỏi</h2>
      ${L.questions.map((q, qi) => `
        <div class="question">
          <div class="q"><span class="n">${qi + 1}.</span>${q.q}</div>
          ${q.options.map((o, oi) => {
            const answered = answers[qi] != null;
            let cls = '';
            if (answered && oi === q.answer) cls = 'right';
            else if (answered && answers[qi] === oi) cls = 'wrong';
            const showMark = cls === 'right' ? icon.check(12) : '';
            return `<button class="option ${cls}" data-q="${qi}" data-o="${oi}" ${answered ? 'disabled' : ''}><span class="mark">${showMark}</span><span>${o}</span></button>`;
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
