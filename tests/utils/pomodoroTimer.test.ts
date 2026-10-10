import { describe, it, expect } from 'vitest';
import { advance, initialState, remainingMs, skip, startOrPause, type PomodoroSettings } from '../../src/utils/pomodoroTimer';

const MIN = 60_000;
const s: PomodoroSettings = { workMinutes: 25, breakMinutes: 5, longBreakMinutes: 15, sessionsBeforeLong: 2, autoStartCycle: false };

describe('pomodoroTimer', () => {
  it('counts a running phase down from the clock', () => {
    const running = startOrPause(initialState(s), s, 0);
    expect(remainingMs(running, 10 * MIN)).toBe(15 * MIN);
  });

  it('keeps the time left while paused and resumes from it', () => {
    const paused = startOrPause(startOrPause(initialState(s), s, 0), s, 10 * MIN);
    expect(remainingMs(paused, 50 * MIN)).toBe(15 * MIN);
    const resumed = startOrPause(paused, s, 50 * MIN);
    expect(remainingMs(resumed, 55 * MIN)).toBe(10 * MIN);
  });

  it('moves to a paused break when the work phase ends', () => {
    const { state, completed } = advance(startOrPause(initialState(s), s, 0), s, 25 * MIN);
    expect(completed).toBe(1);
    expect(state).toMatchObject({ phase: 'break', running: false, completedSessions: 1, remainingMs: 5 * MIN });
  });

  it('catches up through every phase that ended while no block was mounted (N12)', () => {
    const auto = { ...s, autoStartCycle: true };
    // work 0-25, break 25-30, work 30-55, long break 55-70, then the cycle stops
    const { state, completed } = advance(startOrPause(initialState(auto), auto, 0), auto, 100 * MIN);
    expect(completed).toBe(4);
    expect(state).toMatchObject({ phase: 'work', running: false, completedSessions: 0 });
  });

  it('skips a work phase to a paused break when breaks do not start on their own (R7)', () => {
    const skipped = skip(startOrPause(initialState(s), s, 0), s, 3 * MIN);
    expect(skipped).toMatchObject({ phase: 'break', running: false, completedSessions: 1 });
  });
});
