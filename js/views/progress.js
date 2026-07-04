import { addDays } from '../dates.js';
import { icon } from '../icons.js';
import { dueTest, generateQuiz } from '../quiz.js';
import { loadIndex, loadPack } from '../data.js';
import { buildAiTestPrompt, AI_APPS } from '../prompt.js';
import { speak } from '../speech.js';

const KIND_LABEL = { week: 'tuần', month: 'tháng' };

async function packsForPeriod(ctx, kind) {
  const days = kind === 'month' ? 30 : 7;
  const from = addDays(ctx.today, -(days - 1));
  const studied = Object.keys(ctx.store.state.days).filter((d) => d >= from && d <= ctx.today);
  const track = ctx.store.state.profile?.track || 'it';
  const byDate = new Map((await loadIndex()).map((e) => [e.date, e]));
  const packs = [];
  for (const d of studied) {
    const e = byDate.get(d);
    if (!e) continue;
    const tr = e.tracks.includes(track) ? track : e.tracks[0];
    const p = await loadPack(e, tr).catch(() => null);
    if (p) packs.push(p);
  }
  return packs;
}

export function render(el, ctx) {
  const { store } = ctx;
  let quiz = null; // { kind, questions, i, correct, answered, packs }

  function drawStats() {
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

    const due = dueTest(s, ctx.today);
    const last8 = s.tests.slice(-8);

    el.innerHTML = `
      <header class="page-head"><h1>Tiến độ</h1></header>

      ${due ? `
      <button class="test-banner" id="startTest">
        <span class="tile">${icon.target(20)}</span>
        <span class="body"><b>Đến hạn kiểm tra ${KIND_LABEL[due]}!</b>
        <small>${due === 'month' ? '20' : '10'} câu từ chính nội dung bạn đã học</small></span>
        <span class="trail">${icon.chevron(20)}</span>
      </button>` : ''}

      <div class="stats">
        ${stat('ic-amber', icon.flame(18), streak, 'ngày streak')}
        ${stat('ic-accent', icon.layers(18), totalWords, 'từ đã học')}
        ${stat('ic-green', icon.clock(18), speakMins, 'phút luyện nói')}
        ${stat('ic-purple', icon.target(18), longest, 'streak dài nhất')}
      </div>

      <div class="contrib">
        <div class="head"><b>30 ngày qua</b></div>
        <div class="grid30">${cells.join('')}</div>
        <div class="legend">
          <span><i style="background:var(--accent)"></i>Hoàn thành</span>
          <span><i style="background:rgba(245,166,35,0.55)"></i>Dở dang</span>
          <span><i style="background:rgba(255,255,255,0.05);border:1px solid var(--line)"></i>Chưa học</span>
        </div>
      </div>

      ${last8.length ? `
      <div class="contrib">
        <div class="head"><b>Điểm kiểm tra</b></div>
        <div class="testbars">
          ${last8.map((t) => {
            const pct = Math.round((t.score / t.total) * 100);
            return `<div class="tb"><b>${pct}</b><i style="height:${Math.max(6, pct)}%"></i><small>${t.date.slice(5)}<br>${KIND_LABEL[t.kind]}${t.ai ? ' ·AI' : ''}</small></div>`;
          }).join('')}
        </div>
      </div>` : ''}
    `;

    el.querySelector('#startTest')?.addEventListener('click', async () => {
      const kind = due;
      el.querySelector('#startTest').disabled = true;
      const packs = await packsForPeriod(ctx, kind);
      const questions = generateQuiz({ packs, kind, level: store.state.profile?.level || 'b1' });
      if (!questions.length) {
        drawStats();
        el.insertAdjacentHTML('beforeend', '<p class="warn">Chưa đủ nội dung để tạo bài kiểm tra (cần mạng để tải lại bài đã học).</p>');
        return;
      }
      quiz = { kind, questions, i: 0, correct: 0, answered: null, packs };
      drawQuiz();
    });
  }

  function drawQuiz() {
    const q = quiz.questions[quiz.i];
    const answered = quiz.answered != null;
    el.innerHTML = `
      <header class="page-head">
        <h1>Kiểm tra ${KIND_LABEL[quiz.kind]}</h1>
        <span class="count-pill">${quiz.i + 1} / ${quiz.questions.length}</span>
      </header>
      <div class="progress-track"><i style="width:${Math.round((quiz.i / quiz.questions.length) * 100)}%"></i></div>
      <div class="question">
        <div class="q">${q.prompt}</div>
        ${q.tts ? `<button class="pill" id="playTts">${icon.volume(14)} Nghe câu</button>` : ''}
        ${q.options.map((o, oi) => {
          let cls = '';
          if (answered && oi === q.answer) cls = 'right';
          else if (answered && quiz.answered === oi) cls = 'wrong';
          return `<button class="option ${cls}" data-o="${oi}" ${answered ? 'disabled' : ''}>
            <span class="mark">${cls === 'right' ? icon.check(12) : ''}</span><span>${o}</span></button>`;
        }).join('')}
      </div>
      ${answered ? `<button class="primary" id="next">${quiz.i === quiz.questions.length - 1 ? 'Xem kết quả' : 'Câu tiếp theo'}</button>` : ''}
    `;
    el.querySelector('#playTts')?.addEventListener('click', () => speak(q.tts));
    if (q.tts && !answered) speak(q.tts);
    el.querySelectorAll('.option:not([disabled])').forEach((b) => {
      b.onclick = () => {
        quiz.answered = +b.dataset.o;
        if (quiz.answered === q.answer) quiz.correct++;
        drawQuiz();
      };
    });
    el.querySelector('#next')?.addEventListener('click', () => {
      quiz.answered = null;
      if (quiz.i === quiz.questions.length - 1) return finishQuiz();
      quiz.i++;
      drawQuiz();
    });
  }

  function finishQuiz() {
    const { kind, questions, correct, packs } = quiz;
    store.addTestResult({ date: ctx.today, kind, score: correct, total: questions.length });
    const profile = store.state.profile || { level: 'b1', aiApp: 'other' };
    const app = AI_APPS[profile.aiApp] || AI_APPS.other;
    const pct = Math.round((correct / questions.length) * 100);
    el.innerHTML = `
      <div class="empty">
        <h2>${pct >= 80 ? '🎉' : pct >= 50 ? '💪' : '📚'} ${correct}/${questions.length} câu đúng</h2>
        <p>Điểm được lưu vào biểu đồ tiến bộ.</p>
        <button class="pill wide" id="aiTest">${icon.external(15)} Kiểm tra nói/viết sâu hơn với ${app.name}</button>
        <button class="primary" id="done" style="margin-top:12px">Về trang Tiến độ</button>
      </div>
    `;
    el.querySelector('#aiTest').onclick = async () => {
      const words = [...new Set(packs.flatMap((p) => p.vocab.map((v) => v.word)))].slice(0, 20);
      const themes = [...new Set(packs.map((p) => p.theme))];
      const prompt = buildAiTestPrompt(words, themes, profile);
      try { await navigator.clipboard.writeText(prompt); } catch { /* url vẫn mở được */ }
      const url = app.url(prompt);
      if (url) window.open(url, '_blank');
      store.markTestAiDone(ctx.today, kind);
      el.querySelector('#aiTest').innerHTML = `${icon.check(15)} Đã mở ${app.name} — prompt trong clipboard`;
    };
    el.querySelector('#done').onclick = () => { quiz = null; drawStats(); };
  }

  drawStats();
}
