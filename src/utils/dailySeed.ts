import { moment } from 'obsidian';

const MS_PER_DAY = 86_400_000;

/** Days since the Unix epoch, computed against the user's local midnight. */
export function dailyEpochDay(): number {
  return Math.floor(moment().startOf('day').valueOf() / MS_PER_DAY);
}

/**
 * Canonical daily-rotation index: stable per local calendar day, doesn't wrap at year boundaries.
 * Returns a value in [0, poolLength). Returns 0 when poolLength <= 0 (caller must still guard).
 */
export function dailyIndex(poolLength: number): number {
  if (poolLength <= 0) return 0;
  return ((dailyEpochDay() % poolLength) + poolLength) % poolLength;
}
