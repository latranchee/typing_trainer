import type { Finger } from './fingers';
import { FINGERS } from './fingers';
import type { PairTraining, Transitions, TypingFinger } from './generator';
import { DEFAULT_FOCUS, TYPING_FINGERS } from './generator';
import type { Difficulty, Floor, RunBest } from './hardcore';
import { DEFAULT_DIFFICULTY, DIFFICULTIES, FLOORS } from './hardcore';
import type { HistoryEntry } from './history';
import { compactHistory } from './history';
import { preferredLang } from './i18n';
import type { Layout, LayoutId } from './layouts';
import { LAYOUT_IDS } from './layouts';
import { MIN_SAMPLES } from './metrics';
import type { Board } from './physical';
import { BOARDS } from './physical';
import type { KeySound } from './switches';
import { isKeySound } from './switches';

export type DrillId = 'highway' | 'words' | 'pairs' | 'anchors' | 'stats';
export type Lang = 'en' | 'fr' | 'de' | 'es';
export const DRILL_IDS: DrillId[] = ['highway', 'words', 'pairs', 'anchors', 'stats'];
export const LANGS: Lang[] = ['fr', 'en', 'de', 'es'];

export interface Settings {
  layout: LayoutId;
  /** The shape of the keyboard on the desk: the on-screen board is drawn to match it. */
  board: Board;
  /** True once the board was picked by hand or told by one of its own keys: after that, no key changes it. */
  boardSet: boolean;
  /** The fingers to train more: the text leans toward their letters and the anchor drill takes them in turn. */
  focus: TypingFinger[];
  /** Language of the practice text. */
  lang: Lang;
  /** Language of the interface. */
  ui: Lang;
  drill: DrillId;
  /** Rolling WPM window, seconds. */
  window: 5 | 10 | 30;
  highwaySource: 'words' | 'pairs' | 'sentences';
  /** When true the highway holds a fixed tempo and refuses early keys. */
  tempoLock: boolean;
  tempoWpm: number;
  /** What the words drill types: words drawn one by one, or whole sentences. */
  wordsSource: 'words' | 'sentences';
  /** How the letter groups are drawn: from the typist's own weak transitions, or by frequency in the language alone. */
  pairTraining: PairTraining;
  setWords: 15 | 30 | 60;
  caps: boolean;
  pairSize: 2 | 3;
  anchorCount: 0 | 1 | 2 | 3;
  /** When false nothing the typist does is saved: no key numbers, no sets. */
  track: boolean;
  /** Hardcore: a wrong key sticks until Backspace erases it. */
  hardcore: boolean;
  /** Hardcore only: the rolling WPM the set fails under. 0 means no floor. */
  floor: Floor;
  /** Hardcore only, with a floor: how hard the fuse is, 1 to 3. */
  difficulty: Difficulty;
  /** Hardcore only: the heartbeat and the thuds. */
  sound: boolean;
  /** What the keys sound like: a recorded switch, or nothing. With a switch picked, a streak's marks are heard too. */
  keySound: KeySound;
}

export const DEFAULT_SETTINGS: Settings = {
  layout: 'ca-fr',
  board: 'ansi',
  boardSet: false,
  focus: DEFAULT_FOCUS,
  lang: 'en',
  ui: 'en',
  drill: 'highway',
  window: 10,
  highwaySource: 'words',
  tempoLock: false,
  tempoWpm: 40,
  wordsSource: 'words',
  pairTraining: 'adaptive',
  setWords: 30,
  caps: false,
  pairSize: 2,
  anchorCount: 3,
  track: true,
  hardcore: false,
  floor: 0,
  difficulty: DEFAULT_DIFFICULTY,
  sound: true,
  // Silent until the typist picks a switch: a page does not start clicking on its own.
  keySound: 'off',
};

const HIGHWAY_SOURCES: Settings['highwaySource'][] = ['words', 'pairs', 'sentences'];

export interface KeyStat {
  n: number;
  err: number;
  /** Smoothed time from the previous correct stroke to this key, ms. */
  ms: number;
}

/** Two letters typed one after the other: the time between them, and how often the second one was missed. */
export interface PairStat {
  /** Clean transitions measured. */
  n: number;
  /** Smoothed time from the first letter to the second, ms. */
  ms: number;
  /** Failed transitions: the first letter was typed, then the second was missed. Absent from numbers saved before it was counted, which means none. */
  err?: number;
}

/** A transition with its numbers and how much it needs work. */
export interface RankedPair {
  pair: string;
  stat: PairStat;
  weakness: number;
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
  /** Hardcore: the best runs, by layout, drill, floor and difficulty. Absent until a run is saved. */
  runs?: Record<string, RunBest>;
  /** The longest streaks of right keys, by layout and drill. Absent until one is saved. */
  streaks?: Record<string, number>;
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
/** What a first profile is called when nothing was saved before, by interface language. */
const FIRST_NAME: Record<Lang, string> = { en: FIRST_PROFILE, fr: 'principal', de: 'haupt', es: 'principal' };

const emptyStats = (): LayoutStats => ({ keys: {}, pairs: {}, shiftOk: 0, shiftBad: 0 });
const smooth = (previous: number, sample: number, count: number): number =>
  count <= 1 ? sample : previous + (sample - previous) * SMOOTHING;
const cleanName = (name: string): string => name.replace(/\s+/g, ' ').trim().slice(0, NAME_LIMIT);

/** Options saved before the interface had a language take `preferred`, the browser's. */
function cleanSettings(saved: Partial<Settings> | undefined, preferred: Lang): Settings {
  const settings = { ...DEFAULT_SETTINGS, ui: preferred, ...saved };
  if (!LAYOUT_IDS.includes(settings.layout)) settings.layout = DEFAULT_SETTINGS.layout;
  if (!BOARDS.includes(settings.board)) settings.board = DEFAULT_SETTINGS.board;
  settings.boardSet = settings.boardSet === true;
  // Always a list of its own, in hand order: no two profiles share one, and an empty one is a choice (no finger favored).
  const focus: unknown = settings.focus;
  settings.focus = Array.isArray(focus) ? TYPING_FINGERS.filter((finger) => focus.includes(finger)) : [...DEFAULT_FOCUS];
  // Options the finger focus replaced: the pairs drill's own focus and the anchor drill's finger.
  const stale = settings as unknown as Record<string, unknown>;
  delete stale.pairFocus;
  delete stale.anchorFinger;
  if (!DRILL_IDS.includes(settings.drill)) settings.drill = DEFAULT_SETTINGS.drill;
  if (!LANGS.includes(settings.lang)) settings.lang = DEFAULT_SETTINGS.lang;
  if (!LANGS.includes(settings.ui)) settings.ui = preferred;
  settings.track = settings.track !== false;
  settings.hardcore = settings.hardcore === true;
  if (!FLOORS.includes(settings.floor)) settings.floor = DEFAULT_SETTINGS.floor;
  if (!DIFFICULTIES.includes(settings.difficulty)) settings.difficulty = DEFAULT_SETTINGS.difficulty;
  settings.sound = settings.sound !== false;
  if (!HIGHWAY_SOURCES.includes(settings.highwaySource)) settings.highwaySource = DEFAULT_SETTINGS.highwaySource;
  if (settings.wordsSource !== 'sentences') settings.wordsSource = 'words';
  if (settings.pairTraining !== 'classic') settings.pairTraining = 'adaptive';
  if (!isKeySound(settings.keySound)) settings.keySound = DEFAULT_SETTINGS.keySound;
  return settings;
}

/** Failed attempts of a transition: zero for numbers saved before they were counted. */
export const pairErrors = (stat: PairStat): number => Number(stat.err) || 0;

/** Share of a transition's attempts that were clean, 1 when there were none. */
export function pairAccuracy(stat: PairStat): number {
  const attempts = stat.n + pairErrors(stat);
  return attempts > 0 ? stat.n / attempts : 1;
}

/** Median time of the transitions measured often enough, ms. 0 when none is. */
export function pairMedian(pairs: Record<string, PairStat>): number {
  const paces = Object.values(pairs)
    .filter((stat) => stat.n >= MIN_SAMPLES)
    .map((stat) => stat.ms)
    .sort((a, b) => a - b);
  if (paces.length === 0) return 0;
  const middle = paces.length >> 1;
  return paces.length % 2 === 1 ? paces[middle] : (paces[middle - 1] + paces[middle]) / 2;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

/**
 * How much a transition needs work, 0 to 1. Three quarters is its time against the
 * median transition (half again as slow, or more, counts in full), one quarter its
 * error rate (one miss in five attempts, or more, counts in full). Both are scaled
 * by confidence, which is full at ten attempts. A transition measured fewer than
 * five times scores 0: too few numbers say nothing about the typist.
 */
export function pairWeakness(stat: PairStat | undefined, medianMs: number): number {
  if (!stat || stat.n < MIN_SAMPLES || medianMs <= 0) return 0;
  const err = pairErrors(stat);
  const attempts = stat.n + err;
  const slow = clamp01((stat.ms / medianMs - 1) / 1.5);
  const error = clamp01(err / attempts / 0.2);
  const confidence = clamp01(attempts / 10);
  return confidence * (0.75 * slow + 0.25 * error);
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

  /**
   * `preferred` is the language a typist with nothing saved starts in: the browser's, unless a test names one.
   * `firstLayout` is the layout of that first profile; the app passes the one the browser's region suggests.
   */
  constructor(storage: KeyValueStore | null = browserStorage(), preferred: Lang = preferredLang(), firstLayout: LayoutId = DEFAULT_SETTINGS.layout) {
    this.storage = storage;
    const saved = this.read<Partial<Data>>(META_KEY);
    const profiles = saved?.v === 2 && Array.isArray(saved.profiles) ? saved.profiles.filter((profile) => profile?.id && profile.name) : [];
    if (profiles.length > 0) {
      for (const profile of profiles) {
        profile.settings = cleanSettings(profile.settings, preferred);
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
    // Nothing saved at all: the first profile starts in the browser's language, interface and practice text alike.
    this.current = carried
      ? { id: FIRST_PROFILE, name: FIRST_PROFILE, settings: cleanSettings(carried.settings, preferred), layouts: carried.profiles ?? {} }
      : { id: FIRST_PROFILE, name: FIRST_NAME[preferred], settings: cleanSettings({ lang: preferred, layout: firstLayout }, preferred), layouts: {} };
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
    const settings = { ...this.current.settings, focus: [...this.current.settings.focus], track: true };
    this.data.profiles.push({ id, name: cleanName(name), settings, layouts: {} });
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
    const stat = (this.layoutStats(layout).pairs[pair] ??= { n: 0, ms: 0, err: 0 });
    stat.n++;
    stat.ms = smooth(stat.ms, intervalMs, stat.n);
    this.queueSave();
  }

  /** A failed transition: the first letter of `pair` was typed, then the second one was missed. The caller counts one per attempt. */
  recordPairError(layout: LayoutId, pair: string): void {
    if (!this.tracking) return;
    const stat = (this.layoutStats(layout).pairs[pair] ??= { n: 0, ms: 0, err: 0 });
    stat.err = (stat.err ?? 0) + 1;
    this.queueSave();
  }

  /** How much one transition needs work, 0 to 1, against the other transitions measured on the layout. */
  pairWeakness(layout: LayoutId, pair: string): number {
    const { pairs } = this.layoutStats(layout);
    return pairWeakness(pairs[pair], pairMedian(pairs));
  }

  /**
   * The transitions of a layout measured often enough to judge, the ones that need the most
   * work first. Equal scores (fast, clean ones score 0) go slowest first.
   */
  rankedPairs(layout: LayoutId): RankedPair[] {
    const { pairs } = this.layoutStats(layout);
    const median = pairMedian(pairs);
    return Object.entries(pairs)
      .filter(([, stat]) => stat.n >= MIN_SAMPLES)
      .map(([pair, stat]) => ({ pair, stat, weakness: pairWeakness(stat, median) }))
      .sort((a, b) => b.weakness - a.weakness || b.stat.ms - a.stat.ms);
  }

  /** Up to `count` transitions that need work, weakest first. One that scores 0 needs none and is left out. */
  weakestPairs(layout: LayoutId, count: number): string[] {
    return this.rankedPairs(layout)
      .filter((entry) => entry.weakness > 0)
      .slice(0, count)
      .map((entry) => entry.pair);
  }

  /**
   * The transitions of a layout as they stand now, for drawing the next set. The median
   * is taken once, so a set is drawn against one picture of the typist.
   */
  transitions(layout: LayoutId): Transitions {
    const { pairs } = this.layoutStats(layout);
    const median = pairMedian(pairs);
    return {
      weakness: (pair) => pairWeakness(pairs[pair], median),
      samples: (pair) => pairs[pair]?.n ?? 0,
    };
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

  /** Hardcore: the best run saved under `key`, zeros when there is none. */
  bestRun(key: string): RunBest {
    const best = this.current.runs?.[key];
    return { ms: Number(best?.ms) || 0, sets: Number(best?.sets) || 0 };
  }

  /**
   * Hardcore: holds a run against the best one saved under `key` and keeps whatever it beats.
   * Returns what it beat. Nothing is beaten or saved while tracking is off.
   */
  recordRun(key: string, ms: number, sets: number): { ms: boolean; sets: boolean } {
    const best = this.bestRun(key);
    const beat = { ms: this.tracking && ms > best.ms, sets: this.tracking && sets > best.sets };
    if (beat.ms || beat.sets) {
      (this.current.runs ??= {})[key] = { ms: beat.ms ? Math.round(ms) : best.ms, sets: beat.sets ? sets : best.sets };
      this.flush();
    }
    return beat;
  }

  /** The longest streak of right keys saved under `key`, 0 when there is none. */
  bestStreak(key: string): number {
    return Number(this.current.streaks?.[key]) || 0;
  }

  /** Keeps a streak that beats the longest one saved under `key`, and says whether it did. Nothing is saved while tracking is off. */
  recordStreak(key: string, streak: number): boolean {
    if (!this.tracking || streak <= this.bestStreak(key)) return false;
    (this.current.streaks ??= {})[key] = streak;
    this.queueSave();
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
    delete this.current.runs;
    delete this.current.streaks;
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
