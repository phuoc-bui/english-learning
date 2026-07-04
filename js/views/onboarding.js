import { icon } from '../icons.js';
import { TRACK_OPTIONS, LEVEL_OPTIONS, GOAL_OPTIONS, MINUTE_OPTIONS, AI_APP_OPTIONS } from '../profile-options.js';

export function render(el, ctx) {
  const draft = { track: 'it', level: 'b1', goals: [], minutes: 15, aiApp: 'chatgpt' };
  let step = 0;
  const steps = [
    { key: 'track', type: 'single', title: 'Bạn học tiếng Anh cho lĩnh vực nào?', sub: 'Bài học hằng ngày sẽ theo lĩnh vực này (đổi được trong Cài đặt).', options: TRACK_OPTIONS },
    { key: 'level', type: 'single', title: 'Trình độ hiện tại của bạn?', sub: 'Dùng để điều chỉnh prompt AI và độ khó bài kiểm tra.', options: LEVEL_OPTIONS },
    { key: 'goals', type: 'multi', title: 'Mục tiêu của bạn?', sub: 'Chọn được nhiều mục — hoặc bỏ qua.', options: GOAL_OPTIONS },
    { key: 'minutes', type: 'single', title: 'Mỗi ngày bạn dành bao nhiêu phút?', sub: 'Quyết định số hoạt động cần làm để giữ streak.', options: MINUTE_OPTIONS },
    { key: 'aiApp', type: 'single', title: 'Bạn hay dùng app AI nào?', sub: 'Phần thực hành hội thoại / nói / viết sẽ mở app này.', options: AI_APP_OPTIONS },
  ];

  function draw() {
    const s = steps[step];
    el.innerHTML = `
      <div class="onboard">
        <div class="ob-dots">${steps.map((_, i) => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}</div>
        <h1>${s.title}</h1>
        <p class="meta">${s.sub}</p>
        <div class="ob-options">
          ${s.options.map((o) => {
            const sel = s.type === 'multi' ? draft.goals.includes(o.value) : draft[s.key] === o.value;
            return `<button class="ob-opt ${sel ? 'on' : ''}" data-v="${o.value}">
              <span class="body"><b>${o.label}</b>${o.desc ? `<small>${o.desc}</small>` : ''}</span>
              <span class="trail">${sel ? icon.checkCircle(20) : ''}</span>
            </button>`;
          }).join('')}
        </div>
        <div class="ob-nav">
          ${step > 0 ? `<button class="pill" id="back">${icon.chevron(14)} Quay lại</button>` : '<span></span>'}
          <button class="primary" id="next" style="width:auto;margin:0">${step === steps.length - 1 ? 'Bắt đầu học 🎉' : 'Tiếp tục'}</button>
        </div>
      </div>
    `;
    el.querySelectorAll('.ob-opt').forEach((b) => {
      b.onclick = () => {
        const v = b.dataset.v;
        if (s.type === 'multi') {
          draft.goals = draft.goals.includes(v) ? draft.goals.filter((g) => g !== v) : [...draft.goals, v];
        } else {
          draft[s.key] = s.key === 'minutes' ? Number(v) : v;
        }
        draw();
      };
    });
    el.querySelector('#back')?.addEventListener('click', () => { step--; draw(); });
    el.querySelector('#next').onclick = () => {
      if (step < steps.length - 1) { step++; draw(); return; }
      ctx.store.setProfile({ ...draft, onboardedAt: ctx.today });
      location.hash = '';
      location.reload();
    };
  }
  draw();
}
