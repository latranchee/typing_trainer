import type { Finger } from './fingers';
import { FINGERS } from './fingers';
import type { HistoryEntry } from './history';
import { compactHistory } from './history';
import type { Layout, LayoutId } from './layouts';
import { LAYOUT_IDS } from './layouts';
import { MIN_SAMPLES } from './metrics';

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
  /** When false nothing the typist does is saved: no key numbers, no sets. */
  track: boolean;
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
  track: true,
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

/** What the keyboard has measured on one layout. */
export interface LayoutStats {
  keys: Record<string, KeyStat>;
  pairs: Record<string, PairStat>;
  shiftOk: number;
  shiftBad: number;
}

/** One typist: their options and their numbers. Their sets are stored apart, under their own key. */
interface ProfileData {
  id: string;
  name: string;
  settings: Settings;
  layouts: Partial<Record<LayoutId, LayoutStats>>;
}

interface Data {
  v: 2;
  active: string;
  profiles: ProfileData[];
}

/** What the single-profile version saved under `auriculaire:v1`. */
interface LegacyData {
  v: 1;
  settings?: Partial<Settings>;
  profiles?: Partial<Record<LayoutId, LayoutStats>>;
  history?: HistoryEntry[];
}

export interface ProfileInfo {
  id: string;
  name: string;
}

export type NameProblem = 'empty' | 'taken';

export interface FingerSummary {
  finger: Finger;
  n: number;
  err: number;
  ms: number;
}

/** The part of Web Storage the store uses, so tests can hand it a plain map. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

// The keys keep the product's first name: renaming them would orphan saved progress.
const META_KEY = 'auriculaire:v2';
const LEGACY_KEY = 'auriculaire:v1';
const setsKey = (id: string): string => `auriculaire:v2:sets:${id}`;
const SMOOTHING = 0.2;
export const NAME_LIMIT = 20;
const FIRST_PROFILE = 'main';

const emptyStats = (): LayoutStats => ({ keys: {}, pairs: {}, shiftOk: 0, shiftBad: 0 });
const smooth = (previous: number, sample: number, count: number): number =>
  count <= 1 ? sample : previous + (sample - previous) * SMOOTHING;
const cleanName = (name: string): string => name.replace(/\s+/g, ' ').trim().slice(0, NAME_LIMIT);

function cleanSettings(saved: Partial<Settings> | undefined): Settings {
  const settings = { ...DEFAULT_SETTINGS, ...saved };
  if (!LAYOUT_IDS.includes(settings.layout)) settings.layout = DEFAULT_SETTINGS.layout;
  if (!DRILL_IDS.includes(settings.drill)) settings.drill = DEFAULT_SETTINGS.drill;
  settings.track = settings.track !== false;
  return settings;
}

function browserStorage(): KeyValueStore | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    // Storage blocked by the browser: the session still works, it just will not persist.
    return null;
  }
}

export class Store {
  private storage: KeyValueStore | null;
  private data: Data;
  private current: ProfileData;
  /** Finished sets of the active profile, oldest first. */
  private sets: HistoryEntry[];
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(storage: KeyValueStore | null = browserStorage()) {
    this.storage = storage;
    const saved = this.read<Partial<Data>>(META_KEY);
    const profiles = saved?.v === 2 && Array.isArray(saved.profiles) ? saved.profiles.filter((profile) => profile?.id && profile.name) : [];
    if (profiles.length > 0) {
      for (const profile of profiles) {
        profile.settings = cleanSettings(profile.settings);
        profile.layouts ??= {};
      }
      this.data = { v: 2, active: profiles.some((profile) => profile.id === saved!.active) ? saved!.active! : profiles[0].id, profiles };
      this.current = this.data.profiles.find((profile) => profile.id === this.data.active)!;
      this.sets = this.readSets(this.current.id);
      return;
    }

    // First run of this version: what the single-profile version saved becomes the first profile.
    // Its own key is only read, never written, so the old numbers stay where they were.
    const legacy = this.read<LegacyData>(LEGACY_KEY);
    const carried = legacy?.v === 1 ? legacy : null;
    this.current = { id: FIRST_PROFILE, name: FIRST_PROFILE, settings: cleanSettings(carried?.settings), layouts: carried?.profiles ?? {} };
    this.data = { v: 2, active: this.current.id, profiles: [this.current] };
    this.sets = Array.isArray(carried?.history) ? carried.history : [];
    if (carried) {
      this.flush();
      this.writeSets();
    }
  }

  // ---------- profiles ----------

  get profiles(): ProfileInfo[] {
    return this.data.profiles.map(({ id, name }) => ({ id, name }));
  }

  get profileId(): string {
    return this.current.id;
  }

  get profileName(): string {
    return this.current.name;
  }

  /** Why a profile cannot take this name, or null when it can. `ignoreId` is the profile being renamed. */
  nameProblem(name: string, ignoreId?: string): NameProblem | null {
    const clean = cleanName(name).toLowerCase();
    if (!clean) return 'empty';
    return this.data.profiles.some((profile) => profile.id !== ignoreId && profile.name.toLowerCase() === clean) ? 'taken' : null;
  }

  /** Adds a profile that starts from the current options with no numbers, and switches to it. */
  addProfile(name: string): NameProblem | null {
    const problem = this.nameProblem(name);
    if (problem) return problem;
    let id: string;
    do id = Math.random().toString(36).slice(2, 8);
    while (!id || this.data.profiles.some((profile) => profile.id === id));
    this.data.profiles.push({ id, name: cleanName(name), settings: { ...this.current.settings, track: true }, layouts: {} });
    this.switchProfile(id);
    return null;
  }

  renameProfile(name: string): NameProblem | null {
    const problem = this.nameProblem(name, this.current.id);
    if (problem) return problem;
    this.current.name = cleanName(name);
    this.flush();
    return null;
  }

  /** Removes the active profile and its numbers. The last profile stays. */
  deleteProfile(): boolean {
    if (this.data.profiles.length < 2) return false;
    const gone = this.current.id;
    this.data.profiles = this.data.profiles.filter((profile) => profile.id !== gone);
    try {
      this.storage?.removeItem(setsKey(gone));
    } catch {
      // Nothing to clean up if storage is blocked.
    }
    this.activate(this.data.profiles[0]);
    return true;
  }

  switchProfile(id: string): void {
    const next = this.data.profiles.find((profile) => profile.id === id);
    if (next && next !== this.current) this.activate(next);
  }

  private activate(profile: ProfileData): void {
    this.current = profile;
    this.data.active = profile.id;
    this.sets = this.readSets(profile.id);
    this.flush();
  }

  // ---------- options ----------

  get settings(): Settings {
    return this.current.settings;
  }

  get tracking(): boolean {
    return this.current.settings.track;
  }

  update(patch: Partial<Settings>): void {
    Object.assign(this.current.settings, patch);
    this.queueSave();
  }

  // ---------- numbers ----------

  get history(): HistoryEntry[] {
    return this.sets;
  }

  layoutStats(layout: LayoutId): LayoutStats {
    return (this.current.layouts[layout] ??= emptyStats());
  }

  recordStroke(layout: LayoutId, code: string, intervalMs: number | null): void {
    if (!this.tracking) return;
    const stat = (this.layoutStats(layout).keys[code] ??= { n: 0, err: 0, ms: 0 });
    if (intervalMs !== null) {
      stat.n++;
      stat.ms = smooth(stat.ms, intervalMs, stat.n);
    }
    this.queueSave();
  }

  recordError(layout: LayoutId, code: string): void {
    if (!this.tracking) return;
    const stat = (this.layoutStats(layout).keys[code] ??= { n: 0, err: 0, ms: 0 });
    stat.err++;
    this.queueSave();
  }

  recordPair(layout: LayoutId, pair: string, intervalMs: number): void {
    if (!this.tracking) return;
    const stat = (this.layoutStats(layout).pairs[pair] ??= { n: 0, ms: 0 });
    stat.n++;
    stat.ms = smooth(stat.ms, intervalMs, stat.n);
    this.queueSave();
  }

  recordShift(layout: LayoutId, correctSide: boolean): void {
    if (!this.tracking) return;
    const stats = this.layoutStats(layout);
    if (correctSide) stats.shiftOk++;
    else stats.shiftBad++;
    this.queueSave();
  }

  /** Saves a finished set. Returns false when tracking is off and nothing was saved. */
  addHistory(entry: HistoryEntry): boolean {
    if (!this.tracking) return false;
    this.sets.push(entry);
    this.sets = compactHistory(this.sets);
    this.writeSets();
    return true;
  }

  /** Per-finger totals for a layout, from the per-key numbers. */
  fingerSummary(layout: Layout): FingerSummary[] {
    const totals = new Map<Finger, { n: number; err: number; weighted: number }>();
    for (const finger of FINGERS) totals.set(finger, { n: 0, err: 0, weighted: 0 });
    for (const [code, stat] of Object.entries(this.layoutStats(layout.id).keys)) {
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
    const keys = this.layoutStats(layout).keys;
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
    const keys = this.layoutStats(layout).keys;
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

  /** Erases the active profile's numbers and sets. Its options and the other profiles stay. */
  resetStats(): void {
    this.current.layouts = {};
    this.sets = [];
    this.flush();
    this.writeSets();
  }

  // ---------- storage ----------

  /** Writes profiles, options and key numbers. Sets are written when one finishes. */
  flush(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.write(META_KEY, this.data);
  }

  private queueSave(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => this.flush(), 600);
  }

  private writeSets(): void {
    this.write(setsKey(this.current.id), this.sets);
  }

  private readSets(id: string): HistoryEntry[] {
    const sets = this.read<HistoryEntry[]>(setsKey(id));
    return Array.isArray(sets) ? sets : [];
  }

  private read<T>(key: string): T | null {
    try {
      const raw = this.storage?.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  private write(key: string, value: unknown): void {
    try {
      this.storage?.setItem(key, JSON.stringify(value));
    } catch {
      // Storage full or blocked: the session still works, it just will not persist.
    }
  }
}
