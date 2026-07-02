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
      // pack error — try older date
    }
  }
  throw new Error('no valid pack');
}
