import { describe, expect, it } from 'vitest';
import {
  beatLevel,
  BEAT_MS,
  CLIMB_EVERY_MS,
  clock,
  dangerAmount,
  dangerLevel,
  DEFAULT_DIFFICULTY,
  DIFFICULTIES,
  Fuse,
  Heart,
  MIN_CAP,
  RULES,
  Run,
  runKey,
  tremorAmount,
  tunnelAmount,
} from '../src/core/hardcore';
import { RollingWpm, SetStats } from '../src/core/metrics';
import type { KeyValueStore } from '../src/core/store';
import { Store } from '../src/core/store';

/** The hardest difficulty: every rule at full strength. The fuse, run and warning tests are written against it. */
const HARD = RULES[3];
const { scar: SCAR, typoBurn: TYPO_BURN, warmupMs: WARMUP_MS, climbStep: CLIMB_STEP } = HARD;

/** Runs the fuse at a steady rate in 10 ms frames. Returns the milliseconds until it burnt out, or null. */
function burnOut(fuse: Fuse, wpm: number, floor: number, limitMs = 20000): number | null {
  for (let ms = 10; ms <= limitMs; ms += 10) if (fuse.step(wpm, floor, 10)) return ms;
  return null;
}

const memory = (seed: Record<string, unknown> = {}): KeyValueStore => {
  const map = new Map(Object.entries(seed).map(([key, value]) => [key, JSON.stringify(value)]));
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => void map.set(key, value), removeItem: (key) => void map.delete(key) };
};

describe('hardcore fuse', () => {
  it('holds at or above the floor', () => {
    const fuse = new Fuse(HARD);
    expect(burnOut(fuse, 100, 100)).toBeNull();
    expect(fuse.life).toBe(1);
    expect(fuse.cap).toBe(1);
  });

  it('burns out in about three seconds just under the floor and 1.2 seconds far under it', () => {
    expect(burnOut(new Fuse(HARD), 99.9, 100)).toBeGreaterThan(2950);
    expect(burnOut(new Fuse(HARD), 99.9, 100)).toBeLessThan(3050);
    for (const wpm of [75, 50, 0]) {
      expect(burnOut(new Fuse(HARD), wpm, 100)).toBeGreaterThanOrEqual(1190);
      expect(burnOut(new Fuse(HARD), wpm, 100)).toBeLessThanOrEqual(1210);
    }
  });

  it('is scarred by what burns, and grows back no further than the scar', () => {
    const fuse = new Fuse(HARD);
    burnOut(fuse, 50, 100, 600);
    expect(fuse.life).toBeCloseTo(0.5, 5);
    expect(fuse.cap).toBeCloseTo(1 - 0.5 * SCAR, 5);
    burnOut(fuse, 120, 100, 2000);
    expect(fuse.life).toBeCloseTo(0.62, 5);
    burnOut(fuse, 120, 100, 10000);
    expect(fuse.life).toBeCloseTo(0.875, 5);
    expect(fuse.life).toBe(fuse.cap);
  });

  it('loses a piece at once on a wrong key, and burns out on wrong keys alone', () => {
    const fuse = new Fuse(HARD);
    expect(fuse.hit()).toBe(false);
    expect(fuse.life).toBeCloseTo(1 - TYPO_BURN, 5);
    expect(fuse.cap).toBeCloseTo(1 - TYPO_BURN * SCAR, 5);
    let hits = 1;
    while (!fuse.hit()) hits++;
    expect(hits + 1).toBe(Math.ceil(1 / TYPO_BURN));
    expect(fuse.life).toBe(0);
  });

  it('refills to the scar for the next set of a run, and to full for a new run', () => {
    const fuse = new Fuse(HARD);
    burnOut(fuse, 0, 100, 600);
    const { cap } = fuse;
    expect(cap).toBeLessThan(1);
    fuse.refill();
    expect(fuse.life).toBe(cap);
    expect(fuse.cap).toBe(cap);
    fuse.reset();
    expect(fuse.life).toBe(1);
    expect(fuse.cap).toBe(1);
  });

  it('always keeps some fuse to work with, however scarred', () => {
    const fuse = new Fuse(HARD);
    for (let round = 0; round < 20; round++) {
      burnOut(fuse, 0, 100);
      fuse.refill();
    }
    expect(fuse.cap).toBeCloseTo(MIN_CAP, 5);
    expect(fuse.life).toBeCloseTo(MIN_CAP, 5);
  });

  it('stays burnt out and does nothing without a floor', () => {
    const fuse = new Fuse(HARD);
    burnOut(fuse, 0, 100);
    expect(fuse.step(200, 100, 1000)).toBe(true);
    expect(fuse.life).toBe(0);

    const idle = new Fuse(HARD);
    expect(burnOut(idle, 0, 0)).toBeNull();
    expect(idle.life).toBe(1);
  });
});

describe('hardcore difficulty', () => {
  it('leaves the fuse alone at 1: wrong keys burn nothing, nothing scars and the fuse grows back whole', () => {
    const fuse = new Fuse(RULES[1]);
    for (let i = 0; i < 50; i++) expect(fuse.hit()).toBe(false);
    expect(fuse.life).toBe(1);
    burnOut(fuse, 0, 100, 1000);
    expect(fuse.life).toBeCloseTo(0.5, 5);
    expect(fuse.cap).toBe(1);
    burnOut(fuse, 120, 100, 10000);
    expect(fuse.life).toBe(1);
  });

  it('burns the fuse out sooner at each step, just under the floor and far under it', () => {
    const lasts = (level: 1 | 2 | 3, wpm: number): number => burnOut(new Fuse(RULES[level]), wpm, 100) ?? Infinity;
    expect(lasts(1, 99.9)).toBeGreaterThan(4950);
    expect(lasts(1, 99.9)).toBeLessThan(5050);
    expect(lasts(1, 50)).toBeGreaterThanOrEqual(1990);
    expect(lasts(1, 50)).toBeLessThanOrEqual(2010);
    for (const wpm of [99.9, 50]) {
      expect(lasts(2, wpm)).toBeLessThan(lasts(1, wpm));
      expect(lasts(3, wpm)).toBeLessThan(lasts(2, wpm));
    }
  });

  it('asks more at each step: an earlier fuse, a slower regrowth, costlier typos, deeper scars, a steeper climb', () => {
    for (const level of [2, 3] as const) {
      const easier = RULES[(level - 1) as 1 | 2];
      const harder = RULES[level];
      expect(harder.warmupMs).toBeLessThan(easier.warmupMs);
      expect(harder.regrow).toBeLessThan(easier.regrow);
      expect(harder.typoBurn).toBeGreaterThan(easier.typoBurn);
      expect(harder.scar).toBeGreaterThan(easier.scar);
      expect(harder.climbStep).toBeGreaterThan(easier.climbStep);
    }
  });

  it('takes up the rules of a new difficulty with the next run', () => {
    const fuse = new Fuse(RULES[1]);
    burnOut(fuse, 0, 100, 1000);
    fuse.reset(RULES[3]);
    expect(fuse.life).toBe(1);
    fuse.hit();
    expect(fuse.life).toBeCloseTo(1 - RULES[3].typoBurn, 5);
    fuse.reset();
    expect(fuse.rules).toBe(RULES[3]);
  });

  it('keeps the best runs of each difficulty apart', () => {
    const keys = DIFFICULTIES.map((level) => runKey('us', 'words', 60, level));
    expect(new Set(keys).size).toBe(DIFFICULTIES.length);
    expect(runKey('us', 'words', 60, 2)).not.toBe(runKey('us', 'words', 80, 2));
    expect(runKey('us', 'words', 60, 2)).not.toBe(runKey('us', 'highway', 60, 2));
    expect(runKey('us', 'words', 60, 2)).not.toBe(runKey('ca-fr', 'words', 60, 2));
  });
});

describe('hardcore run', () => {
  it('raises the floor a step for each stretch held', () => {
    const run = new Run(60, CLIMB_STEP);
    expect(run.started).toBe(false);
    expect(run.floor).toBe(60);
    expect(run.tick(CLIMB_EVERY_MS - 1)).toBe(false);
    expect(run.started).toBe(true);
    expect(run.floor).toBe(60);
    expect(run.tick(1)).toBe(true);
    expect(run.floor).toBe(60 + CLIMB_STEP);
    expect(run.tick(16)).toBe(false);
    expect(run.tick(CLIMB_EVERY_MS)).toBe(true);
    expect(run.floor).toBe(60 + 2 * CLIMB_STEP);
  });

  it('has no floor to raise when none is set', () => {
    const run = new Run(0, CLIMB_STEP);
    expect(run.tick(10 * CLIMB_EVERY_MS)).toBe(false);
    expect(run.floor).toBe(0);
  });

  it('keeps the floor where it was picked when the difficulty has no climb', () => {
    const run = new Run(60, RULES[1].climbStep);
    expect(run.tick(10 * CLIMB_EVERY_MS)).toBe(false);
    expect(run.floor).toBe(60);
    expect(run.started).toBe(true);
  });

  it('counts a cleared set as something to lose', () => {
    const run = new Run(80);
    run.sets++;
    expect(run.started).toBe(true);
  });

  it('writes held time as minutes and seconds', () => {
    expect(clock(0)).toBe('0:00');
    expect(clock(59999)).toBe('0:59');
    expect(clock(60000)).toBe('1:00');
    expect(clock(754000)).toBe('12:34');
  });
});

describe('hardcore warning', () => {
  it('warms up as the fuse runs down', () => {
    expect(dangerLevel(1)).toBe(0);
    expect(dangerLevel(0.7)).toBe(0);
    expect(dangerLevel(0.69)).toBe(1);
    expect(dangerLevel(0.4)).toBe(1);
    expect(dangerLevel(0.39)).toBe(2);
    expect(dangerLevel(0.19)).toBe(3);
    expect(dangerAmount(0.9)).toBe(0);
    expect(dangerAmount(0.7)).toBe(0);
    expect(dangerAmount(0.35)).toBeCloseTo(0.5, 5);
    expect(dangerAmount(0)).toBe(1);
  });

  it('narrows the screen under half a fuse and trembles on the last of it', () => {
    expect(tunnelAmount(0.8)).toBe(0);
    expect(tunnelAmount(0.5)).toBe(0);
    expect(tunnelAmount(0.3)).toBeCloseTo(0.5, 5);
    expect(tunnelAmount(0.1)).toBe(1);
    expect(tunnelAmount(0)).toBe(1);
    expect(tremorAmount(0.5)).toBe(0);
    expect(tremorAmount(0.06)).toBeCloseTo(0.5, 5);
    expect(tremorAmount(0)).toBe(1);
  });

  it('always beats under the floor, and one step calmer above it until the fuse is out of danger', () => {
    expect(beatLevel(1, false)).toBe(0);
    expect(beatLevel(1, true)).toBe(1);
    expect(beatLevel(0.5, true)).toBe(1);
    expect(beatLevel(0.5, false)).toBe(0);
    expect(beatLevel(0.3, true)).toBe(2);
    expect(beatLevel(0.3, false)).toBe(1);
    expect(beatLevel(0.1, true)).toBe(3);
    expect(beatLevel(0.1, false)).toBe(2);
  });
});

describe('heartbeat', () => {
  /** Steps the heart in 10 ms frames and returns when each thump started. */
  function listen(heart: Heart, ms: number, level: (at: number) => 0 | 1 | 2 | 3): { lubs: number[]; dubs: number[]; pulse: number } {
    const lubs: number[] = [];
    const dubs: number[] = [];
    let pulse = 0;
    for (let at = 0; at <= ms; at += 10) {
      const beat = heart.step(10, level(at));
      if (beat.lub) lubs.push(at);
      if (beat.dub) dubs.push(at);
      pulse = beat.pulse;
    }
    return { lubs, dubs, pulse };
  }

  it('rests until there is something to fear', () => {
    const { lubs, dubs, pulse } = listen(new Heart(), 2000, () => 0);
    expect(lubs).toEqual([]);
    expect(dubs).toEqual([]);
    expect(pulse).toBe(0);
  });

  it('thumps twice a beat at the pace of its level', () => {
    const { lubs, dubs } = listen(new Heart(), 3 * BEAT_MS[1] + 100, () => 1);
    expect(lubs).toHaveLength(4);
    expect(dubs).toHaveLength(3);
    expect(lubs[0]).toBe(0);
    expect(lubs[1]).toBeGreaterThanOrEqual(BEAT_MS[1] - 20);
    expect(lubs[1]).toBeLessThanOrEqual(BEAT_MS[1] + 20);
    // The second thump lands in the first quarter of the beat.
    expect(dubs[0]).toBeGreaterThan(200);
    expect(dubs[0]).toBeLessThan(300);
  });

  it('swells to its top on the first thump', () => {
    const heart = new Heart();
    heart.step(10, 2);
    expect(heart.step(BEAT_MS[2] * 0.1, 2).pulse).toBeCloseTo(1, 5);
  });

  it('finishes the beat it is on before it changes pace', () => {
    const { lubs } = listen(new Heart(), 2000, (at) => (at === 0 ? 1 : 3));
    expect(lubs[1]).toBeGreaterThanOrEqual(BEAT_MS[1] - 20);
    expect(lubs[2] - lubs[1]).toBeGreaterThanOrEqual(BEAT_MS[3] - 20);
    expect(lubs[2] - lubs[1]).toBeLessThanOrEqual(BEAT_MS[3] + 20);
  });

  it('finishes the beat it is on before it rests', () => {
    const heart = new Heart();
    expect(heart.step(10, 2).lub).toBe(true);
    expect(heart.step(BEAT_MS[2] * 0.1, 0).pulse).toBeGreaterThan(0.9);
    const { lubs, pulse } = listen(heart, 3000, () => 0);
    expect(lubs).toEqual([]);
    expect(pulse).toBe(0);
  });
});

describe('rolling rate under a floor', () => {
  it('reads the rate over the warm-up by the time the fuse is lit', () => {
    const rolling = new RollingWpm(10000);
    // One character every 200 ms is 60 WPM.
    for (let t = 0; t < WARMUP_MS; t += 200) rolling.add(t);
    const plain = rolling.value(WARMUP_MS);
    const lit = rolling.value(WARMUP_MS, WARMUP_MS);
    expect(lit).toBeGreaterThan(55);
    expect(lit).toBeLessThan(70);
    expect(plain).toBeLessThan(lit);
  });

  it('starts over with a new set', () => {
    const rolling = new RollingWpm(10000);
    for (let t = 0; t <= 5000; t += 200) rolling.add(t);
    rolling.reset();
    expect(rolling.value(5000)).toBe(0);
    rolling.add(9000);
    expect(rolling.value(9000 + WARMUP_MS, WARMUP_MS)).toBeCloseTo(8, 5);
  });
});

describe('set stats', () => {
  it('counts erasing as typing time without counting it right or wrong', () => {
    const stats = new SetStats();
    stats.hit(0, true);
    stats.miss(200);
    stats.pace(400);
    stats.pace(600);
    stats.hit(800, true);
    expect(stats.activeMs).toBe(800);
    expect(stats.correct).toBe(2);
    expect(stats.wrong).toBe(1);
  });
});

describe('hardcore settings', () => {
  const saved = (settings: Record<string, unknown>) => ({
    'auriculaire:v2': { v: 2, active: 'main', profiles: [{ id: 'main', name: 'main', settings, layouts: {} }] },
  });

  it('starts off with no floor and the sound on', () => {
    const store = new Store(memory(), 'en');
    expect(store.settings.hardcore).toBe(false);
    expect(store.settings.floor).toBe(0);
    expect(store.settings.sound).toBe(true);
  });

  it('keeps a saved floor it offers and drops one it does not', () => {
    const kept = new Store(memory(saved({ hardcore: true, floor: 80 })), 'en');
    expect(kept.settings.hardcore).toBe(true);
    expect(kept.settings.floor).toBe(80);
    const dropped = new Store(memory(saved({ hardcore: 'yes', floor: 85 })), 'en');
    expect(dropped.settings.hardcore).toBe(false);
    expect(dropped.settings.floor).toBe(0);
  });

  it('starts at the middle difficulty, keeps a saved one it offers and drops one it does not', () => {
    expect(new Store(memory(), 'en').settings.difficulty).toBe(DEFAULT_DIFFICULTY);
    expect(DEFAULT_DIFFICULTY).toBe(2);
    expect(new Store(memory(saved({ difficulty: 3 })), 'en').settings.difficulty).toBe(3);
    expect(new Store(memory(saved({ difficulty: 1 })), 'en').settings.difficulty).toBe(1);
    expect(new Store(memory(saved({ difficulty: 4 })), 'en').settings.difficulty).toBe(2);
    expect(new Store(memory(saved({ difficulty: '3' })), 'en').settings.difficulty).toBe(2);
    expect(new Store(memory(saved({})), 'en').settings.difficulty).toBe(2);
  });

  it('keeps the sound off once it was turned off', () => {
    expect(new Store(memory(saved({ sound: false })), 'en').settings.sound).toBe(false);
    expect(new Store(memory(saved({ sound: 'no' })), 'en').settings.sound).toBe(true);
    expect(new Store(memory(saved({})), 'en').settings.sound).toBe(true);
  });
});

describe('best runs', () => {
  const key = 'us|words|60';

  it('keeps the longest time and the most sets, each on its own', () => {
    const store = new Store(memory(), 'en');
    expect(store.bestRun(key)).toEqual({ ms: 0, sets: 0 });
    expect(store.recordRun(key, 42000.4, 2)).toEqual({ ms: true, sets: true });
    expect(store.bestRun(key)).toEqual({ ms: 42000, sets: 2 });
    expect(store.recordRun(key, 30000, 3)).toEqual({ ms: false, sets: true });
    expect(store.bestRun(key)).toEqual({ ms: 42000, sets: 3 });
    expect(store.recordRun(key, 42000, 3)).toEqual({ ms: false, sets: false });
  });

  it('keeps each layout, drill and floor apart', () => {
    const store = new Store(memory(), 'en');
    store.recordRun(key, 42000, 2);
    expect(store.bestRun('us|words|80')).toEqual({ ms: 0, sets: 0 });
    expect(store.bestRun('us|highway|60')).toEqual({ ms: 0, sets: 0 });
  });

  it('survives a reload', () => {
    const storage = memory();
    new Store(storage, 'en').recordRun(key, 42000, 2);
    expect(new Store(storage, 'en').bestRun(key)).toEqual({ ms: 42000, sets: 2 });
  });

  it('saves nothing while tracking is off', () => {
    const store = new Store(memory(), 'en');
    store.recordRun(key, 42000, 2);
    store.update({ track: false });
    expect(store.recordRun(key, 99000, 9)).toEqual({ ms: false, sets: false });
    expect(store.bestRun(key)).toEqual({ ms: 42000, sets: 2 });
  });

  it('goes with the numbers when they are erased, and stays with its profile', () => {
    const store = new Store(memory(), 'en');
    store.recordRun(key, 42000, 2);
    const first = store.profileId;
    store.addProfile('guest');
    expect(store.bestRun(key)).toEqual({ ms: 0, sets: 0 });
    store.recordRun(key, 5000, 1);
    store.resetStats();
    expect(store.bestRun(key)).toEqual({ ms: 0, sets: 0 });
    store.switchProfile(first);
    expect(store.bestRun(key)).toEqual({ ms: 42000, sets: 2 });
  });
});
