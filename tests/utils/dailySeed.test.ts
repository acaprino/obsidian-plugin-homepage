import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { dailyEpochDay, dailyIndex } from '../../src/utils/dailySeed';

describe('dailyEpochDay', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('is stable for every moment within the same local calendar day', () => {
    vi.setSystemTime(new Date('2026-04-24T00:00:00'));
    const early = dailyEpochDay();
    vi.setSystemTime(new Date('2026-04-24T23:59:59'));
    const late = dailyEpochDay();
    expect(early).toBe(late);
  });

  it('advances by exactly 1 after local midnight', () => {
    vi.setSystemTime(new Date('2026-04-24T12:00:00'));
    const today = dailyEpochDay();
    vi.setSystemTime(new Date('2026-04-25T00:00:00'));
    expect(dailyEpochDay()).toBe(today + 1);
  });

  it('has no year-boundary collision (Dec 31 ≠ Jan 1 of next year)', () => {
    vi.setSystemTime(new Date('2026-12-31T12:00:00'));
    const lastDay = dailyEpochDay();
    vi.setSystemTime(new Date('2027-01-01T12:00:00'));
    expect(dailyEpochDay()).not.toBe(lastDay);
  });
});

describe('dailyIndex', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('returns 0 when the pool is empty (defensive — caller should still guard)', () => {
    expect(dailyIndex(0)).toBe(0);
    expect(dailyIndex(-5)).toBe(0);
  });

  it('returns a value in [0, poolLength)', () => {
    vi.setSystemTime(new Date('2026-04-24T10:00:00'));
    for (let n = 1; n <= 12; n++) {
      const idx = dailyIndex(n);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(n);
    }
  });

  it('is stable across the same local day', () => {
    vi.setSystemTime(new Date('2026-04-24T00:00:01'));
    const morning = dailyIndex(7);
    vi.setSystemTime(new Date('2026-04-24T23:59:58'));
    const night = dailyIndex(7);
    expect(morning).toBe(night);
  });

  it('increments by 1 (mod pool) at local midnight', () => {
    vi.setSystemTime(new Date('2026-04-24T09:00:00'));
    const today = dailyIndex(5);
    vi.setSystemTime(new Date('2026-04-25T09:00:00'));
    expect(dailyIndex(5)).toBe((today + 1) % 5);
  });
});
