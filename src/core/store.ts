import type { Finger } from './fingers';
import { FINGERS } from './fingers';
import type { Layout, LayoutId } from './layouts';
import { LAYOUT_IDS } from './layouts';

export type DrillId = 'highway' | 'words' | 'pairs' | 'anchors' | 'stats';
export type Lang = 'en' | 'fr';
export const DRILL_IDS: DrillId[] = ['highway', 'words', 'pairs', 'anchors', 'stats'];

export interface Settings {
  layout: LayoutId;
  lang: Lang;
  drill: DrillId;
  /** Rolling WPM window, seconds. */
  window: 5 | 10 | 30;
  highwaySource: 'words' | 'pairs';
  /** When true the highway holds a fixed tempo and refuses early keys. */
  tempoLock: boolean;
  tempoWpm: number;
  setWords: 15 | 30 | 60;
  caps: boolean;
  pairSize: 2 | 3;
  pairFocus: 'all' | 'weak';
  anchorFinger: 'rotate' | 'LP' | 'LR' | 'RR' | 'RP';
  anchorCount: 0 | 1 | 2 | 3;
}

export const DEFAULT_SETTINGS: Settings = {
  layout: 'ca-fr',
  lang: 'en',
  drill: 'highway',
  window: 10,
  highwaySource: 'words',
  tempoLock: false,
  tempoWpm: 40,
  setWords: 30,
  caps: false,
  pairSize: 2,
  pairFocus: 'weak',
  anchorFinger: 'rotate',
  anchorCount: 3,
};

export interface KeyStat {
  n: number;
  err: number;
  /** Smoothed time from the previous correct stroke to this key, ms. */
  ms: number;
}

export interface PairStat {
  n: number;
  ms: number;
}

export interface Profile {
  keys: Record<string, KeyStat>;
  pairs: Record<string, PairStat>;
  shiftOk: number;
  shiftBad: number;
}

export interface HistoryEntry {
  t: number;
  drill: DrillId;
  layout: LayoutId;
  lang: Lang;
  wpm: number;
  acc: number;
  chars: number;
  secs: number;
}

interface Data {
  v: 1;
  settings: Settings;
  profiles: Partial<Record<LayoutId, Profile>>;
  history: HistoryEntry[];
}

export interface FingerSummary {
  finger: Finger;
  n: number;
  err: number;
  ms: number;
}

const STORAGE_KEY = 'auriculaire:v1';
const SMOOTHING = 0.2;
const HISTORY_LIMIT = 500;
/** Samples a key needs before its numbers mean anything. */
export const MIN_SAMPLES = 5;

const emptyProfile = (): Profile => ({ keys: {}, pairs: {}, shiftOk: 0, shiftBad: 0 });
const smooth = (previous: number, sample: number, count: number): number =>
  count <= 1 ? sample : previous + (sample - previous) * SMOOTHING;

export class Store {
  private data: Data;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.data = this.load();
  }

  get settings(): Settings {
    return this.data.settings;
  }

  get history(): HistoryEntry[] {
    return this.data.history;
  }

  update(patch: Partial<Settings>): void {
    Object.assign(this.data.settings, patch);
    this.queueSave();
  }

  profile(layout: LayoutId): Profile {
    return (this.data.profiles[layout] ??= emptyProfile());
  }

  recordStroke(layout: LayoutId, code: string, intervalMs: number | null): void {
    const stat = (this.profile(layout).keys[code] ??= { n: 0, err: 0, ms: 0 });
    if (intervalMs !== null) {
      stat.n++;
      stat.ms = smooth(stat.ms, intervalMs, stat.n);
    }
    this.queueSave();
  }

  recordError(layout: LayoutId, code: string): void {
    const stat = (this.profile(layout).keys[code] ??= { n: 0, err: 0, ms: 0 });
    stat.err++;
    this.queueSave();
  }

  recordPair(layout: LayoutId, pair: string, intervalMs: number): void {
    const stat = (this.profile(layout).pairs[pair] ??= { n: 0, ms: 0 });
    stat.n++;
    stat.ms = smooth(stat.ms, intervalMs, stat.n);
    this.queueSave();
  }

  recordShift(layout: LayoutId, correctSide: boolean): void {
    const profile = this.profile(layout);
    if (correctSide) profile.shiftOk++;
    else profile.shiftBad++;
    this.queueSave();
  }

  addHistory(entry: HistoryEntry): void {
    this.data.history.push(entry);
    if (this.data.history.length > HISTORY_LIMIT) this.data.history.splice(0, this.data.history.length - HISTORY_LIMIT);
    this.queueSave();
  }

  /** Per-finger totals for a layout, from the per-key numbers. */
  fingerSummary(layout: Layout): FingerSummary[] {
    const totals = new Map<Finger, { n: number; err: number; weighted: number }>();
    for (const finger of FINGERS) totals.set(finger, { n: 0, err: 0, weighted: 0 });
    for (const [code, stat] of Object.entries(this.profile(layout.id).keys)) {
      if (code === 'Space') continue;
      const total = totals.get(layout.fingerOf(code))!;
      total.n += stat.n;
      total.err += stat.err;
      total.weighted += stat.ms * stat.n;
    }
    return FINGERS.map((finger) => {
      const total = totals.get(finger)!;
      return { finger, n: total.n, err: total.err, ms: total.n > 0 ? total.weighted / total.n : 0 };
    });
  }

  /** 0 for a key at or above the typist's usual pace, up to 1 for the keys that need the most work. */
  weakness(layout: LayoutId, code: string): number {
    const keys = this.profile(layout).keys;
    const stat = keys[code];
    if (!stat || stat.n < MIN_SAMPLES) return 0;
    const paces = Object.values(keys)
      .filter((key) => key.n >= MIN_SAMPLES)
      .map((key) => key.ms)
      .sort((a, b) => a - b);
    const median = paces[Math.floor(paces.length / 2)] || stat.ms;
    const slow = stat.ms / median - 1;
    const errorRate = stat.err / (stat.n + stat.err);
    return Math.max(0, Math.min(1, 0.8 * slow + 2.5 * errorRate));
  }

  /**
   * Where a key stands among the measured keys of a layout: 0 for the quickest,
   * 1 for the one that needs the most work. Relative on purpose, so the stats
   * keyboard always shows which keys trail the others.
   */
  heat(layout: LayoutId, code: string): number {
    const keys = this.profile(layout).keys;
    const score = (stat: KeyStat): number => stat.ms * (1 + 2 * (stat.err / (stat.n + stat.err)));
    const measured = Object.entries(keys).filter(([key, stat]) => key !== 'Space' && stat.n >= MIN_SAMPLES);
    const stat = keys[code];
    if (!stat || stat.n < MIN_SAMPLES || code === 'Space' || measured.length < 2) return 0;
    const scores = measured.map(([, entry]) => score(entry));
    const low = Math.min(...scores);
    const high = Math.max(...scores);
    // A spread this small is noise, not a weak key.
    if (high < low * 1.08) return 0;
    return (score(stat) - low) / (high - low);
  }

  resetStats(): void {
    this.data.profiles = {};
    this.data.history = [];
    this.flush();
  }

  flush(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // Storage full or blocked: the session still works, it just will not persist.
    }
  }

  private queueSave(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => this.flush(), 600);
  }

  private load(): Data {
    const fresh: Data = { v: 1, settings: { ...DEFAULT_SETTINGS }, profiles: {}, history: [] };
    try {
      const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
      if (!raw) return fresh;
      const parsed = JSON.parse(raw) as Partial<Data>;
      if (parsed.v !== 1) return fresh;
      const settings = { ...DEFAULT_SETTINGS, ...parsed.settings };
      if (!LAYOUT_IDS.includes(settings.layout)) settings.layout = DEFAULT_SETTINGS.layout;
      if (!DRILL_IDS.includes(settings.drill)) settings.drill = DEFAULT_SETTINGS.drill;
      return { v: 1, settings, profiles: parsed.profiles ?? {}, history: parsed.history ?? [] };
    } catch {
      return fresh;
    }
  }
}
