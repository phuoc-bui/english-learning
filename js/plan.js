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
