/** Staggered entrance positions in poster units; elapsed is seconds. */
export function loadingPose(index, elapsed, reducedMotion = false) {
  const formation = 0.5 + index * 12.1;
  // Every character starts outside the track; the delays establish entry order.
  const entry = Math.max(0, Math.min(1, (elapsed - index * 0.24) / 1.1));
  return {
    left: reducedMotion || entry === 1 ? formation : -26 + (formation + 26) * entry,
    opacity: reducedMotion || entry > 0 ? 1 : 0,
    bounce: reducedMotion ? 0 : (Math.floor(elapsed / 0.17) + index) % 2 ? -1.4 : 0,
  };
}
/** Roll at a consistent poster-relative speed, then hold the final text in view. */
export function creditsMotion(viewportHeight, contentHeight, posterWidth) {
  const bottomReserve = posterWidth * 0.28;
  const from = viewportHeight;
  const to = Math.min(0, viewportHeight - contentHeight - bottomReserve);
  return { from, to, duration: Math.max(55000, ((from - to) / (posterWidth * 0.18)) * 1000) };
}
