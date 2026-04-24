/**
 * Named timer + requestAnimationFrame manager. Re-scheduling a name cancels the previous callback
 * so a burst of "schedule X" calls collapses into a single fire; cancelAll() cleans up on teardown.
 */
export class Scheduler {
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private rafs = new Map<string, number>();

  timeout(name: string, ms: number, fn: () => void): void {
    this.cancelTimeout(name);
    this.timers.set(name, setTimeout(() => { this.timers.delete(name); fn(); }, ms));
  }

  raf(name: string, fn: () => void): void {
    this.cancelRaf(name);
    const id = requestAnimationFrame(() => { this.rafs.delete(name); fn(); });
    this.rafs.set(name, id);
  }

  cancelTimeout(name: string): void {
    const id = this.timers.get(name);
    if (id !== undefined) { clearTimeout(id); this.timers.delete(name); }
  }

  hasTimeout(name: string): boolean {
    return this.timers.has(name);
  }

  cancelRaf(name: string): void {
    const id = this.rafs.get(name);
    if (id !== undefined) { cancelAnimationFrame(id); this.rafs.delete(name); }
  }

  cancelAll(): void {
    for (const id of this.timers.values()) clearTimeout(id);
    this.timers.clear();
    for (const id of this.rafs.values()) cancelAnimationFrame(id);
    this.rafs.clear();
  }
}
