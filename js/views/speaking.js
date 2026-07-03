import { speak, listenOnce, sttSupported } from '../speech.js';
import { compare } from '../diff.js';
import { icon } from '../icons.js';

const ERROR_MSG = {
  'not-allowed': 'Micro bị chặn — vào Cài đặt Chrome ▸ Quyền của trang để bật micro.',
  'service-not-allowed': 'Micro bị chặn — vào Cài đặt Chrome ▸ Quyền của trang để bật micro.',
  network: 'Cần kết nối mạng để nhận giọng nói.',
  'no-speech': 'Không nghe thấy gì, thử nói lại nhé.',
};

export function render(el, ctx) {
  const { store, pack } = ctx;
  if (!pack) {
    el.innerHTML = '<p class="error">Chưa tải được bài học.</p>';
    return;
  }
  const sentences = pack.shadowing;
  const best = store.state.bestScores;

  const maybeComplete = () => {
    if (sentences.every((s) => best[s] != null)) store.markActivity(ctx.today, 'speaking');
  };

  el.innerHTML = `
    <header class="page-head"><h1>Shadowing</h1></header>
    ${sttSupported ? '' : '<p class="warn">Trình duyệt này không hỗ trợ nhận giọng nói — bạn vẫn nghe và đọc theo câu mẫu được.</p>'}
    ${sentences.map((s, i) => `
      <div class="shadow-item">
        <p class="sentence">${s}</p>
        <div class="row">
          <button class="pill play" data-i="${i}">${icon.play(14)} Nghe</button>
          <button class="pill play slow" data-i="${i}">${icon.turtle(14)} 0.75x</button>
          ${sttSupported ? `<button class="pill mic" data-i="${i}">${icon.mic(14)} Nói</button>` : ''}
          <span class="score" id="score-${i}">${best[s] != null ? `${best[s]}%` : ''}</span>
        </div>
        <div class="result" id="res-${i}"></div>
      </div>`).join('')}
  `;

  el.querySelectorAll('.play').forEach((b) => {
    b.onclick = () => speak(sentences[+b.dataset.i], { rate: b.classList.contains('slow') ? 0.75 : 1 });
  });

  el.querySelectorAll('.mic').forEach((b) => {
    b.onclick = () => {
      const i = +b.dataset.i;
      const startedAt = Date.now();
      b.innerHTML = `${icon.mic(14)} Đang nghe…`;
      b.classList.add('listening');
      b.disabled = true;
      listenOnce({
        onResult: (transcript) => {
          const { words, score } = compare(sentences[i], transcript);
          document.getElementById(`res-${i}`).innerHTML = words
            .map((w) => `<span class="${w.ok ? 'ok' : 'miss'}">${w.text}</span>`)
            .join('');
          if (score > (best[sentences[i]] ?? -1)) {
            best[sentences[i]] = score;
            store.save();
          }
          document.getElementById(`score-${i}`).textContent = `${score}%`;
          store.addSpeakingSeconds(ctx.today, Math.max(1, Math.round((Date.now() - startedAt) / 1000)));
          maybeComplete();
        },
        onError: (code) => {
          document.getElementById(`res-${i}`).innerHTML = `<span class="msg">${ERROR_MSG[code] || 'Có lỗi, thử lại nhé.'}</span>`;
        },
        onEnd: () => {
          b.innerHTML = `${icon.mic(14)} Nói`;
          b.classList.remove('listening');
          b.disabled = false;
        },
      });
    };
  });
}
