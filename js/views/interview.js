import { speak, listenOnce, sttSupported } from '../speech.js';
import { icon } from '../icons.js';

const ERROR_MSG = {
  'not-allowed': 'Micro bị chặn — vào Cài đặt Chrome ▸ Quyền của trang để bật micro.',
  'service-not-allowed': 'Micro bị chặn — vào Cài đặt Chrome ▸ Quyền của trang để bật micro.',
  network: 'Cần kết nối mạng để nhận giọng nói.',
  'no-speech': 'Không nghe thấy gì, thử nói lại nhé.',
};

const KIND = { behavioral: 'Behavioral', technical: 'Technical', common: 'Thường gặp' };

function latestAnswer(store, today, question) {
  const entries = store.state.interviewLog.filter((e) => e.date === today && e.question === question);
  return entries.length ? entries[entries.length - 1].transcript : null;
}

export function render(el, ctx) {
  const { store, pack } = ctx;
  if (!pack) {
    el.innerHTML = '<p class="error">Chưa tải được bài học.</p>';
    return;
  }

  const saveAnswer = (question, transcript) => {
    store.state.interviewLog.push({ date: ctx.today, question, transcript });
    store.save();
    if (pack.interview.every((it) => latestAnswer(store, ctx.today, it.question))) {
      store.markActivity(ctx.today, 'interview');
    }
  };

  function draw() {
    el.innerHTML = `
      <header class="page-head"><h1>Phỏng vấn</h1></header>
      ${pack.interview.map((it, i) => {
        const ans = latestAnswer(store, ctx.today, it.question);
        return `
        <div class="iv">
          <div class="iv-q">
            <span class="kind">${KIND[it.type] || it.type}</span>
            <div class="text">${it.question} <button class="speak-btn mini" data-say="${i}">${icon.volume(15)}</button></div>
          </div>
          <details class="acc">
            <summary><span class="lead">${icon.help(18)}</span>Tips trả lời<span class="chev">${icon.chevronDown(18)}</span></summary>
            <div class="acc-body"><ul>${it.tips_vi.map((t) => `<li>${t}</li>`).join('')}</ul></div>
          </details>
          <div class="row">
            ${sttSupported ? `<button class="pill mic" data-mic="${i}">${icon.mic(14)} Trả lời bằng giọng nói</button>` : ''}
            <button class="pill" data-type="${i}">${icon.keyboard(14)} Gõ câu trả lời</button>
          </div>
          <div id="typebox-${i}" style="display:none">
            <textarea id="ta-${i}" placeholder="Type your answer in English..."></textarea>
            <button class="primary" data-submit="${i}">Lưu câu trả lời</button>
          </div>
          ${ans ? `<p class="transcript">Bạn: "${ans}"</p>` : ''}
          <details class="acc">
            <summary><span class="lead">${icon.book(18)}</span>Câu trả lời mẫu (B1)<span class="chev">${icon.chevronDown(18)}</span></summary>
            <div class="acc-body">${it.sample_answer}</div>
          </details>
          <button class="btn-copy" data-copy="${i}">${icon.copy(15)} Copy để hỏi Claude</button>
          <span id="copied-${i}" class="copied" style="display:none"></span>
        </div>`;
      }).join('')}
    `;

    el.querySelectorAll('[data-say]').forEach((b) => {
      b.onclick = () => speak(pack.interview[+b.dataset.say].question);
    });
    el.querySelectorAll('[data-mic]').forEach((b) => {
      b.onclick = () => {
        const i = +b.dataset.mic;
        b.innerHTML = `${icon.mic(14)} Đang nghe… (nói xong sẽ tự dừng)`;
        b.classList.add('listening', 'mic');
        b.disabled = true;
        listenOnce({
          onResult: (t) => saveAnswer(pack.interview[i].question, t),
          onError: (code) => {
            const c = document.getElementById(`copied-${i}`);
            c.textContent = ERROR_MSG[code] || 'Có lỗi, thử lại nhé.';
            c.style.color = 'var(--amber)';
            c.style.display = 'inline';
          },
          onEnd: () => draw(),
        });
      };
    });
    el.querySelectorAll('[data-type]').forEach((b) => {
      b.onclick = () => {
        document.getElementById(`typebox-${b.dataset.type}`).style.display = 'block';
      };
    });
    el.querySelectorAll('[data-submit]').forEach((b) => {
      b.onclick = () => {
        const i = +b.dataset.submit;
        const text = document.getElementById(`ta-${i}`).value.trim();
        if (text) {
          saveAnswer(pack.interview[i].question, text);
          draw();
        }
      };
    });
    el.querySelectorAll('[data-copy]').forEach((b) => {
      b.onclick = async () => {
        const i = +b.dataset.copy;
        const it = pack.interview[i];
        const ans = latestAnswer(store, ctx.today, it.question) || '(chưa trả lời)';
        const prompt = [
          'Tôi đang luyện phỏng vấn tiếng Anh (trình độ B1, ngành IT/phần mềm).',
          `Câu hỏi phỏng vấn: "${it.question}"`,
          `Câu trả lời của tôi: "${ans}"`,
          'Hãy nhận xét giúp tôi: 1) lỗi ngữ pháp, 2) từ vựng nên thay để tự nhiên hơn, 3) cấu trúc câu trả lời (dùng STAR nếu phù hợp), 4) viết lại một bản cải thiện ở trình độ B1-B2.',
        ].join('\n\n');
        const c = document.getElementById(`copied-${i}`);
        try {
          await navigator.clipboard.writeText(prompt);
          c.textContent = 'Đã copy — dán vào app Claude nhé!';
          c.style.color = 'var(--green)';
          c.style.display = 'inline';
        } catch {
          c.textContent = 'Không copy được — hãy tự chọn và sao chép văn bản.';
          c.style.color = 'var(--amber)';
          c.style.display = 'inline';
        }
      };
    });
  }
  draw();
}
