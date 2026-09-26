import { icon } from '../icons.js';
import { getKey, setKey, REGISTER_URL } from '../news.js';
import { LEVEL_OPTIONS, GOAL_OPTIONS, AI_APP_OPTIONS } from '../profile-options.js';

export function render(el, ctx) {
  const { store } = ctx;
  const p = store.state.profile || {};
  const draft = { level: p.level || 'b1', goals: [...(p.goals || [])], aiApp: p.aiApp || 'chatgpt' };

  const group = (title, options, key, multi = false) => `
    <div class="set-group">
      <b>${title}</b>
      <div class="chips">
        ${options.map((o) => {
          const sel = multi ? draft.goals.includes(o.value) : draft[key] === o.value;
          return `<button class="chip ${sel ? 'on' : ''}" data-key="${key}" data-v="${o.value}" data-multi="${multi}">${o.label}</button>`;
        }).join('')}
      </div>
    </div>`;

  function draw() {
    el.innerHTML = `
      <header class="page-head">
        <button class="pill" id="back">${icon.chevron(14)} Quay lại</button>
        <h1>Cài đặt</h1>
      </header>
      ${group('Trình độ', LEVEL_OPTIONS, 'level')}
      ${group('Mục tiêu', GOAL_OPTIONS, 'goals', true)}
      ${group('App AI ưa thích', AI_APP_OPTIONS, 'aiApp')}
      <button class="primary" id="saveProfile">Lưu cài đặt</button>

      <h2>Tin tức (The Guardian)</h2>
      <p class="meta">Key miễn phí: <a class="scene-link" href="${REGISTER_URL}" target="_blank" rel="noopener">đăng ký tại đây ${icon.external(12)}</a>. Chỉ lưu trong máy này, không có trong backup.</p>
      <div class="watch-open" style="margin-top:8px">
        <input class="inline-input" id="gkey" value="${getKey().replace(/"/g, '&quot;')}" placeholder="Dán key The Guardian…">
        <button class="pill" id="saveKey">${icon.check(14)} Lưu</button>
      </div>
      <p class="warn" id="keyMsg"></p>

      <h2>Sao lưu dữ liệu</h2>
      <button class="pill wide" id="export">${icon.download(16)} Xuất backup</button>
      <button class="pill wide" id="import">${icon.upload(16)} Nhập backup</button>
      <input type="file" id="file" accept="application/json" style="display:none">
      <p id="msg" class="warn"></p>
    `;

    el.querySelector('#back').onclick = () => ctx.navigate('today');
    el.querySelectorAll('.chip').forEach((b) => {
      b.onclick = () => {
        const { key, v } = b.dataset;
        if (b.dataset.multi === 'true') {
          draft.goals = draft.goals.includes(v) ? draft.goals.filter((g) => g !== v) : [...draft.goals, v];
        } else {
          draft[key] = v;
        }
        draw();
      };
    });
    el.querySelector('#saveProfile').onclick = () => {
      store.setProfile({ ...store.state.profile, ...draft });
      el.querySelector('#msg').textContent = 'Đã lưu ✓';
    };

    el.querySelector('#saveKey').onclick = () => {
      setKey(el.querySelector('#gkey').value.trim());
      el.querySelector('#keyMsg').textContent = getKey() ? 'Đã lưu key ✓' : 'Đã xoá key';
    };

    el.querySelector('#export').onclick = () => {
      const blob = new Blob([store.exportData()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `office-english-backup-${ctx.today}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    };
    const file = el.querySelector('#file');
    el.querySelector('#import').onclick = () => file.click();
    file.onchange = async () => {
      try {
        store.importData(await file.files[0].text());
        location.reload();
      } catch {
        el.querySelector('#msg').textContent = 'File backup không hợp lệ.';
      }
    };
  }
  draw();
}
