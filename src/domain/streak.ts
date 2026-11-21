/**
 * Advance a streak. Missed days never reset the count to zero (product rule A3);
 * they simply do not increase it.
 */
export function nextStreak(current: number, didCheckinToday: boolean): number {
  const safeCurrent = Math.max(0, current);
  if (didCheckinToday) {
    return safeCurrent + 1;
  }
  return safeCurrent;
}
