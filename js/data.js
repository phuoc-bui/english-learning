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
