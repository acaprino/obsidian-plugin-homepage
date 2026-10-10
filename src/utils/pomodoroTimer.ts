export type PomodoroPhase = 'idle' | 'work' | 'break' | 'longBreak';

export interface PomodoroSettings {
  workMinutes: number;
  breakMinutes: number;
  longBreakMinutes: number;
  sessionsBeforeLong: number;
  autoStartCycle: boolean;
}

/**
 * A Pomodoro timer. A running phase ends at `endsAt` (epoch ms), so the time
 * left comes from the clock and keeps going while no block is mounted (edit
 * mode, homepage closed: N12); a paused or idle phase keeps `remainingMs`.
 */
export interface PomodoroState {
  phase: PomodoroPhase;
  running: boolean;
  endsAt: number;
  remainingMs: number;
  totalMs: number;
  completedSessions: number;
}

const MINUTE = 60_000;

function enter(phase: PomodoroPhase, minutes: number, running: boolean, from: number, completedSessions: number): PomodoroState {
  const ms = minutes * MINUTE;
  return { phase, running, endsAt: running ? from + ms : 0, remainingMs: ms, totalMs: ms, completedSessions };
}

export function initialState(s: PomodoroSettings): PomodoroState {
  return enter('idle', s.workMinutes, false, 0, 0);
}

export function remainingMs(st: PomodoroState, now: number): number {
  return st.running ? Math.max(0, st.endsAt - now) : st.remainingMs;
}

/** Start from idle, pause a running phase, or resume a paused one. */
export function startOrPause(st: PomodoroState, s: PomodoroSettings, now: number): PomodoroState {
  if (st.phase === 'idle') return enter('work', s.workMinutes, true, now, st.completedSessions);
  if (st.running) return { ...st, running: false, endsAt: 0, remainingMs: remainingMs(st, now) };
  return { ...st, running: true, endsAt: now + st.remainingMs };
}

/** The phase after `st`, which ended at `at`. A phase that runs on starts at `at`. */
function next(st: PomodoroState, s: PomodoroSettings, at: number): PomodoroState {
  if (st.phase === 'work') {
    const done = st.completedSessions + 1;
    const long = done % s.sessionsBeforeLong === 0;
    return enter(long ? 'longBreak' : 'break', long ? s.longBreakMinutes : s.breakMinutes, s.autoStartCycle, at, done);
  }
  // A long break completes the cycle: the next work phase waits for Start.
  if (st.phase === 'longBreak') return enter('work', s.workMinutes, false, at, 0);
  return enter('work', s.workMinutes, s.autoStartCycle, at, st.completedSessions);
}

/** Skip to the next phase now; the stored state is the shown state (R7). */
export function skip(st: PomodoroState, s: PomodoroSettings, now: number): PomodoroState {
  return st.phase === 'idle' ? st : next(st, s, now);
}

/**
 * Bring `st` up to `now`, completing every phase that ended meanwhile in turn.
 * `completed` counts them, for one chime however many there were. A cycle stops
 * after its long break, so the loop ends within 2 × sessionsBeforeLong steps.
 */
export function advance(st: PomodoroState, s: PomodoroSettings, now: number): { state: PomodoroState; completed: number } {
  let state = st;
  let completed = 0;
  while (state.running && state.endsAt <= now) {
    state = next(state, s, state.endsAt);
    completed++;
  }
  return { state, completed };
}
