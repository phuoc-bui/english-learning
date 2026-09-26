import { icon } from '../icons.js';
import { speak } from '../speech.js';
import { esc, parseTime, formatTime, sceneUrl, youtubeId, tokenSegments } from '../clip.js';
import { loadYouTubeApi, playerErrorText } from '../youtube.js';
import { parseSubs, cueIndexAt, loadSubs, saveSubs, removeSubs } from '../subs.js';
import { cleanTitle, findLyrics } from '../lyrics.js';
import { createCaptureForm } from './capture-form.js';

const SPEEDS = [0.5, 0.75, 1];

export function render(el, ctx) {
  const { store } = ctx;
  const id = ctx.params.get('v');
  const start = parseTime(ctx.params.get('t')) || 0;
  if (!id) { ctx.navigate('clips'); return; }
  const music = ctx.params.get('m') === '1';
  const url = music ? `https://music.youtube.com/watch?v=${id}` : `https://www.youtube.com/watch?v=${id}`;

  let player = null;
  let ready = false;
  let title = '';
  let autoResume = true;
  let cues = loadSubs(id);
  let cur = -1; // dòng phụ đề đang chạy
  let autoScroll = true;
  let loopIdx = -1; // dòng đang lặp, -1 = không lặp
  let tab = 'subs';
  let timer = null;

  el.innerHTML = `
    <header class="page-head">
      <button class="pill" id="back">${icon.chevron(14)} Săn câu</button>
      <h1>Xem & bắt câu</h1>
    </header>
    <div class="watch-grid">
      <section class="watch-player">
        <div class="player-wrap"><div id="player"></div></div>
        <p class="error" id="ytErr" hidden></p>
        <div class="row player-ctrls">
          <button class="pill" id="rew" title="Lùi 5 giây (←)">${icon.refresh(14)} 5s</button>
          ${SPEEDS.map((s) => `<button class="chip speed ${s === 1 ? 'on' : ''}" data-s="${s}">${s}x</button>`).join('')}
          <button class="primary grab" id="grab">${icon.pencil(16)} Bắt câu <kbd>B</kbd></button>
        </div>
        <p class="meta kbd-hint">Phím tắt (khi không gõ chữ): <kbd>B</kbd> bắt câu đang chạy · <kbd>K</kbd> dừng/phát · <kbd>←</kbd> lùi 5s · <kbd>L</kbd> lặp câu. Bấm ra ngoài video trước khi dùng phím.</p>
      </section>
      <aside class="watch-side" id="side">
        <div class="seg side-tabs">
          <button data-tab="subs">Phụ đề</button>
          <button data-tab="capture">Bắt câu</button>
        </div>
        <div id="subPane"></div>
        <div id="capPane" hidden>
          <label class="toggle resume"><input type="checkbox" id="resume" checked> Phát tiếp sau khi lưu</label>
          <div id="capture"></div>
        </div>
      </aside>
      <section class="watch-list" id="list"></section>
    </div>
  `;

  const form = createCaptureForm(el.querySelector('#capture'), ctx, {
    source: { url, t: start || null, kind: music ? 'music' : undefined }, hideUrl: true,
    onSaved: () => {
      drawList();
      if (autoResume && ready) player.playVideo();
      if (cues) setTab('subs');
    },
  });

  // ---------- tab bên phải ----------
  function setTab(t) {
    tab = t;
    el.querySelectorAll('.side-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
    el.querySelector('#subPane').hidden = t !== 'subs';
    el.querySelector('#capPane').hidden = t !== 'capture';
  }
  el.querySelectorAll('.side-tabs button').forEach((b) => { b.onclick = () => setTab(b.dataset.tab); });

  // ---------- khung phụ đề ----------
  function drawSubs() {
    const pane = el.querySelector('#subPane');
    if (!cues) {
      const lyricsBox = `
        <div class="lyrics-find">
          <p><b>${icon.headphones(14)} Bài hát?</b> Tự tìm lời chạy theo nhạc (nguồn LRCLIB):</p>
          <div class="watch-open">
            <input class="inline-input" id="lq" value="${esc(cleanTitle(title))}" placeholder="Ca sĩ - Tên bài">
            <button class="pill" id="findLyrics">${icon.search(14)} Tìm lời</button>
          </div>
          <p class="warn" id="lyMsg"></p>
        </div>`;
      pane.innerHTML = `
        ${music ? lyricsBox : ''}
        <div class="sub-empty">
          <p><b>${music ? 'Hoặc dán phụ đề/lời' : 'Chưa có phụ đề cho video này.'}</b> YouTube không cho app tự tải phụ đề, nên dán vào một lần:</p>
          <ol>
            <li>Mở video trên <a class="scene-link" href="${esc(url)}" target="_blank" rel="noopener">YouTube ${icon.external(12)}</a> (máy tính).</li>
            <li>Dưới video bấm <b>…thêm</b> → <b>Hiện bản chép lời</b> (Show transcript), chọn ngôn ngữ <b>English</b>.</li>
            <li>Bôi đen toàn bộ bản chép lời → <kbd>Ctrl</kbd>+<kbd>C</kbd> → dán vào ô dưới.</li>
          </ol>
          <textarea id="subText" rows="6" placeholder="0:05&#10;Who dares to enter the Tang Sect?&#10;0:08&#10;…"></textarea>
          <div class="row">
            <button class="primary" id="useSubs" style="width:auto;margin:0">${icon.check(16)} Dùng phụ đề này</button>
            <button class="pill" id="pickFile">${icon.upload(14)} Chọn file .srt / .vtt</button>
            <input type="file" id="subFile" accept=".srt,.vtt,.txt,text/vtt" hidden>
          </div>
          <p class="warn" id="subMsg"></p>
        </div>
        ${music ? '' : lyricsBox}`;
      const apply = (text) => {
        const parsed = parseSubs(text);
        if (!parsed.length) {
          pane.querySelector('#subMsg').textContent = 'Không đọc được phụ đề — cần có mốc giờ (0:05) hoặc file .srt/.vtt.';
          return;
        }
        cues = parsed;
        if (!saveSubs(id, cues)) pane.querySelector('#subMsg').textContent = 'Bộ nhớ đầy, phụ đề chỉ dùng tạm lần này.';
        cur = -1;
        drawSubs();
      };
      pane.querySelector('#useSubs').onclick = () => apply(pane.querySelector('#subText').value);
      pane.querySelector('#findLyrics').onclick = searchLyrics;
      pane.querySelector('#lq').onkeydown = (e) => { if (e.key === 'Enter') searchLyrics(); };
      const file = pane.querySelector('#subFile');
      pane.querySelector('#pickFile').onclick = () => file.click();
      file.onchange = async () => { if (file.files[0]) apply(await file.files[0].text()); };
      return;
    }
    pane.innerHTML = `
      <div class="row sub-tools">
        <label class="toggle"><input type="checkbox" id="autoScroll" ${autoScroll ? 'checked' : ''}> Tự cuộn</label>
        <button class="chip" id="loop">${icon.refresh(12)} Lặp câu <kbd>L</kbd></button>
        <button class="chip" id="clearSubs" style="margin-left:auto">Đổi phụ đề</button>
      </div>
      <p class="meta sub-tip">Bấm vào <b>từ</b> để bắt câu với từ đó · bấm <b>mốc giờ</b> để tua tới.</p>
      <div class="sub-list" id="subList">${cues.map((c, i) => `
        <div class="cue" data-i="${i}">
          <button class="cue-t" data-i="${i}">${formatTime(Math.floor(c.start))}</button>
          <span class="cue-text">${tokenSegments(c.text).map((s) => (s.i != null
            ? `<span class="w" data-w="${s.i}">${esc(s.text)}</span>`
            : esc(s.text))).join('')}</span>
        </div>`).join('')}</div>`;
    pane.querySelector('#autoScroll').onchange = (e) => { autoScroll = e.target.checked; };
    pane.querySelector('#loop').onclick = toggleLoop;
    pane.querySelector('#clearSubs').onclick = () => {
      if (!confirm('Xoá phụ đề đã dán cho video này để dán lại?')) return;
      removeSubs(id);
      cues = null;
      loopIdx = -1;
      drawSubs();
    };
    pane.querySelector('#subList').onclick = (e) => {
      const t = e.target.closest('.cue-t');
      if (t) { seekCue(+t.dataset.i); return; }
      const w = e.target.closest('.w');
      if (w) {
        const i = +w.closest('.cue').dataset.i;
        captureCue(i, +w.dataset.w);
      }
    };
    highlight(true);
  }

  async function searchLyrics() {
    const inp = el.querySelector('#lq');
    const out = el.querySelector('#lyMsg');
    const q = inp?.value.trim();
    if (!q) { if (out) out.textContent = 'Nhập "Ca sĩ - Tên bài" để tìm.'; return; }
    out.textContent = 'Đang tìm lời…';
    const r = await findLyrics(q, ready ? player.getDuration() : 0);
    if (cues) return; // đã có phụ đề trong lúc chờ
    if (!r.cues) {
      const text = {
        none: 'Không tìm thấy lời có mốc giờ khớp độ dài bài — thử sửa lại tên (Ca sĩ - Tên bài).',
        plain: 'Bài này chỉ có lời không kèm mốc giờ nên chưa chạy theo nhạc được.',
        network: 'Không kết nối được LRCLIB — kiểm tra mạng rồi thử lại.',
      }[r.reason];
      if (el.querySelector('#lyMsg')) el.querySelector('#lyMsg').textContent = text;
      return;
    }
    cues = r.cues;
    saveSubs(id, cues);
    cur = -1;
    drawSubs();
    const tip = el.querySelector('.sub-tip');
    if (tip) tip.insertAdjacentHTML('beforebegin', `<p class="meta sub-tip">Lời: <b>${esc(r.label)}</b> · nguồn LRCLIB</p>`);
  }

  function seekCue(i) {
    if (!ready || !cues[i]) return;
    player.seekTo(cues[i].start, true);
    player.playVideo();
    if (loopIdx >= 0) loopIdx = i;
  }

  function captureCue(i, pick = null) {
    if (ready) player.pauseVideo();
    form.setDraft({ text: cues[i].text, pick, t: Math.floor(cues[i].start), title });
    setTab('capture');
    focusForm();
  }

  function toggleLoop() {
    loopIdx = loopIdx >= 0 ? -1 : Math.max(cur, 0);
    el.querySelector('#loop')?.classList.toggle('on', loopIdx >= 0);
  }

  // Tô dòng đang chạy + tự cuộn trong khung (không cuộn cả trang)
  function highlight(force = false) {
    if (!cues || !ready) return;
    const t = player.getCurrentTime();
    if (loopIdx >= 0 && cues[loopIdx] && (t >= cues[loopIdx].end || t < cues[loopIdx].start - 0.5)) {
      player.seekTo(cues[loopIdx].start, true);
      return;
    }
    const i = cueIndexAt(cues, t);
    if (i === cur && !force) return;
    const list = el.querySelector('#subList');
    if (!list) return;
    list.querySelector('.cue.now')?.classList.remove('now');
    cur = i;
    const row = list.querySelector(`.cue[data-i="${i}"]`);
    if (!row) return;
    row.classList.add('now');
    if (autoScroll && tab === 'subs') {
      list.scrollTop = row.offsetTop - list.offsetTop - list.clientHeight / 3;
    }
  }

  // ---------- câu đã bắt ----------
  function drawList() {
    const mine = store.state.mined
      .filter((m) => youtubeId(m.source?.url || '') === id)
      .sort((a, b) => (a.source.t ?? 0) - (b.source.t ?? 0));
    el.querySelector('#list').innerHTML = `
      <h2>Câu đã bắt trong video (${mine.length})</h2>
      ${mine.length ? mine.map((m) => `
        <div class="clip-item">
          <div class="row" style="margin:0 0 6px">
            ${m.source.t != null ? `<button class="pill seek" data-t="${m.source.t}">${icon.play(12)} ${formatTime(m.source.t)}</button>` : ''}
            <button class="pill say" data-say="${esc(m.focus)}">${icon.volume(14)}</button>
          </div>
          <p class="sentence">${esc(m.text)}</p>
          <div><b>${esc(m.focus)}</b>${m.meaning_vi ? ` — ${esc(m.meaning_vi)}` : ' <small class="meta">(chờ giải nghĩa)</small>'}</div>
        </div>`).join('') : '<p class="meta">Chưa có câu nào — gặp câu hay thì bấm Bắt câu.</p>'}
    `;
    el.querySelectorAll('.seek').forEach((b) => {
      b.onclick = () => {
        if (!ready) return;
        player.seekTo(Math.max(0, +b.dataset.t - 2), true);
        player.playVideo();
        el.querySelector('.player-wrap').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      };
    });
    el.querySelectorAll('.say').forEach((b) => { b.onclick = () => speak(b.dataset.say); });
  }

  // ---------- điều khiển ----------
  function focusForm() {
    form.focus();
    if (window.matchMedia('(max-width: 899px)').matches) {
      // cuộn tới form nhưng chừa chỗ cho trình phát đang dính trên cùng
      const playerH = el.querySelector('.watch-player').offsetHeight;
      const top = el.querySelector('#side').getBoundingClientRect().top + window.scrollY - playerH - 8;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  }

  function grab() {
    // có phụ đề: lấy luôn câu đang chạy
    if (cues && ready) {
      const i = cueIndexAt(cues, player.getCurrentTime());
      if (i >= 0) { captureCue(i); return; }
    }
    let t = null;
    if (ready) {
      player.pauseVideo();
      // lùi 1 giây: lúc bấm thường đã qua đầu câu
      t = Math.max(0, Math.floor(player.getCurrentTime()) - 1);
    }
    form.setSource({ t, title });
    setTab('capture');
    focusForm();
  }
  const rewind = () => { if (ready) player.seekTo(Math.max(0, player.getCurrentTime() - 5), true); };
  const toggle = () => {
    if (!ready) return;
    if (player.getPlayerState() === 1) player.pauseVideo(); else player.playVideo();
  };

  el.querySelector('#back').onclick = () => ctx.navigate('clips');
  el.querySelector('#grab').onclick = grab;
  el.querySelector('#rew').onclick = rewind;
  el.querySelector('#resume').onchange = (e) => { autoResume = e.target.checked; };
  el.querySelectorAll('.speed').forEach((b) => {
    b.onclick = () => {
      if (!ready) return;
      player.setPlaybackRate(+b.dataset.s);
      el.querySelectorAll('.speed').forEach((x) => x.classList.toggle('on', x === b));
    };
  });

  const onKey = (e) => {
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'b') { e.preventDefault(); grab(); }
    else if (k === 'k') { e.preventDefault(); toggle(); }
    else if (k === 'l' && cues) { e.preventDefault(); toggleLoop(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); rewind(); }
  };
  document.addEventListener('keydown', onKey);
  ctx.cleanup = () => {
    document.removeEventListener('keydown', onKey);
    clearInterval(timer);
    try { player?.destroy(); } catch { /* bỏ qua */ }
  };

  const showError = (text) => {
    const err = el.querySelector('#ytErr');
    err.hidden = false;
    err.innerHTML = `${esc(text)} <a class="scene-link" href="${esc(sceneUrl(url, start || null))}" target="_blank" rel="noopener">${icon.external(13)} Mở trên YouTube</a> — vẫn bắt câu được, tự gõ phút:giây.`;
  };

  setTab(tab);
  drawSubs();
  drawList();
  loadYouTubeApi().then((YT) => {
    if (!document.getElementById('player')) return; // đã rời màn
    player = new YT.Player('player', {
      videoId: id,
      playerVars: { start, playsinline: 1, rel: 0, cc_load_policy: 1, cc_lang_pref: 'en', modestbranding: 1 },
      events: {
        onReady: () => {
          ready = true;
          title = player.getVideoData?.().title || '';
          if (title) form.setSource({ title });
          const lq = el.querySelector('#lq');
          if (lq && !lq.value) lq.value = cleanTitle(title);
          if (music && !cues && lq?.value) searchLyrics(); // YouTube Music: tự tìm lời
          timer = setInterval(() => highlight(), 250);
        },
        onError: (e) => showError(playerErrorText(e.data)),
      },
    });
  }).catch(() => showError('Không tải được trình phát YouTube (kiểm tra mạng).'));
}
