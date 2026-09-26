// Lời bài hát có mốc giờ từ LRCLIB (lrclib.net — miễn phí, không cần key, cho phép gọi từ trình duyệt).
const API = 'https://lrclib.net/api/search';

// "Ed Sheeran - Perfect (Official Music Video) [4K]" -> "Ed Sheeran - Perfect"
export function cleanTitle(title) {
  return String(title ?? '')
    .replace(/\s*[([【][^)\]】]*[)\]】]/g, ' ') // (Official Video), [MV], 【Lyrics】
    .replace(/\b(official|music|video|audio|lyrics?|lyric video|mv|hd|4k|visualizer|live)\b/gi, ' ')
    .replace(/\s+(ft\.?|feat\.?)\s+.*$/i, '')
    .replace(/[|｜].*$/, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[\s\-–—:]+$/, '')
    .trim();
}

// LRC "[01:02.50] lời" (có thể nhiều mốc trên 1 dòng) -> [{ start, end, text }]
export function parseLrc(lrc) {
  const cues = [];
  for (const line of String(lrc ?? '').split(/\r?\n/)) {
    const stamps = [...line.matchAll(/\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    if (!stamps.length) continue;
    const text = line.replace(/\[[^\]]*\]/g, '').trim();
    if (!text) continue;
    for (const m of stamps) {
      cues.push({ start: Number(m[1]) * 60 + Number(m[2]) + Number(`0.${m[3] || 0}`), text });
    }
  }
  cues.sort((a, b) => a.start - b.start);
  cues.forEach((c, i) => { c.end = cues[i + 1]?.start ?? c.start + 5; });
  return cues;
}

// Chọn bản có lời chạy theo giờ, độ dài gần video nhất (lệch ≤ 15s nếu biết độ dài)
export function pickBest(results, duration) {
  const synced = (results || []).filter((r) => r.syncedLyrics);
  if (!synced.length) return null;
  if (!duration) return synced[0];
  const scored = synced
    .map((r) => ({ r, diff: Math.abs((r.duration || 0) - duration) }))
    .sort((a, b) => a.diff - b.diff);
  return scored[0].diff <= 15 ? scored[0].r : null;
}

// -> { cues, label } | { cues: null, reason: 'none' | 'plain' | 'network' }
export async function findLyrics(query, duration, fetchFn = fetch) {
  let results;
  try {
    const res = await fetchFn(`${API}?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error(String(res.status));
    results = await res.json();
  } catch {
    return { cues: null, reason: 'network' };
  }
  const best = pickBest(results, duration);
  if (!best) return { cues: null, reason: (results || []).some((r) => r.plainLyrics) ? 'plain' : 'none' };
  return { cues: parseLrc(best.syncedLyrics), label: `${best.artistName} – ${best.trackName}` };
}
