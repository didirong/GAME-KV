/** 本機進度；不傳送個人資料，也不把儲存的字串插入 HTML。 */
const STORAGE_KEY = 'tokyo-quest:progress:v1';
export function readProgress(secretIds, characterCount, storage) {
  const fallback = { found: [], met: [], best: { A: 0, B: 0, C: 0 }, sound: true };
  try {
    const saved = JSON.parse((storage ?? window.localStorage).getItem(STORAGE_KEY));
    if (!saved || saved.version !== 1) return fallback;
    const validIds = new Set(secretIds);
    const found = Array.isArray(saved.found)
      ? [...new Set(saved.found.filter((id) => validIds.has(id)))]
      : [];
    const met = Array.isArray(saved.met)
      ? [
          ...new Set(
            saved.met.filter((id) => Number.isInteger(id) && id >= 0 && id < characterCount),
          ),
        ]
      : [];
    const best = {};
    for (const game of ['A', 'B', 'C']) {
      const value = saved.best?.[game];
      best[game] =
        Number.isSafeInteger(value) && value >= 0
          ? Math.min(value, game === 'B' ? 15 : 1000000)
          : 0;
    }
    return { found, met, best, sound: typeof saved.sound === 'boolean' ? saved.sound : true };
  } catch {
    // Private browsing, disabled storage and corrupt saves must not block the game.
    return fallback;
  }
}
export function writeProgress(progress, storage) {
  try {
    (storage ?? window.localStorage).setItem(
      STORAGE_KEY,
      JSON.stringify({ ...progress, version: 1 }),
    );
    return true;
  } catch {
    return false;
  }
}
