import { addDays } from '../dates.js';
import { icon } from '../icons.js';
import { dueTest, generateQuiz } from '../quiz.js';
import { DAILY_GOAL } from '../store.js';
import { esc } from '../clip.js';
import { buildAiTestPrompt, AI_APPS } from '../prompt.js';
import { speak } from '../speech.js';

const KIND_LABEL = { week: 'tuần', month: 'tháng' };

// Thẻ từ câu đã bắt trong kỳ -> "gói" cho generateQuiz (cần word, meaning_vi, example)
function cardsForPeriod(ctx, kind) {
  const from = addDays(ctx.today, -((kind === 'month' ? 30 : 7) - 1));
  const { mined } = ctx.store.state;
  const inPeriod = mined.filter((m) => m.meaning_vi && m.createdAt >= from && m.createdAt <= ctx.today);
  // kỳ ít câu quá thì lấy thêm câu cũ hơn cho đủ đề
  const pool = inPeriod.length >= 8 ? inPeriod : mined.filter((m) => m.meaning_vi);
  const vocab = pool.map((m) => ({ word: m.focus, meaning_vi: m.meaning_vi, example: m.text }));
  const themes = [...new Set(pool.map((m) => m.source?.title).filter(Boolean))].slice(0, 6);
  return { packs: [{ vocab }], themes };
}

export function render(el, ctx) {
  const { store } = ctx;
  let quiz = null; // { kind, questions, i, correct, answered, packs }

  function drawStats() {
    const s = store.state;
    const streak = store.computeStreak(ctx.today);
    const longest = store.computeLongestStreak();
    const totalWords = Object.keys(s.srs).filter((w) => s.wordMeta[w]?.track === 'clip').length;
    const totalMined = s.mined.length;

    const cells = [];
    for (let i = 29; i >= 0; i--) {
      const d = addDays(ctx.today, -i);
      const cls = store.isDayComplete(d) ? 'full' : store.minedCount(d) > 0 ? 'part' : '';
      cells.push(`<div class="cell ${cls}" title="${d}"></div>`);
    }

    const stat = (cls, ico, value, label) =>
      `<div class="stat"><div class="ic ${cls}">${ico}</div><b>${value}</b><small>${label}</small></div>`;

    // đến hạn kiểm tra theo số ngày có bắt câu
    const due = dueTest({ days: Object.fromEntries(store.studiedDates().map((d) => [d, {}])), tests: s.tests }, ctx.today);
    const last8 = s.tests.slice(-8);

    el.innerHTML = `
      <header class="page-head"><h1>Tiến độ</h1></header>

      ${due ? `
      <button class="test-banner" id="startTest">
        <span class="tile">${icon.target(20)}</span>
        <span class="body"><b>Đến hạn kiểm tra ${KIND_LABEL[due]}!</b>
        <small>${due === 'month' ? '20' : '10'} câu từ chính những câu bạn đã bắt</small></span>
        <span class="trail">${icon.chevron(20)}</span>
      </button>` : ''}

      <div class="stats">
        ${stat('ic-amber', icon.flame(18), streak, 'ngày streak')}
        ${stat('ic-accent', icon.pencil(18), totalMined, 'câu đã bắt')}
        ${stat('ic-green', icon.layers(18), totalWords, 'thẻ ôn')}
        ${stat('ic-purple', icon.target(18), longest, 'streak dài nhất')}
      </div>

      <div class="contrib">
        <div class="head"><b>30 ngày qua</b></div>
        <div class="grid30">${cells.join('')}</div>
        <div class="legend">
          <span><i style="background:var(--accent)"></i>Đủ ${DAILY_GOAL} câu</span>
          <span><i style="background:rgba(245,166,35,0.55)"></i>1–${DAILY_GOAL - 1} câu</span>
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
      const { packs, themes } = cardsForPeriod(ctx, kind);
      const questions = generateQuiz({ packs, kind, level: store.state.profile?.level || 'b1' });
      if (!questions.length) {
        drawStats();
        el.insertAdjacentHTML('beforeend', '<p class="warn">Cần ít nhất 4 câu đã có nghĩa để tạo bài kiểm tra.</p>');
        return;
      }
      quiz = { kind, questions, i: 0, correct: 0, answered: null, packs, themes };
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
        <div class="q">${esc(q.prompt)}</div>
        ${q.tts ? `<button class="pill" id="playTts">${icon.volume(14)} Nghe câu</button>` : ''}
        ${q.options.map((o, oi) => {
          let cls = '';
          if (answered && oi === q.answer) cls = 'right';
          else if (answered && quiz.answered === oi) cls = 'wrong';
          return `<button class="option ${cls}" data-o="${oi}" ${answered ? 'disabled' : ''}>
            <span class="mark">${cls === 'right' ? icon.check(12) : ''}</span><span>${esc(o)}</span></button>`;
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
    const { kind, questions, correct, packs, themes: srcThemes } = quiz;
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
      const themes = srcThemes.length ? srcThemes : ['English from videos, songs and news I followed'];
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
