import { describe, expect, it } from 'vitest';
import { centileFigure, centileOf, curveOf, isCurve, OWN_TYPISTS, shareBelow, STUDY, TOP } from '../src/core/centile';

describe('study curves', () => {
  it('rise from nothing to everyone, one share per WPM', () => {
    for (const curve of Object.values(STUDY)) {
      expect(isCurve(curve)).toBe(true);
      expect(curve.below[0]).toBe(0);
      expect(curve.below[TOP]).toBe(10000);
    }
  });

  it('put the median desk typist near 49 WPM and the median phone typist near 34', () => {
    expect(shareBelow(STUDY.keys, 48)).toBeLessThan(0.5);
    expect(shareBelow(STUDY.keys, 50)).toBeGreaterThan(0.5);
    expect(shareBelow(STUDY.touch, 34)).toBeLessThan(0.5);
    expect(shareBelow(STUDY.touch, 35)).toBeGreaterThan(0.5);
  });
});

describe('shareBelow', () => {
  it('reads between two whole WPMs', () => {
    const at60 = shareBelow(STUDY.keys, 60);
    const at61 = shareBelow(STUDY.keys, 61);
    expect(shareBelow(STUDY.keys, 60.5)).toBeCloseTo((at60 + at61) / 2, 6);
  });

  it('holds at the ends', () => {
    expect(shareBelow(STUDY.keys, 0)).toBe(0);
    expect(shareBelow(STUDY.keys, -3)).toBe(0);
    expect(shareBelow(STUDY.keys, Number.NaN)).toBe(0);
    expect(shareBelow(STUDY.keys, 400)).toBe(1);
  });
});

describe('curveOf', () => {
  it('counts each average once, below each whole WPM', () => {
    const curve = curveOf([30, 10, 20, 40]);
    expect(curve.typists).toBe(4);
    expect(curve.below[10]).toBe(0);
    expect(curve.below[11]).toBe(2500);
    expect(curve.below[25]).toBe(5000);
    expect(curve.below[41]).toBe(10000);
    expect(isCurve(curve)).toBe(true);
  });

  it('gives an empty curve for no typists', () => {
    expect(curveOf([]).below.every((share) => share === 0)).toBe(true);
  });
});

describe('isCurve', () => {
  it('turns away what the server could not have sent', () => {
    expect(isCurve(null)).toBe(false);
    expect(isCurve({ typists: 3, below: [0, 1] })).toBe(false);
    const falling = curveOf([10, 20]);
    falling.below[50] = 0;
    expect(isCurve(falling)).toBe(false);
  });
});

describe('centileOf', () => {
  it('uses the study until the trainer has typists enough', () => {
    const few = curveOf(Array.from({ length: OWN_TYPISTS - 1 }, (_, i) => 20 + i / 4));
    expect(centileOf(70, 'keys', few).source).toBe('study');
    expect(centileOf(70, 'keys', null)).toMatchObject({ source: 'study', typists: STUDY.keys.typists });
    expect(centileOf(40, 'touch', null).typists).toBe(STUDY.touch.typists);
  });

  it('switches to the trainer once it has them', () => {
    const many = curveOf(Array.from({ length: OWN_TYPISTS }, (_, i) => i / 2));
    const centile = centileOf(50, 'keys', many);
    expect(centile.source).toBe('here');
    expect(centile.typists).toBe(OWN_TYPISTS);
    expect(centile.share).toBeCloseTo(0.5, 2);
  });
});

describe('centileFigure', () => {
  it('is whole below 99 and rounds down', () => {
    expect(centileFigure(0.29)).toBe(29);
    expect(centileFigure(0.5799)).toBe(57);
    expect(centileFigure(0.004)).toBe(0);
  });

  it('shows a tenth from 99 and never reaches 100', () => {
    expect(centileFigure(0.99)).toBe(99);
    expect(centileFigure(0.9937)).toBe(99.3);
    expect(centileFigure(1)).toBe(99.9);
  });
});
