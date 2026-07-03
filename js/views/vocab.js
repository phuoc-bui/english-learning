import { initialCard, review, isDue } from '../srs.js';
import { speak } from '../speech.js';

export function render(el, ctx) {
  const { store, pack } = ctx;
  const { srs, wordMeta } = store.state;

  if (pack) {
    for (const v of pack.vocab) {
      if (!srs[v.word]) {
        srs[v.word] = initialCard();
        wordMeta[v.word] = { ipa: v.ipa, meaning_vi: v.meaning_vi, example: v.example, example_vi: v.example_vi };
      }
    }
    store.save();
  }

  const queue = Object.keys(srs).filter((w) => isDue(srs[w], ctx.today)).slice(0, 20);
  let i = 0;
  let flipped = false;
  let reviewed = 0;

  function draw() {
    if (i >= queue.length) {
      if (reviewed > 0) store.markActivity(ctx.today, 'vocab');
      el.innerHTML = `<div class="empty"><h2>🎉 Xong!</h2><p>${
        reviewed > 0 ? `Bạn đã ôn ${reviewed} thẻ hôm nay.` : 'Không có thẻ nào đến hạn. Quay lại ngày mai nhé.'
      }</p></div>`;
      return;
    }
    const word = queue[i];
    const meta = wordMeta[word] || {};
    el.innerHTML = `
      <header class="page-head"><h1>Từ vựng</h1><div>${i + 1}/${queue.length}</div></header>
      <div class="flashcard">
        <h2 style="font-size:26px">${word}</h2>
        <p class="ipa">${meta.ipa || ''}</p>
        <button class="speak-btn" id="say">🔊</button>
        ${flipped ? `
          <p class="meaning">${meta.meaning_vi || ''}</p>
          <p>"${meta.example || ''}" <button class="speak-btn small" id="sayEx">🔊</button></p>
          <p class="example-vi">${meta.example_vi || ''}</p>` : ''}
      </div>
      ${flipped
        ? `<div class="grade">
             <button class="g-forgot" id="gf">Quên</button>
             <button class="g-hard" id="gh">Khó</button>
             <button class="g-good" id="gg">Nhớ</button>
           </div>`
        : '<button class="primary" id="flip">Lật thẻ</button>'}
    `;
    el.querySelector('#say').onclick = () => speak(word);
    el.querySelector('#sayEx')?.addEventListener('click', () => speak(meta.example));
    el.querySelector('#flip')?.addEventListener('click', () => { flipped = true; draw(); });
    const grade = (g) => {
      srs[word] = review(srs[word], g, ctx.today);
      store.save();
      reviewed++;
      i++;
      flipped = false;
      draw();
    };
    el.querySelector('#gf')?.addEventListener('click', () => grade('forgot'));
    el.querySelector('#gh')?.addEventListener('click', () => grade('hard'));
    el.querySelector('#gg')?.addEventListener('click', () => grade('good'));
  }
  draw();
}
