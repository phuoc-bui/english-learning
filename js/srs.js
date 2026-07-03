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
