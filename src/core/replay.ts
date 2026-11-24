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
  /** When each character was finished, in ms from the first key. */
  marks: number[];
  /** Every finished character, wrong key and erase, in order: what a ghost of this run plays. */
  steps: GhostStep[];
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
  const steps: GhostStep[] = [];
  const gaps: number[] = [];
  // What a wrong key typed, as the page shows it: the key's own character, or a stand-in when no key of the layout types it.
  const labelOf = (code: string, shift: boolean): string => (code && layout.strokeLabel({ code, shift })) || UNKNOWN_KEY;
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
      steps.push({ at: time, kind: flag ? 'clear' : 'erase', label: '' });
      continue;
    }
    if (previous !== null) gaps.push(time - previous);
    previous = time;
    if (hardcore && typos > 0) {
      stats.miss(time);
      typos = Math.min(MAX_TYPOS, typos + 1);
      steps.push({ at: time, kind: 'stick', label: labelOf(code, flag === 1) });
      continue;
    }
    const note = notes[cursor];
    if (note.code === code && note.shift === (flag === 1)) {
      stats.hit(time, note.last);
      if (note.last) {
        marks.push(time);
        steps.push({ at: time, kind: 'char', label: '' });
      }
      cursor++;
    } else {
      stats.miss(time);
      if (hardcore) typos = Math.min(MAX_TYPOS, typos + 1);
      steps.push({ at: time, kind: hardcore ? 'stick' : 'flash', label: labelOf(code, flag === 1) });
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
    steps,
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

/**
 * One thing a ghost does, `at` ms after its first key: finishes the next character, types a
 * wrong key that only flashes (`label` is what it typed), types one that sticks as a hardcore
 * typo, or erases one typo or all of them.
 */
export interface GhostStep {
  at: number;
  kind: 'char' | 'flash' | 'stick' | 'erase' | 'clear';
  label: string;
}

/** What a ghost shows for a wrong key no key of its layout types, such as one from a phone's own keyboard. */
const UNKNOWN_KEY = '?';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
/** The sign before a step that is not a finished character. None of them is a base64 digit. */
const SIGN: Record<Exclude<GhostStep['kind'], 'char'>, string> = { flash: '~', stick: '!', erase: '<', clear: '|' };
const KIND_OF_SIGN = new Map(Object.entries(SIGN).map(([kind, sign]) => [sign, kind as GhostStep['kind']]));

/**
 * A ghost as one short string, the lightest form that still replays the run key by key.
 * Each step is the gap before it in tens of ms, two base64 digits (up to 40.95 s): a finished
 * character is the two digits alone, so a clean 60-word run stays under a kilobyte. A wrong
 * key that flashed is `~`, the gap and the character it typed; one that stuck is `!`, the gap
 * and the character; an erase is `<` and the gap; an erase of every typo `|` and the gap.
 * Ghosts saved before wrong keys were kept hold characters only, and still play.
 */
export function encodeGhost(steps: readonly GhostStep[]): string {
  let out = '';
  let previous = 0;
  for (const step of steps) {
    const gap = Math.min(4095, Math.max(0, Math.round((step.at - previous) / 10)));
    previous += gap * 10;
    const digits = B64[gap >> 6] + B64[gap & 63];
    if (step.kind === 'char') out += digits;
    else if (step.kind === 'flash' || step.kind === 'stick') out += SIGN[step.kind] + digits + String.fromCodePoint(step.label.codePointAt(0) ?? UNKNOWN_KEY.charCodeAt(0));
    else out += SIGN[step.kind] + digits;
  }
  return out;
}

/** A ghost read back: its steps, and when each character was finished, for the bars. */
export interface GhostTrack {
  steps: GhostStep[];
  marks: number[];
}

export function decodeGhost(ghost: string): GhostTrack {
  const steps: GhostStep[] = [];
  const marks: number[] = [];
  let time = 0;
  let i = 0;
  while (i < ghost.length) {
    const kind = KIND_OF_SIGN.get(ghost[i]) ?? 'char';
    if (kind !== 'char') i++;
    const high = B64.indexOf(ghost[i]);
    const low = B64.indexOf(ghost[i + 1]);
    if (high < 0 || low < 0) break;
    i += 2;
    time += ((high << 6) | low) * 10;
    let label = '';
    if (kind === 'flash' || kind === 'stick') {
      const point = ghost.codePointAt(i);
      if (point === undefined) break;
      label = String.fromCodePoint(point);
      i += label.length;
    }
    steps.push({ at: time, kind, label });
    if (kind === 'char') marks.push(time);
  }
  return { steps, marks };
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

/** How long a ghost's wrong key stays in sight when it did not stick. */
export const GHOST_FLASH_MS = 520;

/** A ghost at one moment, as the text draws it. */
export interface GhostView {
  /** Characters finished: its caret is on the next one. */
  done: number;
  /** Its hardcore typos, oldest first, waiting at the caret for their erase. */
  typos: string[];
  /** Its last wrong key that only flashed, while still in sight: what it typed, on which character, and when. */
  flash: { label: string; cell: number; at: number } | null;
}

/** Plays a ghost's steps up to `ms` after its first key. */
export function ghostView(track: GhostTrack, ms: number): GhostView {
  let done = 0;
  let typos: string[] = [];
  let flash: GhostView['flash'] = null;
  for (const step of track.steps) {
    if (step.at > ms) break;
    if (step.kind === 'char') done++;
    else if (step.kind === 'flash') flash = { label: step.label, cell: done, at: step.at };
    else if (step.kind === 'stick') {
      if (typos.length < MAX_TYPOS) typos = [...typos, step.label];
    } else if (step.kind === 'erase') typos = typos.slice(0, -1);
    else typos = [];
  }
  if (flash && ms - flash.at >= GHOST_FLASH_MS) flash = null;
  return { done, typos, flash };
}
