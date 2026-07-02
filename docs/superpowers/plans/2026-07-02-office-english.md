# Office English PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PWA học tiếng Anh công sở chạy trên Chrome Android (Samsung S23 Ultra), host GitHub Pages, nội dung do Claude routine soạn hàng ngày.

**Architecture:** App tĩnh thuần HTML/CSS/JS (ES modules, không build step). Logic thuần (SRS, diff, validate, store, data-loading) tách thành module có unit test chạy bằng `node --test`. View là DOM thuần, verify bằng trình duyệt. Nội dung là file JSON trong `data/packs/`, được validate bằng script Node dùng chung validator với app.

**Tech Stack:** HTML/CSS/JS thuần, Web Speech API (SpeechSynthesis + SpeechRecognition), Service Worker, localStorage, Node built-in test runner, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-07-02-office-english-design.md`

## Global Constraints

- **Zero dependencies:** không npm package nào; test dùng `node --test` built-in.
- **Không build step:** GitHub Pages serve trực tiếp từ root repo.
- **URL tương đối:** app chạy tại `https://<user>.github.io/english-learning/` nên MỌI đường dẫn (fetch, href, src, SW cache) phải tương đối, KHÔNG bắt đầu bằng `/`.
- **UI tiếng Việt, nội dung học tiếng Anh trình độ B1**, ngành IT/văn phòng.
- **Mobile-first:** viewport chuẩn 412×915 CSS px (S23 Ultra), touch target ≥ 44px, tab bar dưới đáy có `env(safe-area-inset-bottom)`.
- **Ngày luôn là local date** dạng `YYYY-MM-DD` (múi giờ VN) — cấm dùng `toISOString()` để lấy ngày.
- **localStorage key:** `office-english-v1`.
- **View modules** export `render(el, ctx)` với `ctx = { store, pack, today, navigate, packError }`.
- Views không có unit test (DOM thuần, không thêm jsdom) — mỗi view task có bước verify trình duyệt với checklist cụ thể. Logic thuần bắt buộc TDD.

---

### Task 1: Scaffold + module ngày tháng (`dates.js`)

**Files:**
- Create: `package.json`, `.gitignore`, `js/dates.js`
- Test: `tests/dates.test.mjs`

**Interfaces:**
- Produces: `localDateStr(d?: Date): string` — "YYYY-MM-DD" theo giờ local; `addDays(dateStr: string, n: number): string`.

- [ ] **Step 1: Tạo scaffold**

`package.json`:
```json
{
  "name": "office-english",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/",
    "validate-data": "node scripts/validate-data.mjs"
  }
}
```

`.gitignore`:
```
node_modules/
.DS_Store
```

- [ ] **Step 2: Viết test fail**

`tests/dates.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localDateStr, addDays } from '../js/dates.js';

test('localDateStr formats local date with zero padding', () => {
  assert.equal(localDateStr(new Date(2026, 6, 2)), '2026-07-02');
  assert.equal(localDateStr(new Date(2026, 11, 31)), '2026-12-31');
});

test('addDays crosses month and year boundaries', () => {
  assert.equal(addDays('2026-07-31', 1), '2026-08-01');
  assert.equal(addDays('2026-07-01', -1), '2026-06-30');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-07-02', 0), '2026-07-02');
});
```

- [ ] **Step 3: Chạy test, phải FAIL**

Run: `npm test`
Expected: FAIL — `Cannot find module '../js/dates.js'`

- [ ] **Step 4: Implement**

`js/dates.js`:
```js
export function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return localDateStr(new Date(y, m - 1, d + n));
}
```

- [ ] **Step 5: Chạy test, phải PASS**

Run: `npm test`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add package.json .gitignore js/dates.js tests/dates.test.mjs
git commit -m "feat: scaffold + dates module"
```

---

### Task 2: Spaced repetition (`srs.js`)

**Files:**
- Create: `js/srs.js`
- Test: `tests/srs.test.mjs`

**Interfaces:**
- Consumes: `localDateStr`, `addDays` từ `js/dates.js`.
- Produces: `initialCard(): {reps, interval, ease, due}` · `review(card, grade: 'forgot'|'hard'|'good', today?: string): card` · `isDue(card, today?: string): boolean`.

- [ ] **Step 1: Viết test fail**

`tests/srs.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialCard, review, isDue } from '../js/srs.js';

const T = '2026-07-02';

test('new card is due immediately', () => {
  assert.equal(isDue(initialCard(), T), true);
});

test('first good review schedules 1 day out', () => {
  const c = review(initialCard(), 'good', T);
  assert.equal(c.due, '2026-07-03');
  assert.equal(c.reps, 1);
  assert.equal(isDue(c, T), false);
  assert.equal(isDue(c, '2026-07-03'), true);
});

test('second good review schedules 3 days out', () => {
  let c = review(initialCard(), 'good', T);
  c = review(c, 'good', '2026-07-03');
  assert.equal(c.interval, 3);
  assert.equal(c.due, '2026-07-06');
});

test('third good review multiplies interval by ease', () => {
  let c = review(initialCard(), 'good', T);
  c = review(c, 'good', '2026-07-03');
  c = review(c, 'good', '2026-07-06');
  assert.ok(c.interval >= 7, `interval ${c.interval} should be >= 7`);
});

test('hard lowers ease with floor 1.3', () => {
  let c = initialCard();
  for (let i = 0; i < 20; i++) c = review(c, 'hard', T);
  assert.equal(c.ease, 1.3);
});

test('forgot resets reps and makes card due today', () => {
  let c = review(initialCard(), 'good', T);
  c = review(c, 'forgot', '2026-07-03');
  assert.equal(c.reps, 0);
  assert.equal(c.due, '2026-07-03');
  assert.equal(isDue(c, '2026-07-03'), true);
});
```

- [ ] **Step 2: Chạy test, phải FAIL**

Run: `npm test`
Expected: FAIL — `Cannot find module '../js/srs.js'`

- [ ] **Step 3: Implement**

`js/srs.js`:
```js
import { localDateStr, addDays } from './dates.js';

export function initialCard() {
  return { reps: 0, interval: 0, ease: 2.5, due: null };
}

export function review(card, grade, today = localDateStr()) {
  const c = { ...card };
  if (grade === 'forgot') {
    c.reps = 0;
    c.interval = 0;
  } else if (grade === 'hard') {
    c.reps += 1;
    c.ease = Math.max(1.3, Math.round((c.ease - 0.15) * 100) / 100);
    c.interval = c.reps === 1 ? 1 : Math.max(1, Math.ceil(c.interval * 1.2));
  } else {
    c.reps += 1;
    c.ease = Math.min(2.8, Math.round((c.ease + 0.05) * 100) / 100);
    c.interval = c.reps === 1 ? 1 : c.reps === 2 ? 3 : Math.ceil(c.interval * c.ease);
  }
  c.due = addDays(today, c.interval);
  return c;
}

export function isDue(card, today = localDateStr()) {
  return card.due === null || card.due <= today;
}
```

- [ ] **Step 4: Chạy test, phải PASS**

Run: `npm test`
Expected: PASS toàn bộ

- [ ] **Step 5: Commit**

```bash
git add js/srs.js tests/srs.test.mjs
git commit -m "feat: spaced repetition module (SM-2 lite)"
```

---

### Task 3: So khớp câu nói (`diff.js`)

**Files:**
- Create: `js/diff.js`
- Test: `tests/diff.test.mjs`

**Interfaces:**
- Produces: `normalize(s: string): string[]` · `compare(target: string, spoken: string): { words: {text, ok}[], score: number }` — `words` là từ của câu MẪU đánh dấu khớp/không (LCS), `score` = % từ mẫu được khớp (0-100, số nguyên).

- [ ] **Step 1: Viết test fail**

`tests/diff.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, compare } from '../js/diff.js';

test('normalize lowercases and strips punctuation', () => {
  assert.deepEqual(normalize("I'm blocked, on the API!"), ["i'm", 'blocked', 'on', 'the', 'api']);
});

test('perfect match scores 100', () => {
  const r = compare('I finished the login page.', 'i finished the login page');
  assert.equal(r.score, 100);
  assert.ok(r.words.every((w) => w.ok));
});

test('partial match marks missing words', () => {
  const r = compare('I finished the login page', 'I finished the page');
  assert.equal(r.words.find((w) => w.text === 'login').ok, false);
  assert.equal(r.score, 80);
});

test('word order is respected (LCS, not bag of words)', () => {
  const r = compare('the cat sat', 'sat cat the');
  assert.ok(r.score < 100);
});

test('empty spoken scores 0', () => {
  assert.equal(compare('hello world', '').score, 0);
});
```

- [ ] **Step 2: Chạy test, phải FAIL**

Run: `npm test`
Expected: FAIL — `Cannot find module '../js/diff.js'`

- [ ] **Step 3: Implement**

`js/diff.js`:
```js
export function normalize(s) {
  return s.toLowerCase().replace(/[^a-z0-9'\s]/g, ' ').split(/\s+/).filter(Boolean);
}

export function compare(target, spoken) {
  const t = normalize(target);
  const s = normalize(spoken);
  const m = t.length;
  const n = s.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = t[i] === s[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const matched = new Array(m).fill(false);
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (t[i] === s[j]) { matched[i] = true; i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  const words = t.map((w, k) => ({ text: w, ok: matched[k] }));
  const score = m ? Math.round((100 * matched.filter(Boolean).length) / m) : 0;
  return { words, score };
}
```

- [ ] **Step 4: Chạy test, phải PASS**

Run: `npm test`
Expected: PASS toàn bộ

- [ ] **Step 5: Commit**

```bash
git add js/diff.js tests/diff.test.mjs
git commit -m "feat: transcript vs target sentence diff (LCS)"
```

---

### Task 4: Validator gói bài học (`pack.js`) + fixture

**Files:**
- Create: `js/pack.js`, `tests/helpers.mjs`
- Test: `tests/pack.test.mjs`

**Interfaces:**
- Produces: `validatePack(pack): string[]` — mảng lỗi, rỗng = hợp lệ. `tests/helpers.mjs` export `makePack(date: string): object` — gói tối thiểu hợp lệ, dùng lại ở Task 6.

- [ ] **Step 1: Viết fixture helper**

`tests/helpers.mjs`:
```js
export function makePack(date) {
  return {
    date,
    theme: 'Daily standup meeting',
    vocab: [{
      word: `blocker-${date}`,
      ipa: '/ˈblɒkə/',
      meaning_vi: 'vấn đề cản trở công việc',
      example: 'I have a blocker with the payment API.',
      example_vi: 'Tôi đang bị vướng ở API thanh toán.',
    }],
    listening: {
      title: 'Morning standup',
      lines: [
        { speaker: 'A', voice: 'male', text: "Let's start with yesterday." },
        { speaker: 'B', voice: 'female', text: 'I finished the login page.' },
        { speaker: 'A', voice: 'male', text: 'Any blockers?' },
        { speaker: 'B', voice: 'female', text: 'No blockers today.' },
      ],
      questions: [
        { q: 'What did speaker B finish?', options: ['The login page', 'The API'], answer: 0 },
      ],
    },
    shadowing: ['Yesterday I worked on the login page.'],
    interview: [{
      question: 'Tell me about yourself.',
      type: 'common',
      tips_vi: ['Nói 60-90 giây', 'Nêu kinh nghiệm liên quan nhất'],
      sample_answer: 'I am a software developer with five years of experience...',
    }],
  };
}
```

- [ ] **Step 2: Viết test fail**

`tests/pack.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePack } from '../js/pack.js';
import { makePack } from './helpers.mjs';

test('valid pack has no errors', () => {
  assert.deepEqual(validatePack(makePack('2026-07-02')), []);
});

test('non-object pack is rejected', () => {
  assert.ok(validatePack(null).length > 0);
  assert.ok(validatePack('hi').length > 0);
});

test('bad date format is rejected', () => {
  const p = makePack('2026-07-02');
  p.date = '02/07/2026';
  assert.ok(validatePack(p).some((e) => e.includes('date')));
});

test('vocab item missing field is rejected', () => {
  const p = makePack('2026-07-02');
  delete p.vocab[0].meaning_vi;
  assert.ok(validatePack(p).some((e) => e.includes('meaning_vi')));
});

test('listening answer index out of range is rejected', () => {
  const p = makePack('2026-07-02');
  p.listening.questions[0].answer = 9;
  assert.ok(validatePack(p).some((e) => e.includes('answer')));
});

test('invalid voice is rejected', () => {
  const p = makePack('2026-07-02');
  p.listening.lines[0].voice = 'robot';
  assert.ok(validatePack(p).some((e) => e.includes('voice')));
});

test('empty shadowing is rejected', () => {
  const p = makePack('2026-07-02');
  p.shadowing = [];
  assert.ok(validatePack(p).some((e) => e.includes('shadowing')));
});

test('interview with bad type is rejected', () => {
  const p = makePack('2026-07-02');
  p.interview[0].type = 'weird';
  assert.ok(validatePack(p).some((e) => e.includes('type')));
});
```

- [ ] **Step 3: Chạy test, phải FAIL**

Run: `npm test`
Expected: FAIL — `Cannot find module '../js/pack.js'`

- [ ] **Step 4: Implement**

`js/pack.js`:
```js
const isStr = (v) => typeof v === 'string' && v.trim().length > 0;

export function validatePack(pack) {
  if (!pack || typeof pack !== 'object' || Array.isArray(pack)) return ['pack is not an object'];
  const errors = [];
  const err = (msg) => errors.push(msg);

  if (!isStr(pack.date) || !/^\d{4}-\d{2}-\d{2}$/.test(pack.date)) err('date must be YYYY-MM-DD');
  if (!isStr(pack.theme)) err('theme is required');

  if (!Array.isArray(pack.vocab) || pack.vocab.length < 1 || pack.vocab.length > 12) {
    err('vocab must be an array of 1-12 items');
  } else {
    pack.vocab.forEach((v, i) => {
      for (const f of ['word', 'ipa', 'meaning_vi', 'example', 'example_vi']) {
        if (!isStr(v?.[f])) err(`vocab[${i}].${f} missing`);
      }
    });
  }

  const L = pack.listening;
  if (!L || typeof L !== 'object') {
    err('listening missing');
  } else {
    if (!isStr(L.title)) err('listening.title missing');
    if (!Array.isArray(L.lines) || L.lines.length < 4) {
      err('listening.lines must have at least 4 lines');
    } else {
      L.lines.forEach((l, i) => {
        if (!isStr(l?.speaker) || !isStr(l?.text)) err(`listening.lines[${i}] invalid`);
        if (!['male', 'female'].includes(l?.voice)) err(`listening.lines[${i}].voice must be male|female`);
      });
    }
    if (!Array.isArray(L.questions) || L.questions.length < 1) {
      err('listening.questions missing');
    } else {
      L.questions.forEach((q, i) => {
        if (!isStr(q?.q)) err(`listening.questions[${i}].q missing`);
        if (!Array.isArray(q?.options) || q.options.length < 2 || !q.options.every(isStr)) {
          err(`listening.questions[${i}].options invalid`);
        } else if (!Number.isInteger(q?.answer) || q.answer < 0 || q.answer >= q.options.length) {
          err(`listening.questions[${i}].answer out of range`);
        }
      });
    }
  }

  if (!Array.isArray(pack.shadowing) || pack.shadowing.length < 1 || pack.shadowing.length > 10
      || !pack.shadowing.every(isStr)) {
    err('shadowing must be 1-10 non-empty strings');
  }

  if (!Array.isArray(pack.interview) || pack.interview.length < 1) {
    err('interview missing');
  } else {
    pack.interview.forEach((it, i) => {
      if (!isStr(it?.question)) err(`interview[${i}].question missing`);
      if (!['behavioral', 'technical', 'common'].includes(it?.type)) err(`interview[${i}].type invalid`);
      if (!Array.isArray(it?.tips_vi) || it.tips_vi.length < 1 || !it.tips_vi.every(isStr)) {
        err(`interview[${i}].tips_vi invalid`);
      }
      if (!isStr(it?.sample_answer)) err(`interview[${i}].sample_answer missing`);
    });
  }

  return errors;
}
```

- [ ] **Step 5: Chạy test, phải PASS**

Run: `npm test`
Expected: PASS toàn bộ

- [ ] **Step 6: Commit**

```bash
git add js/pack.js tests/pack.test.mjs tests/helpers.mjs
git commit -m "feat: lesson pack schema validator"
```

---

### Task 5: Store — tiến độ, streak, backup (`store.js`)

**Files:**
- Create: `js/store.js`
- Test: `tests/store.test.mjs`

**Interfaces:**
- Consumes: `addDays` từ `js/dates.js`.
- Produces: `createStore(storage): store` với:
  - `store.state` — `{ srs: {word→card}, wordMeta: {word→{ipa,meaning_vi,example,example_vi}}, days: {date→{vocab,listening,speaking,interview: bool, speakingSeconds: number}}, interviewLog: [{date,question,transcript}], bestScores: {sentence→number} }`
  - `save()` · `markActivity(date, activity)` · `addSpeakingSeconds(date, seconds)` · `isDayComplete(date): bool` · `computeStreak(today): number` · `computeLongestStreak(): number` · `exportData(): string` · `importData(json: string)` (throw nếu không hợp lệ)

- [ ] **Step 1: Viết test fail**

`tests/store.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../js/store.js';

function fakeStorage(initial = {}) {
  const m = { ...initial };
  return {
    getItem: (k) => (k in m ? m[k] : null),
    setItem: (k, v) => { m[k] = String(v); },
  };
}

const ACTS = ['vocab', 'listening', 'speaking', 'interview'];
function completeDay(store, date) {
  for (const a of ACTS) store.markActivity(date, a);
}

test('fresh store has empty state', () => {
  const s = createStore(fakeStorage());
  assert.deepEqual(s.state.srs, {});
  assert.equal(s.computeStreak('2026-07-02'), 0);
});

test('corrupt storage falls back to empty state', () => {
  const s = createStore(fakeStorage({ 'office-english-v1': '{{{not json' }));
  assert.deepEqual(s.state.days, {});
});

test('day complete requires all 4 activities', () => {
  const s = createStore(fakeStorage());
  s.markActivity('2026-07-02', 'vocab');
  assert.equal(s.isDayComplete('2026-07-02'), false);
  completeDay(s, '2026-07-02');
  assert.equal(s.isDayComplete('2026-07-02'), true);
});

test('streak counts consecutive complete days; incomplete today does not break it', () => {
  const s = createStore(fakeStorage());
  completeDay(s, '2026-06-30');
  completeDay(s, '2026-07-01');
  assert.equal(s.computeStreak('2026-07-02'), 2);
  completeDay(s, '2026-07-02');
  assert.equal(s.computeStreak('2026-07-02'), 3);
});

test('gap breaks streak but longest streak remembers', () => {
  const s = createStore(fakeStorage());
  completeDay(s, '2026-06-25');
  completeDay(s, '2026-06-26');
  completeDay(s, '2026-06-27');
  completeDay(s, '2026-07-01');
  assert.equal(s.computeStreak('2026-07-02'), 1);
  assert.equal(s.computeLongestStreak(), 3);
});

test('speaking seconds accumulate', () => {
  const s = createStore(fakeStorage());
  s.addSpeakingSeconds('2026-07-02', 30);
  s.addSpeakingSeconds('2026-07-02', 15);
  assert.equal(s.state.days['2026-07-02'].speakingSeconds, 45);
});

test('export/import roundtrip persists across store instances', () => {
  const storage = fakeStorage();
  const s1 = createStore(storage);
  completeDay(s1, '2026-07-02');
  const backup = s1.exportData();
  const s2 = createStore(fakeStorage());
  s2.importData(backup);
  assert.equal(s2.isDayComplete('2026-07-02'), true);
});

test('import rejects garbage', () => {
  const s = createStore(fakeStorage());
  assert.throws(() => s.importData('not json'));
  assert.throws(() => s.importData('{"nope": true}'));
});
```

- [ ] **Step 2: Chạy test, phải FAIL**

Run: `npm test`
Expected: FAIL — `Cannot find module '../js/store.js'`

- [ ] **Step 3: Implement**

`js/store.js`:
```js
import { addDays } from './dates.js';

const KEY = 'office-english-v1';
const ACTIVITIES = ['vocab', 'listening', 'speaking', 'interview'];

const emptyState = () => ({
  srs: {},
  wordMeta: {},
  days: {},
  interviewLog: [],
  bestScores: {},
});

export function createStore(storage) {
  let state;
  try {
    state = JSON.parse(storage.getItem(KEY)) || emptyState();
  } catch {
    state = emptyState();
  }
  state = { ...emptyState(), ...state };

  const save = () => {
    try {
      storage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Không lưu được tiến độ:', e);
    }
  };

  const store = {
    get state() { return state; },
    save,
    markActivity(date, activity) {
      if (!ACTIVITIES.includes(activity)) return;
      state.days[date] = { ...state.days[date], [activity]: true };
      save();
    },
    addSpeakingSeconds(date, seconds) {
      const d = (state.days[date] = { ...state.days[date] });
      d.speakingSeconds = (d.speakingSeconds || 0) + seconds;
      save();
    },
    isDayComplete(date) {
      const d = state.days[date];
      return !!d && ACTIVITIES.every((a) => d[a]);
    },
    computeStreak(today) {
      let d = today;
      if (!store.isDayComplete(d)) d = addDays(d, -1);
      let n = 0;
      while (store.isDayComplete(d)) {
        n++;
        d = addDays(d, -1);
      }
      return n;
    },
    computeLongestStreak() {
      const dates = Object.keys(state.days).filter((d) => store.isDayComplete(d)).sort();
      let best = 0;
      let run = 0;
      let prev = null;
      for (const d of dates) {
        run = prev && addDays(prev, 1) === d ? run + 1 : 1;
        best = Math.max(best, run);
        prev = d;
      }
      return best;
    },
    exportData() { return JSON.stringify(state, null, 2); },
    importData(json) {
      const parsed = JSON.parse(json);
      if (!parsed || typeof parsed !== 'object' || typeof parsed.days !== 'object' || !parsed.days) {
        throw new Error('File backup không hợp lệ');
      }
      state = { ...emptyState(), ...parsed };
      save();
    },
  };
  return store;
}
```

- [ ] **Step 4: Chạy test, phải PASS**

Run: `npm test`
Expected: PASS toàn bộ

- [ ] **Step 5: Commit**

```bash
git add js/store.js tests/store.test.mjs
git commit -m "feat: progress store with streak and backup"
```

---

### Task 6: Data loader (`data.js`)

**Files:**
- Create: `js/data.js`
- Test: `tests/data.test.mjs`

**Interfaces:**
- Consumes: `validatePack` từ `js/pack.js`; `makePack` từ `tests/helpers.mjs`.
- Produces: `loadLatestPack(today: string, fetchFn = fetch): Promise<pack>` — fetch `data/index.json`, chọn ngày mới nhất ≤ today, bỏ qua gói lỗi/thiếu, throw `Error('no valid pack')` nếu hết.

- [ ] **Step 1: Viết test fail**

`tests/data.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLatestPack } from '../js/data.js';
import { makePack } from './helpers.mjs';

function stubFetch(files) {
  return async (url) => {
    if (url in files) return { ok: true, json: async () => files[url] };
    return { ok: false, json: async () => { throw new Error('404'); } };
  };
}

test("loads today's pack when available", async () => {
  const f = stubFetch({
    'data/index.json': ['2026-07-01', '2026-07-02'],
    'data/packs/2026-07-02.json': makePack('2026-07-02'),
  });
  const p = await loadLatestPack('2026-07-02', f);
  assert.equal(p.date, '2026-07-02');
});

test('ignores future dates, picks latest past pack', async () => {
  const f = stubFetch({
    'data/index.json': ['2026-07-01', '2026-07-05'],
    'data/packs/2026-07-01.json': makePack('2026-07-01'),
    'data/packs/2026-07-05.json': makePack('2026-07-05'),
  });
  const p = await loadLatestPack('2026-07-02', f);
  assert.equal(p.date, '2026-07-01');
});

test('skips invalid pack and falls back to older one', async () => {
  const f = stubFetch({
    'data/index.json': ['2026-07-01', '2026-07-02'],
    'data/packs/2026-07-02.json': { date: '2026-07-02' },
    'data/packs/2026-07-01.json': makePack('2026-07-01'),
  });
  const p = await loadLatestPack('2026-07-02', f);
  assert.equal(p.date, '2026-07-01');
});

test('throws when nothing valid exists', async () => {
  const f = stubFetch({ 'data/index.json': [] });
  await assert.rejects(() => loadLatestPack('2026-07-02', f), /no valid pack/);
});
```

- [ ] **Step 2: Chạy test, phải FAIL**

Run: `npm test`
Expected: FAIL — `Cannot find module '../js/data.js'`

- [ ] **Step 3: Implement**

`js/data.js`:
```js
import { validatePack } from './pack.js';

export async function loadLatestPack(today, fetchFn = fetch) {
  const res = await fetchFn('data/index.json');
  if (!res.ok) throw new Error('no valid pack');
  const dates = (await res.json()).filter((d) => d <= today).sort().reverse();
  for (const d of dates) {
    try {
      const r = await fetchFn(`data/packs/${d}.json`);
      if (!r.ok) continue;
      const pack = await r.json();
      if (validatePack(pack).length === 0) return pack;
    } catch {
      // gói lỗi — thử ngày cũ hơn
    }
  }
  throw new Error('no valid pack');
}
```

- [ ] **Step 4: Chạy test, phải PASS**

Run: `npm test`
Expected: PASS toàn bộ

- [ ] **Step 5: Commit**

```bash
git add js/data.js tests/data.test.mjs
git commit -m "feat: pack loader with fallback to latest valid pack"
```

---

### Task 7: App shell — HTML, CSS, router, speech, gói bài đầu tiên

**Files:**
- Create: `index.html`, `css/app.css`, `js/app.js`, `js/speech.js`, `manifest.webmanifest`, `icons/icon.svg`, `icons/icon-maskable.svg`, `data/index.json`, `data/packs/2026-07-02.json`, và 6 view stub trong `js/views/`

**Interfaces:**
- Consumes: `createStore`, `loadLatestPack`, `localDateStr`.
- Produces:
  - View contract: mỗi module trong `js/views/` export `render(el: HTMLElement, ctx)`. `ctx = { store, pack, today, navigate(name), packError }`.
  - `js/speech.js`: `ttsSupported: bool` · `sttSupported: bool` · `speak(text, {lang?, gender?, rate?}): Promise<void>` · `stopSpeaking()` · `listenOnce({lang?, onResult(transcript), onError(code), onEnd()})`.

- [ ] **Step 1: Tạo `index.html`**

```html
<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#1a56db">
<title>Office English</title>
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon.svg">
<link rel="stylesheet" href="css/app.css">
</head>
<body>
<main id="view"></main>
<nav id="tabs">
  <button data-tab="today">🏠<span>Hôm nay</span></button>
  <button data-tab="vocab">📖<span>Từ vựng</span></button>
  <button data-tab="speaking">🎤<span>Nói</span></button>
  <button data-tab="interview">💼<span>Phỏng vấn</span></button>
  <button data-tab="progress">📊<span>Tiến độ</span></button>
</nav>
<script type="module" src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Tạo `css/app.css`** (đủ class cho MỌI view về sau)

```css
:root {
  --bg: #0f172a; --card: #1e293b; --line: #334155;
  --text: #e2e8f0; --muted: #94a3b8;
  --accent: #3b82f6; --green: #22c55e; --red: #ef4444; --amber: #f59e0b;
  --radius: 14px;
}
* { box-sizing: border-box; margin: 0; }
body {
  background: var(--bg); color: var(--text);
  font-family: system-ui, -apple-system, sans-serif;
  min-height: 100dvh;
  -webkit-tap-highlight-color: transparent;
}
#view { padding: 16px 16px calc(80px + env(safe-area-inset-bottom)); max-width: 520px; margin: 0 auto; }
#tabs {
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 10;
  display: flex; background: var(--card);
  padding-bottom: env(safe-area-inset-bottom);
  border-top: 1px solid var(--line);
}
#tabs button {
  flex: 1; background: none; border: none; color: var(--muted);
  font-size: 20px; padding: 8px 0 6px;
  display: flex; flex-direction: column; align-items: center; gap: 2px;
}
#tabs button span { font-size: 11px; }
#tabs button.active { color: var(--accent); }

.page-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
h1 { font-size: 22px; }
h2 { font-size: 17px; margin: 16px 0 8px; }
.streak { font-weight: 700; }
.theme { color: var(--muted); margin-bottom: 12px; }
.stale { color: var(--amber); font-size: 13px; }
.error { color: var(--red); }
.warn { color: var(--amber); margin-bottom: 8px; font-size: 14px; }
.empty { text-align: center; padding: 48px 0; color: var(--muted); }

.cards { display: grid; gap: 12px; }
.card {
  display: flex; align-items: center; gap: 12px; text-align: left;
  background: var(--card); border: 1px solid var(--line); border-radius: var(--radius);
  padding: 16px; color: var(--text); font-size: 16px;
}
.card .icon { font-size: 28px; }
.card .body { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.card .body small { color: var(--muted); }
.card.done { border-color: var(--green); }
.card .check { color: var(--green); font-size: 22px; font-weight: 700; }

button.primary {
  width: 100%; background: var(--accent); color: #fff; border: none;
  border-radius: var(--radius); padding: 14px; font-size: 16px; font-weight: 600; margin-top: 12px;
}
.row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin: 8px 0; }
.row button {
  background: var(--card); color: var(--text); border: 1px solid var(--line);
  border-radius: 10px; padding: 10px 14px; font-size: 14px;
}

.flashcard {
  background: var(--card); border-radius: var(--radius); padding: 28px 16px;
  text-align: center; min-height: 260px;
  display: flex; flex-direction: column; gap: 12px; justify-content: center;
}
.ipa { color: var(--muted); }
.speak-btn {
  background: none; border: 1px solid var(--line); border-radius: 50%;
  width: 44px; height: 44px; font-size: 18px; align-self: center; color: var(--text);
}
.speak-btn.small { width: 34px; height: 34px; font-size: 13px; vertical-align: middle; }
.meaning { font-size: 18px; font-weight: 600; }
.example-vi { color: var(--muted); font-size: 14px; }
.grade { display: flex; gap: 8px; margin-top: 12px; }
.grade button { flex: 1; padding: 14px; border: none; border-radius: var(--radius); font-size: 15px; font-weight: 600; color: #fff; }
.g-forgot { background: var(--red); }
.g-hard { background: var(--amber); }
.g-good { background: var(--green); }

.shadow-item { background: var(--card); border-radius: var(--radius); padding: 14px; margin-bottom: 12px; }
.sentence { font-size: 16px; margin-bottom: 4px; }
.mic { background: var(--accent) !important; color: #fff !important; border: none !important; }
.score { margin-left: auto; font-weight: 700; color: var(--green); }
.result .ok { color: var(--green); }
.result .miss { color: var(--red); text-decoration: underline; }

.script { background: var(--card); border-radius: var(--radius); padding: 14px; margin: 8px 0; display: grid; gap: 6px; }
.question { background: var(--card); border-radius: var(--radius); padding: 14px; margin-bottom: 10px; }
.option {
  display: block; width: 100%; text-align: left; margin-top: 8px;
  background: var(--bg); color: var(--text); border: 1px solid var(--line);
  border-radius: 10px; padding: 12px; font-size: 15px;
}
.option.right { border-color: var(--green); color: var(--green); }
.option.wrong { border-color: var(--red); color: var(--red); }

.iv { background: var(--card); border-radius: var(--radius); padding: 14px; margin-bottom: 14px; }
.iv .q { font-size: 16px; font-weight: 600; margin-bottom: 8px; }
.iv details { margin: 8px 0; }
.iv summary { color: var(--accent); }
.iv textarea {
  width: 100%; min-height: 90px; background: var(--bg); color: var(--text);
  border: 1px solid var(--line); border-radius: 10px; padding: 10px; margin-top: 8px; font: inherit;
}
.transcript { color: var(--muted); font-style: italic; margin: 8px 0; white-space: pre-wrap; }

.stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }
.stat { background: var(--card); border-radius: var(--radius); padding: 14px; text-align: center; }
.stat b { font-size: 24px; display: block; }
.stat small { color: var(--muted); }
.grid30 { display: grid; grid-template-columns: repeat(10, 1fr); gap: 4px; margin: 8px 0 16px; }
.cell { aspect-ratio: 1; border-radius: 4px; background: var(--card); }
.cell.part { background: rgba(59, 130, 246, 0.5); }
.cell.full { background: var(--green); }
```

- [ ] **Step 3: Tạo `js/speech.js`**

```js
export const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
export const sttSupported = !!SR;

let voices = [];
if (ttsSupported) {
  const load = () => { voices = speechSynthesis.getVoices(); };
  load();
  speechSynthesis.onvoiceschanged = load;
}

function pickVoice(lang, gender) {
  const english = voices.filter((v) => v.lang.startsWith('en'));
  const inLang = english.filter((v) => v.lang.replace('_', '-') === lang);
  const pool = inLang.length ? inLang : english;
  const female = pool.find((v) => /female|woman|samantha|zira|libby|aria|sonia|jenny/i.test(v.name));
  const male = pool.find((v) => /(^|[^fe])male|daniel|david|guy|ryan|george/i.test(v.name));
  return (gender === 'male' ? male || female : female || male) || pool[0] || null;
}

export function speak(text, { lang = 'en-US', gender = 'female', rate = 1 } = {}) {
  return new Promise((resolve) => {
    if (!ttsSupported) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = rate;
    const v = pickVoice(lang, gender);
    if (v) u.voice = v;
    u.onend = resolve;
    u.onerror = resolve;
    speechSynthesis.speak(u);
  });
}

export function stopSpeaking() {
  if (ttsSupported) speechSynthesis.cancel();
}

export function listenOnce({ lang = 'en-US', onResult, onError, onEnd } = {}) {
  if (!sttSupported) {
    onError?.('unsupported');
    return null;
  }
  const rec = new SR();
  rec.lang = lang;
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  rec.onresult = (e) => onResult?.(e.results[0][0].transcript);
  rec.onerror = (e) => onError?.(e.error);
  rec.onend = () => onEnd?.();
  rec.start();
  return rec;
}
```

- [ ] **Step 4: Tạo 6 view stub**

Mỗi file `js/views/{today,vocab,speaking,interview,progress,listening}.js` tạm thời:
```js
export function render(el) {
  el.innerHTML = '<div class="empty"><p>Đang xây dựng...</p></div>';
}
```

- [ ] **Step 5: Tạo `js/app.js`**

```js
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
```

(`sw.js` chưa tồn tại — register có `.catch`, đến Task 13 sẽ có thật.)

- [ ] **Step 6: Tạo manifest + icons**

`manifest.webmanifest`:
```json
{
  "name": "Office English",
  "short_name": "OfficeEN",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#1a56db",
  "icons": [
    { "src": "icons/icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any" },
    { "src": "icons/icon-maskable.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "maskable" }
  ]
}
```

`icons/icon.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="100" fill="#1a56db"/>
  <text x="256" y="320" font-family="Arial, Helvetica, sans-serif" font-size="190" font-weight="bold" fill="#ffffff" text-anchor="middle">EN</text>
</svg>
```

`icons/icon-maskable.svg` (nền tràn viền, chữ nhỏ hơn cho safe zone):
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#1a56db"/>
  <text x="256" y="305" font-family="Arial, Helvetica, sans-serif" font-size="150" font-weight="bold" fill="#ffffff" text-anchor="middle">EN</text>
</svg>
```

- [ ] **Step 7: Tạo gói bài đầu tiên `data/packs/2026-07-02.json`**

```json
{
  "date": "2026-07-02",
  "theme": "Daily standup meeting",
  "vocab": [
    { "word": "blocker", "ipa": "/ˈblɒkər/", "meaning_vi": "vấn đề cản trở công việc", "example": "I have a blocker with the payment API — can someone help me after standup?", "example_vi": "Tôi đang bị vướng ở API thanh toán — ai giúp tôi sau standup được không?" },
    { "word": "on track", "ipa": "/ɒn træk/", "meaning_vi": "đúng tiến độ", "example": "The login feature is on track for Friday's release.", "example_vi": "Tính năng đăng nhập đang đúng tiến độ cho bản phát hành thứ Sáu." },
    { "word": "follow up", "ipa": "/ˈfɒləʊ ʌp/", "meaning_vi": "theo dõi / trao đổi tiếp sau", "example": "Let's follow up on this after the meeting.", "example_vi": "Chúng ta trao đổi tiếp việc này sau cuộc họp nhé." },
    { "word": "deadline", "ipa": "/ˈdedlaɪn/", "meaning_vi": "hạn chót", "example": "The deadline for this sprint is next Wednesday.", "example_vi": "Hạn chót của sprint này là thứ Tư tuần sau." },
    { "word": "estimate", "ipa": "/ˈestɪmeɪt/", "meaning_vi": "ước lượng (thời gian/công sức)", "example": "My estimate for this task is about two days.", "example_vi": "Tôi ước lượng task này mất khoảng hai ngày." },
    { "word": "hand over", "ipa": "/hænd ˈəʊvər/", "meaning_vi": "bàn giao", "example": "I will hand over the ticket to the QA team today.", "example_vi": "Hôm nay tôi sẽ bàn giao ticket cho team QA." },
    { "word": "priority", "ipa": "/praɪˈɒrəti/", "meaning_vi": "mức độ ưu tiên", "example": "Fixing the login bug is our top priority this week.", "example_vi": "Sửa lỗi đăng nhập là ưu tiên hàng đầu của chúng ta tuần này." },
    { "word": "update", "ipa": "/ˈʌpdeɪt/", "meaning_vi": "cập nhật (tình hình)", "example": "Can you give us a quick update on the database migration?", "example_vi": "Bạn cập nhật nhanh tình hình migration database được không?" }
  ],
  "listening": {
    "title": "Morning standup",
    "lines": [
      { "speaker": "Nam (team lead)", "voice": "male", "text": "Good morning everyone. Let's start our standup. Linh, can you go first?" },
      { "speaker": "Linh", "voice": "female", "text": "Sure. Yesterday I finished the login page and fixed two small bugs." },
      { "speaker": "Linh", "voice": "female", "text": "Today I will start working on the user profile screen." },
      { "speaker": "Nam (team lead)", "voice": "male", "text": "Great. Any blockers?" },
      { "speaker": "Linh", "voice": "female", "text": "Yes, one. I need access to the staging database, but I'm still waiting for permission." },
      { "speaker": "Nam (team lead)", "voice": "male", "text": "Okay, I will follow up with the infra team after this meeting." },
      { "speaker": "Linh", "voice": "female", "text": "Thank you. That would really help." },
      { "speaker": "Nam (team lead)", "voice": "male", "text": "No problem. Let's keep the profile screen on track for Friday." }
    ],
    "questions": [
      { "q": "What did Linh finish yesterday?", "options": ["The user profile screen", "The login page and two bug fixes", "The staging database"], "answer": 1 },
      { "q": "What is Linh's blocker?", "options": ["She is waiting for database access", "She has too many bugs", "She missed the deadline"], "answer": 0 },
      { "q": "What will Nam do after the meeting?", "options": ["Fix the login page", "Start the profile screen", "Follow up with the infra team"], "answer": 2 }
    ]
  },
  "shadowing": [
    "Yesterday I finished the login page and fixed two small bugs.",
    "Today I will start working on the user profile screen.",
    "I have a blocker — I'm waiting for access to the staging database.",
    "My estimate for this task is about two days.",
    "Let's follow up on this after the meeting."
  ],
  "interview": [
    {
      "question": "Tell me about yourself.",
      "type": "common",
      "tips_vi": ["Nói 60–90 giây: hiện tại → kinh nghiệm nổi bật → vì sao phù hợp vị trí này", "Đừng kể lan man tiểu sử; tập trung kinh nghiệm liên quan công việc", "Kết thúc bằng lý do bạn hứng thú với vị trí đang ứng tuyển"],
      "sample_answer": "I'm a software developer with five years of experience, mainly in web applications. In my current company, I work on a payment system used by more than ten thousand users. I enjoy solving problems and working with people from different teams. Recently I led a small project to improve our checkout page, and we reduced loading time by forty percent. Now I'm looking for a new challenge in an international environment, and I believe this position is a great fit for my skills."
    },
    {
      "question": "Why do you want to work for our company?",
      "type": "common",
      "tips_vi": ["Nêu 2–3 điểm cụ thể về công ty (sản phẩm, công nghệ, văn hoá) — tránh câu chung chung", "Nối điểm mạnh của bạn với nhu cầu của công ty", "Thể hiện bạn đã tìm hiểu trước về công ty"],
      "sample_answer": "There are three main reasons. First, I really like your product — I have used it myself and I can see how it helps people work better. Second, your company uses modern technologies that I want to grow with, especially cloud services. And third, I read about your team culture, and I like that you focus on learning and sharing knowledge. I believe I can contribute my experience in web development, and at the same time grow as an engineer here."
    }
  ]
}
```

`data/index.json`:
```json
["2026-07-02"]
```

- [ ] **Step 8: Verify JSON + chạy local**

```bash
node -e "
import('./js/pack.js').then(async ({ validatePack }) => {
  const { readFileSync } = await import('node:fs');
  const errs = validatePack(JSON.parse(readFileSync('data/packs/2026-07-02.json', 'utf8')));
  console.log(errs.length ? errs : 'PACK OK');
});
"
python3 -m http.server 8000 &
```

Mở `http://localhost:8000` (Chrome DevTools, viewport 412×915). Checklist:
- 5 tab hiện ở đáy, bấm chuyển tab đổi nội dung ("Đang xây dựng...") và highlight tab active
- Console không có lỗi đỏ (trừ 404 của `sw.js` — chấp nhận đến Task 13)

- [ ] **Step 9: Commit**

```bash
git add index.html css/ js/ manifest.webmanifest icons/ data/
git commit -m "feat: app shell, speech wrapper, first lesson pack"
```

---

### Task 8: View Hôm nay (`today.js`)

**Files:**
- Modify: `js/views/today.js` (thay stub)

**Interfaces:**
- Consumes: `ctx.store` (`computeStreak`, `state.days`), `ctx.pack`, `ctx.navigate`.

- [ ] **Step 1: Implement**

`js/views/today.js`:
```js
const CARDS = [
  { id: 'vocab', icon: '📖', title: 'Từ vựng mới', desc: '8 từ hôm nay', mins: 5, tab: 'vocab' },
  { id: 'listening', icon: '🎧', title: 'Bài nghe', desc: '1 hội thoại + 3 câu hỏi', mins: 5, tab: 'listening' },
  { id: 'speaking', icon: '🎤', title: 'Luyện nói', desc: '5 câu shadowing', mins: 5, tab: 'speaking' },
  { id: 'interview', icon: '💼', title: 'Phỏng vấn', desc: '2 câu hỏi', mins: 10, tab: 'interview' },
];

export function render(el, ctx) {
  const { store, pack } = ctx;
  const streak = store.computeStreak(ctx.today);
  const done = (pack && store.state.days[ctx.today]) || {};
  const stale = pack && pack.date !== ctx.today;

  el.innerHTML = `
    <header class="page-head">
      <h1>Office English</h1>
      <div class="streak">🔥 ${streak} ngày</div>
    </header>
    ${!pack
      ? '<p class="error">Không tải được bài học. Kiểm tra kết nối mạng rồi mở lại app nhé.</p>'
      : `
      <p class="theme">Chủ đề: <b>${pack.theme}</b>${stale ? ` <span class="stale">(bài của ngày ${pack.date})</span>` : ''}</p>
      <div class="cards">
        ${CARDS.map((c) => `
          <button class="card ${done[c.id] ? 'done' : ''}" data-tab="${c.tab}">
            <span class="icon">${c.icon}</span>
            <span class="body"><b>${c.title}</b><small>${c.desc} · ~${c.mins} phút</small></span>
            <span class="check">${done[c.id] ? '✓' : ''}</span>
          </button>`).join('')}
      </div>`}
  `;
  el.querySelectorAll('.card').forEach((b) => {
    b.addEventListener('click', () => ctx.navigate(b.dataset.tab));
  });
}
```

- [ ] **Step 2: Verify trình duyệt**

Mở `http://localhost:8000` (viewport 412×915). Checklist:
- Hiện "🔥 0 ngày", chủ đề "Daily standup meeting", không có nhãn stale
- 4 thẻ hoạt động hiện đúng icon/tên/thời lượng; bấm thẻ chuyển sang tab tương ứng
- Đổi system date test stale: chạy `localStorage.clear()` trong console rồi sửa tạm `ctx.today` không cần — thay vào đó kiểm tra logic stale bằng cách đổi tên file pack? Bỏ qua — logic stale đã được cover trong test `data.test.mjs` (chọn gói cũ hơn) + hiển thị sẽ kiểm tra ở Task 14 khi có nhiều gói.

- [ ] **Step 3: Commit**

```bash
git add js/views/today.js
git commit -m "feat: today view with activity cards and streak"
```

---

### Task 9: View Từ vựng (`vocab.js`)

**Files:**
- Modify: `js/views/vocab.js` (thay stub)

**Interfaces:**
- Consumes: `initialCard`, `review`, `isDue` từ `js/srs.js`; `speak` từ `js/speech.js`; `ctx.store.state.srs`, `ctx.store.state.wordMeta`, `ctx.store.markActivity`.

- [ ] **Step 1: Implement**

`js/views/vocab.js`:
```js
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
          <p>“${meta.example || ''}” <button class="speak-btn small" id="sayEx">🔊</button></p>
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
```

- [ ] **Step 2: Verify trình duyệt**

`localStorage.clear()` trong console rồi reload, mở tab Từ vựng. Checklist:
- Hiện "1/8", từ "blocker" + IPA; nút 🔊 phát âm (cần bật loa)
- "Lật thẻ" hiện nghĩa tiếng Việt + ví dụ; 3 nút Quên/Khó/Nhớ
- Chấm hết 8 thẻ → màn 🎉; quay lại tab Hôm nay → thẻ Từ vựng có ✓ xanh
- Reload → tab Từ vựng hiện "Không có thẻ nào đến hạn"

- [ ] **Step 3: Commit**

```bash
git add js/views/vocab.js
git commit -m "feat: vocab flashcards with SRS scheduling"
```

---

### Task 10: View Luyện nói (`speaking.js`)

**Files:**
- Modify: `js/views/speaking.js` (thay stub)

**Interfaces:**
- Consumes: `speak`, `listenOnce`, `sttSupported` từ `js/speech.js`; `compare` từ `js/diff.js`; `ctx.store.state.bestScores`, `addSpeakingSeconds`, `markActivity`.

- [ ] **Step 1: Implement**

`js/views/speaking.js`:
```js
import { speak, listenOnce, sttSupported } from '../speech.js';
import { compare } from '../diff.js';

const ERROR_MSG = {
  'not-allowed': 'Micro bị chặn — vào Cài đặt Chrome ▸ Quyền của trang để bật micro.',
  'service-not-allowed': 'Micro bị chặn — vào Cài đặt Chrome ▸ Quyền của trang để bật micro.',
  network: 'Cần kết nối mạng để nhận giọng nói.',
  'no-speech': 'Không nghe thấy gì, thử nói lại nhé.',
};

export function render(el, ctx) {
  const { store, pack } = ctx;
  if (!pack) {
    el.innerHTML = '<p class="error">Chưa tải được bài học.</p>';
    return;
  }
  const sentences = pack.shadowing;
  const best = store.state.bestScores;

  const maybeComplete = () => {
    if (sentences.every((s) => best[s] != null)) store.markActivity(ctx.today, 'speaking');
  };

  el.innerHTML = `
    <header class="page-head"><h1>Luyện nói</h1></header>
    ${sttSupported ? '' : '<p class="warn">Trình duyệt này không hỗ trợ nhận giọng nói — bạn vẫn nghe và đọc theo câu mẫu được.</p>'}
    ${sentences.map((s, i) => `
      <div class="shadow-item">
        <p class="sentence">${s}</p>
        <div class="row">
          <button class="play" data-i="${i}">▶ Nghe</button>
          <button class="play slow" data-i="${i}">🐢 0.75x</button>
          ${sttSupported ? `<button class="mic" data-i="${i}">🎤 Nói</button>` : ''}
          <span class="score" id="score-${i}">${best[s] != null ? `${best[s]}%` : ''}</span>
        </div>
        <p class="result" id="res-${i}"></p>
      </div>`).join('')}
  `;

  el.querySelectorAll('.play').forEach((b) => {
    b.onclick = () => speak(sentences[+b.dataset.i], { rate: b.classList.contains('slow') ? 0.75 : 1 });
  });

  el.querySelectorAll('.mic').forEach((b) => {
    b.onclick = () => {
      const i = +b.dataset.i;
      const startedAt = Date.now();
      b.textContent = '👂 ...';
      b.disabled = true;
      listenOnce({
        onResult: (transcript) => {
          const { words, score } = compare(sentences[i], transcript);
          document.getElementById(`res-${i}`).innerHTML = words
            .map((w) => `<span class="${w.ok ? 'ok' : 'miss'}">${w.text}</span>`)
            .join(' ');
          if (score > (best[sentences[i]] ?? -1)) {
            best[sentences[i]] = score;
            store.save();
          }
          document.getElementById(`score-${i}`).textContent = `${score}%`;
          store.addSpeakingSeconds(ctx.today, Math.max(1, Math.round((Date.now() - startedAt) / 1000)));
          maybeComplete();
        },
        onError: (code) => {
          document.getElementById(`res-${i}`).textContent = ERROR_MSG[code] || 'Có lỗi, thử lại nhé.';
        },
        onEnd: () => {
          b.textContent = '🎤 Nói';
          b.disabled = false;
        },
      });
    };
  });
}
```

- [ ] **Step 2: Verify trình duyệt**

Tab Nói (desktop Chrome có mic cũng test được). Checklist:
- 5 câu shadowing hiện đủ; ▶ đọc tốc độ thường, 🐢 đọc chậm
- 🎤 → nói câu → hiện từ xanh/đỏ + điểm %; nói lại điểm cao hơn thì cập nhật
- Từ chối quyền mic → hiện thông báo hướng dẫn bật quyền
- Nói đủ 5 câu → tab Hôm nay thẻ Luyện nói có ✓

- [ ] **Step 3: Commit**

```bash
git add js/views/speaking.js
git commit -m "feat: shadowing practice with speech recognition scoring"
```

---

### Task 11: View Bài nghe (`listening.js`)

**Files:**
- Modify: `js/views/listening.js` (thay stub)

**Interfaces:**
- Consumes: `speak`, `stopSpeaking` từ `js/speech.js`; `ctx.store.markActivity`.

- [ ] **Step 1: Implement**

`js/views/listening.js`:
```js
import { speak, stopSpeaking } from '../speech.js';

export function render(el, ctx) {
  const { store, pack } = ctx;
  if (!pack) {
    el.innerHTML = '<p class="error">Chưa tải được bài học.</p>';
    return;
  }
  const L = pack.listening;
  // Xen kẽ accent theo ngày: ngày chẵn en-US, ngày lẻ en-GB
  const lang = Number(pack.date.slice(8)) % 2 === 0 ? 'en-US' : 'en-GB';
  let showScript = false;
  let playing = false;
  const answers = {};

  function draw() {
    el.innerHTML = `
      <header class="page-head"><h1>🎧 ${L.title}</h1></header>
      <div class="row">
        <button class="primary" style="width:auto;margin:0" id="playAll">${playing ? '🔊 Đang phát...' : '▶ Nghe hội thoại'}</button>
        <button id="stop">⏹ Dừng</button>
        <button id="toggleScript">${showScript ? 'Ẩn script' : 'Hiện script'}</button>
      </div>
      ${showScript ? `<div class="script">${L.lines.map((l) => `<p><b>${l.speaker}:</b> ${l.text}</p>`).join('')}</div>` : ''}
      <h2>Câu hỏi</h2>
      ${L.questions.map((q, qi) => `
        <div class="question">
          <p>${qi + 1}. ${q.q}</p>
          ${q.options.map((o, oi) => {
            const answered = answers[qi] != null;
            let cls = '';
            if (answered && oi === q.answer) cls = 'right';
            else if (answered && answers[qi] === oi) cls = 'wrong';
            return `<button class="option ${cls}" data-q="${qi}" data-o="${oi}" ${answered ? 'disabled' : ''}>${o}</button>`;
          }).join('')}
        </div>`).join('')}
    `;

    el.querySelector('#playAll').onclick = async () => {
      if (playing) return;
      playing = true;
      draw();
      for (const line of L.lines) {
        if (!playing) return;
        await speak(line.text, { gender: line.voice, lang });
      }
      playing = false;
      draw();
    };
    el.querySelector('#stop').onclick = () => { playing = false; stopSpeaking(); draw(); };
    el.querySelector('#toggleScript').onclick = () => { showScript = !showScript; draw(); };
    el.querySelectorAll('.option:not([disabled])').forEach((b) => {
      b.onclick = () => {
        answers[+b.dataset.q] = +b.dataset.o;
        if (Object.keys(answers).length === L.questions.length) {
          store.markActivity(ctx.today, 'listening');
        }
        draw();
      };
    });
  }
  draw();
}
```

Lưu ý vòng lặp playAll: sau `draw()` các node cũ bị thay nhưng vòng `for` async vẫn chạy đúng vì chỉ dùng biến `playing` (closure) — bấm ⏹ set `playing = false` và `stopSpeaking()` cắt luôn.

- [ ] **Step 2: Verify trình duyệt**

Từ tab Hôm nay bấm thẻ Bài nghe. Checklist:
- ▶ phát lần lượt các lượt thoại, giọng nam/nữ khác nhau; ⏹ dừng ngay
- "Hiện script" hiện hội thoại; tab bar highlight tab Hôm nay (vì listening là sub-view)
- Chọn đáp án: đúng viền xanh; sai → đáp án chọn viền đỏ + đáp án đúng viền xanh; các option bị khoá sau khi chọn
- Trả lời đủ 3 câu → quay lại Hôm nay, thẻ Bài nghe có ✓

- [ ] **Step 3: Commit**

```bash
git add js/views/listening.js
git commit -m "feat: listening view with TTS dialogue and quiz"
```

---

### Task 12: View Phỏng vấn (`interview.js`)

**Files:**
- Modify: `js/views/interview.js` (thay stub)

**Interfaces:**
- Consumes: `speak`, `listenOnce`, `sttSupported` từ `js/speech.js`; `ctx.store.state.interviewLog`, `markActivity`, `save`.

- [ ] **Step 1: Implement**

`js/views/interview.js`:
```js
import { speak, listenOnce, sttSupported } from '../speech.js';

function latestAnswer(store, today, question) {
  const entries = store.state.interviewLog.filter((e) => e.date === today && e.question === question);
  return entries.length ? entries[entries.length - 1].transcript : null;
}

export function render(el, ctx) {
  const { store, pack } = ctx;
  if (!pack) {
    el.innerHTML = '<p class="error">Chưa tải được bài học.</p>';
    return;
  }

  const saveAnswer = (question, transcript) => {
    store.state.interviewLog.push({ date: ctx.today, question, transcript });
    store.save();
    if (pack.interview.every((it) => latestAnswer(store, ctx.today, it.question))) {
      store.markActivity(ctx.today, 'interview');
    }
  };

  function draw() {
    el.innerHTML = `
      <header class="page-head"><h1>Phỏng vấn</h1></header>
      ${pack.interview.map((it, i) => {
        const ans = latestAnswer(store, ctx.today, it.question);
        return `
        <div class="iv">
          <p class="q">${it.question} <button class="speak-btn small" data-say="${i}">🔊</button></p>
          <details><summary>💡 Tips trả lời</summary><ul>${it.tips_vi.map((t) => `<li>${t}</li>`).join('')}</ul></details>
          <div class="row">
            ${sttSupported ? `<button class="mic" data-mic="${i}">🎤 Trả lời bằng giọng nói</button>` : ''}
            <button data-type="${i}">⌨️ Gõ câu trả lời</button>
          </div>
          <div id="typebox-${i}" style="display:none">
            <textarea id="ta-${i}" placeholder="Type your answer in English..."></textarea>
            <button class="primary" data-submit="${i}">Lưu câu trả lời</button>
          </div>
          ${ans ? `<p class="transcript">Bạn: “${ans}”</p>` : ''}
          <details><summary>📄 Câu trả lời mẫu (B1)</summary><p>${it.sample_answer}</p></details>
          <button data-copy="${i}">📋 Copy để hỏi Claude</button>
          <span id="copied-${i}" class="warn" style="display:none">Đã copy — dán vào app Claude nhé!</span>
        </div>`;
      }).join('')}
    `;

    el.querySelectorAll('[data-say]').forEach((b) => {
      b.onclick = () => speak(pack.interview[+b.dataset.say].question);
    });
    el.querySelectorAll('[data-mic]').forEach((b) => {
      b.onclick = () => {
        const i = +b.dataset.mic;
        b.textContent = '👂 Đang nghe... (nói xong sẽ tự dừng)';
        b.disabled = true;
        listenOnce({
          onResult: (t) => saveAnswer(pack.interview[i].question, t),
          onError: () => {},
          onEnd: () => draw(),
        });
      };
    });
    el.querySelectorAll('[data-type]').forEach((b) => {
      b.onclick = () => {
        document.getElementById(`typebox-${b.dataset.type}`).style.display = 'block';
      };
    });
    el.querySelectorAll('[data-submit]').forEach((b) => {
      b.onclick = () => {
        const i = +b.dataset.submit;
        const text = document.getElementById(`ta-${i}`).value.trim();
        if (text) {
          saveAnswer(pack.interview[i].question, text);
          draw();
        }
      };
    });
    el.querySelectorAll('[data-copy]').forEach((b) => {
      b.onclick = async () => {
        const i = +b.dataset.copy;
        const it = pack.interview[i];
        const ans = latestAnswer(store, ctx.today, it.question) || '(chưa trả lời)';
        const prompt = [
          'Tôi đang luyện phỏng vấn tiếng Anh (trình độ B1, ngành IT/phần mềm).',
          `Câu hỏi phỏng vấn: "${it.question}"`,
          `Câu trả lời của tôi: "${ans}"`,
          'Hãy nhận xét giúp tôi: 1) lỗi ngữ pháp, 2) từ vựng nên thay để tự nhiên hơn, 3) cấu trúc câu trả lời (dùng STAR nếu phù hợp), 4) viết lại một bản cải thiện ở trình độ B1-B2.',
        ].join('\n\n');
        await navigator.clipboard.writeText(prompt);
        document.getElementById(`copied-${i}`).style.display = 'inline';
      };
    });
  }
  draw();
}
```

- [ ] **Step 2: Verify trình duyệt**

Tab Phỏng vấn. Checklist:
- 2 câu hỏi hiện đủ; 🔊 đọc câu hỏi; Tips và Câu trả lời mẫu mở/đóng được
- 🎤 trả lời → transcript hiện "Bạn: ..."; hoặc ⌨️ gõ → Lưu → transcript hiện
- Trả lời cả 2 câu → thẻ Phỏng vấn ở Hôm nay có ✓
- "Copy để hỏi Claude" → dán ra editor thấy prompt đủ câu hỏi + câu trả lời

- [ ] **Step 3: Commit**

```bash
git add js/views/interview.js
git commit -m "feat: interview practice with transcript and Claude prompt copy"
```

---

### Task 13: View Tiến độ (`progress.js`) + Service worker + PWA

**Files:**
- Modify: `js/views/progress.js` (thay stub)
- Create: `sw.js`

**Interfaces:**
- Consumes: `addDays` từ `js/dates.js`; toàn bộ store API.

- [ ] **Step 1: Implement `progress.js`**

```js
import { addDays } from '../dates.js';

export function render(el, ctx) {
  const { store } = ctx;
  const s = store.state;
  const streak = store.computeStreak(ctx.today);
  const longest = store.computeLongestStreak();
  const totalWords = Object.keys(s.srs).length;
  const speakMins = Math.round(
    Object.values(s.days).reduce((sum, d) => sum + (d.speakingSeconds || 0), 0) / 60,
  );
  const answered = s.interviewLog.length;

  const cells = [];
  for (let i = 29; i >= 0; i--) {
    const d = addDays(ctx.today, -i);
    const cls = store.isDayComplete(d) ? 'full' : s.days[d] ? 'part' : '';
    cells.push(`<div class="cell ${cls}" title="${d}"></div>`);
  }

  el.innerHTML = `
    <header class="page-head"><h1>Tiến độ</h1></header>
    <div class="stats">
      <div class="stat"><b>🔥 ${streak}</b><small>streak hiện tại</small></div>
      <div class="stat"><b>${longest}</b><small>streak dài nhất</small></div>
      <div class="stat"><b>${totalWords}</b><small>từ đã học</small></div>
      <div class="stat"><b>${speakMins}′</b><small>phút luyện nói</small></div>
      <div class="stat"><b>${answered}</b><small>câu phỏng vấn đã trả lời</small></div>
    </div>
    <h2>30 ngày gần nhất</h2>
    <div class="grid30">${cells.join('')}</div>
    <button class="primary" id="export">⬇️ Xuất backup</button>
    <button class="primary" id="import" style="background:var(--card);border:1px solid var(--line)">⬆️ Nhập backup</button>
    <input type="file" id="file" accept="application/json" style="display:none">
    <p id="msg" class="warn"></p>
  `;

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
      render(el, ctx);
    } catch {
      el.querySelector('#msg').textContent = 'File backup không hợp lệ.';
    }
  };
}
```

- [ ] **Step 2: Implement `sw.js`**

```js
const SHELL_CACHE = 'shell-v1';
const DATA_CACHE = 'data-v1';
const SHELL = [
  './', 'index.html', 'css/app.css', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/icon-maskable.svg',
  'js/app.js', 'js/dates.js', 'js/srs.js', 'js/diff.js', 'js/pack.js',
  'js/store.js', 'js/data.js', 'js/speech.js',
  'js/views/today.js', 'js/views/vocab.js', 'js/views/speaking.js',
  'js/views/interview.js', 'js/views/progress.js', 'js/views/listening.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => ![SHELL_CACHE, DATA_CACHE].includes(k)).map((k) => caches.delete(k)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.pathname.includes('/data/')) {
    // data: network-first, cache lại để offline vẫn học được gói đã mở
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(DATA_CACHE).then((c) => c.put(e.request, copy));
          return res;
        })
        .catch(() => caches.match(e.request)),
    );
  } else {
    // shell: cache-first
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
  }
});
```

- [ ] **Step 3: Verify trình duyệt**

Checklist:
- Tab Tiến độ: 5 ô stat đúng số liệu (sau khi hoàn thành các hoạt động ở task trước, streak = 1); lưới 30 ô, ô hôm nay xanh đậm
- Xuất backup tải file JSON; `localStorage.clear()` + reload → stats về 0 → Nhập backup → stats khôi phục
- DevTools ▸ Application ▸ Service worker: sw activated; Cache Storage có `shell-v1` + `data-v1`
- DevTools ▸ Network ▸ Offline + reload → app vẫn mở được, bài học vẫn hiện (STT sẽ báo cần mạng — đúng thiết kế)
- DevTools ▸ Application ▸ Manifest: không lỗi, icon hiện

- [ ] **Step 4: Commit**

```bash
git add js/views/progress.js sw.js
git commit -m "feat: progress view, backup, service worker offline support"
```

---

### Task 14: Script validate data + 29 gói bài còn lại

**Files:**
- Create: `scripts/validate-data.mjs`, `data/packs/2026-07-03.json` … `data/packs/2026-07-31.json`
- Modify: `data/index.json`

**Interfaces:**
- Consumes: `validatePack` từ `js/pack.js`.
- Produces: lệnh `npm run validate-data` — exit 0 nếu toàn bộ gói hợp lệ, không trùng từ vựng giữa các gói, index khớp file.

- [ ] **Step 1: Viết `scripts/validate-data.mjs`**

```js
import { readFileSync, readdirSync } from 'node:fs';
import { validatePack } from '../js/pack.js';

const index = JSON.parse(readFileSync('data/index.json', 'utf8'));
const files = readdirSync('data/packs').filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''));
let failed = false;
const seenWords = new Set();

for (const f of files) {
  if (!index.includes(f)) {
    console.error(`data/packs/${f}.json exists but is missing from index.json`);
    failed = true;
  }
}

for (const date of index) {
  if (!files.includes(date)) {
    console.error(`index.json lists ${date} but pack file is missing`);
    failed = true;
    continue;
  }
  const pack = JSON.parse(readFileSync(`data/packs/${date}.json`, 'utf8'));
  const errors = validatePack(pack);
  if (pack.date !== date) errors.push(`date field "${pack.date}" != filename "${date}"`);
  for (const v of pack.vocab || []) {
    const w = v.word?.toLowerCase();
    if (seenWords.has(w)) errors.push(`duplicate word across packs: "${v.word}"`);
    seenWords.add(w);
  }
  if (errors.length) {
    console.error(`${date}:`);
    for (const e of errors) console.error(`  - ${e}`);
    failed = true;
  }
}

if (failed) {
  console.error('FAILED');
  process.exit(1);
}
console.log(`OK: ${index.length} packs, ${seenWords.size} unique words`);
```

- [ ] **Step 2: Chạy validator với 1 gói hiện có**

Run: `npm run validate-data`
Expected: `OK: 1 packs, 8 unique words`

- [ ] **Step 3: Soạn 29 gói còn lại (2026-07-03 → 2026-07-31)**

Người thực thi (Claude) tự soạn nội dung theo các ràng buộc sau — mỗi gói cùng schema với `2026-07-02.json` (xem Task 7 Step 7 làm chuẩn chất lượng):

- **Chủ đề xoay vòng theo thứ tự, lặp lại sau 14 ngày:** (1) Daily standup meeting, (2) Code review & pull requests, (3) Báo cáo tiến độ với sếp, (4) Small talk đầu giờ & pantry chat, (5) Họp với khách hàng, (6) Deal lương & phúc lợi, (7) Xin nghỉ phép & thông báo vắng mặt, (8) Giải thích bug & sự cố production, (9) Thuyết trình demo sản phẩm, (10) Onboarding người mới, (11) Nói về email & follow-up, (12) Họp retrospective, (13) Phỏng vấn kỹ thuật (giới thiệu dự án, giải thích công nghệ), (14) Remote meeting etiquette. Ngày 2026-07-03 dùng chủ đề (2), 07-04 dùng (3), v.v.
- **Mỗi gói:** đúng 8 từ vựng (word + ipa + meaning_vi + example + example_vi), 1 hội thoại 8–12 lượt thoại xen kẽ voice male/female với title + đúng 3 câu hỏi trắc nghiệm 3 lựa chọn, đúng 5 câu shadowing (10–16 từ/câu, lấy ngữ cảnh từ chủ đề), đúng 2 câu hỏi phỏng vấn (mix type behavioral/technical/common; sample_answer 100–200 từ trình độ B1; tips_vi 2–3 gạch đầu dòng).
- **Không trùng `word`** với bất kỳ gói nào trước đó (validator sẽ chặn).
- **Tiếng Anh B1:** câu ngắn, thì đơn giản, từ thực dụng. Nội dung IT/văn phòng, nhân vật tên Việt (Nam, Linh, Minh, Hoa...) làm việc ở công ty phần mềm.
- Cập nhật `data/index.json` thành mảng đầy đủ 30 ngày `["2026-07-02", ..., "2026-07-31"]`.
- Soạn theo lô 5-6 gói, sau mỗi lô chạy `npm run validate-data` để bắt lỗi sớm.

- [ ] **Step 4: Validate toàn bộ**

Run: `npm run validate-data`
Expected: `OK: 30 packs, 240 unique words`

- [ ] **Step 5: Verify trình duyệt**

Reload app: tab Hôm nay hiện gói `2026-07-02` (hôm nay), KHÔNG hiện nhãn stale. (Gói tương lai bị bỏ qua — đã cover bằng unit test Task 6.)

- [ ] **Step 6: Commit**

```bash
git add scripts/validate-data.mjs data/
git commit -m "feat: data validator + 30 seed lesson packs"
```

---

### Task 15: Prompt cho Claude routine (`routine/PROMPT.md`)

**Files:**
- Create: `routine/PROMPT.md`

**Interfaces:**
- Consumes: schema từ `js/pack.js`, validator `scripts/validate-data.mjs`.
- Produces: file prompt hoàn chỉnh để tạo scheduled task.

- [ ] **Step 1: Viết `routine/PROMPT.md`**

````markdown
# Nhiệm vụ hàng ngày: Soạn gói bài học Office English

Bạn là routine tự động soạn bài học tiếng Anh hàng ngày cho repo này (PWA Office English).

## Các bước

1. Xác định ngày hôm nay theo múi giờ Asia/Ho_Chi_Minh, dạng `YYYY-MM-DD`.
2. Nếu `data/packs/<hôm nay>.json` đã tồn tại → dừng, không làm gì.
3. Đọc `data/index.json` và 14 gói gần nhất trong `data/packs/` để biết:
   - Chủ đề của 14 ngày trước → chọn chủ đề TIẾP THEO trong vòng xoay 14 chủ đề (danh sách bên dưới).
   - Từ vựng đã dùng → KHÔNG lặp lại bất kỳ `word` nào đã có trong mọi gói cũ.
4. Soạn gói mới `data/packs/<hôm nay>.json` đúng schema (bên dưới).
5. Chạy `npm run validate-data` — nếu lỗi, sửa cho đến khi `OK`.
6. Thêm ngày mới vào `data/index.json` (giữ thứ tự tăng dần).
7. Commit với message `content: lesson pack <ngày>` và push lên nhánh main.

## Vòng xoay 14 chủ đề

1. Daily standup meeting
2. Code review & pull requests
3. Báo cáo tiến độ với sếp
4. Small talk đầu giờ & pantry chat
5. Họp với khách hàng
6. Deal lương & phúc lợi
7. Xin nghỉ phép & thông báo vắng mặt
8. Giải thích bug & sự cố production
9. Thuyết trình demo sản phẩm
10. Onboarding người mới
11. Nói về email & follow-up
12. Họp retrospective
13. Phỏng vấn kỹ thuật
14. Remote meeting etiquette

## Yêu cầu nội dung (trình độ B1, ngành IT/văn phòng)

- Đúng **8 từ vựng**: `word`, `ipa`, `meaning_vi`, `example` (câu ngữ cảnh công sở), `example_vi`.
- **1 hội thoại** 8–12 lượt thoại (`speaker` là tên + vai, `voice` là `male`/`female` xen kẽ, `text` tiếng Anh B1), có `title`, kèm đúng **3 câu hỏi trắc nghiệm** (`q`, `options` 3 lựa chọn, `answer` là index đáp án đúng).
- Đúng **5 câu shadowing**: 10–16 từ, câu thực dụng người đi làm nói hàng ngày, theo chủ đề.
- Đúng **2 câu hỏi phỏng vấn**: `type` ∈ behavioral|technical|common, `tips_vi` 2–3 gạch đầu dòng tiếng Việt, `sample_answer` 100–200 từ tiếng Anh B1 (câu ngắn, thì đơn giản, tự nhiên khi nói).
- Nhân vật trong hội thoại là người Việt làm công ty phần mềm (Nam, Linh, Minh, Hoa...).

## Schema (xem `js/pack.js` là nguồn chân lý)

```json
{
  "date": "YYYY-MM-DD",
  "theme": "...",
  "vocab": [{ "word": "", "ipa": "", "meaning_vi": "", "example": "", "example_vi": "" }],
  "listening": {
    "title": "",
    "lines": [{ "speaker": "", "voice": "male|female", "text": "" }],
    "questions": [{ "q": "", "options": ["", "", ""], "answer": 0 }]
  },
  "shadowing": [""],
  "interview": [{ "question": "", "type": "behavioral|technical|common", "tips_vi": [""], "sample_answer": "" }]
}
```
````

- [ ] **Step 2: Commit**

```bash
git add routine/PROMPT.md
git commit -m "docs: daily content generation prompt for Claude routine"
```

---

### Task 16: Deploy GitHub Pages + hướng dẫn cài đặt

**Files:**
- Create: `README.md`

**Điều kiện:** `gh` CLI đã đăng nhập (`gh auth status`). Repo sẽ **public** (GitHub Pages free yêu cầu public; nội dung chỉ là bài học chung, tiến độ cá nhân nằm trong localStorage điện thoại, không lên repo).

- [ ] **Step 1: Viết `README.md`**

```markdown
# Office English

PWA học tiếng Anh công sở (trình độ B1, ngành IT) — chạy trên Chrome Android.

- **App:** https://<user>.github.io/english-learning/ (thay <user> sau khi deploy)
- **Nội dung:** Claude routine soạn gói bài mới mỗi sáng vào `data/packs/`, xem `routine/PROMPT.md`
- **Dev:** `python3 -m http.server 8000` rồi mở http://localhost:8000
- **Test:** `npm test` · **Validate nội dung:** `npm run validate-data`

## Cài lên điện thoại

Mở link app bằng Chrome → menu ⋮ → "Thêm vào màn hình chính".
```

- [ ] **Step 2: Kiểm tra toàn bộ trước khi ship**

```bash
npm test && npm run validate-data
```
Expected: cả hai PASS/OK.

- [ ] **Step 3: Tạo repo + push + bật Pages**

```bash
git add README.md && git commit -m "docs: README"
gh repo create english-learning --public --source . --push
gh api -X POST "repos/{owner}/english-learning/pages" \
  -f "source[branch]=main" -f "source[path]=/"
```

Đợi ~2 phút rồi kiểm tra:
```bash
gh api "repos/{owner}/english-learning/pages" --jq .html_url
curl -sI <html_url> | head -1
```
Expected: `HTTP/2 200`. Cập nhật link thật vào README, commit + push.

- [ ] **Step 4: Bàn giao cho người dùng (dừng chờ xác nhận)**

Báo người dùng làm 2 việc trên điện thoại S23 Ultra:
1. Mở link app bằng Chrome → test 4 hoạt động (đặc biệt 🎤 mic và 🔊 loa)
2. Menu ⋮ → "Thêm vào màn hình chính" để cài PWA

- [ ] **Step 5: Tạo routine hàng ngày**

Sau khi người dùng xác nhận app chạy tốt trên điện thoại: dùng skill `schedule` (scheduled cloud agents) tạo routine chạy **hàng ngày 22:00 UTC (= 5:00 sáng VN)** trên repo `english-learning`, với prompt: *"Đọc file routine/PROMPT.md trong repo và làm đúng theo hướng dẫn trong đó."* Nếu môi trường không cho phép tạo scheduled task trên repo GitHub, hướng dẫn người dùng tạo routine trong Claude app với cùng nội dung.

---

## Self-Review (đã chạy)

1. **Spec coverage:** 5 tab (Task 8–13) ✓ · SRS ✓ · shadowing + diff ✓ · listening TTS 2 giọng + accent xen kẽ ✓ · interview + Copy để hỏi Claude ✓ · streak/backup ✓ · offline SW ✓ · fallback gói cũ + nhãn stale ✓ · fallback không mic (textarea) ✓ · quyền mic bị chặn (ERROR_MSG) ✓ · 30 gói mồi ✓ · routine PROMPT ✓ · deploy Pages ✓.
2. **Placeholder scan:** không còn TBD/TODO; Task 14 Step 3 là chỉ dẫn sinh nội dung có ràng buộc đo được (validator chặn sai).
3. **Type consistency:** `render(el, ctx)` thống nhất; `ctx.today` là string `YYYY-MM-DD` xuyên suốt; tên hàm store khớp giữa Task 5 và các view; SW cache list khớp danh sách file thật.
