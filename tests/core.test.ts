import { describe, expect, it } from 'vitest';
import { PAIRS, TRIPLES, WORDS } from '../src/core/corpus';
import { makeAnchorSet, makePairs, makeWords, weakShare } from '../src/core/generator';
import { getLayout, LAYOUTS } from '../src/core/layouts';
import { RollingWpm, SetStats } from '../src/core/metrics';
import { ROWS } from '../src/core/physical';

const noWeakness = () => 0;
const E_ACUTE = String.fromCharCode(0xe9);
const E_GRAVE = String.fromCharCode(0xe8);
const C_CEDILLA = String.fromCharCode(0xe7);
const E_CIRC = String.fromCharCode(0xea);

describe('physical board', () => {
  it('has fifteen units in every row', () => {
    for (const row of ROWS) expect(row.reduce((sum, key) => sum + key.w, 0)).toBe(15);
  });
});

describe('layouts', () => {
  it('types plain letters on every layout', () => {
    for (const layout of LAYOUTS) expect(layout.canType('the quick brown fox jumps over a lazy dog')).toBe(true);
  });

  it('puts e-acute on its own key in Canadian French', () => {
    expect(getLayout('ca-fr').strokesFor(E_ACUTE)).toEqual([{ code: 'Slash', shift: false }]);
  });

  it('builds accents from dead keys in Canadian French', () => {
    const layout = getLayout('ca-fr');
    expect(layout.strokesFor(E_GRAVE)).toEqual([
      { code: 'Quote', shift: false },
      { code: 'KeyE', shift: false },
    ]);
    expect(layout.strokesFor(C_CEDILLA)).toEqual([
      { code: 'BracketRight', shift: false },
      { code: 'KeyC', shift: false },
    ]);
    expect(layout.strokesFor(E_CIRC)).toEqual([
      { code: 'BracketLeft', shift: false },
      { code: 'KeyE', shift: false },
    ]);
  });

  it('types the apostrophe with Shift and comma in Canadian French', () => {
    expect(getLayout('ca-fr').strokesFor("'")).toEqual([{ code: 'Comma', shift: true }]);
  });

  it('cannot type accents on layouts without accent keys', () => {
    expect(getLayout('us').canType(E_ACUTE)).toBe(false);
    expect(getLayout('colemak-dh').canType(E_GRAVE)).toBe(false);
  });

  it('maps Colemak-DH letters to their physical keys and angle fingering', () => {
    const layout = getLayout('colemak-dh');
    expect(layout.strokesFor('o')).toEqual([{ code: 'Semicolon', shift: false }]);
    expect(layout.strokesFor('d')).toEqual([{ code: 'KeyC', shift: false }]);
    expect(layout.fingerOf('KeyZ')).toBe('LR');
    expect(layout.fingerOf('KeyC')).toBe('LI');
    expect(layout.fingerOf('Semicolon')).toBe('RP');
  });

  it('asks for the Shift key on the opposite hand', () => {
    const layout = getLayout('us');
    expect(layout.properShift('KeyA')).toBe('ShiftRight');
    expect(layout.properShift('KeyP')).toBe('ShiftLeft');
  });

  it('shows dead keys with a spacing accent', () => {
    expect(getLayout('ca-fr').legend('BracketLeft')?.base).toBe('^');
  });
});

describe('corpus', () => {
  it('keeps most French words typeable in Canadian French', () => {
    const layout = getLayout('ca-fr');
    const typeable = WORDS.fr.filter((word) => layout.canType(word));
    expect(typeable.length / WORDS.fr.length).toBeGreaterThan(0.97);
    expect(typeable).toContain('fen' + E_CIRC + 'tre');
  });

  it('has letter groups of the right size', () => {
    for (const lang of ['en', 'fr'] as const) {
      expect(PAIRS[lang].every((pair) => pair.length === 2)).toBe(true);
      expect(TRIPLES[lang].every((triple) => triple.length === 3)).toBe(true);
    }
  });
});

describe('generator', () => {
  it('returns the requested number of typeable words', () => {
    for (const layout of LAYOUTS) {
      const text = makeWords(layout, 'fr', 30, { caps: true }, noWeakness);
      expect(text.split(' ')).toHaveLength(30);
      expect(layout.canType(text)).toBe(true);
    }
  });

  it('favours ring and pinky work', () => {
    const layout = getLayout('us');
    const weighted = weakShare(layout, makeWords(layout, 'en', 400, { caps: false }, noWeakness));
    const uniform = weakShare(layout, [...new Set(WORDS.en)].join(' '));
    expect(weighted).toBeGreaterThan(uniform);
  });

  it('repeats each letter group three times', () => {
    const groups = makePairs(getLayout('us'), 'en', 5, { size: 2, focus: 'weak' }, noWeakness).split(' ');
    expect(groups).toHaveLength(15);
    expect(groups[0]).toBe(groups[1]);
    expect(groups[1]).toBe(groups[2]);
  });

  it('anchors the neighbouring fingers and returns home every other tap', () => {
    const set = makeAnchorSet(getLayout('us'), 'RP', 3, 12);
    expect(set.anchors).toEqual(['KeyL', 'KeyK', 'KeyJ']);
    expect(set.taps).toHaveLength(12);
    expect(set.taps.filter((_, i) => i % 2 === 0).every((tap) => tap.code === 'Semicolon')).toBe(true);
    expect(makeAnchorSet(getLayout('us'), 'LP', 1, 4).anchors).toEqual(['KeyS']);
  });

  it('keeps the pinky off the Colemak-DH bottom row', () => {
    const set = makeAnchorSet(getLayout('colemak-dh'), 'LP', 3, 40);
    expect(set.taps.some((tap) => tap.code === 'KeyZ')).toBe(false);
  });
});

describe('metrics', () => {
  it('measures a steady pace over the rolling window', () => {
    const rolling = new RollingWpm(10000);
    // One character every 200 ms is 300 characters a minute: 60 WPM.
    for (let t = 0; t <= 20000; t += 200) rolling.add(t);
    expect(rolling.value(20000)).toBeGreaterThan(58);
    expect(rolling.value(20000)).toBeLessThan(62);
  });

  it('falls to zero after the typist stops', () => {
    const rolling = new RollingWpm(10000);
    for (let t = 0; t <= 5000; t += 200) rolling.add(t);
    expect(rolling.value(16000)).toBe(0);
  });

  it('does not spike on the first keystrokes', () => {
    const rolling = new RollingWpm(10000);
    rolling.add(0);
    rolling.add(80);
    expect(rolling.value(100)).toBeLessThan(15);
  });

  it('tracks accuracy, streak and active time', () => {
    const stats = new SetStats();
    stats.hit(0, true);
    stats.hit(200, true);
    stats.miss(400);
    stats.hit(600, true);
    stats.hit(60000, true);
    expect(stats.accuracy).toBeCloseTo(0.8);
    expect(stats.streak).toBe(2);
    expect(stats.bestStreak).toBe(2);
    expect(stats.activeMs).toBe(2600);
  });
});
