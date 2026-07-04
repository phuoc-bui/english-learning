import { speak, listenOnce, sttSupported } from '../speech.js';
import { compare } from '../diff.js';
import { icon } from '../icons.js';
import { buildPrompt, taskDesc, AI_APPS } from '../prompt.js';
import { AI_KINDS, aiKindsFor } from '../plan.js';

const ERROR_MSG = {
  'not-allowed': 'Micro bị chặn — vào Cài đặt Chrome ▸ Quyền của trang để bật micro.',
  'service-not-allowed': 'Micro bị chặn — vào Cài đặt Chrome ▸ Quyền của trang để bật micro.',
  network: 'Cần kết nối mạng để nhận giọng nói.',
  'no-speech': 'Không nghe thấy gì, thử nói lại nhé.',
};

const AI_META = {
  conversation: { ico: 'message', title: 'Hội thoại với AI' },
  speaking: { ico: 'mic', title: 'Nói tự do với AI' },
  writing: { ico: 'pencil', title: 'Viết với AI' },
};

function toast(el, msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  el.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

export function render(el, ctx) {
  const { store, pack } = ctx;
  if (!pack) {
    el.innerHTML = '<p class="error">Chưa tải được bài học.</p>';
    return;
  }
  const profile = store.state.profile || { level: 'b1', goals: [], minutes: 15, aiApp: 'other' };
  const app = AI_APPS[profile.aiApp] || AI_APPS.other;
  const planned = aiKindsFor(ctx.today, profile.minutes);
  const sentences = pack.shadowing;
  const best = store.state.bestScores;

  const maybeComplete = () => {
    if (sentences.every((s) => best[s] != null)) store.markActivity(ctx.today, 'speaking');
  };

  function draw() {
    el.innerHTML = `
      <header class="page-head"><h1>Luyện tập</h1></header>

      <h2>Shadowing</h2>
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

      <h2>Thực hành với AI</h2>
      <p class="meta" style="margin-bottom:10px">Mở ${app.name} với prompt soạn sẵn theo bài hôm nay, xong quay lại đánh dấu ✓</p>
      <div class="ai-cards">
        ${AI_KINDS.map((k) => {
          const done = store.isAiDone(ctx.today, k);
          return `
          <div class="ai-card ${done ? 'done' : ''}">
            <div class="head">
              <span class="tile">${icon[AI_META[k].ico](18)}</span>
              <b>${AI_META[k].title}</b>
              ${planned.includes(k) ? '<span class="badge">kế hoạch hôm nay</span>' : ''}
            </div>
            <p class="desc">${taskDesc(k, pack)}</p>
            <div class="row">
              <button class="pill open-ai" data-kind="${k}">${icon.external(14)} Mở ${app.name}</button>
              <button class="pill mark-ai ${done ? 'on' : ''}" data-kind="${k}">${done ? `${icon.check(14)} Đã xong` : 'Đánh dấu xong'}</button>
            </div>
            <div class="prompt-fallback" id="fb-${k}" hidden>
              <p class="meta">Copy thủ công prompt dưới đây rồi dán vào ${app.name}:</p>
              <textarea readonly rows="6"></textarea>
            </div>
          </div>`;
        }).join('')}
      </div>
    `;
    bind();
  }

  function bind() {
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

    el.querySelectorAll('.open-ai').forEach((b) => {
      b.onclick = async () => {
        const kind = b.dataset.kind;
        const prompt = buildPrompt(kind, pack, profile);
        let copied = true;
        try {
          await navigator.clipboard.writeText(prompt);
        } catch {
          copied = false;
        }
        const url = app.url(prompt);
        if (url) window.open(url, '_blank');
        if (copied) {
          toast(el, 'Đã copy prompt — nếu ô chat trống, dán vào để bắt đầu.');
        } else {
          // clipboard bị chặn — hiện prompt để copy tay
          const fb = el.querySelector(`#fb-${kind}`);
          fb.hidden = false;
          fb.querySelector('textarea').value = prompt;
        }
      };
    });

    el.querySelectorAll('.mark-ai').forEach((b) => {
      b.onclick = () => {
        const kind = b.dataset.kind;
        store.setAiDone(ctx.today, kind, !store.isAiDone(ctx.today, kind));
        draw();
      };
    });
  }

  draw();
}
