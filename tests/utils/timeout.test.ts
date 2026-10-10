import { describe, it, expect, vi, afterEach } from 'vitest';
import { RequestTimeoutError, withTimeout } from '../../src/utils/timeout';

afterEach(() => { vi.useRealTimers(); });

describe('withTimeout', () => {
  it('rejects with RequestTimeoutError when the promise is still pending after the delay', async () => {
    vi.useFakeTimers();
    const result = withTimeout(new Promise(() => {}), 1000);
    const assertion = expect(result).rejects.toBeInstanceOf(RequestTimeoutError);
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });

  it('passes a value through and leaves no timer behind', async () => {
    vi.useFakeTimers();
    await expect(withTimeout(Promise.resolve(5), 1000)).resolves.toBe(5);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('passes a rejection through', async () => {
    await expect(withTimeout(Promise.reject(new Error('down')), 1000)).rejects.toThrow('down');
  });
});
