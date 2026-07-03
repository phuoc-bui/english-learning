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
