import { createStore } from './store.js';
import { localDateStr } from './dates.js';
import * as today from './views/today.js';
import * as vocab from './views/vocab.js';
import * as practice from './views/practice.js';
import * as progress from './views/progress.js';
import * as settings from './views/settings.js';
import * as onboarding from './views/onboarding.js';
import * as clips from './views/clips.js';
import * as watch from './views/watch.js';
import * as news from './views/news.js';

const views = { today, vocab, practice, progress, settings, clips, watch, news };
// view ẩn (không có tab riêng) -> tab nào sáng
const HIDDEN = { settings: 'today', watch: 'clips', news: 'clips' };

const ctx = {
  store: createStore(localStorage),
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

// App đã chuyển vào Vaultly (/hoc/). Không chuyển hướng cứng: dữ liệu nằm trong
// localStorage của origin này, người dùng cần Xuất backup trước rồi Nhập ở app mới.
// Trỏ thẳng màn có nút Nhập backup: trong Vaultly, tab "Cài đặt" là cài đặt tài
// chính, Nhập backup nằm ở Học → Cài đặt học.
const VAULTLY_HOC = 'https://vaultly-api-p6r6kaznba-as.a.run.app/hoc/cai-dat';
function showMovedBanner() {
  const bar = document.createElement('div');
  bar.className = 'moved-banner';
  bar.innerHTML = `
    <b>App đã chuyển sang Vaultly</b>
    <span>Bấm <b>Xuất backup</b> ở đây, rồi mở app mới (tab Học → Cài đặt học) → <b>Nhập backup</b>.</span>
    <div class="moved-actions">
      <button class="pill" id="movedExport">Xuất backup</button>
      <a class="pill" href="${VAULTLY_HOC}">Mở app mới</a>
    </div>`;
  document.body.prepend(bar);
  bar.querySelector('#movedExport').onclick = () => {
    const blob = new Blob([ctx.store.exportData()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `office-english-backup-${ctx.today}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
}
showMovedBanner();

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
    render();
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
