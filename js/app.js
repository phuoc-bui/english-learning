import { createStore } from './store.js';
import { loadLatestPack } from './data.js';
import { localDateStr } from './dates.js';
import * as today from './views/today.js';
import * as vocab from './views/vocab.js';
import * as speaking from './views/speaking.js';
import * as interview from './views/interview.js';
import * as progress from './views/progress.js';
import * as listening from './views/listening.js';

const views = { today, vocab, speaking, interview, progress, listening };

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
  const tabName = name === 'listening' ? 'today' : name;
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
  try {
    ctx.pack = await loadLatestPack(ctx.today);
  } catch {
    ctx.packError = true;
  }
  render();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
