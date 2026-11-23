import { MAX_TYPOS } from './hardcore';
import type { Layout } from './layouts';
import { SetStats } from './metrics';

/**
 * What a set leaves behind for the server: every keystroke and every erase, in order,
 * with the time since the one before. The server plays it back over the text with the
 * same rules as the drills and keeps its own numbers, never the ones a page claims.
 */

/** Stands in for a key code on an erase: Backspace, one typo or all of them. */
export const ERASE = '#bs';

/** `[ms since the previous event, key code, Shift held]`, or `[ms, ERASE, every typo]`. A code of `''` is a character no key of the layout types. */
export type LogEvent = [dt: number, code: string, flag: 0 | 1];

/** Builds the log as the set is typed. Times are rounded against the first event, so rounding never adds up. */
export class KeyLog {
  private events: LogEvent[] = [];
  private first: number | null = null;
  private last = 0;

  stroke(code: string, shift: boolean, time: number): void {
    this.push(code, shift ? 1 : 0, time);
  }

  erase(all: boolean, time: number): void {
    this.push(ERASE, all ? 1 : 0, time);
  }

  get length(): number {
    return this.events.length;
  }

  take(): LogEvent[] {
    return this.events.slice();
  }

  reset(): void {
    this.events = [];
    this.first = null;
    this.last = 0;
  }

  private push(code: string, flag: 0 | 1, time: number): void {
    this.first ??= time;
    const at = Math.round(time - this.first);
    this.events.push([Math.max(0, at - this.last), code, flag]);
    this.last = Math.max(this.last, at);
  }
}

export interface Replay {
  /** True when the log typed the whole text. */
  complete: boolean;
  wpm: number;
  acc: number;
  chars: number;
  correct: number;
  wrong: number;
  activeMs: number;
  /** When each character was finished, in ms from the first key: what a ghost of this run plays. */
  marks: number[];
  /** Gaps between strokes, in ms, for the checks below. */
  gaps: number[];
}

/**
 * Plays a log back over a text. A right key moves the cursor; a wrong one is a miss and
 * the cursor stays. In hardcore a wrong key sticks: every key after it is a miss too until
 * Backspace has erased them all. Keys after the last character are ignored, as the page
 * ignores them behind its result.
 */
export function replay(layout: Layout, text: string, log: readonly LogEvent[], hardcore: boolean): Replay {
  const notes = layout.targets(text).flatMap((target) =>
    target.strokes.map((stroke, i) => ({ code: stroke.code, shift: stroke.shift, last: i === target.strokes.length - 1 })),
  );
  const stats = new SetStats();
  const marks: number[] = [];
  const gaps: number[] = [];
  let cursor = 0;
  let typos = 0;
  let time = 0;
  let previous: number | null = null;
  for (const [dt, code, flag] of log) {
    if (cursor >= notes.length) break;
    time += Math.max(0, dt);
    if (code === ERASE) {
      if (typos === 0) continue;
      typos = flag ? 0 : typos - 1;
      stats.pace(time);
      continue;
    }
    if (previous !== null) gaps.push(time - previous);
    previous = time;
    if (hardcore && typos > 0) {
      stats.miss(time);
      typos = Math.min(MAX_TYPOS, typos + 1);
      continue;
    }
    const note = notes[cursor];
    if (note.code === code && note.shift === (flag === 1)) {
      stats.hit(time, note.last);
      if (note.last) marks.push(time);
      cursor++;
    } else {
      stats.miss(time);
      if (hardcore) typos = Math.min(MAX_TYPOS, typos + 1);
    }
  }
  return {
    complete: notes.length > 0 && cursor >= notes.length,
    wpm: stats.wpm,
    acc: stats.accuracy,
    chars: stats.chars,
    correct: stats.correct,
    wrong: stats.wrong,
    activeMs: stats.activeMs,
    marks,
    gaps,
  };
}

/** Fastest a set may be and still count: past this it is a script, not a typist. */
export const MAX_WPM = 260;
/** A set needs this accuracy to rank. */
export const RANK_ACCURACY = 0.95;
/** A set needs this many characters to rank: shorter bursts say little. */
export const RANK_CHARS = 40;
/** Gaps under this are rollover or a script; a typist has some, never most. */
const FLAT_GAP_MS = 12;
const FLAT_SHARE = 0.35;

export type Verdict = 'ok' | 'incomplete' | 'too-fast' | 'machine';

/** Whether a replayed set is a person typing the whole text. */
export function verdict(run: Replay): Verdict {
  if (!run.complete) return 'incomplete';
  if (run.wpm > MAX_WPM) return 'too-fast';
  const flat = run.gaps.filter((gap) => gap < FLAT_GAP_MS).length;
  if (run.gaps.length >= 20 && flat / run.gaps.length > FLAT_SHARE) return 'machine';
  // Every stroke the same distance apart is a metronome, not a hand.
  if (run.gaps.length >= 20) {
    const mean = run.gaps.reduce((sum, gap) => sum + gap, 0) / run.gaps.length;
    const spread = Math.sqrt(run.gaps.reduce((sum, gap) => sum + (gap - mean) ** 2, 0) / run.gaps.length);
    if (mean > 0 && spread / mean < 0.06) return 'machine';
  }
  return 'ok';
}

/** True when a good set also clears the bar for the boards. */
export const ranks = (run: Replay): boolean => run.acc >= RANK_ACCURACY && run.chars >= RANK_CHARS;

// ---------- ghosts ----------

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/**
 * A ghost: when each character of a run was finished. Stored as the gaps between them in
 * tens of ms, two base64 characters per gap (up to 40.95 s), so a 60-word run fits in under a kilobyte.
 */
export function encodeGhost(marks: readonly number[]): string {
  let out = '';
  let previous = 0;
  for (const mark of marks) {
    const gap = Math.min(4095, Math.max(0, Math.round((mark - previous) / 10)));
    previous += gap * 10;
    out += B64[gap >> 6] + B64[gap & 63];
  }
  return out;
}

export function decodeGhost(ghost: string): number[] {
  const marks: number[] = [];
  let time = 0;
  for (let i = 0; i + 1 < ghost.length; i += 2) {
    const high = B64.indexOf(ghost[i]);
    const low = B64.indexOf(ghost[i + 1]);
    if (high < 0 || low < 0) break;
    time += ((high << 6) | low) * 10;
    marks.push(time);
  }
  return marks;
}

/** How many characters a ghost had finished `ms` after its first key. */
export function ghostAt(marks: readonly number[], ms: number): number {
  let low = 0;
  let high = marks.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (marks[mid] <= ms) low = mid + 1;
    else high = mid;
  }
  return low;
}
