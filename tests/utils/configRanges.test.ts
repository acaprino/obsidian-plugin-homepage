import { describe, it, expect } from 'vitest';
import { clampConfigNumber, rangedNumber } from '../../src/utils/configRanges';

describe('clampConfigNumber (M13)', () => {
  it('clamps to the settings bounds and rounds to whole numbers', () => {
    expect(clampConfigNumber('pomodoro', 'sessionsBeforeLong', 1e9)).toBe(8);
    expect(clampConfigNumber('pomodoro', 'sessionsBeforeLong', 0)).toBe(2);
    expect(clampConfigNumber('pomodoro', 'workMinutes', 0)).toBe(1);
    expect(clampConfigNumber('recent-files', 'maxItems', -1)).toBe(5);
    expect(clampConfigNumber('quotes-list', 'columns', 2.4)).toBe(2);
  });

  it('passes a key without a range through', () => {
    expect(clampConfigNumber('clock', 'anything', 123.4)).toBe(123.4);
  });

  it('does not take inherited keys such as __proto__ for a range', () => {
    expect(clampConfigNumber('pomodoro', '__proto__', 5)).toBe(5);
  });
});

describe('rangedNumber', () => {
  it('falls back for a missing or non-finite value and clamps the rest', () => {
    expect(rangedNumber('recent-files', {}, 'maxItems', 10)).toBe(10);
    expect(rangedNumber('recent-files', { maxItems: Number.NaN }, 'maxItems', 10)).toBe(10);
    expect(rangedNumber('recent-files', { maxItems: '7' }, 'maxItems', 10)).toBe(10);
    expect(rangedNumber('recent-files', { maxItems: 99 }, 'maxItems', 10)).toBe(20);
  });
});
