import { moment } from 'obsidian';

const MS_PER_DAY = 86_400_000;

/**
 * Days since the Unix epoch for the user's local calendar date. From the date's
 * fields, not from local midnight's timestamp: in a UTC+0 zone with summer time,
 * local midnight is 23:00 UTC of the day before, so a day repeated and the next
 * one was skipped at each clock change (M85).
 */
export function dailyEpochDay(): number {
  const now = moment();
  return Math.floor(Date.UTC(now.year(), now.month(), now.date()) / MS_PER_DAY);
}

/**
 * Canonical daily-rotation index: stable per local calendar day, doesn't wrap at year boundaries.
 * Returns a value in [0, poolLength). Returns 0 when poolLength <= 0 (caller must still guard).
 */
export function dailyIndex(poolLength: number): number {
  if (poolLength <= 0) return 0;
  return ((dailyEpochDay() % poolLength) + poolLength) % poolLength;
}
