# Office English v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nâng cấp PWA Office English lên v2: onboarding + hồ sơ người dùng, 5 track nội dung (bỏ tab Phỏng vấn), tab Luyện tập gộp shadowing + thực hành AI ngoài, tab Ôn tập, kiểm tra tiến bộ định kỳ, icon mới.

**Architecture:** Giữ nguyên PWA tĩnh (HTML/CSS/JS thuần, ES modules, không build step, GitHub Pages). Hồ sơ + trạng thái mới lưu localStorage qua `store.js`. Nội dung chuyển sang gói-theo-track `data/packs/YYYY-MM-DD-<track>.json`. Spec: `docs/superpowers/specs/2026-07-04-office-english-v2-design.md`.

**Tech Stack:** Vanilla JS ES modules · node:test · Web Speech API · Service Worker.

## Global Constraints

- KHÔNG framework, KHÔNG bundler, KHÔNG backend. Chỉ sửa file tĩnh trong repo.
- Test chạy bằng `npm test` (node --test tests/*.test.mjs). Validate nội dung: `npm run validate-data`.
- Ngôn ngữ UI: tiếng Việt; nội dung học: tiếng Anh. Code comment tiếng Việt theo idiom repo.
- Track hợp lệ: `it`, `office`, `sales`, `finance`, `interview` (đúng 5 giá trị này).
- Trình độ: `a2` | `b1` | `b2`. Phút/ngày: `15` | `30` | `45`. App AI: `chatgpt` | `claude` | `gemini` | `other`.
- Kích hoạt AI: `conversation` | `speaking` | `writing` (khoá trong `aiDone`, prefix `ai_` trong danh sách hoạt động).
- Mỗi task kết thúc bằng commit. Chạy `npm test` trước mọi commit có sửa JS.
- Dùng CSS variables có sẵn trong `css/app.css` (--card, --accent, --line, --muted, --radius...); CSS mới append cuối file.

---

### Task 1: `js/plan.js` — kế hoạch ngày

**Files:**
- Create: `js/plan.js`
- Test: `tests/plan.test.mjs`

**Interfaces:**
- Consumes: không gì (module thuần).
- Produces: `AI_KINDS = ['conversation','speaking','writing']`; `dayIndex(dateStr) -> number` (số ngày kể từ epoch, UTC); `aiKindsFor(date, minutes) -> string[]` (0/1/2 phần tử xoay vòng theo ngày); `requiredActivities(date, minutes) -> string[]` (vd `['vocab','listening','speaking','ai_conversation']`).

- [ ] **Step 1: Viết test fail**

```js
// tests/plan.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AI_KINDS, dayIndex, aiKindsFor, requiredActivities } from '../js/plan.js';

test('dayIndex tăng 1 mỗi ngày', () => {
  assert.equal(dayIndex('2026-07-05') - dayIndex('2026-07-04'), 1);
  assert.equal(dayIndex('2026-08-01') - dayIndex('2026-07-31'), 1);
});

test('15 phút: không có hoạt động AI', () => {
  assert.deepEqual(aiKindsFor('2026-07-04', 15), []);
  assert.deepEqual(requiredActivities('2026-07-04', 15), ['vocab', 'listening', 'speaking']);
});

test('30 phút: 1 hoạt động AI, xoay vòng theo ngày', () => {
  const kinds = ['2026-07-04', '2026-07-05', '2026-07-06'].map((d) => aiKindsFor(d, 30)[0]);
  assert.deepEqual([...kinds].sort(), [...AI_KINDS].sort()); // 3 ngày liên tiếp đủ 3 loại
  assert.equal(aiKindsFor('2026-07-04', 30).length, 1);
});

test('45 phút: 2 hoạt động AI khác nhau', () => {
  const kinds = aiKindsFor('2026-07-04', 45);
  assert.equal(kinds.length, 2);
  assert.notEqual(kinds[0], kinds[1]);
  assert.deepEqual(
    requiredActivities('2026-07-04', 45),
    ['vocab', 'listening', 'speaking', `ai_${kinds[0]}`, `ai_${kinds[1]}`],
  );
});

test('minutes lạ/undefined coi như 15', () => {
  assert.deepEqual(requiredActivities('2026-07-04', undefined), ['vocab', 'listening', 'speaking']);
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `node --test tests/plan.test.mjs`
Expected: FAIL — `Cannot find module .../js/plan.js`

- [ ] **Step 3: Viết `js/plan.js`**

```js
// Kế hoạch ngày: hoạt động bắt buộc theo số phút user chọn trong onboarding.
export const AI_KINDS = ['conversation', 'speaking', 'writing'];
const CORE = ['vocab', 'listening', 'speaking'];

export function dayIndex(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

export function aiKindsFor(date, minutes) {
  const n = minutes >= 45 ? 2 : minutes >= 30 ? 1 : 0;
  const start = dayIndex(date) % AI_KINDS.length;
  return Array.from({ length: n }, (_, i) => AI_KINDS[(start + i) % AI_KINDS.length]);
}

export function requiredActivities(date, minutes) {
  return [...CORE, ...aiKindsFor(date, minutes).map((k) => `ai_${k}`)];
}
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `node --test tests/plan.test.mjs`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add js/plan.js tests/plan.test.mjs
git commit -m "feat: daily plan module (required activities by minutes)"
```

---

### Task 2: `js/store.js` v2 — profile, aiDone, tests, streak mới

**Files:**
- Modify: `js/store.js`
- Test: `tests/store.test.mjs`

**Interfaces:**
- Consumes: `requiredActivities` từ `js/plan.js` (Task 1).
- Produces: state thêm `profile: null|{track,level,goals[],minutes,aiApp,onboardedAt}`, `aiDone: { [date]: {conversation?,speaking?,writing?} }`, `tests: [{date,kind:'week'|'month',score,total,ai?:true}]`. Method mới: `setProfile(profile)`, `setAiDone(date, kind, done)`, `isAiDone(date, kind) -> bool`, `addTestResult({date,kind,score,total})`, `markTestAiDone(date, kind)`. `markActivity` chỉ nhận `vocab|listening|speaking`. `isDayComplete(date)`: đủ 4 hoạt động v1 (ngày cũ) HOẶC đủ `requiredActivities(date, profile.minutes)` (ai_* đọc từ `aiDone`).

- [ ] **Step 1: Thêm test mới vào `tests/store.test.mjs`** (giữ nguyên test cũ, chỉ đổi tên test `'day complete requires all 4 activities'` thành nội dung dưới; helper `completeDay` giữ nguyên 4 activity — ngày cũ vẫn phải complete theo luật v1)

Thay test `'day complete requires all 4 activities'` bằng:

```js
test('luật v1: ngày cũ đủ 4 hoạt động (kể cả interview trong data cũ) vẫn complete', () => {
  const s = createStore(fakeStorage({
    'office-english-v1': JSON.stringify({
      days: { '2026-07-01': { vocab: true, listening: true, speaking: true, interview: true } },
    }),
  }));
  assert.equal(s.isDayComplete('2026-07-01'), true);
});
```

Thêm cuối file:

```js
test('markActivity bỏ qua activity không hợp lệ (interview không còn markable)', () => {
  const s = createStore(fakeStorage());
  s.markActivity('2026-07-04', 'interview');
  assert.equal(s.state.days['2026-07-04'], undefined);
});

test('luật v2 15p: đủ 3 hoạt động cốt lõi là complete', () => {
  const s = createStore(fakeStorage());
  s.setProfile({ track: 'it', level: 'b1', goals: [], minutes: 15, aiApp: 'chatgpt', onboardedAt: '2026-07-04' });
  for (const a of ['vocab', 'listening', 'speaking']) s.markActivity('2026-07-04', a);
  assert.equal(s.isDayComplete('2026-07-04'), true);
});

test('luật v2 30p: cần thêm hoạt động AI theo kế hoạch của ngày', () => {
  const s = createStore(fakeStorage());
  s.setProfile({ track: 'it', level: 'b1', goals: [], minutes: 30, aiApp: 'chatgpt', onboardedAt: '2026-07-04' });
  for (const a of ['vocab', 'listening', 'speaking']) s.markActivity('2026-07-04', a);
  assert.equal(s.isDayComplete('2026-07-04'), false);
  const kind = requiredActivities('2026-07-04', 30).find((a) => a.startsWith('ai_')).slice(3);
  s.setAiDone('2026-07-04', kind, true);
  assert.equal(s.isDayComplete('2026-07-04'), true);
  s.setAiDone('2026-07-04', kind, false); // toggle được (phòng bấm nhầm)
  assert.equal(s.isDayComplete('2026-07-04'), false);
});

test('setProfile lưu và tồn tại qua reload store', () => {
  const storage = fakeStorage();
  const p = { track: 'sales', level: 'a2', goals: ['work'], minutes: 30, aiApp: 'claude', onboardedAt: '2026-07-04' };
  createStore(storage).setProfile(p);
  assert.deepEqual(createStore(storage).state.profile, p);
});

test('addTestResult + markTestAiDone', () => {
  const s = createStore(fakeStorage());
  s.addTestResult({ date: '2026-07-10', kind: 'week', score: 8, total: 10 });
  assert.equal(s.state.tests.length, 1);
  s.markTestAiDone('2026-07-10', 'week');
  assert.equal(s.state.tests[0].ai, true);
});

test('import backup v1 (không có profile/aiDone/tests) vẫn hợp lệ, dùng mặc định', () => {
  const s = createStore(fakeStorage());
  s.importData(JSON.stringify({ days: { '2026-07-01': { vocab: true } }, srs: {} }));
  assert.equal(s.state.profile, null);
  assert.deepEqual(s.state.aiDone, {});
  assert.deepEqual(s.state.tests, []);
});

test('import từ chối profile/aiDone/tests sai kiểu', () => {
  const s = createStore(fakeStorage());
  assert.throws(() => s.importData('{"days":{},"profile":"x"}'));
  assert.throws(() => s.importData('{"days":{},"tests":{}}'));
});
```

Thêm import đầu file test: `import { requiredActivities } from '../js/plan.js';`

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `node --test tests/store.test.mjs`
Expected: FAIL — `s.setProfile is not a function` (và các test mới khác fail)

- [ ] **Step 3: Sửa `js/store.js`**

Thay toàn bộ file bằng:

```js
import { addDays } from './dates.js';
import { requiredActivities } from './plan.js';

const KEY = 'office-english-v1';
const ACTIVITIES = ['vocab', 'listening', 'speaking'];
const V1_ACTIVITIES = ['vocab', 'listening', 'speaking', 'interview'];

const emptyState = () => ({
  srs: {},
  wordMeta: {},
  days: {},
  interviewLog: [],
  bestScores: {},
  profile: null,
  aiDone: {},
  tests: [],
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
    setProfile(profile) {
      state.profile = { ...profile };
      save();
    },
    markActivity(date, activity) {
      if (!ACTIVITIES.includes(activity)) return;
      state.days[date] = { ...state.days[date], [activity]: true };
      save();
    },
    setAiDone(date, kind, done) {
      state.aiDone[date] = { ...state.aiDone[date], [kind]: !!done };
      save();
    },
    isAiDone(date, kind) {
      return !!state.aiDone[date]?.[kind];
    },
    addTestResult({ date, kind, score, total }) {
      state.tests.push({ date, kind, score, total });
      save();
    },
    markTestAiDone(date, kind) {
      const t = state.tests.find((x) => x.date === date && x.kind === kind);
      if (t) { t.ai = true; save(); }
    },
    addSpeakingSeconds(date, seconds) {
      const d = (state.days[date] = { ...state.days[date] });
      d.speakingSeconds = (d.speakingSeconds || 0) + seconds;
      save();
    },
    isDayComplete(date) {
      const d = state.days[date];
      if (!d) return false;
      if (V1_ACTIVITIES.every((a) => d[a])) return true; // ngày cũ tính theo luật v1, không tính lại
      const req = requiredActivities(date, state.profile?.minutes ?? 15);
      const ai = state.aiDone[date] || {};
      return req.every((a) => (a.startsWith('ai_') ? ai[a.slice(3)] : d[a]));
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
      const isPlainObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
      const valid = isPlainObj(parsed)
        && isPlainObj(parsed.days)
        && (parsed.srs === undefined || isPlainObj(parsed.srs))
        && (parsed.wordMeta === undefined || isPlainObj(parsed.wordMeta))
        && (parsed.bestScores === undefined || isPlainObj(parsed.bestScores))
        && (parsed.interviewLog === undefined || Array.isArray(parsed.interviewLog))
        && (parsed.profile === undefined || parsed.profile === null || isPlainObj(parsed.profile))
        && (parsed.aiDone === undefined || isPlainObj(parsed.aiDone))
        && (parsed.tests === undefined || Array.isArray(parsed.tests));
      if (!valid) {
        throw new Error('File backup không hợp lệ');
      }
      state = { ...emptyState(), ...parsed };
      save();
    },
  };
  return store;
}
```

- [ ] **Step 4: Chạy toàn bộ test, xác nhận pass**

Run: `npm test`
Expected: PASS toàn bộ (test cũ của store vẫn pass: `completeDay` đánh dấu 4 hoạt động, `interview` bị bỏ qua nhưng 3 core đủ luật v2-15p vì profile null → minutes 15)

- [ ] **Step 5: Commit**

```bash
git add js/store.js tests/store.test.mjs
git commit -m "feat: store v2 - profile, aiDone, tests, plan-based day completion"
```

---

### Task 3: `js/pack.js` v2 — schema theo track, bỏ interview

**Files:**
- Modify: `js/pack.js`, `tests/helpers.mjs`
- Test: `tests/pack.test.mjs`

**Interfaces:**
- Produces: `TRACKS = ['it','office','sales','finance','interview']`; `validatePack(pack, { requireTrack = false }) -> string[]`. `pack.track` optional (legacy) nhưng nếu có phải thuộc TRACKS; khi `requireTrack: true` thì bắt buộc. Trường `interview` trong pack KHÔNG còn được validate (bị bỏ qua). `makePack(date, track = 'it')` trong helpers trả pack có `track`, không có `interview`.

- [ ] **Step 1: Cập nhật `tests/helpers.mjs`** — thêm `track`, xoá `interview`:

```js
export function makePack(date, track = 'it') {
  return {
    date,
    track,
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
  };
}
```

- [ ] **Step 2: Cập nhật `tests/pack.test.mjs`** — XOÁ test `'interview with bad type is rejected'`, thêm:

```js
test('pack không có track vẫn hợp lệ (legacy), track lạ bị từ chối', () => {
  const p = makePack('2026-07-02');
  delete p.track;
  assert.deepEqual(validatePack(p), []);
  p.track = 'cooking';
  assert.ok(validatePack(p).some((e) => e.includes('track')));
});

test('requireTrack: thiếu track bị từ chối', () => {
  const p = makePack('2026-07-02');
  delete p.track;
  assert.ok(validatePack(p, { requireTrack: true }).some((e) => e.includes('track')));
});

test('trường interview cũ được bỏ qua, không lỗi', () => {
  const p = makePack('2026-07-02');
  p.interview = [{ question: 'x', type: 'weird' }];
  assert.deepEqual(validatePack(p), []);
});
```

- [ ] **Step 3: Chạy test, xác nhận fail**

Run: `node --test tests/pack.test.mjs`
Expected: FAIL — track validation chưa tồn tại

- [ ] **Step 4: Sửa `js/pack.js`** — thêm đầu file và thay khối validate interview:

Thêm sau dòng `const isStr = ...`:

```js
export const TRACKS = ['it', 'office', 'sales', 'finance', 'interview'];
```

Đổi chữ ký hàm thành `export function validatePack(pack, { requireTrack = false } = {})` và thêm ngay sau check `theme`:

```js
  if (pack.track !== undefined || requireTrack) {
    if (!TRACKS.includes(pack.track)) err(`track must be one of: ${TRACKS.join('|')}`);
  }
```

XOÁ toàn bộ khối `if (!Array.isArray(pack.interview) ...) { ... }` (khối validate interview, dòng 53-64 file hiện tại).

- [ ] **Step 5: Chạy toàn bộ test**

Run: `npm test`
Expected: PASS (data.test dùng makePack mới — không còn interview nhưng validatePack không đòi nữa)

- [ ] **Step 6: Commit**

```bash
git add js/pack.js tests/pack.test.mjs tests/helpers.mjs
git commit -m "feat: pack schema v2 - track field, drop interview section"
```

---

### Task 4: Migration dữ liệu + `scripts/validate-data.mjs` v2

**Files:**
- Create: `scripts/migrate-v2-data.mjs` (chạy 1 lần rồi giữ lại làm tài liệu)
- Modify: `scripts/validate-data.mjs`, `data/index.json`, đổi tên toàn bộ `data/packs/*.json`

**Interfaces:**
- Produces: mọi pack ở `data/packs/YYYY-MM-DD-<track>.json` có `track`, không còn `interview`; `data/index.json` format mới `[{ "date": "YYYY-MM-DD", "tracks": ["it"] }, ...]` tăng dần theo ngày. `validate-data` hiểu format mới (và entry string legacy), check trùng từ TRONG TỪNG track.

- [ ] **Step 1: Viết `scripts/migrate-v2-data.mjs`**

```js
// Chạy 1 lần: chuyển dữ liệu v1 -> v2 (thêm track "it", bỏ interview, đổi tên file, index mới).
import { readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';

const files = readdirSync('data/packs').filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f));
const dates = [];
for (const f of files) {
  const date = f.replace('.json', '');
  const pack = JSON.parse(readFileSync(`data/packs/${f}`, 'utf8'));
  pack.track = 'it';
  delete pack.interview;
  writeFileSync(`data/packs/${date}-it.json`, `${JSON.stringify(pack, null, 2)}\n`);
  rmSync(`data/packs/${f}`);
  dates.push(date);
}
dates.sort();
writeFileSync('data/index.json', `${JSON.stringify(dates.map((date) => ({ date, tracks: ['it'] })))}\n`);
console.log(`Migrated ${dates.length} packs`);
```

- [ ] **Step 2: Thay `scripts/validate-data.mjs`**

```js
import { readFileSync, readdirSync } from 'node:fs';
import { validatePack, TRACKS } from '../js/pack.js';

const raw = JSON.parse(readFileSync('data/index.json', 'utf8'));
let failed = false;
const fail = (msg) => { console.error(msg); failed = true; };

// entry string legacy = { date, tracks: ['it'] } tại đường dẫn cũ
const entries = raw.map((e) => (typeof e === 'string' ? { date: e, tracks: ['it'], legacy: true } : e));
const expected = new Set();
const seenWords = Object.fromEntries(TRACKS.map((t) => [t, new Set()]));
let packCount = 0;

for (const e of entries) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) fail(`index: bad date "${e.date}"`);
  if (!Array.isArray(e.tracks) || e.tracks.length === 0) { fail(`index ${e.date}: tracks missing`); continue; }
  for (const t of e.tracks) {
    if (!TRACKS.includes(t)) { fail(`index ${e.date}: unknown track "${t}"`); continue; }
    const file = e.legacy ? `${e.date}.json` : `${e.date}-${t}.json`;
    expected.add(file);
    let pack;
    try {
      pack = JSON.parse(readFileSync(`data/packs/${file}`, 'utf8'));
    } catch {
      fail(`index lists ${e.date} (${t}) but data/packs/${file} is missing/bad JSON`);
      continue;
    }
    const errors = validatePack(pack, { requireTrack: !e.legacy });
    if (pack.date !== e.date) errors.push(`date field "${pack.date}" != index "${e.date}"`);
    if (!e.legacy && pack.track !== t) errors.push(`track field "${pack.track}" != filename track "${t}"`);
    for (const v of pack.vocab || []) {
      const w = v.word?.toLowerCase();
      if (seenWords[t].has(w)) errors.push(`duplicate word in track ${t}: "${v.word}"`);
      seenWords[t].add(w);
    }
    if (errors.length) {
      fail(`${file}:`);
      for (const er of errors) console.error(`  - ${er}`);
    }
    packCount++;
  }
}

for (const f of readdirSync('data/packs').filter((f) => f.endsWith('.json'))) {
  if (!expected.has(f)) fail(`data/packs/${f} exists but is missing from index.json`);
}

if (failed) { console.error('FAILED'); process.exit(1); }
console.log(`OK: ${packCount} packs across ${entries.length} dates`);
```

- [ ] **Step 3: Chạy migration + validate**

Run: `node scripts/migrate-v2-data.mjs && npm run validate-data`
Expected: `Migrated 30 packs` rồi `OK: 30 packs across 30 dates`

- [ ] **Step 4: Kiểm tra bằng mắt** — `ls data/packs | head -3` phải ra `2026-07-02-it.json ...`; `head -c 200 data/index.json` phải ra format object.

- [ ] **Step 5: Commit**

```bash
git add -A data scripts
git commit -m "feat: migrate content data to v2 track layout"
```

---

### Task 5: `js/data.js` v2 — tải gói theo track

**Files:**
- Modify: `js/data.js`
- Test: `tests/data.test.mjs`

**Interfaces:**
- Consumes: `validatePack` (Task 3).
- Produces: `normalizeIndex(raw) -> [{date, tracks, legacy?}]`; `loadIndex(fetchFn=fetch)`; `packPath(entry, track) -> string`; `loadPack(entry, track, fetchFn) -> pack|null`; `loadLatestPack(today, track = 'it', fetchFn = fetch) -> pack` — tìm gói mới nhất `date <= today` của track; nếu track không có gói nào hợp lệ thì fallback toàn bộ sang track `it`; hết cách thì throw `Error('no valid pack')`.

- [ ] **Step 1: Thay `tests/data.test.mjs`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLatestPack, normalizeIndex, packPath } from '../js/data.js';
import { makePack } from './helpers.mjs';

function stubFetch(files) {
  return async (url) => {
    if (url in files) return { ok: true, json: async () => files[url] };
    return { ok: false, json: async () => { throw new Error('404'); } };
  };
}

const IDX = 'data/index.json';

test('normalizeIndex: entry string legacy thành {date, tracks:[it]}', () => {
  const [a, b] = normalizeIndex(['2026-07-01', { date: '2026-07-02', tracks: ['office'] }]);
  assert.deepEqual({ date: a.date, tracks: a.tracks }, { date: '2026-07-01', tracks: ['it'] });
  assert.equal(packPath(a, 'it'), 'data/packs/2026-07-01.json');
  assert.equal(packPath(b, 'office'), 'data/packs/2026-07-02-office.json');
});

test('tải gói hôm nay đúng track', async () => {
  const f = stubFetch({
    [IDX]: [{ date: '2026-07-04', tracks: ['it', 'office'] }],
    'data/packs/2026-07-04-office.json': makePack('2026-07-04', 'office'),
  });
  const p = await loadLatestPack('2026-07-04', 'office', f);
  assert.equal(p.track, 'office');
});

test('bỏ ngày tương lai, ưu tiên gói cũ hơn CỦA TRACK trước khi fallback', async () => {
  const f = stubFetch({
    [IDX]: [
      { date: '2026-07-01', tracks: ['it', 'sales'] },
      { date: '2026-07-03', tracks: ['it'] },
      { date: '2026-07-09', tracks: ['it', 'sales'] },
    ],
    'data/packs/2026-07-01-sales.json': makePack('2026-07-01', 'sales'),
    'data/packs/2026-07-01-it.json': makePack('2026-07-01', 'it'),
    'data/packs/2026-07-03-it.json': makePack('2026-07-03', 'it'),
  });
  const p = await loadLatestPack('2026-07-04', 'sales', f);
  assert.equal(p.track, 'sales'); // gói sales 07-01 thắng gói it 07-03
});

test('track không có gói nào -> fallback it', async () => {
  const f = stubFetch({
    [IDX]: [{ date: '2026-07-03', tracks: ['it'] }],
    'data/packs/2026-07-03-it.json': makePack('2026-07-03', 'it'),
  });
  const p = await loadLatestPack('2026-07-04', 'finance', f);
  assert.equal(p.track, 'it');
});

test('gói lỗi schema bị bỏ qua, lấy ngày cũ hơn', async () => {
  const f = stubFetch({
    [IDX]: [{ date: '2026-07-01', tracks: ['it'] }, { date: '2026-07-02', tracks: ['it'] }],
    'data/packs/2026-07-02-it.json': { date: '2026-07-02' },
    'data/packs/2026-07-01-it.json': makePack('2026-07-01', 'it'),
  });
  const p = await loadLatestPack('2026-07-02', 'it', f);
  assert.equal(p.date, '2026-07-01');
});

test('index legacy string vẫn đọc được (đường dẫn cũ)', async () => {
  const legacy = makePack('2026-07-01');
  delete legacy.track;
  const f = stubFetch({ [IDX]: ['2026-07-01'], 'data/packs/2026-07-01.json': legacy });
  const p = await loadLatestPack('2026-07-02', 'it', f);
  assert.equal(p.date, '2026-07-01');
});

test('không có gì hợp lệ -> throw', async () => {
  const f = stubFetch({ [IDX]: [] });
  await assert.rejects(() => loadLatestPack('2026-07-02', 'it', f), /no valid pack/);
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `node --test tests/data.test.mjs`
Expected: FAIL — `normalizeIndex` chưa export

- [ ] **Step 3: Thay `js/data.js`**

```js
import { validatePack } from './pack.js';

// entry string là format index v1 -> coi như track "it" tại đường dẫn cũ
export function normalizeIndex(raw) {
  return raw.map((e) => (typeof e === 'string' ? { date: e, tracks: ['it'], legacy: true } : e));
}

export function packPath(entry, track) {
  return entry.legacy ? `data/packs/${entry.date}.json` : `data/packs/${entry.date}-${track}.json`;
}

export async function loadIndex(fetchFn = fetch) {
  const res = await fetchFn('data/index.json');
  if (!res.ok) throw new Error('no valid pack');
  return normalizeIndex(await res.json());
}

export async function loadPack(entry, track, fetchFn = fetch) {
  const r = await fetchFn(packPath(entry, track));
  if (!r.ok) return null;
  const pack = await r.json();
  return validatePack(pack).length === 0 ? pack : null;
}

export async function loadLatestPack(today, track = 'it', fetchFn = fetch) {
  const entries = (await loadIndex(fetchFn))
    .filter((e) => e.date <= today)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const tries = track === 'it' ? ['it'] : [track, 'it'];
  for (const tr of tries) {
    for (const e of entries) {
      if (!e.tracks.includes(tr)) continue;
      try {
        const pack = await loadPack(e, tr, fetchFn);
        if (pack) return pack;
      } catch {
        // gói lỗi — thử ngày cũ hơn
      }
    }
  }
  throw new Error('no valid pack');
}
```

- [ ] **Step 4: Chạy toàn bộ test**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/data.js tests/data.test.mjs
git commit -m "feat: track-aware pack loading with it-fallback"
```

---

### Task 6: Gói mồi cho 4 track mới

**Files:**
- Create: `data/packs/2026-07-04-office.json`, `...-sales.json`, `...-finance.json`, `...-interview.json` và tương tự cho `2026-07-05`, `2026-07-06` (12 file)
- Modify: `data/index.json` (3 entry đầu tiên của các ngày 07-04/05/06 thêm 4 track mới)

**Interfaces:**
- Consumes: schema Task 3, validator Task 4.
- Produces: mỗi track có ≥3 gói để app dùng được ngay.

- [ ] **Step 1: Soạn 12 gói theo mẫu.** Mẫu ĐẦY ĐỦ cho `data/packs/2026-07-04-office.json` (dùng đúng cấu trúc này cho 11 gói còn lại, thay nội dung):

```json
{
  "date": "2026-07-04",
  "track": "office",
  "theme": "Small talk before a meeting",
  "vocab": [
    { "word": "catch up", "ipa": "/kætʃ ʌp/", "meaning_vi": "hàn huyên, cập nhật tin tức với ai đó", "example": "Let's catch up over coffee before the meeting starts.", "example_vi": "Mình hàn huyên chút bên cà phê trước khi họp nhé." },
    { "word": "commute", "ipa": "/kəˈmjuːt/", "meaning_vi": "quãng đường đi làm", "example": "How was your commute this morning? The traffic looked terrible.", "example_vi": "Sáng nay đi làm thế nào? Đường có vẻ tắc lắm." },
    { "word": "long weekend", "ipa": "/lɒŋ ˈwiːkend/", "meaning_vi": "kỳ nghỉ cuối tuần dài (dính lễ)", "example": "Did you go anywhere for the long weekend?", "example_vi": "Cuối tuần dài vừa rồi bạn có đi đâu không?" },
    { "word": "swamped", "ipa": "/swɒmpt/", "meaning_vi": "ngập việc, quá bận", "example": "I'm swamped this week — three deadlines on Friday.", "example_vi": "Tuần này tôi ngập việc — thứ Sáu có ba deadline." },
    { "word": "grab", "ipa": "/ɡræb/", "meaning_vi": "lấy nhanh, tranh thủ (đồ ăn, đồ uống)", "example": "I'm going to grab a coffee. Do you want anything?", "example_vi": "Tôi đi lấy cà phê đây. Bạn có muốn gì không?" },
    { "word": "settle in", "ipa": "/ˈsetl ɪn/", "meaning_vi": "quen dần với chỗ mới", "example": "Are you settling in well at the new office?", "example_vi": "Bạn quen với văn phòng mới chưa?" },
    { "word": "run late", "ipa": "/rʌn leɪt/", "meaning_vi": "bị muộn giờ", "example": "Sorry, I'm running late — start without me.", "example_vi": "Xin lỗi, tôi đến muộn — mọi người cứ bắt đầu trước." },
    { "word": "weekend plans", "ipa": "/ˈwiːkend plænz/", "meaning_vi": "kế hoạch cuối tuần", "example": "Any weekend plans, or just relaxing at home?", "example_vi": "Cuối tuần có kế hoạch gì không, hay ở nhà nghỉ ngơi?" }
  ],
  "listening": {
    "title": "Chatting in the pantry",
    "lines": [
      { "speaker": "Linh", "voice": "female", "text": "Morning, Nam! I'm going to grab a coffee before the nine o'clock meeting. Want one?" },
      { "speaker": "Nam", "voice": "male", "text": "Oh yes, please. How was your commute? The rain was crazy this morning." },
      { "speaker": "Linh", "voice": "female", "text": "Terrible. It took me almost an hour. Anyway, how was your long weekend?" },
      { "speaker": "Nam", "voice": "male", "text": "Really nice. We went to Da Lat with my family. And you?" },
      { "speaker": "Linh", "voice": "female", "text": "I just stayed home. I was swamped with the quarterly report, to be honest." },
      { "speaker": "Nam", "voice": "male", "text": "That report again? You should ask Minh to help you with the numbers." },
      { "speaker": "Linh", "voice": "female", "text": "Good idea. Oh, it's almost nine — Hoa said she's running late, so we can settle in slowly." },
      { "speaker": "Nam", "voice": "male", "text": "Perfect. Let's catch up more at lunch." }
    ],
    "questions": [
      { "q": "Where did Nam go for the long weekend?", "options": ["Da Lat", "Home", "The office"], "answer": 0 },
      { "q": "Why did Linh stay home at the weekend?", "options": ["She was sick", "She was swamped with a report", "She had guests"], "answer": 1 },
      { "q": "Who is running late for the meeting?", "options": ["Linh", "Minh", "Hoa"], "answer": 2 }
    ]
  },
  "shadowing": [
    "How was your weekend? Did you do anything special?",
    "Sorry I'm running late — please start without me.",
    "I'm a bit swamped this week, can we catch up on Friday?",
    "I'm going to grab a coffee, do you want anything?",
    "It's been a busy morning, but things are settling down now."
  ]
}
```

- [ ] **Step 2: Soạn 11 gói còn lại** theo đúng cấu trúc trên, tuân thủ:
  - Chủ đề lấy từ danh sách track trong `routine/PROMPT.md` mới (Task 16 có danh sách — dùng trước 3 chủ đề đầu của mỗi track): office (Small talk trước giờ họp · Viết email & follow-up · Xin nghỉ phép), sales (Cold call khách mới · Demo sản phẩm cho khách · Xử lý khi khách từ chối), finance (Trình bày báo cáo tháng · Ngân sách & cắt giảm chi phí · Hoá đơn và thanh toán), interview (Giới thiệu bản thân · Điểm mạnh điểm yếu · Kể về dự án đáng nhớ).
  - Track `interview`: hội thoại là buổi phỏng vấn (interviewer + candidate), shadowing là 5 câu trả lời mẫu ngắn kiểu STAR, vocab là từ hay dùng khi phỏng vấn.
  - Đúng 8 vocab / hội thoại 8 lượt + 3 câu hỏi / 5 câu shadowing, trình độ B1, KHÔNG trùng `word` trong cùng track, nhân vật tên Việt.
- [ ] **Step 3: Cập nhật `data/index.json`** — 3 entry của `2026-07-04`, `2026-07-05`, `2026-07-06` đổi thành `{"date":"2026-07-04","tracks":["it","office","sales","finance","interview"]}` (tương tự 2 ngày kia).
- [ ] **Step 4: Validate**

Run: `npm run validate-data`
Expected: `OK: 42 packs across 30 dates`

- [ ] **Step 5: Commit**

```bash
git add data
git commit -m "content: seed packs for office/sales/finance/interview tracks"
```

---

### Task 7: `js/prompt.js` — dựng prompt AI

**Files:**
- Create: `js/prompt.js`
- Test: `tests/prompt.test.mjs`

**Interfaces:**
- Consumes: pack (theme, vocab), profile (level, goals, aiApp).
- Produces: `AI_APPS = { chatgpt: {name, url(prompt)}, claude: {...}, gemini: {...}, other: {...} }` — `url()` trả string hoặc `null` (other); `buildPrompt(kind, pack, profile) -> string` (kind: conversation|speaking|writing); `taskDesc(kind, pack) -> string` (mô tả tiếng Việt cho thẻ); `buildAiTestPrompt(words, themes, profile) -> string`.

- [ ] **Step 1: Viết test fail**

```js
// tests/prompt.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AI_APPS, buildPrompt, taskDesc, buildAiTestPrompt } from '../js/prompt.js';
import { makePack } from './helpers.mjs';

const profile = { track: 'it', level: 'b1', goals: ['work', 'email'], minutes: 30, aiApp: 'chatgpt' };

test('buildPrompt chứa theme, từ vựng, trình độ và yêu cầu tổng kết tiếng Việt', () => {
  const pack = makePack('2026-07-04');
  for (const kind of ['conversation', 'speaking', 'writing']) {
    const p = buildPrompt(kind, pack, profile);
    assert.ok(p.includes(pack.theme), `${kind} thiếu theme`);
    assert.ok(p.includes(pack.vocab[0].word), `${kind} thiếu vocab`);
    assert.ok(/B1/.test(p), `${kind} thiếu level`);
    assert.ok(/Vietnamese/.test(p), `${kind} thiếu yêu cầu tổng kết`);
  }
});

test('AI_APPS: chatgpt/claude prefill qua ?q=, gemini không prefill, other không mở url', () => {
  assert.ok(AI_APPS.chatgpt.url('hello world').startsWith('https://chatgpt.com/?q=hello%20world'));
  assert.ok(AI_APPS.claude.url('xin chào').startsWith('https://claude.ai/new?q=xin%20ch'));
  assert.equal(AI_APPS.gemini.url('abc'), 'https://gemini.google.com/app');
  assert.equal(AI_APPS.other.url('abc'), null);
});

test('taskDesc trả mô tả tiếng Việt có theme', () => {
  const pack = makePack('2026-07-04');
  assert.ok(taskDesc('writing', pack).includes(pack.theme));
});

test('buildAiTestPrompt gồm từ vựng và chủ đề của kỳ', () => {
  const p = buildAiTestPrompt(['blocker', 'deploy'], ['Daily standup', 'Code review'], profile);
  assert.ok(p.includes('blocker') && p.includes('Code review'));
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `node --test tests/prompt.test.mjs`
Expected: FAIL — module chưa tồn tại

- [ ] **Step 3: Viết `js/prompt.js`**

```js
// Dựng prompt mở ChatGPT/Claude/Gemini cho 3 hoạt động thực hành + kiểm tra định kỳ.
export const AI_APPS = {
  chatgpt: { name: 'ChatGPT', url: (p) => `https://chatgpt.com/?q=${encodeURIComponent(p)}` },
  claude: { name: 'Claude', url: (p) => `https://claude.ai/new?q=${encodeURIComponent(p)}` },
  gemini: { name: 'Gemini', url: () => 'https://gemini.google.com/app' },
  other: { name: 'app AI', url: () => null },
};

const LEVEL_EN = {
  a2: 'beginner (CEFR A2)',
  b1: 'intermediate (CEFR B1)',
  b2: 'upper-intermediate (CEFR B2+)',
};

const GOAL_EN = {
  work: 'communicating at work',
  interview: 'preparing for job interviews',
  email: 'writing professional emails',
  presentation: 'giving presentations',
  smalltalk: 'making small talk with colleagues',
};

const SCENARIO = {
  conversation: (theme) => `Let's do a roleplay conversation about "${theme}". You play the other person (a colleague, customer, or interviewer — whichever fits the topic). Keep each of your turns short (1-3 sentences) and wait for my reply. Gently correct my mistakes as we go.`,
  speaking: (theme) => `I want to practice speaking. Give me one short speaking task at a time about "${theme}" (describe, explain, or give my opinion). After each answer, point out my grammar and word-choice mistakes and show a better way to say it. Give me 3 tasks in total.`,
  writing: (theme) => `I want to practice writing. Give me one realistic workplace writing task about "${theme}" (a short email or message, 80-120 words). After I submit my text, correct it line by line, explain the mistakes simply, then show an improved version.`,
};

export function buildPrompt(kind, pack, profile) {
  const words = (pack.vocab || []).map((v) => v.word).join(', ');
  const goals = (profile.goals || []).map((g) => GOAL_EN[g]).filter(Boolean).join('; ');
  return [
    `You are my English coach. My level is ${LEVEL_EN[profile.level] || LEVEL_EN.b1}. Please use simple English that matches my level.`,
    goals ? `My learning goals: ${goals}.` : '',
    SCENARIO[kind](pack.theme),
    words ? `Today I learned these words — use them naturally and encourage me to use them too: ${words}.` : '',
    'At the end of the session, give me a summary in Vietnamese: my main grammar mistakes, word-choice issues, and 3 concrete tips to improve.',
  ].filter(Boolean).join('\n\n');
}

export function taskDesc(kind, pack) {
  return {
    conversation: `Nhập vai hội thoại chủ đề “${pack.theme}” — AI sửa lỗi trong lúc chat`,
    speaking: `3 đề nói ngắn về “${pack.theme}” — dùng voice mode của app AI`,
    writing: `Viết email/tin nhắn ~100 từ chủ đề “${pack.theme}” — AI chữa từng câu`,
  }[kind];
}

export function buildAiTestPrompt(words, themes, profile) {
  return [
    `You are my English examiner. My level is ${LEVEL_EN[profile.level] || LEVEL_EN.b1}.`,
    `Test my English on these workplace topics I studied recently: ${themes.join('; ')}.`,
    `Focus on this vocabulary: ${words.join(', ')}.`,
    'Ask me 5 questions one by one (mix short speaking-style answers and one short writing task). After all 5, give me a score out of 10 and a summary in Vietnamese: strengths, mistakes, and what to review.',
  ].join('\n\n');
}
```

- [ ] **Step 4: Chạy test**

Run: `node --test tests/prompt.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/prompt.js tests/prompt.test.mjs
git commit -m "feat: AI practice prompt builder"
```

---

### Task 8: `js/icons.js` + `js/profile-options.js`

**Files:**
- Modify: `js/icons.js`
- Create: `js/profile-options.js`

**Interfaces:**
- Produces: icon mới `gear, message, pencil, search, external, history, dumbbell, x`; options dùng chung cho onboarding + settings: `TRACK_OPTIONS/LEVEL_OPTIONS/GOAL_OPTIONS/MINUTE_OPTIONS/AI_APP_OPTIONS` (mảng `{value, label, desc?}`) và `TRACK_LABEL` (map value→label).

- [ ] **Step 1: Thêm vào object `icon` trong `js/icons.js`** (trước dấu `};` cuối):

```js
  gear: (s) => svg('<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>', s),
  message: (s) => svg('<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>', s),
  pencil: (s) => svg('<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>', s),
  search: (s) => svg('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>', s),
  external: (s) => svg('<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>', s),
  history: (s) => svg('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>', s),
  dumbbell: (s) => svg('<path d="M14.4 14.4 9.6 9.6"/><path d="M18.657 21.485a2 2 0 1 1-2.829-2.828l-1.767 1.768a2 2 0 1 1-2.829-2.829l6.364-6.364a2 2 0 1 1 2.829 2.829l-1.768 1.767a2 2 0 1 1 2.828 2.829z"/><path d="m21.5 21.5-1.4-1.4"/><path d="M3.9 3.9 2.5 2.5"/><path d="M6.404 12.768a2 2 0 1 1-2.829-2.829l1.768-1.767a2 2 0 1 1-2.828-2.829l2.828-2.828a2 2 0 1 1 2.829 2.828l1.767-1.768a2 2 0 1 1 2.829 2.829z"/>', s),
  x: (s) => svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', s),
```

- [ ] **Step 2: Viết `js/profile-options.js`**

```js
// Lựa chọn hồ sơ dùng chung cho onboarding + cài đặt.
export const TRACK_OPTIONS = [
  { value: 'it', label: 'IT / Phần mềm', desc: 'Standup, code review, bug, demo sản phẩm' },
  { value: 'office', label: 'Văn phòng chung', desc: 'Họp hành, email, small talk, báo cáo' },
  { value: 'sales', label: 'Sales & Marketing', desc: 'Gặp khách, pitch, đàm phán, follow-up' },
  { value: 'finance', label: 'Tài chính / Kế toán', desc: 'Báo cáo số liệu, ngân sách, kiểm toán' },
  { value: 'interview', label: 'Phỏng vấn xin việc', desc: 'Trả lời phỏng vấn, deal lương' },
];
export const TRACK_LABEL = Object.fromEntries(TRACK_OPTIONS.map((o) => [o.value, o.label]));

export const LEVEL_OPTIONS = [
  { value: 'a2', label: 'Sơ cấp (A2)', desc: 'Nghe nói cơ bản, vốn từ còn ít' },
  { value: 'b1', label: 'Trung cấp (B1)', desc: 'Giao tiếp được nhưng chưa tự tin' },
  { value: 'b2', label: 'Khá (B2+)', desc: 'Khá tự tin, muốn trau chuốt hơn' },
];

export const GOAL_OPTIONS = [
  { value: 'work', label: 'Giao tiếp trong công việc' },
  { value: 'interview', label: 'Chuẩn bị phỏng vấn' },
  { value: 'email', label: 'Viết email chuyên nghiệp' },
  { value: 'presentation', label: 'Thuyết trình' },
  { value: 'smalltalk', label: 'Small talk với đồng nghiệp' },
];

export const MINUTE_OPTIONS = [
  { value: 15, label: '15 phút / ngày', desc: 'Từ vựng + Nghe + Shadowing' },
  { value: 30, label: '30 phút / ngày', desc: 'Cốt lõi + 1 hoạt động với AI' },
  { value: 45, label: '45+ phút / ngày', desc: 'Cốt lõi + 2 hoạt động với AI' },
];

export const AI_APP_OPTIONS = [
  { value: 'chatgpt', label: 'ChatGPT' },
  { value: 'claude', label: 'Claude' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'other', label: 'App khác (chỉ copy prompt)' },
];
```

- [ ] **Step 3: Sanity + commit**

Run: `node --check js/icons.js && node --check js/profile-options.js && npm test`
Expected: không lỗi, tests PASS

```bash
git add js/icons.js js/profile-options.js
git commit -m "feat: new icons + shared profile options"
```

---

### Task 9: `js/views/practice.js` — tab Luyện tập

**Files:**
- Create: `js/views/practice.js`
- Modify: `css/app.css` (append cuối file)

**Interfaces:**
- Consumes: `speak/listenOnce/sttSupported` (speech.js), `compare` (diff.js), `icon`, `buildPrompt/taskDesc/AI_APPS` (Task 7), `aiKindsFor` (Task 1), store methods `setAiDone/isAiDone/markActivity/addSpeakingSeconds` (Task 2).
- Produces: `render(el, ctx)` — phần Shadowing giữ nguyên hành vi speaking.js cũ; phần AI 3 thẻ với nút mở app + toggle xong.

- [ ] **Step 1: Viết `js/views/practice.js`**

```js
import { speak, listenOnce, sttSupported } from '../speech.js';
import { compare } from '../diff.js';
import { icon } from '../icons.js';
import { buildPrompt, taskDesc, AI_APPS } from '../prompt.js';
import { AI_KINDS, aiKindsFor } from '../plan.js';

const ERROR_MSG = {
  'not-allowed': 'Micro bị chặn — vào Cài đặt Chrome ▸ Quyền của trang để bật micro.',
  'service-not-allowed': 'Micro bị chặn — vào Cài đặt Chrome ▸ Quyền của trang để bật micro.',
  network: 'Cần kết nối mạng để nhận giọng nói.',
  'no-speech': 'Không nghe thấy gì, thử nói lại nhé.',
};

const AI_META = {
  conversation: { ico: 'message', title: 'Hội thoại với AI' },
  speaking: { ico: 'mic', title: 'Nói tự do với AI' },
  writing: { ico: 'pencil', title: 'Viết với AI' },
};

function toast(el, msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  el.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

export function render(el, ctx) {
  const { store, pack } = ctx;
  if (!pack) {
    el.innerHTML = '<p class="error">Chưa tải được bài học.</p>';
    return;
  }
  const profile = store.state.profile || { level: 'b1', goals: [], minutes: 15, aiApp: 'other' };
  const app = AI_APPS[profile.aiApp] || AI_APPS.other;
  const planned = aiKindsFor(ctx.today, profile.minutes);
  const sentences = pack.shadowing;
  const best = store.state.bestScores;

  const maybeComplete = () => {
    if (sentences.every((s) => best[s] != null)) store.markActivity(ctx.today, 'speaking');
  };

  function draw() {
    el.innerHTML = `
      <header class="page-head"><h1>Luyện tập</h1></header>

      <h2>Shadowing</h2>
      ${sttSupported ? '' : '<p class="warn">Trình duyệt này không hỗ trợ nhận giọng nói — bạn vẫn nghe và đọc theo câu mẫu được.</p>'}
      ${sentences.map((s, i) => `
        <div class="shadow-item">
          <p class="sentence">${s}</p>
          <div class="row">
            <button class="pill play" data-i="${i}">${icon.play(14)} Nghe</button>
            <button class="pill play slow" data-i="${i}">${icon.turtle(14)} 0.75x</button>
            ${sttSupported ? `<button class="pill mic" data-i="${i}">${icon.mic(14)} Nói</button>` : ''}
            <span class="score" id="score-${i}">${best[s] != null ? `${best[s]}%` : ''}</span>
          </div>
          <div class="result" id="res-${i}"></div>
        </div>`).join('')}

      <h2>Thực hành với AI</h2>
      <p class="meta" style="margin-bottom:10px">Mở ${app.name} với prompt soạn sẵn theo bài hôm nay, xong quay lại đánh dấu ✓</p>
      <div class="ai-cards">
        ${AI_KINDS.map((k) => {
          const done = store.isAiDone(ctx.today, k);
          return `
          <div class="ai-card ${done ? 'done' : ''}">
            <div class="head">
              <span class="tile">${icon[AI_META[k].ico](18)}</span>
              <b>${AI_META[k].title}</b>
              ${planned.includes(k) ? '<span class="badge">kế hoạch hôm nay</span>' : ''}
            </div>
            <p class="desc">${taskDesc(k, pack)}</p>
            <div class="row">
              <button class="pill open-ai" data-kind="${k}">${icon.external(14)} Mở ${app.name}</button>
              <button class="pill mark-ai ${done ? 'on' : ''}" data-kind="${k}">${done ? `${icon.check(14)} Đã xong` : 'Đánh dấu xong'}</button>
            </div>
            <div class="prompt-fallback" id="fb-${k}" hidden>
              <p class="meta">Copy thủ công prompt dưới đây rồi dán vào ${app.name}:</p>
              <textarea readonly rows="6"></textarea>
            </div>
          </div>`;
        }).join('')}
      </div>
    `;
    bind();
  }

  function bind() {
    el.querySelectorAll('.play').forEach((b) => {
      b.onclick = () => speak(sentences[+b.dataset.i], { rate: b.classList.contains('slow') ? 0.75 : 1 });
    });

    el.querySelectorAll('.mic').forEach((b) => {
      b.onclick = () => {
        const i = +b.dataset.i;
        const startedAt = Date.now();
        b.innerHTML = `${icon.mic(14)} Đang nghe…`;
        b.classList.add('listening');
        b.disabled = true;
        listenOnce({
          onResult: (transcript) => {
            const { words, score } = compare(sentences[i], transcript);
            document.getElementById(`res-${i}`).innerHTML = words
              .map((w) => `<span class="${w.ok ? 'ok' : 'miss'}">${w.text}</span>`)
              .join('');
            if (score > (best[sentences[i]] ?? -1)) {
              best[sentences[i]] = score;
              store.save();
            }
            document.getElementById(`score-${i}`).textContent = `${score}%`;
            store.addSpeakingSeconds(ctx.today, Math.max(1, Math.round((Date.now() - startedAt) / 1000)));
            maybeComplete();
          },
          onError: (code) => {
            document.getElementById(`res-${i}`).innerHTML = `<span class="msg">${ERROR_MSG[code] || 'Có lỗi, thử lại nhé.'}</span>`;
          },
          onEnd: () => {
            b.innerHTML = `${icon.mic(14)} Nói`;
            b.classList.remove('listening');
            b.disabled = false;
          },
        });
      };
    });

    el.querySelectorAll('.open-ai').forEach((b) => {
      b.onclick = async () => {
        const kind = b.dataset.kind;
        const prompt = buildPrompt(kind, pack, profile);
        let copied = true;
        try {
          await navigator.clipboard.writeText(prompt);
        } catch {
          copied = false;
        }
        const url = app.url(prompt);
        if (url) window.open(url, '_blank');
        if (copied) {
          toast(el, 'Đã copy prompt — nếu ô chat trống, dán vào để bắt đầu.');
        } else {
          // clipboard bị chặn — hiện prompt để copy tay
          const fb = el.querySelector(`#fb-${kind}`);
          fb.hidden = false;
          fb.querySelector('textarea').value = prompt;
        }
      };
    });

    el.querySelectorAll('.mark-ai').forEach((b) => {
      b.onclick = () => {
        const kind = b.dataset.kind;
        store.setAiDone(ctx.today, kind, !store.isAiDone(ctx.today, kind));
        draw();
      };
    });
  }

  draw();
}
```

- [ ] **Step 2: Append CSS cuối `css/app.css`**

```css
/* ============ V2: LUYỆN TẬP / AI CARDS / TOAST ============ */
#view h2 { font-family: var(--font-display); font-size: 17px; margin: 22px 0 10px; }
.ai-cards { display: flex; flex-direction: column; gap: 12px; }
.ai-card { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius); padding: 14px; }
.ai-card.done { border-color: rgba(51, 201, 138, 0.4); }
.ai-card .head { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
.ai-card .tile { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 10px; background: var(--accent-soft); color: var(--accent-light); }
.ai-card .badge { margin-left: auto; font-size: 11px; color: var(--amber); border: 1px solid rgba(245, 166, 35, 0.4); border-radius: 999px; padding: 2px 8px; }
.ai-card .desc { color: var(--muted); font-size: 13.5px; margin-bottom: 10px; }
.ai-card .mark-ai.on { color: var(--green); border-color: rgba(51, 201, 138, 0.4); }
.prompt-fallback textarea { width: 100%; margin-top: 8px; background: var(--surface2); color: var(--text); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 10px; font-family: inherit; font-size: 12.5px; }
.toast { position: fixed; left: 50%; bottom: calc(110px + env(safe-area-inset-bottom)); transform: translateX(-50%); background: var(--surface2); border: 1px solid var(--line-strong); color: var(--text); padding: 10px 16px; border-radius: 999px; font-size: 13px; z-index: 50; max-width: 90vw; animation: fadeUp .25s ease; }
```

- [ ] **Step 3: Sanity + commit**

Run: `node --check js/views/practice.js && npm test`

```bash
git add js/views/practice.js css/app.css
git commit -m "feat: practice tab - shadowing + external AI activities"
```

---

### Task 10: `js/views/review.js` — tab Ôn tập (+ vocab.js ghi track)

**Files:**
- Create: `js/views/review.js`
- Modify: `js/views/vocab.js` (1 dòng), `css/app.css` (append)

**Interfaces:**
- Consumes: `loadIndex/loadPack` (Task 5), `speak/stopSpeaking`, `icon`, `TRACK_LABEL` (Task 8), `srs.isDue` không cần — dùng `reps/interval` trực tiếp.
- Produces: `render(el, ctx)` — segmented "Bài cũ" | "Sổ tay từ vựng".

- [ ] **Step 1: Sửa `js/views/vocab.js`** — khi đăng ký từ mới, lưu thêm track:

Đổi dòng `wordMeta[v.word] = { ipa: v.ipa, meaning_vi: v.meaning_vi, example: v.example, example_vi: v.example_vi };` thành:

```js
        wordMeta[v.word] = { ipa: v.ipa, meaning_vi: v.meaning_vi, example: v.example, example_vi: v.example_vi, track: pack.track || 'it' };
```

- [ ] **Step 2: Viết `js/views/review.js`**

```js
import { loadIndex, loadPack } from '../data.js';
import { speak, stopSpeaking, listenOnce, sttSupported } from '../speech.js';
import { compare } from '../diff.js';
import { icon } from '../icons.js';
import { TRACK_LABEL } from '../profile-options.js';

// Độ nhớ theo SRS: mới / đang học / thuộc
function strength(card) {
  if (!card || card.reps === 0) return 'new';
  return card.interval >= 21 ? 'known' : 'learning';
}
const STRENGTH_LABEL = { new: 'Mới', learning: 'Đang học', known: 'Thuộc' };

export function render(el, ctx) {
  const { store } = ctx;
  const st = { seg: 'packs', track: 'all', query: '', strength: 'all', entries: null, detail: null };

  async function loadEntries() {
    try {
      st.entries = (await loadIndex()).filter((e) => e.date <= ctx.today).sort((a, b) => (a.date < b.date ? 1 : -1));
    } catch {
      st.entries = [];
    }
    draw();
  }

  function packRows() {
    const rows = st.entries.flatMap((e) => e.tracks.map((t) => ({ entry: e, track: t })));
    return st.track === 'all' ? rows : rows.filter((r) => r.track === st.track);
  }

  function wordRows() {
    const { srs, wordMeta } = store.state;
    let words = Object.keys(srs).sort();
    if (st.track !== 'all') words = words.filter((w) => (wordMeta[w]?.track || 'it') === st.track);
    if (st.strength !== 'all') words = words.filter((w) => strength(srs[w]) === st.strength);
    if (st.query) {
      const q = st.query.toLowerCase();
      words = words.filter((w) => w.toLowerCase().includes(q) || (wordMeta[w]?.meaning_vi || '').toLowerCase().includes(q));
    }
    return words;
  }

  function trackChips(withAll = true) {
    const opts = [...(withAll ? [['all', 'Tất cả']] : []), ...Object.entries(TRACK_LABEL)];
    return `<div class="chips">${opts.map(([v, l]) =>
      `<button class="chip ${st.track === v ? 'on' : ''}" data-track="${v}">${l}</button>`).join('')}</div>`;
  }

  function drawDetail() {
    const p = st.detail;
    let playing = false;
    const lang = Number(p.date.slice(8)) % 2 === 0 ? 'en-US' : 'en-GB';
    el.innerHTML = `
      <header class="page-head">
        <button class="pill" id="back">${icon.chevron(14)} Quay lại</button>
        <h1 style="font-size:18px">${p.theme}</h1>
      </header>
      <p class="meta">${p.date} · ${TRACK_LABEL[p.track || 'it']}</p>

      <h2>${p.listening.title}</h2>
      <div class="row">
        <button class="primary" style="width:auto;margin:0" id="playAll">${icon.play(15)} Nghe hội thoại</button>
        <button class="pill" id="stop">${icon.stop(14)} Dừng</button>
      </div>
      <div class="script">${p.listening.lines.map((l) => `
        <div class="line"><div class="bar a"></div>
        <div class="txt"><div class="spk">${l.speaker}</div>${l.text}</div></div>`).join('')}</div>

      <h2>Từ vựng (${p.vocab.length})</h2>
      ${p.vocab.map((v, i) => `
        <div class="word-row">
          <button class="pill play-word" data-i="${i}">${icon.volume(14)}</button>
          <div><b>${v.word}</b> <span class="meta">${v.ipa}</span><br><small>${v.meaning_vi}</small></div>
        </div>`).join('')}

      <h2>Shadowing</h2>
      ${p.shadowing.map((s, i) => `
        <div class="shadow-item"><p class="sentence">${s}</p>
        <div class="row">
          <button class="pill play-sh" data-i="${i}">${icon.play(14)} Nghe</button>
          ${sttSupported ? `<button class="pill mic-sh" data-i="${i}">${icon.mic(14)} Nói</button>` : ''}
          <span class="score" id="rsc-${i}"></span>
        </div>
        <div class="result" id="rres-${i}"></div></div>`).join('')}
    `;
    el.querySelector('#back').onclick = () => { stopSpeaking(); st.detail = null; draw(); };
    el.querySelector('#playAll').onclick = async () => {
      if (playing) return;
      playing = true;
      for (const line of p.listening.lines) {
        if (!playing) return;
        await speak(line.text, { gender: line.voice, lang });
      }
      playing = false;
    };
    el.querySelector('#stop').onclick = () => { playing = false; stopSpeaking(); };
    el.querySelectorAll('.play-word').forEach((b) => { b.onclick = () => speak(p.vocab[+b.dataset.i].word); });
    el.querySelectorAll('.play-sh').forEach((b) => { b.onclick = () => speak(p.shadowing[+b.dataset.i]); });
    el.querySelectorAll('.mic-sh').forEach((b) => {
      b.onclick = () => {
        const i = +b.dataset.i;
        b.disabled = true;
        listenOnce({
          onResult: (t) => {
            const { words, score } = compare(p.shadowing[i], t);
            document.getElementById(`rres-${i}`).innerHTML = words
              .map((w) => `<span class="${w.ok ? 'ok' : 'miss'}">${w.text}</span>`).join('');
            // chỉ hiển thị điểm khi ôn — không ghi đè bestScores/tiến độ ngày cũ
            document.getElementById(`rsc-${i}`).textContent = `${score}%`;
          },
          onEnd: () => { b.disabled = false; },
        });
      };
    });
  }

  function draw() {
    if (st.detail) return drawDetail();
    el.innerHTML = `
      <header class="page-head"><h1>Ôn tập</h1></header>
      <div class="seg">
        <button class="${st.seg === 'packs' ? 'on' : ''}" data-seg="packs">Bài cũ</button>
        <button class="${st.seg === 'words' ? 'on' : ''}" data-seg="words">Sổ tay từ vựng</button>
      </div>
      ${trackChips()}
      ${st.seg === 'packs' ? drawPacks() : drawWords()}
    `;
    el.querySelectorAll('.seg button').forEach((b) => { b.onclick = () => { st.seg = b.dataset.seg; draw(); }; });
    el.querySelectorAll('.chip').forEach((b) => { b.onclick = () => { st.track = b.dataset.track; draw(); }; });
    if (st.seg === 'packs') {
      el.querySelectorAll('.pack-row').forEach((b) => {
        b.onclick = async () => {
          const entry = st.entries.find((e) => e.date === b.dataset.date);
          b.classList.add('loading');
          const p = await loadPack(entry, b.dataset.track).catch(() => null);
          if (p) { st.detail = p; draw(); } else {
            b.classList.remove('loading');
            b.querySelector('small').textContent = 'Không tải được — cần mạng';
          }
        };
      });
    } else {
      const inp = el.querySelector('#q');
      inp.oninput = () => {
        st.query = inp.value;
        el.querySelector('#word-list').innerHTML = drawWordList();
        bindWordList();
      };
      el.querySelectorAll('.schip').forEach((b) => { b.onclick = () => { st.strength = b.dataset.s; draw(); }; });
      bindWordList();
    }
  }

  function drawPacks() {
    if (!st.entries) return '<p class="meta">Đang tải danh sách bài…</p>';
    if (!st.entries.length) return '<p class="error">Không tải được danh sách bài. Kiểm tra mạng nhé.</p>';
    return packRows().map(({ entry, track }) => `
      <button class="pack-row" data-date="${entry.date}" data-track="${track}">
        <b>${entry.date}</b><small>${TRACK_LABEL[track]}</small>
        <span class="trail">${icon.chevron(18)}</span>
      </button>`).join('');
  }

  function drawWordList() {
    const { srs, wordMeta } = store.state;
    const words = wordRows();
    if (!words.length) return '<p class="meta">Chưa có từ nào khớp bộ lọc.</p>';
    return words.map((w) => {
      const m = wordMeta[w] || {};
      return `
      <div class="word-row expandable" data-w="${w}">
        <button class="pill play-w" data-w="${w}">${icon.volume(14)}</button>
        <div><b>${w}</b> <span class="sbadge s-${strength(srs[w])}">${STRENGTH_LABEL[strength(srs[w])]}</span>
          <br><small>${m.meaning_vi || ''}</small>
          <div class="word-detail" hidden><small>${m.ipa || ''}</small><p>${m.example || ''}</p><p class="meta">${m.example_vi || ''}</p></div>
        </div>
      </div>`;
    }).join('');
  }

  function drawWords() {
    return `
      <div class="searchbar">${icon.search(16)}<input id="q" placeholder="Tìm từ hoặc nghĩa…" value="${st.query}"></div>
      <div class="chips">
        ${['all', 'new', 'learning', 'known'].map((s) =>
          `<button class="chip schip ${st.strength === s ? 'on' : ''}" data-s="${s}">${s === 'all' ? 'Mọi mức nhớ' : STRENGTH_LABEL[s]}</button>`).join('')}
      </div>
      <div id="word-list">${drawWordList()}</div>`;
  }

  function bindWordList() {
    el.querySelectorAll('.play-w').forEach((b) => {
      b.onclick = (e) => { e.stopPropagation(); speak(b.dataset.w); };
    });
    el.querySelectorAll('.expandable').forEach((r) => {
      r.onclick = () => { const d = r.querySelector('.word-detail'); d.hidden = !d.hidden; };
    });
  }

  draw();
  loadEntries();
}
```

- [ ] **Step 3: Append CSS cuối `css/app.css`**

```css
/* ============ V2: ÔN TẬP ============ */
.seg { display: flex; background: var(--surface2); border-radius: 999px; padding: 4px; margin-bottom: 14px; }
.seg button { flex: 1; border: none; background: none; color: var(--muted); padding: 9px; border-radius: 999px; font-family: inherit; font-size: 13.5px; cursor: pointer; }
.seg button.on { background: var(--accent); color: #fff; }
.chips { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }
.chip { border: 1px solid var(--line-strong); background: var(--card); color: var(--muted); border-radius: 999px; padding: 6px 12px; font-size: 12.5px; font-family: inherit; cursor: pointer; }
.chip.on { border-color: var(--accent); color: var(--accent-light); background: var(--accent-soft); }
.pack-row { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 13px 14px; margin-bottom: 8px; color: var(--text); font-family: inherit; cursor: pointer; }
.pack-row small { color: var(--muted); }
.pack-row .trail { margin-left: auto; color: var(--faint); }
.pack-row.loading { opacity: .5; }
.searchbar { display: flex; align-items: center; gap: 8px; background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 10px 12px; margin-bottom: 12px; color: var(--faint); }
.searchbar input { flex: 1; background: none; border: none; color: var(--text); font-family: inherit; font-size: 14px; outline: none; }
.word-row { display: flex; gap: 12px; align-items: flex-start; background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 12px; margin-bottom: 8px; }
.word-row small { color: var(--muted); }
.sbadge { font-size: 10.5px; border-radius: 999px; padding: 2px 7px; margin-left: 6px; }
.s-new { background: var(--accent-soft); color: var(--accent-light); }
.s-learning { background: rgba(245, 166, 35, 0.15); color: var(--amber); }
.s-known { background: rgba(51, 201, 138, 0.15); color: var(--green); }
.word-detail p { font-size: 13px; margin-top: 4px; }
```

- [ ] **Step 4: Sanity + commit**

Run: `node --check js/views/review.js && npm test`

```bash
git add js/views/review.js js/views/vocab.js css/app.css
git commit -m "feat: review tab - past packs + vocabulary notebook"
```

---

### Task 11: Onboarding + Cài đặt

**Files:**
- Create: `js/views/onboarding.js`, `js/views/settings.js`
- Modify: `css/app.css` (append)

**Interfaces:**
- Consumes: options Task 8, `store.setProfile`, `store.exportData/importData`, `icon`.
- Produces: `onboarding.render(el, ctx)` — wizard 5 bước, xong gọi `store.setProfile` + `location.reload()`. `settings.render(el, ctx)` — sửa hồ sơ + backup/restore; đổi track thì reload.

- [ ] **Step 1: Viết `js/views/onboarding.js`**

```js
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
```

- [ ] **Step 2: Viết `js/views/settings.js`**

```js
import { icon } from '../icons.js';
import { TRACK_OPTIONS, LEVEL_OPTIONS, GOAL_OPTIONS, MINUTE_OPTIONS, AI_APP_OPTIONS } from '../profile-options.js';

export function render(el, ctx) {
  const { store } = ctx;
  const p = store.state.profile || {};
  const draft = { track: p.track || 'it', level: p.level || 'b1', goals: [...(p.goals || [])], minutes: p.minutes || 15, aiApp: p.aiApp || 'chatgpt' };

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
      ${group('Lĩnh vực', TRACK_OPTIONS, 'track')}
      ${group('Trình độ', LEVEL_OPTIONS, 'level')}
      ${group('Mục tiêu', GOAL_OPTIONS, 'goals', true)}
      ${group('Thời gian mỗi ngày', MINUTE_OPTIONS, 'minutes')}
      ${group('App AI ưa thích', AI_APP_OPTIONS, 'aiApp')}
      <button class="primary" id="saveProfile">Lưu cài đặt</button>

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
          draft[key] = key === 'minutes' ? Number(v) : v;
        }
        draw();
      };
    });
    el.querySelector('#saveProfile').onclick = () => {
      const trackChanged = draft.track !== (store.state.profile?.track || 'it');
      store.setProfile({ ...store.state.profile, ...draft });
      if (trackChanged) {
        location.hash = '';
        location.reload(); // tải lại gói theo track mới
      } else {
        el.querySelector('#msg').textContent = 'Đã lưu ✓';
      }
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
```

- [ ] **Step 3: Append CSS cuối `css/app.css`**

```css
/* ============ V2: ONBOARDING + CÀI ĐẶT ============ */
.onboard { padding-top: 24px; }
.onboard h1 { font-family: var(--font-display); font-size: 22px; margin-bottom: 6px; }
.ob-dots { display: flex; gap: 6px; margin-bottom: 26px; }
.ob-dots i { height: 4px; flex: 1; border-radius: 2px; background: var(--surface2); }
.ob-dots i.on { background: var(--accent); }
.ob-options { display: flex; flex-direction: column; gap: 10px; margin: 18px 0 24px; }
.ob-opt { display: flex; align-items: center; gap: 10px; text-align: left; background: var(--card); border: 1px solid var(--line); border-radius: var(--radius); padding: 14px; color: var(--text); font-family: inherit; cursor: pointer; }
.ob-opt.on { border-color: var(--accent); background: var(--accent-soft); }
.ob-opt small { display: block; color: var(--muted); margin-top: 2px; }
.ob-opt .trail { margin-left: auto; color: var(--accent-light); }
.ob-nav { display: flex; justify-content: space-between; align-items: center; }
.set-group { margin-bottom: 18px; }
.set-group > b { display: block; margin-bottom: 8px; }
.pill.wide { width: 100%; justify-content: center; margin-top: 10px; padding: 13px; }
```

- [ ] **Step 4: Sanity + commit**

Run: `node --check js/views/onboarding.js && node --check js/views/settings.js && npm test`

```bash
git add js/views/onboarding.js js/views/settings.js css/app.css
git commit -m "feat: onboarding wizard + settings view"
```

---

### Task 12: `js/quiz.js` — sinh bài kiểm tra định kỳ

**Files:**
- Create: `js/quiz.js`
- Test: `tests/quiz.test.mjs`

**Interfaces:**
- Consumes: state của store (days, tests), packs đã học.
- Produces: `dueTest(state, today) -> 'month'|'week'|null` (đếm số NGÀY CÓ HỌC sau lần test gần nhất cùng loại: ≥30 → month, ≥7 → week, ưu tiên month); `generateQuiz({packs, kind='week', level='b1', rng=Math.random}) -> Question[]` với `Question = {type:'en2vi'|'vi2en'|'fill'|'listen', prompt, tts?, options: string[], answer: number}`. Tuần 10 câu, tháng 20 câu; cần ≥4 từ vựng, không đủ trả `[]`.

- [ ] **Step 1: Viết test fail**

```js
// tests/quiz.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dueTest, generateQuiz } from '../js/quiz.js';
import { makePack } from './helpers.mjs';

// rng tuần hoàn cho kết quả xác định
const seqRng = () => { let i = 0; return () => ((i += 7) % 100) / 100; };

function studiedState(nDays, tests = []) {
  const days = {};
  for (let i = 1; i <= nDays; i++) {
    days[`2026-07-${String(i).padStart(2, '0')}`] = { vocab: true };
  }
  return { days, tests };
}

test('dueTest: chưa đủ 7 ngày học -> null', () => {
  assert.equal(dueTest(studiedState(6), '2026-07-10'), null);
});

test('dueTest: đủ 7 ngày -> week, đủ 30 -> month (ưu tiên month)', () => {
  assert.equal(dueTest(studiedState(7), '2026-07-10'), 'week');
  assert.equal(dueTest(studiedState(30), '2026-07-31'), 'month');
});

test('dueTest: chỉ đếm ngày học SAU lần test gần nhất cùng loại', () => {
  const s = studiedState(10, [{ date: '2026-07-08', kind: 'week', score: 7, total: 10 }]);
  assert.equal(dueTest(s, '2026-07-10'), null); // chỉ còn 07-09, 07-10 sau test
});

function bigPack(date) {
  const p = makePack(date);
  p.vocab = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot'].map((w, i) => ({
    word: `${w}-${date}`, ipa: '/x/', meaning_vi: `nghĩa ${w} ${date}`, example: `We use ${w}-${date} in the report.`, example_vi: 'ví dụ',
  }));
  return p;
}

test('generateQuiz: tuần 10 câu, tháng 20 câu, mỗi câu có 4 lựa chọn và answer đúng phạm vi', () => {
  const packs = [bigPack('2026-07-01'), bigPack('2026-07-02')];
  for (const [kind, n] of [['week', 10], ['month', 20]]) {
    const qs = generateQuiz({ packs, kind, level: 'b1', rng: seqRng() });
    assert.equal(qs.length, n);
    for (const q of qs) {
      assert.equal(q.options.length, 4);
      assert.ok(q.answer >= 0 && q.answer < 4);
      assert.equal(new Set(q.options).size, 4, 'options không trùng nhau');
      assert.ok(['en2vi', 'vi2en', 'fill', 'listen'].includes(q.type));
    }
  }
});

test('generateQuiz: câu fill che từ trong câu ví dụ, câu listen có tts', () => {
  const qs = generateQuiz({ packs: [bigPack('2026-07-01')], kind: 'week', level: 'b1', rng: seqRng() });
  const fill = qs.find((q) => q.type === 'fill');
  assert.ok(fill && fill.prompt.includes('____'));
  const listen = qs.find((q) => q.type === 'listen');
  assert.ok(listen && listen.tts && listen.tts.length > 0);
});

test('generateQuiz: level lệch phân bố (a2 không có vi2en, b2 có nhiều vi2en hơn en2vi)', () => {
  const packs = [bigPack('2026-07-01'), bigPack('2026-07-02')];
  const a2 = generateQuiz({ packs, kind: 'month', level: 'a2', rng: seqRng() });
  assert.equal(a2.filter((q) => q.type === 'vi2en').length, 0);
  const b2 = generateQuiz({ packs, kind: 'month', level: 'b2', rng: seqRng() });
  assert.ok(b2.filter((q) => q.type === 'vi2en').length > b2.filter((q) => q.type === 'en2vi').length);
});

test('generateQuiz: dưới 4 từ -> mảng rỗng', () => {
  assert.deepEqual(generateQuiz({ packs: [makePack('2026-07-01')], kind: 'week' }), []);
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `node --test tests/quiz.test.mjs`
Expected: FAIL — module chưa tồn tại

- [ ] **Step 3: Viết `js/quiz.js`**

```js
// Sinh bài kiểm tra tiến bộ tuần/tháng từ nội dung đã học. Không cần mạng, không cần AI.

// Đến hạn kiểm tra chưa? Đếm số ngày có học sau lần test gần nhất cùng loại.
export function dueTest(state, today) {
  const studied = Object.keys(state.days).filter((d) => d <= today).sort();
  const lastOf = (kind) => state.tests.filter((t) => t.kind === kind).map((t) => t.date).sort().pop() || '';
  const countAfter = (since) => studied.filter((d) => d > since).length;
  if (countAfter(lastOf('month')) >= 30) return 'month';
  if (countAfter(lastOf('week')) >= 7) return 'week';
  return null;
}

// Phân bố dạng câu theo trình độ (trọng số trên 10 câu)
const MIX = {
  a2: { en2vi: 5, listen: 3, fill: 2 },
  b1: { en2vi: 3, vi2en: 2, fill: 3, listen: 2 },
  b2: { en2vi: 1, vi2en: 4, fill: 4, listen: 1 },
};

function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function blank(example, word) {
  const safe = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return example.replace(new RegExp(`\\b${safe}\\w*`, 'gi'), '____');
}

function makeQuestion(type, item, pool, rng) {
  const others = shuffle(pool.filter((v) => v.word !== item.word), rng).slice(0, 3);
  const useWords = type !== 'en2vi';
  const correct = useWords ? item.word : item.meaning_vi;
  const options = shuffle([correct, ...others.map((v) => (useWords ? v.word : v.meaning_vi))], rng);
  const base = { type, options, answer: options.indexOf(correct) };
  if (type === 'en2vi') return { ...base, prompt: `“${item.word}” nghĩa là gì?` };
  if (type === 'vi2en') return { ...base, prompt: `Từ nào nghĩa là “${item.meaning_vi}”?` };
  if (type === 'fill') return { ...base, prompt: `Điền từ: ${blank(item.example, item.word)}` };
  return { ...base, prompt: 'Nghe câu và chọn từ bạn nghe thấy:', tts: item.example };
}

export function generateQuiz({ packs, kind = 'week', level = 'b1', rng = Math.random }) {
  const seen = new Set();
  const pool = packs.flatMap((p) => p.vocab || []).filter((v) => {
    if (seen.has(v.word)) return false;
    seen.add(v.word);
    return true;
  });
  if (pool.length < 4) return [];

  const total = kind === 'month' ? 20 : 10;
  const mix = MIX[level] || MIX.b1;
  const types = Object.entries(mix).flatMap(([t, w]) => Array(Math.round((w * total) / 10)).fill(t));
  while (types.length < total) types.push('en2vi');
  types.length = total;

  const items = shuffle(pool, rng);
  const questions = types.map((t, i) => makeQuestion(t, items[i % items.length], pool, rng));
  return shuffle(questions, rng);
}
```

- [ ] **Step 4: Chạy test**

Run: `node --test tests/quiz.test.mjs && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/quiz.js tests/quiz.test.mjs
git commit -m "feat: periodic progress quiz generator"
```

---

### Task 13: `js/views/progress.js` v2 — kiểm tra định kỳ + biểu đồ điểm

**Files:**
- Modify: `js/views/progress.js`, `css/app.css` (append)

**Interfaces:**
- Consumes: `dueTest/generateQuiz` (Task 12), `loadIndex/loadPack` (Task 5), `buildAiTestPrompt/AI_APPS` (Task 7), `speak`, store `addTestResult/markTestAiDone`.
- Produces: tab Tiến độ — stats + lưới 30 ngày như cũ, THÊM banner kiểm tra + flow quiz + biểu đồ điểm; BỎ nút backup (đã sang Cài đặt).

- [ ] **Step 1: Thay `js/views/progress.js`**

```js
import { addDays } from '../dates.js';
import { icon } from '../icons.js';
import { dueTest, generateQuiz } from '../quiz.js';
import { loadIndex, loadPack } from '../data.js';
import { buildAiTestPrompt, AI_APPS } from '../prompt.js';
import { speak } from '../speech.js';

const KIND_LABEL = { week: 'tuần', month: 'tháng' };

async function packsForPeriod(ctx, kind) {
  const days = kind === 'month' ? 30 : 7;
  const from = addDays(ctx.today, -(days - 1));
  const studied = Object.keys(ctx.store.state.days).filter((d) => d >= from && d <= ctx.today);
  const track = ctx.store.state.profile?.track || 'it';
  const byDate = new Map((await loadIndex()).map((e) => [e.date, e]));
  const packs = [];
  for (const d of studied) {
    const e = byDate.get(d);
    if (!e) continue;
    const tr = e.tracks.includes(track) ? track : e.tracks[0];
    const p = await loadPack(e, tr).catch(() => null);
    if (p) packs.push(p);
  }
  return packs;
}

export function render(el, ctx) {
  const { store } = ctx;
  let quiz = null; // { kind, questions, i, correct, answered, packs }

  function drawStats() {
    const s = store.state;
    const streak = store.computeStreak(ctx.today);
    const longest = store.computeLongestStreak();
    const totalWords = Object.keys(s.srs).length;
    const speakMins = Math.round(
      Object.values(s.days).reduce((sum, d) => sum + (d.speakingSeconds || 0), 0) / 60,
    );

    const cells = [];
    for (let i = 29; i >= 0; i--) {
      const d = addDays(ctx.today, -i);
      const cls = store.isDayComplete(d) ? 'full' : s.days[d] ? 'part' : '';
      cells.push(`<div class="cell ${cls}" title="${d}"></div>`);
    }

    const stat = (cls, ico, value, label) =>
      `<div class="stat"><div class="ic ${cls}">${ico}</div><b>${value}</b><small>${label}</small></div>`;

    const due = dueTest(s, ctx.today);
    const last8 = s.tests.slice(-8);

    el.innerHTML = `
      <header class="page-head"><h1>Tiến độ</h1></header>

      ${due ? `
      <button class="test-banner" id="startTest">
        <span class="tile">${icon.target(20)}</span>
        <span class="body"><b>Đến hạn kiểm tra ${KIND_LABEL[due]}!</b>
        <small>${due === 'month' ? '20' : '10'} câu từ chính nội dung bạn đã học</small></span>
        <span class="trail">${icon.chevron(20)}</span>
      </button>` : ''}

      <div class="stats">
        ${stat('ic-amber', icon.flame(18), streak, 'ngày streak')}
        ${stat('ic-accent', icon.layers(18), totalWords, 'từ đã học')}
        ${stat('ic-green', icon.clock(18), speakMins, 'phút luyện nói')}
        ${stat('ic-purple', icon.target(18), longest, 'streak dài nhất')}
      </div>

      <div class="contrib">
        <div class="head"><b>30 ngày qua</b></div>
        <div class="grid30">${cells.join('')}</div>
        <div class="legend">
          <span><i style="background:var(--accent)"></i>Hoàn thành</span>
          <span><i style="background:rgba(245,166,35,0.55)"></i>Dở dang</span>
          <span><i style="background:rgba(255,255,255,0.05);border:1px solid var(--line)"></i>Chưa học</span>
        </div>
      </div>

      ${last8.length ? `
      <div class="contrib">
        <div class="head"><b>Điểm kiểm tra</b></div>
        <div class="testbars">
          ${last8.map((t) => {
            const pct = Math.round((t.score / t.total) * 100);
            return `<div class="tb"><b>${pct}</b><i style="height:${Math.max(6, pct)}%"></i><small>${t.date.slice(5)}<br>${KIND_LABEL[t.kind]}${t.ai ? ' ·AI' : ''}</small></div>`;
          }).join('')}
        </div>
      </div>` : ''}
    `;

    el.querySelector('#startTest')?.addEventListener('click', async () => {
      const kind = due;
      el.querySelector('#startTest').disabled = true;
      const packs = await packsForPeriod(ctx, kind);
      const questions = generateQuiz({ packs, kind, level: store.state.profile?.level || 'b1' });
      if (!questions.length) {
        drawStats();
        el.insertAdjacentHTML('beforeend', '<p class="warn">Chưa đủ nội dung để tạo bài kiểm tra (cần mạng để tải lại bài đã học).</p>');
        return;
      }
      quiz = { kind, questions, i: 0, correct: 0, answered: null, packs };
      drawQuiz();
    });
  }

  function drawQuiz() {
    const q = quiz.questions[quiz.i];
    const answered = quiz.answered != null;
    el.innerHTML = `
      <header class="page-head">
        <h1>Kiểm tra ${KIND_LABEL[quiz.kind]}</h1>
        <span class="count-pill">${quiz.i + 1} / ${quiz.questions.length}</span>
      </header>
      <div class="progress-track"><i style="width:${Math.round((quiz.i / quiz.questions.length) * 100)}%"></i></div>
      <div class="question">
        <div class="q">${q.prompt}</div>
        ${q.tts ? `<button class="pill" id="playTts">${icon.volume(14)} Nghe câu</button>` : ''}
        ${q.options.map((o, oi) => {
          let cls = '';
          if (answered && oi === q.answer) cls = 'right';
          else if (answered && quiz.answered === oi) cls = 'wrong';
          return `<button class="option ${cls}" data-o="${oi}" ${answered ? 'disabled' : ''}>
            <span class="mark">${cls === 'right' ? icon.check(12) : ''}</span><span>${o}</span></button>`;
        }).join('')}
      </div>
      ${answered ? `<button class="primary" id="next">${quiz.i === quiz.questions.length - 1 ? 'Xem kết quả' : 'Câu tiếp theo'}</button>` : ''}
    `;
    el.querySelector('#playTts')?.addEventListener('click', () => speak(q.tts));
    if (q.tts && !answered) speak(q.tts);
    el.querySelectorAll('.option:not([disabled])').forEach((b) => {
      b.onclick = () => {
        quiz.answered = +b.dataset.o;
        if (quiz.answered === q.answer) quiz.correct++;
        drawQuiz();
      };
    });
    el.querySelector('#next')?.addEventListener('click', () => {
      quiz.answered = null;
      if (quiz.i === quiz.questions.length - 1) return finishQuiz();
      quiz.i++;
      drawQuiz();
    });
  }

  function finishQuiz() {
    const { kind, questions, correct, packs } = quiz;
    store.addTestResult({ date: ctx.today, kind, score: correct, total: questions.length });
    const profile = store.state.profile || { level: 'b1', aiApp: 'other' };
    const app = AI_APPS[profile.aiApp] || AI_APPS.other;
    const pct = Math.round((correct / questions.length) * 100);
    el.innerHTML = `
      <div class="empty">
        <h2>${pct >= 80 ? '🎉' : pct >= 50 ? '💪' : '📚'} ${correct}/${questions.length} câu đúng</h2>
        <p>Điểm được lưu vào biểu đồ tiến bộ.</p>
        <button class="pill wide" id="aiTest">${icon.external(15)} Kiểm tra nói/viết sâu hơn với ${app.name}</button>
        <button class="primary" id="done" style="margin-top:12px">Về trang Tiến độ</button>
      </div>
    `;
    el.querySelector('#aiTest').onclick = async () => {
      const words = [...new Set(packs.flatMap((p) => p.vocab.map((v) => v.word)))].slice(0, 20);
      const themes = [...new Set(packs.map((p) => p.theme))];
      const prompt = buildAiTestPrompt(words, themes, profile);
      try { await navigator.clipboard.writeText(prompt); } catch { /* url vẫn mở được */ }
      const url = app.url(prompt);
      if (url) window.open(url, '_blank');
      store.markTestAiDone(ctx.today, kind);
      el.querySelector('#aiTest').innerHTML = `${icon.check(15)} Đã mở ${app.name} — prompt trong clipboard`;
    };
    el.querySelector('#done').onclick = () => { quiz = null; drawStats(); };
  }

  drawStats();
}
```

- [ ] **Step 2: Append CSS cuối `css/app.css`**

```css
/* ============ V2: KIỂM TRA ĐỊNH KỲ ============ */
.test-banner { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; background: linear-gradient(120deg, var(--accent-grad-a), var(--accent-grad-b)); border: none; border-radius: var(--radius); padding: 15px; color: #fff; font-family: inherit; cursor: pointer; margin-bottom: 16px; }
.test-banner .tile { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 11px; background: rgba(255, 255, 255, 0.18); }
.test-banner small { color: rgba(255, 255, 255, 0.85); }
.test-banner .trail { margin-left: auto; }
.testbars { display: flex; gap: 10px; align-items: flex-end; height: 130px; padding-top: 8px; }
.tb { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 4px; height: 100%; }
.tb b { font-size: 11.5px; color: var(--muted); }
.tb i { width: 100%; max-width: 34px; border-radius: 6px 6px 2px 2px; background: linear-gradient(180deg, var(--accent-grad-a), var(--accent-grad-b)); }
.tb small { font-size: 10px; color: var(--faint); text-align: center; line-height: 1.3; }
```

- [ ] **Step 3: Sanity + commit**

Run: `node --check js/views/progress.js && npm test`

```bash
git add js/views/progress.js css/app.css
git commit -m "feat: periodic progress tests with score chart in progress tab"
```

---

### Task 14: Nối lại app shell — tabs mới, onboarding gate, xoá Phỏng vấn

**Files:**
- Modify: `index.html`, `js/app.js`, `js/views/today.js`, `sw.js`
- Delete: `js/views/interview.js`, `js/views/speaking.js`

**Interfaces:**
- Consumes: mọi view + module từ các task trước.
- Produces: 5 tab `today · vocab · practice · review · progress`; view ẩn `listening`, `settings`; gate onboarding khi `profile` null; pack tải theo `profile.track`.

- [ ] **Step 1: Sửa `index.html`** — thay 2 button tab `speaking` và `interview` bằng:

```html
  <button data-tab="practice"><span class="tab-ico"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.4 14.4 9.6 9.6"/><path d="M18.657 21.485a2 2 0 1 1-2.829-2.828l-1.767 1.768a2 2 0 1 1-2.829-2.829l6.364-6.364a2 2 0 1 1 2.829 2.829l-1.768 1.767a2 2 0 1 1 2.828 2.829z"/><path d="m21.5 21.5-1.4-1.4"/><path d="M3.9 3.9 2.5 2.5"/><path d="M6.404 12.768a2 2 0 1 1-2.829-2.829l1.768-1.767a2 2 0 1 1-2.828-2.829l2.828-2.828a2 2 0 1 1 2.829 2.828l1.767-1.768a2 2 0 1 1 2.829 2.829z"/></svg></span><span class="tab-label">Luyện tập</span></button>
  <button data-tab="review"><span class="tab-ico"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg></span><span class="tab-label">Ôn tập</span></button>
```

- [ ] **Step 2: Thay `js/app.js`**

```js
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
```

- [ ] **Step 3: Thay `js/views/today.js`**

```js
import { icon } from '../icons.js';
import { addDays } from '../dates.js';
import { requiredActivities } from '../plan.js';
import { TRACK_LABEL } from '../profile-options.js';

// Thẻ hoạt động: 3 cốt lõi + AI theo kế hoạch ngày
const CARD_META = {
  vocab: { ico: 'book', title: 'Từ vựng', desc: '8 từ · ~5 phút', tab: 'vocab' },
  listening: { ico: 'headphones', title: 'Nghe hội thoại', desc: '1 hội thoại + câu hỏi', tab: 'listening' },
  speaking: { ico: 'mic', title: 'Nói · Shadowing', desc: 'Luyện phát âm', tab: 'practice' },
  ai_conversation: { ico: 'message', title: 'Hội thoại với AI', desc: 'Nhập vai theo chủ đề hôm nay', tab: 'practice' },
  ai_speaking: { ico: 'mic', title: 'Nói tự do với AI', desc: 'Trả lời đề nói với AI', tab: 'practice' },
  ai_writing: { ico: 'pencil', title: 'Viết với AI', desc: 'Viết email/tin nhắn, AI chữa', tab: 'practice' },
};

const DOW = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Chào buổi sáng';
  if (h < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

// 7 ô của tuần hiện tại (Thứ 2 → Chủ nhật), đánh dấu ngày đã hoàn thành.
function weekDots(store, today) {
  const [y, m, d] = today.split('-').map(Number);
  const jsDow = new Date(y, m - 1, d).getDay(); // 0=CN..6=T7
  const backToMon = (jsDow + 6) % 7;
  const monday = addDays(today, -backToMon);
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    const [yy, mm, dd] = date.split('-').map(Number);
    const label = DOW[new Date(yy, mm - 1, dd).getDay()];
    return { date, label, done: store.isDayComplete(date), isToday: date === today, dayNum: dd };
  });
}

export function render(el, ctx) {
  const { store, pack } = ctx;
  const profile = store.state.profile || {};
  const streak = store.computeStreak(ctx.today);
  const done = store.state.days[ctx.today] || {};
  const stale = pack && pack.date !== ctx.today;
  const week = weekDots(store, ctx.today);

  const activities = requiredActivities(ctx.today, profile.minutes ?? 15);
  const isDone = (a) => (a.startsWith('ai_') ? store.isAiDone(ctx.today, a.slice(3)) : !!done[a]);
  const doneCount = activities.filter(isDone).length;

  el.innerHTML = `
    <div class="greet">
      <div>
        <div class="eyebrow">${greeting()}</div>
        <div class="hi">Học chút nhé 👋</div>
      </div>
      <button class="avatar" id="openSettings" style="color:var(--accent-light);border:none;background:none;cursor:pointer">${icon.gear(22)}</button>
    </div>

    ${!pack ? '' : `
    <div class="streak-hero">
      <div class="top">
        <div class="flame">${icon.flame(30)}</div>
        <div>
          <div><span class="num">${streak}</span> <span class="unit">ngày liên tục</span></div>
          <div class="sub">Cứ đều đặn mỗi ngày là tiến bộ 🔥</div>
        </div>
      </div>
      <div class="week">
        ${week.map((w) => `
          <div class="day ${w.isToday ? 'is-today' : ''}">
            <div class="dot ${w.done ? 'on' : ''} ${w.isToday ? 'today' : ''}">${
              w.isToday ? w.dayNum : (w.done ? icon.check(14) : '')
            }</div>
            <div class="lbl">${w.label}</div>
          </div>`).join('')}
      </div>
    </div>`}

    ${!pack
      ? '<p class="error">Không tải được bài học. Kiểm tra kết nối mạng rồi mở lại app nhé.</p>'
      : `
      <p class="theme">Chủ đề hôm nay: <b>${pack.theme}</b> · ${TRACK_LABEL[pack.track || 'it']}${stale ? ` <span class="stale">(bài của ngày ${pack.date})</span>` : ''}</p>
      <div class="section-head">
        <b>Hôm nay cần làm</b>
        <span class="meta">${doneCount}/${activities.length} xong</span>
      </div>
      <div class="cards">
        ${activities.map((a) => {
          const c = CARD_META[a];
          return `
          <button class="card ${isDone(a) ? 'done' : ''}" data-tab="${c.tab}">
            <span class="tile">${icon[c.ico](19)}</span>
            <span class="body"><b>${c.title}</b><small>${c.desc}</small></span>
            <span class="trail">${isDone(a) ? icon.checkCircle(22) : icon.chevron(20)}</span>
          </button>`;
        }).join('')}
      </div>`}
  `;

  el.querySelectorAll('.card').forEach((b) => {
    b.addEventListener('click', () => ctx.navigate(b.dataset.tab));
  });
  el.querySelector('#openSettings').onclick = () => ctx.navigate('settings');
}
```

- [ ] **Step 4: Xoá view cũ**

```bash
git rm js/views/interview.js js/views/speaking.js
```

- [ ] **Step 5: Cập nhật `sw.js`** — thay 2 hằng đầu và danh sách SHELL:

```js
const SHELL_CACHE = 'shell-v3';
const DATA_CACHE = 'data-v2';
const SHELL = [
  './', 'index.html', 'css/app.css', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/icon-maskable.svg',
  'js/app.js', 'js/dates.js', 'js/srs.js', 'js/diff.js', 'js/pack.js',
  'js/store.js', 'js/data.js', 'js/speech.js', 'js/icons.js',
  'js/plan.js', 'js/prompt.js', 'js/quiz.js', 'js/profile-options.js',
  'js/views/today.js', 'js/views/vocab.js', 'js/views/practice.js',
  'js/views/review.js', 'js/views/progress.js', 'js/views/listening.js',
  'js/views/settings.js', 'js/views/onboarding.js',
];
```

(Phần fetch handler giữ nguyên — data network-first đã tự cache gói theo track user vì app chỉ fetch track của user.)

- [ ] **Step 6: Chạy test + syntax check toàn bộ**

Run: `npm test && for f in js/*.js js/views/*.js; do node --check "$f" || exit 1; done && echo ALL-OK`
Expected: tests PASS, `ALL-OK`

- [ ] **Step 7: Commit**

```bash
git add index.html js/app.js js/views/today.js sw.js
git commit -m "feat: v2 shell - new tabs, onboarding gate, remove interview tab"
```

---

### Task 15: Icon mới + manifest

**Files:**
- Modify: `icons/icon.svg`, `icons/icon-maskable.svg`, `manifest.webmanifest`

- [ ] **Step 1: Thay `icons/icon.svg`** (bong bóng hội thoại, gradient theo design system):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#5b6cf0"/>
      <stop offset="1" stop-color="#8163e8"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <path d="M296 118h112a44 44 0 0 1 44 44v68a44 44 0 0 1-44 44h-16v38l-50-38h-46a44 44 0 0 1-44-44v-68a44 44 0 0 1 44-44z" fill="#ffffff" opacity="0.42"/>
  <path d="M110 192h160a50 50 0 0 1 50 50v76a50 50 0 0 1-50 50h-86l-60 46v-46h-14a50 50 0 0 1-50-50v-76a50 50 0 0 1 50-50z" fill="#ffffff"/>
  <text x="190" y="312" font-family="Arial, Helvetica, sans-serif" font-size="88" font-weight="bold" fill="#5b6cf0" text-anchor="middle">En</text>
</svg>
```

- [ ] **Step 2: Thay `icons/icon-maskable.svg`** (nền tràn viền, nội dung trong safe zone 80%):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#5b6cf0"/>
      <stop offset="1" stop-color="#8163e8"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <g transform="translate(256 256) scale(0.82) translate(-256 -256)">
    <path d="M296 118h112a44 44 0 0 1 44 44v68a44 44 0 0 1-44 44h-16v38l-50-38h-46a44 44 0 0 1-44-44v-68a44 44 0 0 1 44-44z" fill="#ffffff" opacity="0.42"/>
    <path d="M110 192h160a50 50 0 0 1 50 50v76a50 50 0 0 1-50 50h-86l-60 46v-46h-14a50 50 0 0 1-50-50v-76a50 50 0 0 1 50-50z" fill="#ffffff"/>
    <text x="190" y="312" font-family="Arial, Helvetica, sans-serif" font-size="88" font-weight="bold" fill="#5b6cf0" text-anchor="middle">En</text>
  </g>
</svg>
```

- [ ] **Step 3: Sửa `manifest.webmanifest`** — đồng bộ màu design system hiện tại:

```json
{
  "name": "Office English",
  "short_name": "OfficeEN",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "background_color": "#0d0f14",
  "theme_color": "#0d0f14",
  "icons": [
    { "src": "icons/icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any" },
    { "src": "icons/icon-maskable.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 4: Commit**

```bash
git add icons manifest.webmanifest
git commit -m "feat: new speech-bubble app icon"
```

---

### Task 16: `routine/PROMPT.md` v2

**Files:**
- Modify: `routine/PROMPT.md`

- [ ] **Step 1: Thay toàn bộ nội dung**

````markdown
# Nhiệm vụ hàng ngày: Soạn gói bài học Office English (v2 — 5 track)

Bạn là routine tự động soạn bài học tiếng Anh hàng ngày cho repo này (PWA Office English).

## Các bước

1. Xác định ngày hôm nay theo múi giờ Asia/Ho_Chi_Minh, dạng `YYYY-MM-DD`.
2. Với TỪNG track trong `it`, `office`, `sales`, `finance`, `interview`:
   - Nếu `data/packs/<hôm nay>-<track>.json` đã tồn tại → bỏ qua track đó.
   - Đọc 14 gói gần nhất CỦA TRACK ĐÓ (file `*-<track>.json`; với track `it` tính cả file cũ `YYYY-MM-DD.json` không hậu tố) để biết: chủ đề đã dùng → chọn chủ đề TIẾP THEO trong vòng xoay của track; từ vựng đã dùng → KHÔNG lặp `word` trong cùng track (khác track được phép trùng).
   - Soạn gói mới `data/packs/<hôm nay>-<track>.json` đúng schema bên dưới.
3. Cập nhật `data/index.json`: thêm/sửa entry của hôm nay thành `{ "date": "<hôm nay>", "tracks": [<các track đã soạn>] }` (mảng giữ thứ tự ngày tăng dần).
4. Chạy `npm run validate-data` — nếu lỗi, sửa cho đến khi `OK`.
5. Commit với message `content: lesson packs <ngày>` và push lên nhánh main.

## Vòng xoay chủ đề theo track

**it (13):** Daily standup meeting · Code review & pull requests · Báo cáo tiến độ với sếp · Small talk đầu giờ & pantry chat · Họp với khách hàng · Deal lương & phúc lợi · Xin nghỉ phép & thông báo vắng mặt · Giải thích bug & sự cố production · Thuyết trình demo sản phẩm · Onboarding người mới · Nói về email & follow-up · Họp retrospective · Remote meeting etiquette

**office (14):** Small talk trước giờ họp · Viết email & follow-up · Xin nghỉ phép & bàn giao · Báo cáo với sếp · Họp phòng ban · Feedback cho đồng nghiệp · Deal deadline · Gọi điện với đối tác · Ghi chú & biên bản họp · Tổ chức sự kiện nội bộ · Onboarding người mới · Out-of-office & bàn giao việc · Văn hoá công sở đa quốc gia · Pantry chat & networking nội bộ

**sales (14):** Cold call khách mới · Demo sản phẩm cho khách · Xử lý khi khách từ chối · Đàm phán giá & điều khoản · Email follow-up sau gặp khách · Gặp khách lần đầu · Chăm sóc khách sau bán · Pitch ngắn (elevator pitch) · Khảo sát nhu cầu khách · Gửi & giải thích báo giá · Networking tại hội chợ/sự kiện · Upsell & cross-sell · Xử lý phàn nàn của khách · Chốt hợp đồng

**finance (14):** Trình bày báo cáo tháng · Ngân sách & cắt giảm chi phí · Hoá đơn và thanh toán · Làm việc với kiểm toán · Expense claim & hoàn ứng · Dự báo dòng tiền · Trao đổi với kế toán thuế · Lương thưởng & phúc lợi · Đề xuất mua sắm thiết bị · Đối chiếu số liệu · Trình bày số liệu với sếp · Deadline quyết toán · Phần mềm kế toán & công cụ · Chính sách tài chính công ty

**interview (14):** Giới thiệu bản thân · Điểm mạnh điểm yếu · Kể về dự án đáng nhớ · Xử lý xung đột trong nhóm · Lý do nghỉ việc & chuyển việc · Mục tiêu nghề nghiệp 3-5 năm · Deal lương khi phỏng vấn · Câu hỏi ngược cho nhà tuyển dụng · Phỏng vấn qua video call · Kể chuyện theo STAR · Tìm hiểu văn hoá công ty · Thất bại & bài học · Làm việc nhóm & teamwork · Câu hỏi tình huống (situational)

## Yêu cầu nội dung (trình độ B1)

- Đúng **8 từ vựng**: `word`, `ipa`, `meaning_vi`, `example` (câu ngữ cảnh công sở đúng track), `example_vi`.
- **1 hội thoại** 8–12 lượt thoại (`speaker` là tên + vai, `voice` là `male`/`female` xen kẽ, `text` tiếng Anh B1), có `title`, kèm đúng **3 câu hỏi trắc nghiệm** (`q`, `options` 3 lựa chọn, `answer` là index đáp án đúng).
- Đúng **5 câu shadowing**: 10–16 từ, câu thực dụng người đi làm nói hàng ngày theo chủ đề.
- Track `interview` đặc thù: hội thoại là buổi phỏng vấn (interviewer + candidate), shadowing là câu trả lời mẫu ngắn kiểu STAR, vocab là từ hay dùng khi phỏng vấn.
- Nhân vật là người Việt trong môi trường phù hợp track (Nam, Linh, Minh, Hoa...).

## Schema (xem `js/pack.js` là nguồn chân lý)

```json
{
  "date": "YYYY-MM-DD",
  "track": "it|office|sales|finance|interview",
  "theme": "...",
  "vocab": [{ "word": "", "ipa": "", "meaning_vi": "", "example": "", "example_vi": "" }],
  "listening": {
    "title": "",
    "lines": [{ "speaker": "", "voice": "male|female", "text": "" }],
    "questions": [{ "q": "", "options": ["", "", ""], "answer": 0 }]
  },
  "shadowing": [""]
}
```
````

- [ ] **Step 2: Commit**

```bash
git add routine/PROMPT.md
git commit -m "docs: routine prompt v2 - 5 tracks, per-track rotation and dedupe"
```

**Lưu ý cho người vận hành (ghi vào báo cáo cuối):** scheduled task Claude đang chạy hằng ngày sẽ tự đọc PROMPT.md mới ở lần chạy kế tiếp — không cần tạo lại task, nhưng nên theo dõi lần chạy đầu.

---

### Task 17: Verification cuối

**Files:** không sửa code (chỉ fix nếu phát hiện lỗi).

- [ ] **Step 1: Toàn bộ test + validate**

Run: `npm test && npm run validate-data`
Expected: tất cả PASS, `OK: 42 packs across 30 dates`

- [ ] **Step 2: Chạy app bằng preview server** (`.claude/launch.json` đã có config, hoặc `python3 -m http.server 8000`), xác minh theo flow:
  1. Xoá localStorage (trạng thái user mới) → mở app → wizard onboarding 5 bước hiện ra, chọn track `office`, 30 phút → app reload vào Hôm nay.
  2. Hôm nay: 4 thẻ (3 cốt lõi + 1 AI), chủ đề của track office, nút ⚙ mở Cài đặt.
  3. Luyện tập: shadowing hoạt động (nút Nghe phát TTS), 3 thẻ AI, bấm "Mở ChatGPT" → tab mới `chatgpt.com/?q=...` chứa prompt, toast hiện; "Đánh dấu xong" toggle ✓ và thẻ trên Hôm nay cập nhật.
  4. Ôn tập: danh sách bài cũ lọc theo track, mở 1 bài nghe lại được; Sổ tay từ vựng tìm kiếm/lọc được (cần học vài từ trước ở tab Từ vựng).
  5. Tiến độ: chưa có banner test (chưa đủ 7 ngày học) — giả lập bằng cách seed localStorage 7 ngày `days` qua DevTools console rồi reload → banner hiện, làm hết quiz → điểm hiện trên biểu đồ.
  6. Cài đặt: đổi track → reload, bài đổi theo; xuất/nhập backup hoạt động.
  7. Kiểm tra manifest/icon: DevTools ▸ Application ▸ Manifest hiển thị icon mới.
- [ ] **Step 3: Chụp screenshot các màn chính làm bằng chứng, báo cáo kết quả.**
- [ ] **Step 4: Commit các fix phát sinh (nếu có), rồi push:**

```bash
git push origin main
```
