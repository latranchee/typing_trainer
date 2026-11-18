import type { Finger } from './fingers';
import type { Layout, LayoutId } from './layouts';
import { charsToWpm, intervalToWpm } from './metrics';
import type { DrillId, Lang } from './store';

/** One key inside one set: clean timed strokes, misses, and the summed time of those strokes in ms. */
export type KeyTally = [n: number, err: number, ms: number];

export interface HistoryEntry {
  t: number;
  drill: DrillId;
  layout: LayoutId;
  lang: Lang;
  wpm: number;
  acc: number;
  chars: number;
  secs: number;
  /** Per-key numbers for the set. Absent on sets saved before key history existed. */
  keys?: Record<string, KeyTally>;
  /** Present on a day rollup: how many sets it merges. */
  sets?: number;
}

/** Sets kept one by one. Older ones are merged into one entry per day and layout. */
export const KEEP_SETS = 300;
/** Extra sets allowed before the oldest are merged, so merging runs once in a while and not on every set. */
const COMPACT_SLACK = 60;
/** Day rollups kept per profile: about four years of daily practice on one layout. */
const MAX_DAYS = 1500;

/** What a history line is about: the whole layout, one finger, or one key. */
export type Subject = { kind: 'all' } | { kind: 'finger'; finger: Finger } | { kind: 'key'; code: string };
export type Metric = 'wpm' | 'acc';

export interface Point {
  entry: HistoryEntry;
  /** The subject's value in this entry, or null when the entry holds nothing for it. */
  value: number | null;
  /** What the value counts for when entries are pooled: typing time for speed, strokes for accuracy. */
  weight: number;
  /** Strokes behind the value. */
  n: number;
}

const NOTHING = { value: null, weight: 0, n: 0 };

function tallyOf(entry: HistoryEntry, layout: Layout, subject: Subject): KeyTally | null {
  if (!entry.keys || subject.kind === 'all') return null;
  if (subject.kind === 'key') return entry.keys[subject.code] ?? null;
  const sum: KeyTally = [0, 0, 0];
  for (const [code, [n, err, ms]] of Object.entries(entry.keys)) {
    if (layout.fingerOf(code) !== subject.finger) continue;
    sum[0] += n;
    sum[1] += err;
    sum[2] += ms;
  }
  return sum;
}

/**
 * The history of one subject on one layout, oldest first: one point per saved entry.
 * A finger's numbers are summed from its keys with the layout's current finger map.
 */
export function series(sets: HistoryEntry[], layout: Layout, subject: Subject, metric: Metric): Point[] {
  return sets
    .filter((entry) => entry.layout === layout.id)
    .map((entry): Point => {
      if (subject.kind === 'all') {
        if (metric === 'wpm') return entry.secs > 0 ? { entry, value: entry.wpm, weight: entry.secs, n: entry.chars } : { entry, ...NOTHING };
        return entry.chars > 0 ? { entry, value: entry.acc, weight: entry.chars, n: entry.chars } : { entry, ...NOTHING };
      }
      const sum = tallyOf(entry, layout, subject);
      if (!sum) return { entry, ...NOTHING };
      const [n, err, ms] = sum;
      if (metric === 'wpm') return n > 0 && ms > 0 ? { entry, value: intervalToWpm(ms / n), weight: ms, n } : { entry, ...NOTHING };
      return n + err > 0 ? { entry, value: n / (n + err), weight: n + err, n: n + err } : { entry, ...NOTHING };
    });
}

/** Pooled value of some points: speed weighted by typing time, accuracy by strokes. */
function pool(points: Point[], minSamples: number): number | null {
  let sum = 0;
  let weight = 0;
  let n = 0;
  for (const point of points) {
    if (point.value === null) continue;
    sum += point.value * point.weight;
    weight += point.weight;
    n += point.n;
  }
  return weight > 0 && n >= minSamples ? sum / weight : null;
}

/**
 * For each point, the pooled value of the last `span` entries that hold data for the subject.
 * Null until those entries hold `minSamples` strokes.
 */
export function rolling(points: Point[], span: number, minSamples: number): (number | null)[] {
  return points.map((_, i) => {
    const window: Point[] = [];
    for (let j = i; j >= 0 && window.length < span; j--) {
      if (points[j].value !== null) window.push(points[j]);
    }
    return pool(window, minSamples);
  });
}

/**
 * Change between the latest entries and the same number of entries before them
 * (up to `span` each), or null when there is too little to compare.
 */
export function trend(points: Point[], span: number, minSamples: number): number | null {
  const data = points.filter((point) => point.value !== null);
  const size = Math.min(span, Math.floor(data.length / 2));
  if (size < 2) return null;
  const recent = pool(data.slice(-size), minSamples);
  const before = pool(data.slice(-2 * size, -size), minSamples);
  return recent === null || before === null ? null : recent - before;
}

const dayOf = (t: number): string => {
  const date = new Date(t);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
};

function mergeInto(day: HistoryEntry, entry: HistoryEntry): void {
  const chars = day.chars + entry.chars;
  const secs = day.secs + entry.secs;
  if (chars > 0) day.acc = (day.acc * day.chars + entry.acc * entry.chars) / chars;
  day.chars = chars;
  day.secs = secs;
  day.wpm = charsToWpm(chars, secs * 1000);
  day.sets = (day.sets ?? 1) + (entry.sets ?? 1);
  if (!entry.keys) return;
  const keys = (day.keys ??= {});
  for (const [code, [n, err, ms]] of Object.entries(entry.keys)) {
    const sum = (keys[code] ??= [0, 0, 0]);
    sum[0] += n;
    sum[1] += err;
    sum[2] += ms;
  }
}

/**
 * Keeps the history small enough for browser storage without dropping the long view:
 * the newest `keep` sets stay as they are, older ones become one entry per day and layout.
 * Expects the entries oldest first, which is how they are saved.
 */
export function compactHistory(sets: HistoryEntry[], keep = KEEP_SETS, slack = COMPACT_SLACK): HistoryEntry[] {
  const single = sets.filter((entry) => entry.sets === undefined).length;
  if (single <= keep + slack) return sets;

  let toMerge = single - keep;
  const days = new Map<string, HistoryEntry>();
  const kept: HistoryEntry[] = [];
  for (const entry of sets) {
    const isDay = entry.sets !== undefined;
    if (!isDay && toMerge <= 0) {
      kept.push(entry);
      continue;
    }
    if (!isDay) toMerge--;
    const key = `${dayOf(entry.t)}|${entry.layout}`;
    const day = days.get(key);
    if (day) {
      mergeInto(day, entry);
      continue;
    }
    const copy: HistoryEntry = { ...entry, sets: entry.sets ?? 1 };
    if (entry.keys) copy.keys = Object.fromEntries(Object.entries(entry.keys).map(([code, tally]) => [code, [...tally] as KeyTally]));
    days.set(key, copy);
  }
  return [...[...days.values()].slice(-MAX_DAYS), ...kept];
}
