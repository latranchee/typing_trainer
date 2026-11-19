import { describe, expect, it } from 'vitest';
import { dangerAmount, dangerLevel, Fuse } from '../src/core/hardcore';
import { SetStats } from '../src/core/metrics';
import type { KeyValueStore } from '../src/core/store';
import { Store } from '../src/core/store';

/** Runs the fuse at a steady rate in 10 ms frames. Returns the milliseconds until it burnt out, or null. */
function burnOut(fuse: Fuse, wpm: number, floor: number, limitMs = 20000): number | null {
  for (let ms = 10; ms <= limitMs; ms += 10) if (fuse.step(wpm, floor, 10)) return ms;
  return null;
}

describe('hardcore fuse', () => {
  it('holds at or above the floor', () => {
    const fuse = new Fuse();
    expect(burnOut(fuse, 100, 100)).toBeNull();
    expect(fuse.life).toBe(1);
  });

  it('burns out in about five seconds just under the floor and two seconds far under it', () => {
    expect(burnOut(new Fuse(), 99.9, 100)).toBeGreaterThan(4900);
    expect(burnOut(new Fuse(), 99.9, 100)).toBeLessThan(5100);
    for (const wpm of [75, 50, 0]) {
      expect(burnOut(new Fuse(), wpm, 100)).toBeGreaterThanOrEqual(1990);
      expect(burnOut(new Fuse(), wpm, 100)).toBeLessThanOrEqual(2010);
    }
  });

  it('grows back above the floor, never past full', () => {
    const fuse = new Fuse();
    burnOut(fuse, 50, 100, 1000);
    expect(fuse.life).toBeCloseTo(0.5, 5);
    burnOut(fuse, 120, 100, 2000);
    expect(fuse.life).toBeCloseTo(0.74, 5);
    burnOut(fuse, 120, 100, 10000);
    expect(fuse.life).toBe(1);
  });

  it('stays burnt out and does nothing without a floor', () => {
    const fuse = new Fuse();
    burnOut(fuse, 0, 100);
    expect(fuse.step(200, 100, 1000)).toBe(true);
    expect(fuse.life).toBe(0);

    const idle = new Fuse();
    expect(burnOut(idle, 0, 0)).toBeNull();
    expect(idle.life).toBe(1);
  });

  it('warms up the warning as the fuse runs down', () => {
    expect(dangerLevel(1)).toBe(0);
    expect(dangerLevel(0.4)).toBe(0);
    expect(dangerLevel(0.3)).toBe(1);
    expect(dangerLevel(0.2)).toBe(2);
    expect(dangerLevel(0.05)).toBe(3);
    expect(dangerAmount(0.8)).toBe(0);
    expect(dangerAmount(0.2)).toBeCloseTo(0.5, 5);
    expect(dangerAmount(0)).toBe(1);
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
  const memory = (seed: Record<string, unknown>): KeyValueStore => {
    const map = new Map(Object.entries(seed).map(([key, value]) => [key, JSON.stringify(value)]));
    return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => void map.set(key, value), removeItem: (key) => void map.delete(key) };
  };

  it('starts off with no floor', () => {
    const store = new Store(memory({}), 'en');
    expect(store.settings.hardcore).toBe(false);
    expect(store.settings.floor).toBe(0);
  });

  it('keeps a saved floor it offers and drops one it does not', () => {
    const saved = (settings: Record<string, unknown>) => ({
      'auriculaire:v2': { v: 2, active: 'main', profiles: [{ id: 'main', name: 'main', settings, layouts: {} }] },
    });
    const kept = new Store(memory(saved({ hardcore: true, floor: 80 })), 'en');
    expect(kept.settings.hardcore).toBe(true);
    expect(kept.settings.floor).toBe(80);
    const dropped = new Store(memory(saved({ hardcore: 'yes', floor: 85 })), 'en');
    expect(dropped.settings.hardcore).toBe(false);
    expect(dropped.settings.floor).toBe(0);
  });
});
