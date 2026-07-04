import { createStore } from './store.js';
import { loadLatestPack } from './data.js';
import { localDateStr } from './dates.js';
import * as today from './views/today.js';
import * as vocab from './views/vocab.js';
import * as practice from './views/practice.js';
import * as review from './views/review.js';
import * as progress from './views/progress.js';
import * as listening from './views/listening.js';
import * as settings from './views/settings.js';
import * as onboarding from './views/onboarding.js';

const views = { today, vocab, practice, review, progress, listening, settings };
// view ẩn (không có tab riêng) -> tab nào sáng
const HIDDEN = { listening: 'today', settings: 'today' };

const ctx = {
  store: createStore(localStorage),
  pack: null,
  packError: false,
  today: localDateStr(),
  navigate: (name) => { location.hash = name; },
};

function render() {
  const name = location.hash.slice(1) || 'today';
  const view = views[name] || views.today;
  const tabName = HIDDEN[name] || (views[name] ? name : 'today');
  document.querySelectorAll('#tabs button').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === tabName);
  });
  const el = document.getElementById('view');
  el.innerHTML = '';
  view.render(el, ctx);
}

document.getElementById('tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (btn) ctx.navigate(btn.dataset.tab);
});
window.addEventListener('hashchange', render);

(async () => {
  if (!ctx.store.state.profile) {
    // lần đầu mở app: bắt buộc qua onboarding, xong sẽ reload
    document.getElementById('tabs').hidden = true;
    onboarding.render(document.getElementById('view'), ctx);
  } else {
    try {
      ctx.pack = await loadLatestPack(ctx.today, ctx.store.state.profile.track);
    } catch {
      ctx.packError = true;
    }
    render();
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
