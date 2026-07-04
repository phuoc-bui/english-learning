import { initialCard, review, isDue } from '../srs.js';
import { speak } from '../speech.js';
import { icon } from '../icons.js';

function highlight(example, word) {
  if (!example) return '';
  const safe = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return example.replace(new RegExp(`\\b${safe}\\w*`, 'gi'), (m) => `<span class="hl">${m}</span>`);
}

export function render(el, ctx) {
  const { store, pack } = ctx;
  const { srs, wordMeta } = store.state;

  if (pack) {
    for (const v of pack.vocab) {
      if (!srs[v.word]) {
        srs[v.word] = initialCard();
        wordMeta[v.word] = { ipa: v.ipa, meaning_vi: v.meaning_vi, example: v.example, example_vi: v.example_vi, track: pack.track || 'it' };
      }
    }
    store.save();
  }

  const queue = Object.keys(srs).filter((w) => isDue(srs[w], ctx.today)).slice(0, 20);
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
      if (reviewed > 0) store.markActivity(ctx.today, 'vocab');
      el.innerHTML = `<div class="empty"><h2>🎉 Xong rồi!</h2><p>${
        reviewed > 0 ? `Bạn đã ôn ${reviewed} thẻ hôm nay.` : 'Không có thẻ nào đến hạn. Quay lại ngày mai nhé.'
      }</p></div>`;
      return;
    }
    word = queue[i];
    meta = wordMeta[word] || {};
    const pct = Math.round((i / queue.length) * 100);
    el.innerHTML = `
      <header class="page-head">
        <h1>Từ vựng</h1>
        <span class="count-pill">${i + 1} / ${queue.length}</span>
      </header>
      <div class="progress-track"><i style="width:${pct}%"></i></div>

      <div class="flip" id="flip-card">
        <div class="flip-inner">
          <div class="face front">
            <span class="tag">Từ mới</span>
            <div class="word">${word}</div>
            <div class="ipa">${meta.ipa || ''}</div>
            <button class="speak-btn" id="say">${icon.volume(18)}Nghe phát âm</button>
            <div class="flip-hint">Chạm để lật ↻</div>
          </div>
          <div class="face back">
            <div class="label">Nghĩa</div>
            <div class="meaning">${meta.meaning_vi || ''}</div>
            <div class="divider"></div>
            <div class="label">Ví dụ</div>
            <div class="example">${highlight(meta.example, word)} <button class="speak-btn mini" id="sayEx">${icon.volume(15)}</button></div>
            <div class="example-vi">${meta.example_vi || ''}</div>
            <div class="flip-hint">Chạm để lật lại ↻</div>
          </div>
        </div>
      </div>
      <div id="bottom">${bottomControls()}</div>
    `;

    el.querySelector('#say').onclick = (e) => { e.stopPropagation(); speak(word); };
    el.querySelector('#sayEx').onclick = (e) => { e.stopPropagation(); speak(meta.example); };
    el.querySelector('#flip-card').addEventListener('click', doFlip);
    bindBottom();
  }
  draw();
}
