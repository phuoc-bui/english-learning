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
