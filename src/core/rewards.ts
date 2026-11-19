import type { Finger } from './fingers';
import { FINGERS, fingerKind, isWeakFinger } from './fingers';
import type { HistoryEntry, KeyTally } from './history';
import { rolling, series } from './history';
import type { Layout, LayoutId } from './layouts';
import { intervalToWpm, MIN_SAMPLES } from './metrics';
import type { DrillId, Lang } from './store';

/**
 * What the trainer notices when the typist does well: a streak of right keys
 * that outlasts the best one, a set faster than the ones before it, a finger
 * ahead of its own average, days of practice in a row. Everything here is
 * counted from keys and saved sets; nothing is estimated.
 */

/** The streak counter stays out of sight until the streak is worth a look. */
export const STREAK_SHOWN_FROM = 10;
/** A best streak shorter than this falls without a celebration: the first minutes of a profile are not records. */
export const RECORD_FROM = 25;

/** Streak lengths that get a mark: 25, 50, then every hundred. */
export const isMilestone = (streak: number): boolean => streak === 25 || streak === 50 || (streak > 0 && streak % 100 === 0);

/** Best streaks are kept per layout and drill. */
export const streakKey = (layout: string, drill: string): string => `${layout}|${drill}`;

/** What one right key did to the streak. */
export interface StreakStep {
  milestone: boolean;
  /** True on the one key that takes the streak past the best it began against. */
  record: boolean;
}

/**
 * Right keys in a row. A streak runs on from one set to the next and ends on a
 * wrong key. `best` is what there is to beat: the best streak as it stood when
 * this one began.
 */
export class Streak {
  count = 0;
  best: number;

  constructor(best = 0) {
    this.best = best;
  }

  hit(): StreakStep {
    this.count++;
    return { milestone: isMilestone(this.count), record: this.best >= RECORD_FROM && this.count === this.best + 1 };
  }

  /** True once the streak is longer than the best it began against. */
  get past(): boolean {
    return this.best > 0 && this.count > this.best;
  }

  /** True while the streak is a record worth saying so: past a best that was long enough to count. */
  get record(): boolean {
    return this.best >= RECORD_FROM && this.count > this.best;
  }

  /** Ends the streak and returns its length. The next one has this one to beat if it was the longest. */
  end(): number {
    const length = this.count;
    this.best = Math.max(this.best, length);
    this.count = 0;
    return length;
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** A calendar day in the typist's own time zone, as a running number. */
const dayIndex = (t: number): number => {
  const date = new Date(t);
  return Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);
};

/**
 * Days in a row with at least one finished set, counting back from the day of
 * `now`. A day with no set yet does not break the count: it starts from the day before.
 */
export function dayStreak(sets: HistoryEntry[], now: number): number {
  const days = new Set(sets.map((entry) => dayIndex(entry.t)));
  let day = dayIndex(now);
  if (!days.has(day)) day--;
  let count = 0;
  while (days.has(day)) {
    count++;
    day--;
  }
  return count;
}

/** Sets of the same kind a comparison needs before it says anything. */
const MIN_SETS = 3;
const USUAL_SETS = 10;

export interface SetVerdict {
  /** The pace of the last ten sets of this kind, weighted by typing time. Null with fewer than three. */
  usual: number | null;
  /** The fastest of the sets of this kind still kept one by one. Null with fewer than three. */
  best: number | null;
  /** True when this set is faster than every one of them. */
  isBest: boolean;
}

/**
 * Holds a set's speed against the sets before it: same layout, same drill, same
 * language of text. `sets` is the history without the set being judged. Day
 * rollups are left out: they average a day and are no set's speed.
 */
export function setVerdict(sets: HistoryEntry[], layout: LayoutId, drill: DrillId, lang: Lang, wpm: number): SetVerdict {
  const prior = sets.filter(
    (entry) => entry.sets === undefined && entry.layout === layout && entry.drill === drill && entry.lang === lang && entry.secs > 0,
  );
  if (prior.length < MIN_SETS) return { usual: null, best: null, isBest: false };
  const recent = prior.slice(-USUAL_SETS);
  const secs = recent.reduce((sum, entry) => sum + entry.secs, 0);
  const usual = recent.reduce((sum, entry) => sum + entry.wpm * entry.secs, 0) / secs;
  const best = Math.max(...prior.map((entry) => entry.wpm));
  return { usual, best, isBest: wpm > best };
}

/** Clean strokes a finger needs in one set before its speed there is held against its average. */
const GAIN_STROKES = 12;
/** A finger is ahead once it beats its last ten sets by this many words per minute. */
const GAIN_MIN = 2;

export interface FingerGain {
  finger: Finger;
  /** The finger's speed in this set. */
  wpm: number;
  /** How far that is above the finger's last ten sets. */
  gain: number;
}

/**
 * The finger that got furthest ahead of its own last ten sets in this set, or
 * null when none did. The ring and pinky fingers come first: a gain there is
 * what the trainer is for, so one of them is named before a bigger gain elsewhere.
 * `sets` is the history without this set; `keys` are this set's per-key numbers.
 */
export function fingerGain(sets: HistoryEntry[], layout: Layout, keys: Record<string, KeyTally>): FingerGain | null {
  let top: FingerGain | null = null;
  for (const finger of FINGERS) {
    if (fingerKind(finger) === 'thumb') continue;
    let strokes = 0;
    let ms = 0;
    for (const [code, [n, , sum]] of Object.entries(keys)) {
      if (layout.fingerOf(code) !== finger) continue;
      strokes += n;
      ms += sum;
    }
    if (strokes < GAIN_STROKES || ms <= 0) continue;
    const averages = rolling(series(sets, layout, { kind: 'finger', finger }, 'wpm'), USUAL_SETS, MIN_SAMPLES * 4);
    const usual = averages.length > 0 ? averages[averages.length - 1] : null;
    if (usual === null) continue;
    const wpm = intervalToWpm(ms / strokes);
    const gain = wpm - usual;
    if (gain < GAIN_MIN) continue;
    const better = top === null || (isWeakFinger(finger) !== isWeakFinger(top.finger) ? isWeakFinger(finger) : gain > top.gain);
    if (better) top = { finger, wpm, gain };
  }
  return top;
}
