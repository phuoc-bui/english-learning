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
      const isPlainObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
      const valid = isPlainObj(parsed)
        && isPlainObj(parsed.days)
        && (parsed.srs === undefined || isPlainObj(parsed.srs))
        && (parsed.wordMeta === undefined || isPlainObj(parsed.wordMeta))
        && (parsed.bestScores === undefined || isPlainObj(parsed.bestScores))
        && (parsed.interviewLog === undefined || Array.isArray(parsed.interviewLog));
      if (!valid) {
        throw new Error('File backup không hợp lệ');
      }
      state = { ...emptyState(), ...parsed };
      save();
    },
  };
  return store;
}
