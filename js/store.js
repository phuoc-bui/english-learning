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
