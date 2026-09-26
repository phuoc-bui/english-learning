import { icon } from '../icons.js';
import { speak } from '../speech.js';
import { esc, parseTime, formatTime, sceneUrl, youtubeId } from '../clip.js';
import { loadYouTubeApi, playerErrorText } from '../youtube.js';
import { createCaptureForm } from './capture-form.js';

const SPEEDS = [0.5, 0.75, 1];

export function render(el, ctx) {
  const { store } = ctx;
  const id = ctx.params.get('v');
  const start = parseTime(ctx.params.get('t')) || 0;
  if (!id) { ctx.navigate('clips'); return; }
  const url = `https://www.youtube.com/watch?v=${id}`;

  let player = null;
  let ready = false;
  let title = '';
  let autoResume = true;

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
        <p class="meta kbd-hint">Phím tắt (khi không gõ chữ): <kbd>B</kbd> bắt câu · <kbd>K</kbd> dừng/phát · <kbd>←</kbd> lùi 5s. Bấm ra ngoài video trước khi dùng phím.</p>
      </section>
      <aside class="watch-side" id="side">
        <div class="side-head">
          <h2>Bắt câu</h2>
          <label class="toggle"><input type="checkbox" id="resume" checked> Phát tiếp sau khi lưu</label>
        </div>
        <div id="capture"></div>
      </aside>
      <section class="watch-list" id="list"></section>
    </div>
  `;

  const form = createCaptureForm(el.querySelector('#capture'), ctx, {
    source: { url, t: start || null }, hideUrl: true,
    onSaved: () => {
      drawList();
      if (autoResume && ready) player.playVideo();
    },
  });

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

  function grab() {
    let t = null;
    if (ready) {
      player.pauseVideo();
      // lùi 1 giây: lúc bấm thường đã qua đầu câu
      t = Math.max(0, Math.floor(player.getCurrentTime()) - 1);
    }
    form.setSource({ t, title });
    form.focus();
    if (window.matchMedia('(max-width: 899px)').matches) {
      // cuộn tới form nhưng chừa chỗ cho trình phát đang dính trên cùng
      const playerH = el.querySelector('.watch-player').offsetHeight;
      const top = el.querySelector('#side').getBoundingClientRect().top + window.scrollY - playerH - 8;
      window.scrollTo({ top, behavior: 'smooth' });
    }
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
    if (e.key === 'b' || e.key === 'B') { e.preventDefault(); grab(); }
    else if (e.key === 'k' || e.key === 'K') { e.preventDefault(); toggle(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); rewind(); }
  };
  document.addEventListener('keydown', onKey);
  ctx.cleanup = () => {
    document.removeEventListener('keydown', onKey);
    try { player?.destroy(); } catch { /* bỏ qua */ }
  };

  const showError = (text) => {
    const err = el.querySelector('#ytErr');
    err.hidden = false;
    err.innerHTML = `${esc(text)} <a class="scene-link" href="${esc(sceneUrl(url, start || null))}" target="_blank" rel="noopener">${icon.external(13)} Mở trên YouTube</a> — vẫn bắt câu được, tự gõ phút:giây.`;
  };

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
        },
        onError: (e) => showError(playerErrorText(e.data)),
      },
    });
  }).catch(() => showError('Không tải được trình phát YouTube (kiểm tra mạng).'));
}
