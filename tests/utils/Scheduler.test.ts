import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Scheduler } from '../../src/utils/Scheduler';

describe('Scheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires a timeout callback after the requested delay', () => {
    const s = new Scheduler();
    const fn = vi.fn();
    s.timeout('t', 50, fn);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('clears itself from hasTimeout once the callback has fired', () => {
    const s = new Scheduler();
    s.timeout('t', 50, () => {});
    expect(s.hasTimeout('t')).toBe(true);
    vi.advanceTimersByTime(50);
    expect(s.hasTimeout('t')).toBe(false);
  });

  it('cancels and replaces a previous timeout when the same name is re-scheduled', () => {
    const s = new Scheduler();
    const first = vi.fn();
    const second = vi.fn();
    s.timeout('t', 50, first);
    s.timeout('t', 50, second);
    vi.advanceTimersByTime(50);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('cancelTimeout prevents the callback and clears hasTimeout', () => {
    const s = new Scheduler();
    const fn = vi.fn();
    s.timeout('t', 50, fn);
    s.cancelTimeout('t');
    expect(s.hasTimeout('t')).toBe(false);
    vi.advanceTimersByTime(100);
    expect(fn).not.toHaveBeenCalled();
  });

  it('cancelAll tears down all pending timers and rAFs', () => {
    const s = new Scheduler();
    const a = vi.fn();
    const b = vi.fn();
    s.timeout('a', 50, a);
    s.timeout('b', 100, b);
    s.cancelAll();
    vi.advanceTimersByTime(200);
    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();
    expect(s.hasTimeout('a')).toBe(false);
    expect(s.hasTimeout('b')).toBe(false);
  });

  it('rAF callbacks fire on the next animation frame and de-register themselves', () => {
    const s = new Scheduler();
    const fn = vi.fn();
    s.raf('r', fn);
    expect(fn).not.toHaveBeenCalled();
    // Advance past the next animation frame. happy-dom polyfills rAF onto setTimeout(0).
    vi.advanceTimersByTime(16);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('re-scheduling the same rAF replaces the previous callback', () => {
    const s = new Scheduler();
    const first = vi.fn();
    const second = vi.fn();
    s.raf('r', first);
    s.raf('r', second);
    vi.advanceTimersByTime(16);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
