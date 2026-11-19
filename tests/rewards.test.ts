import { describe, expect, it } from 'vitest';
import type { HistoryEntry, KeyTally } from '../src/core/history';
import { getLayout } from '../src/core/layouts';
import { dayStreak, fingerGain, isMilestone, RECORD_FROM, setVerdict, Streak, streakKey } from '../src/core/rewards';
import type { KeyValueStore } from '../src/core/store';
import { DEFAULT_SETTINGS, Store } from '../src/core/store';
import { pressSample, releaseSample, samplesOf, SWITCH_IDS, SWITCHES } from '../src/core/switches';

function memory(seed: Record<string, unknown> = {}): KeyValueStore & { map: Map<string, string> } {
  const map = new Map(Object.entries(seed).map(([key, value]) => [key, JSON.stringify(value)]));
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}

const NOON = new Date(2026, 10, 18, 12).getTime();
const DAY = 24 * 60 * 60 * 1000;

const set = (t: number, wpm: number, extra: Partial<HistoryEntry> = {}): HistoryEntry => ({
  t,
  drill: 'words',
  layout: 'us',
  lang: 'en',
  wpm,
  acc: 0.95,
  chars: 100,
  secs: (100 / 5) * (60 / wpm),
  ...extra,
});

/** `n` clean strokes on a key at one pace: the per-key numbers a set saves. */
const strokes = (n: number, msEach: number): KeyTally => [n, 0, n * msEach];

describe('streak', () => {
  it('marks 25, 50 and every hundred', () => {
    const marked = Array.from({ length: 320 }, (_, i) => i + 1).filter(isMilestone);
    expect(marked).toEqual([25, 50, 100, 200, 300]);
  });

  it('counts right keys and names the one key that passes the best', () => {
    const streak = new Streak(30);
    const steps = Array.from({ length: 32 }, () => streak.hit());
    expect(streak.count).toBe(32);
    expect(steps.map((step) => step.record).indexOf(true)).toBe(30);
    expect(steps.filter((step) => step.record)).toHaveLength(1);
    expect(steps[24].milestone).toBe(true);
    expect(streak.past).toBe(true);
    expect(streak.record).toBe(true);
  });

  it('keeps a first short best from being celebrated as a record', () => {
    const streak = new Streak(RECORD_FROM - 1);
    const steps = Array.from({ length: RECORD_FROM + 5 }, () => streak.hit());
    expect(steps.some((step) => step.record)).toBe(false);
    // The rail still says the old best is behind.
    expect(streak.past).toBe(true);
    expect(streak.record).toBe(false);
  });

  it('gives the next streak the one just ended to beat, when it was the longest', () => {
    const streak = new Streak(40);
    for (let i = 0; i < 55; i++) streak.hit();
    expect(streak.end()).toBe(55);
    expect(streak.count).toBe(0);
    expect(streak.best).toBe(55);
    for (let i = 0; i < 10; i++) streak.hit();
    expect(streak.end()).toBe(10);
    expect(streak.best).toBe(55);
  });

  it('has nothing to pass on a profile with no streak saved', () => {
    const streak = new Streak();
    for (let i = 0; i < 200; i++) expect(streak.hit().record).toBe(false);
    expect(streak.past).toBe(false);
  });

  it('saves the longest streak per layout and drill, and only with tracking on', () => {
    const storage = memory();
    const store = new Store(storage, 'en');
    const words = streakKey('us', 'words');
    expect(store.bestStreak(words)).toBe(0);
    expect(store.recordStreak(words, 80)).toBe(true);
    expect(store.recordStreak(words, 60)).toBe(false);
    expect(store.recordStreak(streakKey('us', 'highway'), 20)).toBe(true);
    expect(store.bestStreak(words)).toBe(80);
    expect(store.bestStreak(streakKey('us', 'highway'))).toBe(20);

    store.update({ track: false });
    expect(store.recordStreak(words, 500)).toBe(false);
    expect(store.bestStreak(words)).toBe(80);

    store.flush();
    expect(new Store(storage, 'en').bestStreak(words)).toBe(80);
  });

  it('erases the streaks with the rest of the saved numbers', () => {
    const store = new Store(memory(), 'en');
    store.recordStreak(streakKey('us', 'words'), 80);
    store.resetStats();
    expect(store.bestStreak(streakKey('us', 'words'))).toBe(0);
  });
});

describe('days in a row', () => {
  it('counts back from today', () => {
    const sets = [set(NOON - 3 * DAY, 60), set(NOON - 2 * DAY, 60), set(NOON - DAY, 60), set(NOON - DAY + 1000, 62), set(NOON, 61)];
    expect(dayStreak(sets, NOON)).toBe(4);
  });

  it('does not break on a day with no set yet', () => {
    const sets = [set(NOON - 2 * DAY, 60), set(NOON - DAY, 60)];
    expect(dayStreak(sets, NOON)).toBe(2);
  });

  it('stops at a day that was skipped', () => {
    const sets = [set(NOON - 4 * DAY, 60), set(NOON - 2 * DAY, 60), set(NOON - DAY, 60), set(NOON, 60)];
    expect(dayStreak(sets, NOON)).toBe(3);
    expect(dayStreak([set(NOON - 3 * DAY, 60)], NOON)).toBe(0);
    expect(dayStreak([], NOON)).toBe(0);
  });

  it('counts a day by the calendar, not by 24 hours', () => {
    const late = new Date(2026, 10, 17, 23, 50).getTime();
    const early = new Date(2026, 10, 18, 0, 10).getTime();
    expect(dayStreak([set(late, 60), set(early, 60)], early)).toBe(2);
  });
});

describe('set verdict', () => {
  const history = [set(NOON - 5000, 60), set(NOON - 4000, 70), set(NOON - 3000, 80), set(NOON - 2000, 65)];

  it('says nothing before three sets of the same kind', () => {
    expect(setVerdict(history.slice(0, 2), 'us', 'words', 'en', 90)).toEqual({ usual: null, best: null, isBest: false });
  });

  it('holds a set against the last ten and the fastest of its kind', () => {
    const verdict = setVerdict(history, 'us', 'words', 'en', 81);
    expect(verdict.best).toBe(80);
    expect(verdict.isBest).toBe(true);
    // Weighted by typing time, so the slower sets weigh a little more than the plain mean of 68.75.
    expect(verdict.usual).toBeGreaterThan(67);
    expect(verdict.usual).toBeLessThan(68.75);
    expect(setVerdict(history, 'us', 'words', 'en', 80).isBest).toBe(false);
  });

  it('only looks at the same layout, drill and language, and never at a day rollup', () => {
    const mixed = [
      ...history,
      set(NOON - 1000, 140, { layout: 'colemak-dh' }),
      set(NOON - 900, 150, { drill: 'pairs' }),
      set(NOON - 800, 160, { lang: 'fr' }),
      set(NOON - 700, 170, { sets: 12 }),
    ];
    expect(setVerdict(mixed, 'us', 'words', 'en', 81).best).toBe(80);
  });

  it('takes the pace from the last ten sets only', () => {
    const long = [...Array.from({ length: 5 }, (_, i) => set(NOON - 100000 + i, 200)), ...Array.from({ length: 10 }, (_, i) => set(NOON - 1000 + i, 50))];
    const verdict = setVerdict(long, 'us', 'words', 'en', 60);
    expect(verdict.usual).toBeCloseTo(50, 5);
    expect(verdict.best).toBe(200);
    expect(verdict.isBest).toBe(false);
  });
});

describe('finger gain', () => {
  const us = getLayout('us');
  // Left ring (S) at 300 ms a key and right index (J) at 150 ms, over four sets.
  const history = Array.from({ length: 4 }, (_, i) => set(NOON - 4000 + i * 1000, 60, { keys: { KeyS: strokes(20, 300), KeyJ: strokes(20, 150) } }));

  it('names the finger that got furthest ahead of its own last ten sets', () => {
    const gain = fingerGain(history, us, { KeyS: strokes(20, 300), KeyJ: strokes(20, 120) });
    expect(gain?.finger).toBe('RI');
    expect(gain?.wpm).toBeCloseTo(100, 5);
    expect(gain?.gain).toBeCloseTo(20, 5);
  });

  it('names a ring or pinky finger first, even with a bigger gain elsewhere', () => {
    const gain = fingerGain(history, us, { KeyS: strokes(20, 250), KeyJ: strokes(20, 100) });
    expect(gain?.finger).toBe('LR');
    expect(gain?.gain).toBeCloseTo(8, 5);
  });

  it('says nothing for a finger at its usual pace, with too few strokes, or with no history', () => {
    expect(fingerGain(history, us, { KeyS: strokes(20, 300), KeyJ: strokes(20, 150) })).toBeNull();
    expect(fingerGain(history, us, { KeyS: strokes(5, 100) })).toBeNull();
    expect(fingerGain([], us, { KeyS: strokes(40, 100) })).toBeNull();
  });
});

describe('key sounds', () => {
  it('starts silent and keeps a saved switch', () => {
    expect(DEFAULT_SETTINGS.keySound).toBe('off');
    const storage = memory();
    const store = new Store(storage, 'en');
    store.update({ keySound: 'mxbrown' });
    store.flush();
    expect(new Store(storage, 'en').settings.keySound).toBe('mxbrown');
  });

  it('drops a switch it does not know', () => {
    const storage = memory();
    const store = new Store(storage, 'en');
    store.update({ keySound: 'gamer-rgb' as never });
    store.flush();
    expect(new Store(storage, 'en').settings.keySound).toBe('off');
  });

  it('plays each row of the board its own press, and the big keys theirs where the set has them', () => {
    expect(pressSample('mxbrown', 'Digit4')).toBe('press-r0');
    expect(pressSample('mxbrown', 'KeyQ')).toBe('press-r1');
    expect(pressSample('mxbrown', 'KeyA')).toBe('press-r2');
    expect(pressSample('mxbrown', 'KeyZ')).toBe('press-r3');
    expect(pressSample('mxbrown', 'AltRight')).toBe('press-r4');
    expect(pressSample('mxbrown', 'Space')).toBe('press-space');
    expect(pressSample('mxbrown', 'Enter')).toBe('press-enter');
    expect(pressSample('mxbrown', 'Backspace')).toBe('press-backspace');
    expect(releaseSample('mxbrown', 'KeyA')).toBe('release');
    expect(releaseSample('mxbrown', 'Space')).toBe('release-space');
  });

  it('falls back on the row for a set with no recording of the big keys', () => {
    expect(pressSample('mxblue', 'Space')).toBe('press-r4');
    expect(pressSample('mxblue', 'Enter')).toBe('press-r2');
    expect(pressSample('mxblue', 'Backspace')).toBe('press-r0');
    expect(releaseSample('mxblue', 'Space')).toBe('release');
    expect(samplesOf('mxblue')).toHaveLength(6);
    expect(samplesOf('topre')).toHaveLength(12);
  });

  it('names every switch once, in lowercase', () => {
    expect(new Set(SWITCH_IDS).size).toBe(SWITCHES.length);
    for (const item of SWITCHES) expect(item.name).toBe(item.name.toLowerCase());
  });
});
