/** Standard typing-test convention: one word is five characters. */
const CHARS_PER_WORD = 5;
/** A gap longer than this is a pause, not typing time. */
const PAUSE_MS = 2000;
/** Shortest span the rolling rate divides by, so the first keystrokes cannot spike it. */
const MIN_SPAN_MS = 2500;

/** Words per minute over a sliding window of recent correct characters. */
export class RollingWpm {
  private stamps: number[] = [];
  private startedAt: number | null = null;
  windowMs: number;

  constructor(windowMs: number) {
    this.windowMs = windowMs;
  }

  add(now: number): void {
    const last = this.stamps[this.stamps.length - 1];
    // After a long pause the warm-up restarts, so the old run does not dilute the new one.
    if (this.startedAt === null || (last !== undefined && now - last > this.windowMs)) this.startedAt = now;
    this.stamps.push(now);
    this.trim(now);
  }

  value(now: number): number {
    this.trim(now);
    if (this.stamps.length === 0 || this.startedAt === null) return 0;
    const span = Math.min(this.windowMs, Math.max(now - this.startedAt, MIN_SPAN_MS));
    return (this.stamps.length / CHARS_PER_WORD) * (60000 / span);
  }

  reset(): void {
    this.stamps = [];
    this.startedAt = null;
  }

  private trim(now: number): void {
    const cutoff = now - this.windowMs;
    let drop = 0;
    while (drop < this.stamps.length && this.stamps[drop] < cutoff) drop++;
    if (drop > 0) this.stamps.splice(0, drop);
  }
}

/** Totals for the current set: accuracy, streak, and speed over active typing time. */
export class SetStats {
  chars = 0;
  correct = 0;
  wrong = 0;
  streak = 0;
  bestStreak = 0;
  activeMs = 0;
  private last: number | null = null;

  /** A correct stroke. `completesChar` is false for the first half of a dead-key pair. */
  hit(now: number, completesChar: boolean): void {
    this.correct++;
    this.streak++;
    this.bestStreak = Math.max(this.bestStreak, this.streak);
    if (completesChar) this.chars++;
    this.clock(now);
  }

  miss(now: number): void {
    this.wrong++;
    this.streak = 0;
    this.clock(now);
  }

  /** A keystroke that is neither right nor wrong, such as a Backspace: it only keeps the clock running. */
  pace(now: number): void {
    this.clock(now);
  }

  get accuracy(): number {
    const total = this.correct + this.wrong;
    return total === 0 ? 1 : this.correct / total;
  }

  get wpm(): number {
    return this.activeMs < 1000 ? 0 : (this.chars / CHARS_PER_WORD) * (60000 / this.activeMs);
  }

  private clock(now: number): void {
    if (this.last !== null) this.activeMs += Math.min(now - this.last, PAUSE_MS);
    this.last = now;
  }
}

/** Speed a per-key interval corresponds to, in words per minute. */
export const intervalToWpm = (ms: number): number => (ms > 0 ? 60000 / ms / CHARS_PER_WORD : 0);

/** Speed for a count of characters typed over a stretch of active typing time. */
export const charsToWpm = (chars: number, ms: number): number => (ms > 0 ? (chars / CHARS_PER_WORD) * (60000 / ms) : 0);

/** Samples a key, a finger or a history line needs before its numbers mean anything. */
export const MIN_SAMPLES = 5;
