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
import * as clips from './views/clips.js';
import * as watch from './views/watch.js';

const views = { today, vocab, practice, review, progress, listening, settings, clips, watch };
// view ẩn (không có tab riêng) -> tab nào sáng
const HIDDEN = { listening: 'today', settings: 'today', clips: 'today', watch: 'today' };

const ctx = {
  store: createStore(localStorage),
  pack: null,
  packError: false,
  today: localDateStr(),
  navigate: (name) => { location.hash = name; },
  shared: null, // dữ liệu từ nút Chia sẻ của Android (Web Share Target)
  params: new URLSearchParams(), // tham số sau dấu ? trong hash, vd #watch?v=…&t=…
  cleanup: null, // view dọn dẹp (listener, player) trước khi chuyển màn
};

// Mở app qua Chia sẻ: ./?title=…&text=…&url=… -> form Bắt câu
{
  const q = new URLSearchParams(location.search);
  if (q.has('title') || q.has('text') || q.has('url')) {
    ctx.shared = { title: q.get('title') || '', text: q.get('text') || '', url: q.get('url') || '' };
    history.replaceState(null, '', `${location.pathname}#clips`);
  }
}

function render() {
  const [hashName, query = ''] = location.hash.slice(1).split('?');
  const name = hashName || 'today';
  ctx.params = new URLSearchParams(query);
  ctx.cleanup?.();
  ctx.cleanup = null;
  document.body.classList.toggle('wide', name === 'watch');
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
