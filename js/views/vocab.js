import { review, isDue } from '../srs.js';
import { speak } from '../speech.js';
import { icon } from '../icons.js';
import { esc, sceneAnchor, formatTime, KIND_LABEL } from '../clip.js';

function highlight(example, word) {
  if (!example) return '';
  example = esc(example);
  const safe = esc(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return example.replace(new RegExp(`\\b${safe}\\w*`, 'gi'), (m) => `<span class="hl">${m}</span>`);
}

export function render(el, ctx) {
  const { store } = ctx;
  const { srs, wordMeta } = store.state;

  // chỉ thẻ từ câu tự bắt (từ của gói bài cũ không còn hiện)
  const queue = Object.keys(srs)
    .filter((w) => wordMeta[w]?.track === 'clip' && isDue(srs[w], ctx.today))
    .slice(0, 20);
  let i = 0;
  let flipped = false;
  let reviewed = 0;

  function bottomControls() {
    return flipped
      ? `<div class="grade">
           <button class="g-forgot" id="gf">${icon.refresh(20)}Quên</button>
           <button class="g-hard" id="gh">${icon.alert(20)}Khó</button>
           <button class="g-good" id="gg">${icon.check(20)}Nhớ tốt</button>
         </div>`
      : '<button class="primary" id="flip">Lật thẻ xem nghĩa</button>';
  }

  function bindBottom() {
    el.querySelector('#flip')?.addEventListener('click', doFlip);
    el.querySelector('#gf')?.addEventListener('click', () => grade('forgot'));
    el.querySelector('#gh')?.addEventListener('click', () => grade('hard'));
    el.querySelector('#gg')?.addEventListener('click', () => grade('good'));
  }

  let word, meta;
  function doFlip() {
    if (flipped) return;
    flipped = true;
    el.querySelector('.flip').classList.add('flipped');
    el.querySelector('#bottom').innerHTML = bottomControls();
    bindBottom();
  }
  function grade(g) {
    srs[word] = review(srs[word], g, ctx.today);
    store.save();
    reviewed++;
    i++;
    flipped = false;
    draw();
  }

  function draw() {
    if (i >= queue.length) {
      const total = Object.keys(srs).filter((w) => wordMeta[w]?.track === 'clip').length;
      el.innerHTML = `<div class="empty"><h2>${reviewed ? '🎉 Xong rồi!' : total ? '✅ Hết thẻ đến hạn' : '📭 Chưa có thẻ nào'}</h2><p>${
        reviewed > 0 ? `Bạn đã ôn ${reviewed} thẻ hôm nay.`
          : total ? 'Không có thẻ nào đến hạn. Quay lại ngày mai nhé.'
            : 'Bắt câu từ video, nhạc hoặc tin tức — câu có nghĩa sẽ thành thẻ ôn ở đây.'
      }</p>${total ? '' : '<a class="primary" href="#clips" style="display:inline-flex;width:auto;padding:12px 20px;text-decoration:none;margin-top:14px">Đi săn câu</a>'}</div>`;
      return;
    }
    word = queue[i];
    meta = wordMeta[word] || {};
    const pct = Math.round((i / queue.length) * 100);
    const src = meta.track === 'clip' ? meta.source || {} : null;
    const tag = src ? `${KIND_LABEL[src.kind] || 'Phim & nhạc'}${src.title ? ` · ${esc(src.title)}` : ''}` : 'Từ mới';
    el.innerHTML = `
      <header class="page-head">
        <h1>Từ vựng</h1>
        <span class="count-pill">${i + 1} / ${queue.length}</span>
      </header>
      <div class="progress-track"><i style="width:${pct}%"></i></div>

      <div class="flip" id="flip-card">
        <div class="flip-inner">
          <div class="face front">
            <span class="tag">${tag}</span>
            <div class="word">${esc(word)}</div>
            ${src ? `<div class="example" style="margin-top:12px">${highlight(meta.example, word)}</div>` : ''}
            <div class="ipa">${meta.ipa || ''}</div>
            <button class="speak-btn" id="say">${icon.volume(18)}Nghe phát âm</button>
            <div class="flip-hint">Chạm để lật ↻</div>
          </div>
          <div class="face back">
            <div class="label">Nghĩa</div>
            <div class="meaning">${esc(meta.meaning_vi)}</div>
            <div class="divider"></div>
            <div class="label">Ví dụ</div>
            <div class="example">${highlight(meta.example, word)} <button class="speak-btn mini" id="sayEx">${icon.volume(15)}</button></div>
            <div class="example-vi">${esc(meta.example_vi)}</div>
            ${src ? sceneAnchor(src, `${icon.play(13)} Xem lại cảnh${src.t != null ? ` (${formatTime(src.t)})` : ''}`, 'id="scene"') : ''}
            <div class="flip-hint">Chạm để lật lại ↻</div>
          </div>
        </div>
      </div>
      <div id="bottom">${bottomControls()}</div>
    `;

    el.querySelector('#say').onclick = (e) => { e.stopPropagation(); speak(word); };
    el.querySelector('#sayEx').onclick = (e) => { e.stopPropagation(); speak(meta.example); };
    el.querySelector('#scene')?.addEventListener('click', (e) => e.stopPropagation());
    el.querySelector('#flip-card').addEventListener('click', doFlip);
    bindBottom();
  }
  draw();
}
