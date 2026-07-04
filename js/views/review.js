import { loadIndex, loadPack } from '../data.js';
import { speak, stopSpeaking, listenOnce, sttSupported } from '../speech.js';
import { compare } from '../diff.js';
import { icon } from '../icons.js';
import { TRACK_LABEL } from '../profile-options.js';

// Độ nhớ theo SRS: mới / đang học / thuộc
function strength(card) {
  if (!card || card.reps === 0) return 'new';
  return card.interval >= 21 ? 'known' : 'learning';
}
const STRENGTH_LABEL = { new: 'Mới', learning: 'Đang học', known: 'Thuộc' };

export function render(el, ctx) {
  const { store } = ctx;
  const st = { seg: 'packs', track: 'all', query: '', strength: 'all', entries: null, detail: null };

  async function loadEntries() {
    try {
      st.entries = (await loadIndex()).filter((e) => e.date <= ctx.today).sort((a, b) => (a.date < b.date ? 1 : -1));
    } catch {
      st.entries = [];
    }
    draw();
  }

  function packRows() {
    const rows = st.entries.flatMap((e) => e.tracks.map((t) => ({ entry: e, track: t })));
    return st.track === 'all' ? rows : rows.filter((r) => r.track === st.track);
  }

  function wordRows() {
    const { srs, wordMeta } = store.state;
    let words = Object.keys(srs).sort();
    if (st.track !== 'all') words = words.filter((w) => (wordMeta[w]?.track || 'it') === st.track);
    if (st.strength !== 'all') words = words.filter((w) => strength(srs[w]) === st.strength);
    if (st.query) {
      const q = st.query.toLowerCase();
      words = words.filter((w) => w.toLowerCase().includes(q) || (wordMeta[w]?.meaning_vi || '').toLowerCase().includes(q));
    }
    return words;
  }

  function trackChips(withAll = true) {
    const opts = [...(withAll ? [['all', 'Tất cả']] : []), ...Object.entries(TRACK_LABEL)];
    return `<div class="chips">${opts.map(([v, l]) =>
      `<button class="chip ${st.track === v ? 'on' : ''}" data-track="${v}">${l}</button>`).join('')}</div>`;
  }

  function drawDetail() {
    const p = st.detail;
    let playing = false;
    const lang = Number(p.date.slice(8)) % 2 === 0 ? 'en-US' : 'en-GB';
    el.innerHTML = `
      <header class="page-head">
        <button class="pill" id="back">${icon.chevron(14)} Quay lại</button>
        <h1 style="font-size:18px">${p.theme}</h1>
      </header>
      <p class="meta">${p.date} · ${TRACK_LABEL[p.track || 'it']}</p>

      <h2>${p.listening.title}</h2>
      <div class="row">
        <button class="primary" style="width:auto;margin:0" id="playAll">${icon.play(15)} Nghe hội thoại</button>
        <button class="pill" id="stop">${icon.stop(14)} Dừng</button>
      </div>
      <div class="script">${p.listening.lines.map((l) => `
        <div class="line"><div class="bar a"></div>
        <div class="txt"><div class="spk">${l.speaker}</div>${l.text}</div></div>`).join('')}</div>

      <h2>Từ vựng (${p.vocab.length})</h2>
      ${p.vocab.map((v, i) => `
        <div class="word-row">
          <button class="pill play-word" data-i="${i}">${icon.volume(14)}</button>
          <div><b>${v.word}</b> <span class="meta">${v.ipa}</span><br><small>${v.meaning_vi}</small></div>
        </div>`).join('')}

      <h2>Shadowing</h2>
      ${p.shadowing.map((s, i) => `
        <div class="shadow-item"><p class="sentence">${s}</p>
        <div class="row">
          <button class="pill play-sh" data-i="${i}">${icon.play(14)} Nghe</button>
          ${sttSupported ? `<button class="pill mic-sh" data-i="${i}">${icon.mic(14)} Nói</button>` : ''}
          <span class="score" id="rsc-${i}"></span>
        </div>
        <div class="result" id="rres-${i}"></div></div>`).join('')}
    `;
    el.querySelector('#back').onclick = () => { stopSpeaking(); st.detail = null; draw(); };
    el.querySelector('#playAll').onclick = async () => {
      if (playing) return;
      playing = true;
      for (const line of p.listening.lines) {
        if (!playing) return;
        await speak(line.text, { gender: line.voice, lang });
      }
      playing = false;
    };
    el.querySelector('#stop').onclick = () => { playing = false; stopSpeaking(); };
    el.querySelectorAll('.play-word').forEach((b) => { b.onclick = () => speak(p.vocab[+b.dataset.i].word); });
    el.querySelectorAll('.play-sh').forEach((b) => { b.onclick = () => speak(p.shadowing[+b.dataset.i]); });
    el.querySelectorAll('.mic-sh').forEach((b) => {
      b.onclick = () => {
        const i = +b.dataset.i;
        b.disabled = true;
        listenOnce({
          onResult: (t) => {
            const { words, score } = compare(p.shadowing[i], t);
            document.getElementById(`rres-${i}`).innerHTML = words
              .map((w) => `<span class="${w.ok ? 'ok' : 'miss'}">${w.text}</span>`).join('');
            // chỉ hiển thị điểm khi ôn — không ghi đè bestScores/tiến độ ngày cũ
            document.getElementById(`rsc-${i}`).textContent = `${score}%`;
          },
          onEnd: () => { b.disabled = false; },
        });
      };
    });
  }

  function draw() {
    if (st.detail) return drawDetail();
    el.innerHTML = `
      <header class="page-head"><h1>Ôn tập</h1></header>
      <div class="seg">
        <button class="${st.seg === 'packs' ? 'on' : ''}" data-seg="packs">Bài cũ</button>
        <button class="${st.seg === 'words' ? 'on' : ''}" data-seg="words">Sổ tay từ vựng</button>
      </div>
      ${trackChips()}
      ${st.seg === 'packs' ? drawPacks() : drawWords()}
    `;
    el.querySelectorAll('.seg button').forEach((b) => { b.onclick = () => { st.seg = b.dataset.seg; draw(); }; });
    el.querySelectorAll('.chip').forEach((b) => { b.onclick = () => { st.track = b.dataset.track; draw(); }; });
    if (st.seg === 'packs') {
      el.querySelectorAll('.pack-row').forEach((b) => {
        b.onclick = async () => {
          const entry = st.entries.find((e) => e.date === b.dataset.date);
          b.classList.add('loading');
          const p = await loadPack(entry, b.dataset.track).catch(() => null);
          if (p) { st.detail = p; draw(); } else {
            b.classList.remove('loading');
            b.querySelector('small').textContent = 'Không tải được — cần mạng';
          }
        };
      });
    } else {
      const inp = el.querySelector('#q');
      inp.oninput = () => {
        st.query = inp.value;
        el.querySelector('#word-list').innerHTML = drawWordList();
        bindWordList();
      };
      el.querySelectorAll('.schip').forEach((b) => { b.onclick = () => { st.strength = b.dataset.s; draw(); }; });
      bindWordList();
    }
  }

  function drawPacks() {
    if (!st.entries) return '<p class="meta">Đang tải danh sách bài…</p>';
    if (!st.entries.length) return '<p class="error">Không tải được danh sách bài. Kiểm tra mạng nhé.</p>';
    return packRows().map(({ entry, track }) => `
      <button class="pack-row" data-date="${entry.date}" data-track="${track}">
        <b>${entry.date}</b><small>${TRACK_LABEL[track]}</small>
        <span class="trail">${icon.chevron(18)}</span>
      </button>`).join('');
  }

  function drawWordList() {
    const { srs, wordMeta } = store.state;
    const words = wordRows();
    if (!words.length) return '<p class="meta">Chưa có từ nào khớp bộ lọc.</p>';
    return words.map((w) => {
      const m = wordMeta[w] || {};
      return `
      <div class="word-row expandable" data-w="${w}">
        <button class="pill play-w" data-w="${w}">${icon.volume(14)}</button>
        <div><b>${w}</b> <span class="sbadge s-${strength(srs[w])}">${STRENGTH_LABEL[strength(srs[w])]}</span>
          <br><small>${m.meaning_vi || ''}</small>
          <div class="word-detail" hidden><small>${m.ipa || ''}</small><p>${m.example || ''}</p><p class="meta">${m.example_vi || ''}</p></div>
        </div>
      </div>`;
    }).join('');
  }

  function drawWords() {
    return `
      <div class="searchbar">${icon.search(16)}<input id="q" placeholder="Tìm từ hoặc nghĩa…" value="${st.query}"></div>
      <div class="chips">
        ${['all', 'new', 'learning', 'known'].map((s) =>
          `<button class="chip schip ${st.strength === s ? 'on' : ''}" data-s="${s}">${s === 'all' ? 'Mọi mức nhớ' : STRENGTH_LABEL[s]}</button>`).join('')}
      </div>
      <div id="word-list">${drawWordList()}</div>`;
  }

  function bindWordList() {
    el.querySelectorAll('.play-w').forEach((b) => {
      b.onclick = (e) => { e.stopPropagation(); speak(b.dataset.w); };
    });
    el.querySelectorAll('.expandable').forEach((r) => {
      r.onclick = () => { const d = r.querySelector('.word-detail'); d.hidden = !d.hidden; };
    });
  }

  draw();
  loadEntries();
}
