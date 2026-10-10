import { Setting, setIcon } from 'obsidian';
import { BaseBlock } from './BaseBlock';
import { rangedNumber } from '../utils/configRanges';
import { advance, initialState, remainingMs, skip, startOrPause, type PomodoroPhase, type PomodoroSettings, type PomodoroState } from '../utils/pomodoroTimer';
import { blockTitle } from '../blockMeta';

interface PomodoroConfig {
  workMinutes?: number;
  breakMinutes?: number;
  longBreakMinutes?: number;
  sessionsBeforeLong?: number;
  soundType?: 'none' | 'crystal' | 'chime' | 'bowl';
  autoStartCycle?: boolean;
}

const CIRCUMFERENCE = 2 * Math.PI * 52; // ≈ 326.73

/**
 * Module-level store so timer state survives re-renders and unmounts (edit mode
 * toggle, settings save, homepage closed) for the session. A running phase is
 * anchored to the clock (utils/pomodoroTimer.ts), so it keeps counting meanwhile.
 */
const timerStore = new Map<string, PomodoroState>();
let sharedAudioCtx: AudioContext | null = null;

/** Plugin unload cleanup: drop all per-instance timer state. */
export function clearPomodoroState(): void {
  timerStore.clear();
}

/** Plugin unload cleanup: close the shared AudioContext so it can be recreated after reload. */
export function closeSharedAudioCtx(): void {
  if (!sharedAudioCtx) return;
  void sharedAudioCtx.close().catch(() => { /* context may already be closed */ });
  sharedAudioCtx = null;
}

export class PomodoroBlock extends BaseBlock {
  private state!: PomodoroState;
  private timerEl: HTMLElement | null = null;
  private ringEl: SVGCircleElement | null = null;
  private phaseEl: HTMLElement | null = null;
  private sessionDotsEl: HTMLElement | null = null;
  private startPauseBtn: HTMLButtonElement | null = null;

  render(el: HTMLElement): void {
    el.addClass('pomodoro-block');

    this.renderHeader(el, blockTitle('pomodoro'));

    const container = el.createDiv({ cls: 'pomodoro-container' });

    // ── SVG progress ring ──────────────────────────────────────────────
    const ringWrap = container.createDiv({ cls: 'pomodoro-ring' });

    const svg = ringWrap.createSvg('svg', { attr: { viewBox: '0 0 120 120' } });

    svg.createSvg('circle', {
      attr: {
        cx: '60',
        cy: '60',
        r: '52',
        stroke: 'var(--background-modifier-border)',
        'stroke-width': '8',
        fill: 'transparent',
      },
    });

    const progressCircle = svg.createSvg('circle', {
      attr: {
        cx: '60',
        cy: '60',
        r: '52',
        stroke: 'var(--block-accent, var(--color-accent))',
        'stroke-width': '8',
        fill: 'transparent',
        'stroke-linecap': 'round',
        transform: 'rotate(-90 60 60)',
        'stroke-dasharray': String(CIRCUMFERENCE),
        'stroke-dashoffset': String(CIRCUMFERENCE),
      },
    });
    this.ringEl = progressCircle;

    // ── Time display (overlaid on ring) ─────────────────────────────────
    this.timerEl = ringWrap.createDiv({ cls: 'pomodoro-time' });

    // ── Phase label ────────────────────────────────────────────────────
    this.phaseEl = container.createDiv({ cls: 'pomodoro-phase' });

    // ── Session dots ───────────────────────────────────────────────────
    this.sessionDotsEl = container.createDiv({ cls: 'pomodoro-dots' });

    // ── Controls ───────────────────────────────────────────────────────
    const controls = container.createDiv({ cls: 'pomodoro-controls' });

    const startPauseBtn = controls.createEl('button', {
      cls: 'pomodoro-btn is-primary',
    });
    const startPauseIcon = startPauseBtn.createSpan({ cls: 'pomodoro-btn-icon' });
    setIcon(startPauseIcon, 'play');
    startPauseBtn.createSpan({ cls: 'pomodoro-btn-label', text: 'Start' });
    this.registerDomEvent(startPauseBtn, 'click', () => this.toggleStartPause());
    this.startPauseBtn = startPauseBtn;

    const resetBtn = controls.createEl('button', {
      cls: 'pomodoro-btn pomodoro-btn-reset',
    });
    const resetIcon = resetBtn.createSpan({ cls: 'pomodoro-btn-icon' });
    setIcon(resetIcon, 'rotate-ccw');
    resetBtn.createSpan({ cls: 'pomodoro-btn-label', text: 'Reset' });
    this.registerDomEvent(resetBtn, 'click', () => this.resetTimer());

    const skipBtn = controls.createEl('button', {
      cls: 'pomodoro-btn pomodoro-btn-skip',
    });
    const skipIcon = skipBtn.createSpan({ cls: 'pomodoro-btn-icon' });
    setIcon(skipIcon, 'skip-forward');
    skipBtn.createSpan({ cls: 'pomodoro-btn-label', text: 'Skip' });
    this.registerDomEvent(skipBtn, 'click', () => this.skipPhase());

    // ── Restore state (survives re-renders and unmounts in this session) ──
    // An idle timer is rebuilt from the settings, which may have changed. Phases
    // that ended while no block was mounted are caught up silently.
    const s = this.settings();
    const saved = timerStore.get(this.instance.id);
    const restored = saved && saved.phase !== 'idle' ? saved : initialState(s);
    this.setState(advance(restored, s, Date.now()).state);

    // ── Tick: the clock decides, the interval only refreshes the display ──
    this.registerInterval(window.setInterval(() => this.tick(), 1000));

    // An idle timer holds nothing worth keeping; a paused or running one stays
    // for the next mount (R7).
    this.register(() => {
      if (timerStore.get(this.instance.id)?.phase === 'idle') timerStore.delete(this.instance.id);
    });
  }

  // ── Timer logic ────────────────────────────────────────────────────────

  /** Settings as numbers in their ranges (configRanges.ts, M13). */
  private settings(): PomodoroSettings {
    const c = this.instance.config;
    return {
      workMinutes: rangedNumber('pomodoro', c, 'workMinutes', 25),
      breakMinutes: rangedNumber('pomodoro', c, 'breakMinutes', 5),
      longBreakMinutes: rangedNumber('pomodoro', c, 'longBreakMinutes', 15),
      sessionsBeforeLong: rangedNumber('pomodoro', c, 'sessionsBeforeLong', 4),
      autoStartCycle: c.autoStartCycle === true,
    };
  }

  /** Keep `next` as the shown and the stored state: they never differ (R7). */
  private setState(next: PomodoroState): void {
    this.state = next;
    timerStore.set(this.instance.id, next);
    this.updateDisplay();
  }

  private tick(): void {
    const { state, completed } = advance(this.state, this.settings(), Date.now());
    if (completed > 0) {
      const { soundType = 'crystal' } = this.instance.config as PomodoroConfig;
      if (soundType !== 'none') PomodoroBlock.playNotificationSound(soundType);
      this.setState(state);
    } else if (this.state.running) {
      this.updateDisplay();
    }
  }

  public static playNotificationSound(type: 'crystal' | 'chime' | 'bowl'): void {
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as Record<string, typeof AudioContext>).webkitAudioContext;
      if (!AudioContextClass) return;
      
      if (!sharedAudioCtx) {
        sharedAudioCtx = new AudioContextClass();
      }
      const ctx = sharedAudioCtx;
      // Many browsers suspend the audio context if it was created before user interaction.
      if (ctx.state === 'suspended') {
        // We aren't awaiting this since the sound schedule doesn't rely on it executing synchronously,
        // but it will immediately process queued audio commands.
        void ctx.resume();
      }
      
      const t = ctx.currentTime;
      
      if (type === 'crystal') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, t);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.5, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 1);
        osc.start(t);
        osc.stop(t + 1.1);
      } 
      else if (type === 'chime') {
        [800, 1000].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, t + i * 0.2);
          gain.gain.setValueAtTime(0, t + i * 0.2);
          gain.gain.linearRampToValueAtTime(0.3, t + i * 0.2 + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.01, t + i * 0.2 + 1);
          osc.start(t + i * 0.2);
          osc.stop(t + i * 0.2 + 1.1);
        });
      } 
      else if (type === 'bowl') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, t);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.6, t + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 4);
        osc.start(t);
        osc.stop(t + 4.1);
      }
    } catch (e) {
      console.error('[Homepage Blocks] Pomodoro audio playback failed', e instanceof Error ? e.message : 'unknown error');
    }
  }

  private toggleStartPause(): void {
    this.setState(startOrPause(this.state, this.settings(), Date.now()));
  }

  private resetTimer(): void {
    this.setState(initialState(this.settings()));
  }

  private skipPhase(): void {
    this.setState(skip(this.state, this.settings(), Date.now()));
  }

  // ── Display ────────────────────────────────────────────────────────────

  private updateDisplay(): void {
    const left = remainingMs(this.state, Date.now());
    const secsLeft = Math.ceil(left / 1000);

    // Time text
    if (this.timerEl) {
      const mins = Math.floor(secsLeft / 60);
      const secs = secsLeft % 60;
      this.timerEl.setText(
        `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`,
      );
    }

    // Ring progress
    if (this.ringEl) {
      const progress = this.state.totalMs > 0
        ? (this.state.totalMs - left) / this.state.totalMs
        : 0;
      const offset = CIRCUMFERENCE * (1 - progress);
      this.ringEl.setAttribute('stroke-dashoffset', String(offset));
    }

    // Phase label
    if (this.phaseEl) {
      const labels: Record<PomodoroPhase, string> = {
        idle: 'Ready',
        work: 'Work',
        break: 'Break',
        longBreak: 'Long break',
      };
      this.phaseEl.setText(labels[this.state.phase]);
    }

    // Session dots
    if (this.sessionDotsEl) {
      const { sessionsBeforeLong } = this.settings();
      this.sessionDotsEl.empty();
      for (let i = 0; i < sessionsBeforeLong; i++) {
        const dot = this.sessionDotsEl.createSpan({ cls: 'pomodoro-dot' });
        if (i < this.state.completedSessions % sessionsBeforeLong) {
          dot.addClass('is-complete');
        }
      }
    }

    // Start/Pause button text + icon
    if (this.startPauseBtn) {
      const label = this.startPauseBtn.querySelector('.pomodoro-btn-label');
      const icon = this.startPauseBtn.querySelector('.pomodoro-btn-icon');
      if (this.state.phase === 'idle') {
        label?.setText('Start');
        if (icon instanceof HTMLElement) setIcon(icon, 'play');
      } else if (this.state.running) {
        label?.setText('Pause');
        if (icon instanceof HTMLElement) setIcon(icon, 'pause');
      } else {
        label?.setText('Resume');
        if (icon instanceof HTMLElement) setIcon(icon, 'play');
      }
    }
  }

  // ── Settings ───────────────────────────────────────────────────────────

  renderContentSettings(body: HTMLElement, draft: Record<string, unknown>): void {
    new Setting(body)
      .setName('Work duration')
      .setDesc('Minutes per work session.')
      .addSlider(s =>
        s.setLimits(1, 60, 1)
         .setValue(draft.workMinutes as number ?? 25)
         .setDynamicTooltip()
         .onChange(v => { draft.workMinutes = v; }),
      );

    new Setting(body)
      .setName('Break duration')
      .setDesc('Minutes per short break.')
      .addSlider(s =>
        s.setLimits(1, 30, 1)
         .setValue(draft.breakMinutes as number ?? 5)
         .setDynamicTooltip()
         .onChange(v => { draft.breakMinutes = v; }),
      );

    new Setting(body)
      .setName('Long break duration')
      .setDesc('Minutes per long break.')
      .addSlider(s =>
        s.setLimits(1, 60, 1)
         .setValue(draft.longBreakMinutes as number ?? 15)
         .setDynamicTooltip()
         .onChange(v => { draft.longBreakMinutes = v; }),
      );

    new Setting(body)
      .setName('Sessions before long break')
      .setDesc('Work sessions before a long break.')
      .addSlider(s =>
        s.setLimits(2, 8, 1)
         .setValue(draft.sessionsBeforeLong as number ?? 4)
         .setDynamicTooltip()
         .onChange(v => { draft.sessionsBeforeLong = v; }),
      );

    new Setting(body)
      .setName('Notification sound')
      .setDesc('Play a sound when a phase ends.')
      .addDropdown(d => {
        d.addOption('none', 'None')
         .addOption('crystal', 'Crystal')
         .addOption('chime', 'Chime')
         .addOption('bowl', 'Singing bowl')
         .setValue((draft as PomodoroConfig).soundType ?? 'crystal')
         .onChange(v => {
           (draft as PomodoroConfig).soundType = v as PomodoroConfig['soundType'];
           if (v !== 'none') {
             PomodoroBlock.playNotificationSound(v as 'crystal' | 'chime' | 'bowl');
           }
         });
      });

    new Setting(body)
      .setName('Auto-start next session')
      .setDesc('Start the next phase automatically.')
      .addToggle(t =>
        t.setValue((draft as PomodoroConfig).autoStartCycle ?? false)
         .onChange(v => { (draft as PomodoroConfig).autoStartCycle = v; }),
      );
  }
}
