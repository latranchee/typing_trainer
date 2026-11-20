import { describe, expect, it } from 'vitest';
import { PAIRS, TRIPLES } from '../src/core/corpus';
import type { Finger } from '../src/core/fingers';
import type { Bias, PairTraining, Transitions } from '../src/core/generator';
import { adaptiveQuotas, fingerShare, groupWeakness, isUnderPracticed, makePairs, transitionsOf } from '../src/core/generator';
import { LAYOUTS, getLayout } from '../src/core/layouts';
import { PairWatch } from '../src/core/metrics';
import type { KeyValueStore, PairStat } from '../src/core/store';
import { LANGS, pairAccuracy, pairErrors, pairMedian, pairWeakness, Store } from '../src/core/store';

function memory(seed: Record<string, unknown> = {}): KeyValueStore & { map: Map<string, string> } {
  const map = new Map(Object.entries(seed).map(([key, value]) => [key, JSON.stringify(value)]));
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}

/** A fixed stream of draws: the same seed gives the same sets. */
const seeded = (seed: number): (() => number) => {
  let state = seed;
  return () => (state = (state * 16807) % 2147483647) / 2147483647;
};

const bias = (transitions?: Transitions, focus: readonly Finger[] = []): Bias => ({ weakness: () => 0, focus: new Set(focus), transitions });

/** Transitions read straight from a table of numbers, as the store reads its own. */
function fromStats(pairs: Record<string, PairStat>): Transitions {
  const median = pairMedian(pairs);
  return { weakness: (pair) => pairWeakness(pairs[pair], median), samples: (pair) => pairs[pair]?.n ?? 0 };
}

/** Every English pair measured often, near 200 ms with a little spread and no misses: a typist with no standout transition. */
function evenTypist(): Record<string, PairStat> {
  const pairs: Record<string, PairStat> = {};
  [...new Set(PAIRS.en)].forEach((pair, i) => {
    pairs[pair] = { n: 30, ms: 185 + ((i * 37) % 30), err: 0 };
  });
  return pairs;
}

/** How many groups of a set are `group`, over `sets` sets drawn from one seed. */
function countDraws(group: string, transitions: Transitions | undefined, training: PairTraining, sets = 200): number {
  const layout = getLayout('us');
  const random = seeded(11);
  let count = 0;
  for (let i = 0; i < sets; i++) {
    const groups = makePairs(layout, 'en', 14, { size: 2, training }, bias(transitions), random).split(' ').filter((_, j) => j % 3 === 0);
    count += groups.filter((item) => item === group).length;
  }
  return count;
}

describe('transition weakness', () => {
  it('scores a slow, error-prone transition high and a fluent one low, by the three factors', () => {
    // 450 ms against a typical 200, 85% accuracy over 30 attempts.
    const struggling: PairStat = { n: 26, ms: 450, err: 4 };
    const slow = (450 / 200 - 1) / 1.5;
    const error = Math.min(1, 4 / 30 / 0.2);
    expect(pairWeakness(struggling, 200)).toBeCloseTo(0.75 * slow + 0.25 * error, 6);
    // After practice: 230 ms, 98% accuracy.
    const fluent: PairStat = { n: 98, ms: 230, err: 2 };
    expect(pairWeakness(fluent, 200)).toBeCloseTo(0.75 * 0.1 + 0.25 * 0.1, 6);
    expect(pairWeakness(fluent, 200)).toBeLessThan(pairWeakness(struggling, 200) / 5);
  });

  it('stays between 0 and 1, and scores a transition at or under the median on its misses alone', () => {
    expect(pairWeakness({ n: 50, ms: 2000, err: 50 }, 150)).toBe(1);
    expect(pairWeakness({ n: 50, ms: 120, err: 0 }, 150)).toBe(0);
    expect(pairWeakness({ n: 40, ms: 150, err: 10 }, 150)).toBeCloseTo(0.25, 6);
  });

  it('lowers its confidence below ten attempts and says nothing under five clean samples', () => {
    expect(pairWeakness({ n: 5, ms: 450, err: 0 }, 200)).toBeCloseTo(0.5 * 0.75 * ((450 / 200 - 1) / 1.5), 6);
    expect(pairWeakness({ n: 4, ms: 900, err: 6 }, 200)).toBe(0);
    expect(pairWeakness({ n: 0, ms: 0, err: 3 }, 200)).toBe(0);
    expect(pairWeakness(undefined, 200)).toBe(0);
    // No measured transition to compare with: no verdict.
    expect(pairWeakness({ n: 20, ms: 450, err: 0 }, 0)).toBe(0);
  });

  it('takes the median of the transitions measured often enough', () => {
    expect(pairMedian({})).toBe(0);
    expect(pairMedian({ a: { n: 5, ms: 100 }, b: { n: 5, ms: 300 }, c: { n: 2, ms: 9000 } })).toBe(200);
    expect(pairMedian({ a: { n: 5, ms: 100 }, b: { n: 5, ms: 300 }, c: { n: 9, ms: 250 } })).toBe(250);
  });

  it('reads numbers saved before misses were counted as none missed', () => {
    const legacy: PairStat = { n: 12, ms: 180 };
    expect(pairErrors(legacy)).toBe(0);
    expect(pairAccuracy(legacy)).toBe(1);
    expect(pairWeakness(legacy, 200)).toBe(0);
  });

  it('weighs a triple by both of its transitions, the weaker one more', () => {
    expect(transitionsOf('the')).toEqual(['th', 'he']);
    expect(transitionsOf('St')).toEqual(['st']);
    const scores: Record<string, number> = { th: 0.8, he: 0 };
    const transitions: Transitions = { weakness: (pair) => scores[pair] ?? 0, samples: () => 20 };
    expect(groupWeakness('the', transitions)).toBeCloseTo(0.6, 6);
    expect(groupWeakness('the', transitions)).toBeGreaterThan((0.8 + 0) / 2);
    expect(groupWeakness('th', transitions)).toBeCloseTo(0.8, 6);
    expect(isUnderPracticed('the', { weakness: () => 0, samples: (pair) => (pair === 'he' ? 4 : 20) })).toBe(true);
    expect(isUnderPracticed('the', transitions)).toBe(false);
  });
});

describe('pair watch', () => {
  it('times a clean transition and skips the first letter of a set', () => {
    const watch = new PairWatch();
    expect(watch.complete('s', 0, true)).toBeNull();
    expect(watch.complete('T', 180, true)).toEqual({ pair: 'st', ms: 180 });
  });

  it('counts one failure per attempt however many wrong keys follow, and no time for it', () => {
    const watch = new PairWatch();
    watch.complete('s', 0, true);
    expect(watch.miss('t', 100)).toBe('st');
    expect(watch.miss('t', 150)).toBeNull();
    expect(watch.miss('t', 210)).toBeNull();
    expect(watch.complete('t', 300, true)).toBeNull();
    // The next transition starts clean.
    expect(watch.complete('o', 420, true)).toEqual({ pair: 'to', ms: 120 });
  });

  it('measures nothing across a space, a mark, a pause or a new set', () => {
    const watch = new PairWatch();
    watch.complete('s', 0, true);
    expect(watch.complete(' ', 100, true)).toBeNull();
    expect(watch.miss('t', 150)).toBeNull();
    expect(watch.complete('t', 200, true)).toBeNull();
    expect(watch.complete('.', 300, true)).toBeNull();
    watch.complete('a', 400, true);
    expect(watch.miss('b', 2400)).toBeNull();
    expect(watch.complete('b', 2500, false)).toBeNull();
    watch.reset();
    expect(watch.complete('c', 2600, true)).toBeNull();
    expect(watch.miss('d', 2700)).toBe('cd');
  });

  it('keeps no time for a character whose last stroke came after a pause or a miss', () => {
    const watch = new PairWatch();
    watch.complete('s', 0, true);
    expect(watch.complete('t', 150, false)).toBeNull();
    expect(watch.complete('o', 300, true)).toEqual({ pair: 'to', ms: 150 });
  });

  it('treats a dead-key character as one: a miss on either stroke fails the transition once', () => {
    const watch = new PairWatch();
    const eCirc = String.fromCharCode(0xea);
    watch.complete('t', 0, true);
    // The accent stroke is missed, then the letter stroke: one failed transition.
    expect(watch.miss(eCirc, 100)).toBe(`t${eCirc}`);
    expect(watch.miss(eCirc, 200)).toBeNull();
    expect(watch.complete(eCirc, 300, true)).toBeNull();
    expect(watch.complete('t', 450, true)).toEqual({ pair: `${eCirc}t`, ms: 150 });
  });
});

describe('transition numbers in the store', () => {
  it('counts misses beside the clean samples and ranks transitions by weakness', () => {
    const store = new Store(memory(), 'en');
    for (let i = 0; i < 10; i++) {
      store.recordPair('us', 'th', 150);
      store.recordPair('us', 'he', 160);
      store.recordPair('us', 'st', i < 5 ? 600 : 400);
      store.recordPair('us', 'io', 300);
    }
    store.recordPair('us', 'qu', 900);
    store.recordPairError('us', 'st');
    store.recordPairError('us', 'st');
    store.recordPairError('us', 'zz');
    const { pairs } = store.layoutStats('us');
    expect(pairs.st.err).toBe(2);
    expect(pairs.zz).toEqual({ n: 0, ms: 0, err: 1 });

    const ranked = store.rankedPairs('us').map((entry) => entry.pair);
    // Measured too few times, qu and zz stay out of the ranking.
    expect(ranked).toEqual(['st', 'io', 'he', 'th']);
    expect(store.weakestPairs('us', 3)).toEqual(['st', 'io']);
    expect(store.pairWeakness('us', 'st')).toBeGreaterThan(store.pairWeakness('us', 'io'));
    expect(store.transitions('us').weakness('st')).toBe(store.pairWeakness('us', 'st'));
    expect(store.transitions('us').samples('qu')).toBe(1);
  });

  it('saves no transition while tracking is off', () => {
    const store = new Store(memory(), 'en');
    store.recordPair('us', 'st', 200);
    store.update({ track: false });
    store.recordPair('us', 'st', 900);
    store.recordPairError('us', 'st');
    store.recordPairError('us', 'io');
    expect(store.layoutStats('us').pairs).toEqual({ st: { n: 1, ms: 200, err: 0 } });
  });

  it('loads transitions saved before misses were counted, and counts on from them', () => {
    const storage = memory({
      'auriculaire:v2': {
        v: 2,
        active: 'main',
        profiles: [{ id: 'main', name: 'main', settings: { layout: 'us', drill: 'pairs' }, layouts: { us: { keys: {}, pairs: { th: { n: 12, ms: 180 }, st: { n: 9, ms: 420 } }, shiftOk: 0, shiftBad: 0 } } }],
      },
    });
    const store = new Store(storage, 'en');
    expect(store.rankedPairs('us').map((entry) => entry.pair)).toEqual(['st', 'th']);
    expect(store.settings.pairTraining).toBe('adaptive');
    store.recordPairError('us', 'th');
    store.recordPair('us', 'th', 180);
    expect(store.layoutStats('us').pairs.th).toEqual({ n: 13, ms: 180, err: 1 });
    store.flush();
    expect(new Store(storage, 'en').layoutStats('us').pairs.th.err).toBe(1);
  });

  it('starts on adaptive training, keeps classic once picked, and cleans anything else', () => {
    const store = new Store(memory(), 'en');
    expect(store.settings.pairTraining).toBe('adaptive');
    store.update({ pairTraining: 'classic' });
    store.flush();
    const profile = (pairTraining: unknown) => ({
      'auriculaire:v2': { v: 2, active: 'p', profiles: [{ id: 'p', name: 'p', settings: { pairTraining }, layouts: {} }] },
    });
    expect(new Store(memory(profile('classic')), 'en').settings.pairTraining).toBe('classic');
    expect(new Store(memory(profile('worst-first')), 'en').settings.pairTraining).toBe('adaptive');
  });
});

describe('adaptive letter groups', () => {
  it('splits a set of fourteen into eight weak groups, four common and two to explore', () => {
    expect(adaptiveQuotas(14)).toEqual({ weak: 8, common: 4, explore: 2 });
    for (const groups of [1, 5, 10, 14, 30]) {
      const quota = adaptiveQuotas(groups);
      expect(quota.weak + quota.common + quota.explore, String(groups)).toBe(groups);
    }
    expect(adaptiveQuotas(20)).toEqual({ weak: 12, common: 5, explore: 3 });
  });

  it('gives an untouched profile valid, varied sets', () => {
    const layout = getLayout('us');
    const empty = fromStats({});
    const random = seeded(3);
    for (let i = 0; i < 20; i++) {
      const text = makePairs(layout, 'en', 14, { size: 2, training: 'adaptive' }, bias(empty), random);
      const groups = text.split(' ');
      expect(groups).toHaveLength(42);
      const picks = groups.filter((_, j) => j % 3 === 0);
      expect(new Set(picks).size).toBeGreaterThanOrEqual(8);
      picks.forEach((pick, j) => {
        expect(PAIRS.en).toContain(pick);
        expect(groups[j * 3 + 1]).toBe(pick);
        expect(groups[j * 3 + 2]).toBe(pick);
        if (j > 0) expect(pick, `set ${i} group ${j}`).not.toBe(picks[j - 1]);
      });
    }
  });

  it('draws the same sets from the same seed', () => {
    const transitions = fromStats(evenTypist());
    const draw = () => makePairs(getLayout('us'), 'en', 14, { size: 3, training: 'adaptive' }, bias(transitions), seeded(42));
    expect(draw()).toBe(draw());
  });

  it('gives a slow transition far more practice than an equally common fast one', () => {
    const pairs = evenTypist();
    // st and to sit side by side in the frequency list.
    pairs.st = { n: 26, ms: 450, err: 4 };
    pairs.to = { n: 30, ms: 200, err: 0 };
    const transitions = fromStats(pairs);
    const slow = countDraws('st', transitions, 'adaptive');
    const fast = countDraws('to', transitions, 'adaptive');
    expect(slow).toBeGreaterThan(fast * 4);
    // Classic training sees no difference between them.
    const classicSlow = countDraws('st', transitions, 'classic');
    const classicFast = countDraws('to', transitions, 'classic');
    expect(classicSlow).toBeLessThan(classicFast * 2);
    expect(classicFast).toBeLessThan(classicSlow * 2);
    expect(slow).toBeGreaterThan(classicSlow * 3);
  });

  it('draws a transition less and less as it gets quicker and cleaner', () => {
    const stages: PairStat[] = [
      { n: 26, ms: 450, err: 4 },
      { n: 60, ms: 330, err: 4 },
      { n: 120, ms: 260, err: 3 },
      { n: 200, ms: 215, err: 2 },
    ];
    const counts = stages.map((stage) => countDraws('st', fromStats({ ...evenTypist(), st: stage }), 'adaptive'));
    for (let i = 1; i < counts.length; i++) expect(counts[i], `stage ${i}: ${counts.join(' ')}`).toBeLessThan(counts[i - 1]);
    // Fluent, it comes up about as often as classic training would bring it.
    expect(counts[counts.length - 1]).toBeLessThan(countDraws('st', undefined, 'classic') * 2);
  });

  it('spreads the weak draws by weight instead of always taking the weakest', () => {
    const pairs = evenTypist();
    pairs.st = { n: 30, ms: 500, err: 3 };
    pairs.io = { n: 30, ms: 380, err: 1 };
    pairs.ea = { n: 30, ms: 320, err: 0 };
    const transitions = fromStats(pairs);
    const st = countDraws('st', transitions, 'adaptive');
    const io = countDraws('io', transitions, 'adaptive');
    const ea = countDraws('ea', transitions, 'adaptive');
    expect(st).toBeGreaterThan(io);
    expect(io).toBeGreaterThan(ea);
    expect(ea).toBeGreaterThan(countDraws('ea', transitions, 'classic'));
  });

  it('gives about three fifths of a set to the weak transitions once there are many', () => {
    const pairs = evenTypist();
    const weak = [...new Set(PAIRS.en)].filter((_, i) => i % 3 === 1);
    weak.forEach((pair, i) => {
      pairs[pair] = { n: 30, ms: 300 + (i % 5) * 50, err: i % 3 };
    });
    const transitions = fromStats(pairs);
    const layout = getLayout('us');
    const random = seeded(17);
    let hits = 0;
    let slots = 0;
    for (let i = 0; i < 200; i++) {
      const picks = makePairs(layout, 'en', 14, { size: 2, training: 'adaptive' }, bias(transitions), random).split(' ').filter((_, j) => j % 3 === 0);
      hits += picks.filter((pick) => weak.includes(pick)).length;
      slots += picks.length;
    }
    // Three fifths through the weak slots, a little more where the common draws land on them too.
    expect(hits / slots).toBeGreaterThan(0.6);
    expect(hits / slots).toBeLessThan(0.8);
  });

  it('trains a typist with no standout transition on frequency', () => {
    const transitions = fromStats(evenTypist());
    for (const pair of ['th', 'er', 'aw']) {
      const adaptive = countDraws(pair, transitions, 'adaptive');
      const classic = countDraws(pair, transitions, 'classic');
      expect(adaptive, pair).toBeGreaterThan(classic * 0.6);
      expect(adaptive, pair).toBeLessThan(classic * 1.6);
    }
  });

  it('explores the transitions measured too few times', () => {
    const pairs = evenTypist();
    delete pairs.aw;
    delete pairs.sa;
    const transitions = fromStats(pairs);
    const explored = countDraws('aw', transitions, 'adaptive') + countDraws('sa', transitions, 'adaptive');
    // About two groups a set go to exploring, and only these two need it.
    expect(explored).toBeGreaterThan(200 * 1.5);
  });

  it('weighs triples by their transitions', () => {
    const pairs = evenTypist();
    pairs.he = { n: 30, ms: 520, err: 5 };
    const transitions = fromStats(pairs);
    const layout = getLayout('us');
    const share = (training: PairTraining): number => {
      const random = seeded(5);
      let withHe = 0;
      let total = 0;
      for (let i = 0; i < 100; i++) {
        for (const group of makePairs(layout, 'en', 14, { size: 3, training }, bias(transitions), random).split(' ')) {
          if (transitionsOf(group).includes('he')) withHe++;
          total++;
        }
      }
      return withHe / total;
    };
    // Only the and her hold it, two groups of fifty: they take most of the weak slots.
    expect(share('adaptive')).toBeGreaterThan(0.25);
    expect(share('adaptive')).toBeGreaterThan(share('classic') * 4);
  });

  it('keeps to the focus fingers', () => {
    const layout = getLayout('us');
    const focus = new Set<Finger>(['LP']);
    const pairs = evenTypist();
    // The weakest transition gives the left pinky no letter: it stays out.
    pairs.io = { n: 30, ms: 700, err: 8 };
    const groups = makePairs(layout, 'en', 40, { size: 2, training: 'adaptive' }, bias(fromStats(pairs), ['LP']), seeded(9)).split(' ');
    expect(groups.every((group) => fingerShare(layout, group, focus) > 0)).toBe(true);
  });

  it('only draws groups the layout can type, on every layout, language and size', () => {
    const scores: Record<string, PairStat> = {};
    for (const lang of LANGS) {
      [...PAIRS[lang], ...TRIPLES[lang].flatMap(transitionsOf)].forEach((pair, i) => {
        scores[pair] = { n: 10 + (i % 5), ms: 150 + ((i * 53) % 250), err: i % 4 };
      });
    }
    const transitions = fromStats(scores);
    for (const layout of LAYOUTS) {
      for (const lang of LANGS) {
        for (const size of [2, 3] as const) {
          const text = makePairs(layout, lang, 14, { size, training: 'adaptive' }, bias(transitions), seeded(1));
          const groups = text.split(' ');
          expect(groups, `${layout.id} ${lang} ${size}`).toHaveLength(42);
          for (const group of groups) {
            expect(layout.canType(group), `${layout.id} ${group}`).toBe(true);
            expect((size === 2 ? PAIRS : TRIPLES)[lang]).toContain(group);
          }
        }
      }
    }
  });

  it('draws classic sets exactly as before, with or without numbers', () => {
    const layout = getLayout('ca-fr');
    const transitions = fromStats(evenTypist());
    const before = makePairs(layout, 'fr', 14, { size: 2 }, bias(), seeded(8));
    expect(makePairs(layout, 'fr', 14, { size: 2, training: 'classic' }, bias(transitions), seeded(8))).toBe(before);
    // Adaptive training without the store's numbers falls back to classic.
    expect(makePairs(layout, 'fr', 14, { size: 2, training: 'adaptive' }, bias(), seeded(8))).toBe(before);
  });
});
