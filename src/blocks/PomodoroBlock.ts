import { App, Modal, Setting } from 'obsidian';
import { BlockInstance, IHomepagePlugin } from '../types';
import { BaseBlock } from './BaseBlock';

type PomodoroPhase = 'idle' | 'work' | 'break' | 'longBreak';

interface PomodoroConfig {
  title?: string;
  workMinutes?: number;
  breakMinutes?: number;
  longBreakMinutes?: number;
  sessionsBeforeLong?: number;
}

const CIRCUMFERENCE = 2 * Math.PI * 52; // ≈ 326.73

/** Module-level store so timer state survives block re-renders (edit mode toggle, settings save, etc.). */
interface TimerState {
  phase: PomodoroPhase;
  secondsLeft: number;
  totalSeconds: number;
  completedSessions: number;
  running: boolean;
}
const timerStore = new Map<string, TimerState>();

export class PomodoroBlock extends BaseBlock {
  private phase: PomodoroPhase = 'idle';
  private secondsLeft = 0;
  private completedSessions = 0;
  private running = false;
  private timerEl: HTMLElement | null = null;
  private ringEl: SVGCircleElement | null = null;
  private phaseEl: HTMLElement | null = null;
  private sessionDotsEl: HTMLElement | null = null;
  private startPauseBtn: HTMLButtonElement | null = null;

  /** Total seconds for the current phase (used to compute ring progress). */
  private totalSeconds = 0;

  render(el: HTMLElement): void {
    const {
      workMinutes = 25,
    } = this.instance.config as PomodoroConfig;

    el.addClass('pomodoro-block');

    this.renderHeader(el, 'Pomodoro');

    const container = el.createDiv({ cls: 'pomodoro-container' });

    // ── SVG progress ring ──────────────────────────────────────────────
    const ringWrap = container.createDiv({ cls: 'pomodoro-ring' });

    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 120 120');

    const bgCircle = document.createElementNS(NS, 'circle');
    bgCircle.setAttribute('cx', '60');
    bgCircle.setAttribute('cy', '60');
    bgCircle.setAttribute('r', '52');
    bgCircle.setAttribute('stroke', 'var(--background-modifier-border)');
    bgCircle.setAttribute('stroke-width', '8');
    bgCircle.setAttribute('fill', 'transparent');
    svg.appendChild(bgCircle);

    const progressCircle = document.createElementNS(NS, 'circle');
    progressCircle.setAttribute('cx', '60');
    progressCircle.setAttribute('cy', '60');
    progressCircle.setAttribute('r', '52');
    progressCircle.setAttribute('stroke', 'var(--color-accent)');
    progressCircle.setAttribute('stroke-width', '8');
    progressCircle.setAttribute('fill', 'transparent');
    progressCircle.setAttribute('stroke-linecap', 'round');
    progressCircle.setAttribute('transform', 'rotate(-90 60 60)');
    progressCircle.setAttribute('stroke-dasharray', String(CIRCUMFERENCE));
    progressCircle.setAttribute('stroke-dashoffset', String(CIRCUMFERENCE));
    svg.appendChild(progressCircle);
    this.ringEl = progressCircle;

    ringWrap.appendChild(svg);

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
      text: 'Start',
    });
    this.registerDomEvent(startPauseBtn, 'click', () => this.toggleStartPause());
    this.startPauseBtn = startPauseBtn;

    const resetBtn = controls.createEl('button', {
      cls: 'pomodoro-btn pomodoro-btn-reset',
      text: 'Reset',
    });
    this.registerDomEvent(resetBtn, 'click', () => this.resetTimer());

    const skipBtn = controls.createEl('button', {
      cls: 'pomodoro-btn pomodoro-btn-skip',
      text: 'Skip',
    });
    this.registerDomEvent(skipBtn, 'click', () => this.skipPhase());

    // ── Restore state from module-level store (survives re-renders) ────
    const saved = timerStore.get(this.instance.id);
    if (saved) {
      this.phase = saved.phase;
      this.secondsLeft = saved.secondsLeft;
      this.totalSeconds = saved.totalSeconds;
      this.completedSessions = saved.completedSessions;
      this.running = saved.running;
    } else {
      this.secondsLeft = workMinutes * 60;
      this.totalSeconds = this.secondsLeft;
    }
    this.updateDisplay();

    // ── Tick interval ──────────────────────────────────────────────────
    this.registerInterval(window.setInterval(() => this.tick(), 1000));
  }

  // ── Timer logic ────────────────────────────────────────────────────────

  /** Persist timer state to module-level store so it survives re-renders. */
  private saveState(): void {
    timerStore.set(this.instance.id, {
      phase: this.phase,
      secondsLeft: this.secondsLeft,
      totalSeconds: this.totalSeconds,
      completedSessions: this.completedSessions,
      running: this.running,
    });
  }

  private tick(): void {
    if (!this.running || this.phase === 'idle') return;

    this.secondsLeft--;

    if (this.secondsLeft <= 0) {
      this.secondsLeft = 0;
      this.onPhaseComplete();
    }

    this.updateDisplay();
    this.saveState();
  }

  private onPhaseComplete(): void {
    const {
      breakMinutes = 5,
      longBreakMinutes = 15,
      sessionsBeforeLong = 4,
      workMinutes = 25,
    } = this.instance.config as PomodoroConfig;

    if (this.phase === 'work') {
      this.completedSessions++;
      if (this.completedSessions % sessionsBeforeLong === 0) {
        this.startPhase('longBreak', longBreakMinutes);
      } else {
        this.startPhase('break', breakMinutes);
      }
    } else {
      // After break or long break, set up next work but pause
      this.phase = 'work';
      this.secondsLeft = workMinutes * 60;
      this.totalSeconds = this.secondsLeft;
      this.running = false;
      this.updateDisplay();
    }
  }

  private startPhase(phase: PomodoroPhase, minutes: number): void {
    this.phase = phase;
    this.secondsLeft = minutes * 60;
    this.totalSeconds = this.secondsLeft;
    this.running = true;
    this.updateDisplay();
    this.saveState();
  }

  private toggleStartPause(): void {
    if (this.phase === 'idle') {
      const { workMinutes = 25 } = this.instance.config as PomodoroConfig;
      this.startPhase('work', workMinutes);
      return;
    }
    this.running = !this.running;
    this.updateDisplay();
    this.saveState();
  }

  private resetTimer(): void {
    const { workMinutes = 25 } = this.instance.config as PomodoroConfig;
    this.phase = 'idle';
    this.running = false;
    this.completedSessions = 0;
    this.secondsLeft = workMinutes * 60;
    this.totalSeconds = this.secondsLeft;
    this.updateDisplay();
    this.saveState();
  }

  private skipPhase(): void {
    if (this.phase === 'idle') return;
    this.secondsLeft = 0;
    this.onPhaseComplete();
    this.updateDisplay();
  }

  // ── Display ────────────────────────────────────────────────────────────

  private updateDisplay(): void {
    // Time text
    if (this.timerEl) {
      const mins = Math.floor(this.secondsLeft / 60);
      const secs = this.secondsLeft % 60;
      this.timerEl.setText(
        `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`,
      );
    }

    // Ring progress
    if (this.ringEl) {
      const progress = this.totalSeconds > 0
        ? (this.totalSeconds - this.secondsLeft) / this.totalSeconds
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
        longBreak: 'Long Break',
      };
      this.phaseEl.setText(labels[this.phase]);
    }

    // Session dots
    if (this.sessionDotsEl) {
      const { sessionsBeforeLong = 4 } = this.instance.config as PomodoroConfig;
      this.sessionDotsEl.empty();
      for (let i = 0; i < sessionsBeforeLong; i++) {
        const dot = this.sessionDotsEl.createSpan({ cls: 'pomodoro-dot' });
        if (i < this.completedSessions % sessionsBeforeLong) {
          dot.addClass('is-complete');
        }
      }
    }

    // Start/Pause button text
    if (this.startPauseBtn) {
      if (this.phase === 'idle') {
        this.startPauseBtn.setText('Start');
      } else {
        this.startPauseBtn.setText(this.running ? 'Pause' : 'Resume');
      }
    }
  }

  // ── Settings ───────────────────────────────────────────────────────────

  openSettings(onSave: (config: Record<string, unknown>) => void): void {
    new PomodoroSettingsModal(this.app, this.instance.config, onSave).open();
  }
}

class PomodoroSettingsModal extends Modal {
  constructor(
    app: App,
    private config: Record<string, unknown>,
    private onSave: (config: Record<string, unknown>) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: 'Pomodoro Settings' });

    const draft = structuredClone(this.config);

    new Setting(contentEl)
      .setName('Work duration')
      .setDesc('Minutes per work session.')
      .addSlider(s =>
        s.setLimits(1, 60, 1)
         .setValue(draft.workMinutes as number ?? 25)
         .setDynamicTooltip()
         .onChange(v => { draft.workMinutes = v; }),
      );

    new Setting(contentEl)
      .setName('Break duration')
      .setDesc('Minutes per short break.')
      .addSlider(s =>
        s.setLimits(1, 30, 1)
         .setValue(draft.breakMinutes as number ?? 5)
         .setDynamicTooltip()
         .onChange(v => { draft.breakMinutes = v; }),
      );

    new Setting(contentEl)
      .setName('Long break duration')
      .setDesc('Minutes per long break.')
      .addSlider(s =>
        s.setLimits(1, 60, 1)
         .setValue(draft.longBreakMinutes as number ?? 15)
         .setDynamicTooltip()
         .onChange(v => { draft.longBreakMinutes = v; }),
      );

    new Setting(contentEl)
      .setName('Sessions before long break')
      .setDesc('Number of work sessions before a long break.')
      .addSlider(s =>
        s.setLimits(2, 8, 1)
         .setValue(draft.sessionsBeforeLong as number ?? 4)
         .setDynamicTooltip()
         .onChange(v => { draft.sessionsBeforeLong = v; }),
      );

    new Setting(contentEl)
      .addButton(btn =>
        btn.setButtonText('Save').setCta().onClick(() => {
          this.onSave(draft);
          this.close();
        }),
      )
      .addButton(btn =>
        btn.setButtonText('Cancel').onClick(() => this.close()),
      );
  }

  onClose(): void { this.contentEl.empty(); }
}
