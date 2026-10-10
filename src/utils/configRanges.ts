import type { BlockType } from '../types';

/**
 * Bounds of the numeric block settings, as their settings controls offer them.
 * A clipboard import clamps to them (importSanitizer.ts) and blocks clamp again
 * where they read the value, so a number set by hand, by an old version or by a
 * crafted import (sessionsBeforeLong: 1e9 built a billion elements on every
 * open) never reaches a loop or a timer unbounded (M13).
 */
export const CONFIG_RANGES: Partial<Record<BlockType, Record<string, { min: number; max: number }>>> = {
  'button-grid': { columns: { min: 1, max: 3 } },
  'bookmarks': { columns: { min: 1, max: 3 } },
  'quotes-list': { columns: { min: 1, max: 3 }, maxItems: { min: 0, max: 500 } },
  'image-gallery': { columns: { min: 2, max: 7 }, maxItems: { min: 0, max: 500 } },
  'recent-files': { maxItems: { min: 5, max: 20 } },
  'pomodoro': {
    workMinutes: { min: 1, max: 60 },
    breakMinutes: { min: 1, max: 30 },
    longBreakMinutes: { min: 1, max: 60 },
    sessionsBeforeLong: { min: 2, max: 8 },
  },
};

/** `value` rounded and clamped to the range of setting `key` of `type`; a setting without a range passes through. */
export function clampConfigNumber(type: BlockType, key: string, value: number): number {
  const ranges = CONFIG_RANGES[type];
  const range = ranges && Object.prototype.hasOwnProperty.call(ranges, key) ? ranges[key] : undefined;
  if (!range) return value;
  return Math.max(range.min, Math.min(range.max, Math.round(value)));
}

/** Setting `key` of `config` as an in-range number, or `fallback` when it is not a finite number. */
export function rangedNumber(type: BlockType, config: Record<string, unknown>, key: string, fallback: number): number {
  const v = config[key];
  return typeof v === 'number' && Number.isFinite(v) ? clampConfigNumber(type, key, v) : fallback;
}
