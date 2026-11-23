import { describe, expect, it } from 'vitest';
import { DEFAULT_FEATURES, FONT_FEATURES, featureOn, featureSettings, savedFeatures, setFeature } from '../src/core/font';
import { stringsOf } from '../src/core/i18n';
import type { KeyValueStore } from '../src/core/store';
import { LANGS, Store } from '../src/core/store';

const saved = (settings: Record<string, unknown>): KeyValueStore => {
  const map = new Map([['auriculaire:v2', JSON.stringify({ v: 2, active: 'main', profiles: [{ id: 'main', name: 'main', settings, layouts: {} }] })]]);
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => void map.set(key, value), removeItem: (key) => void map.delete(key) };
};

describe('font features', () => {
  it('starts with tabular figures, ligatures and contextual forms, and sends only the figures to the page', () => {
    expect(new Store(saved({}), 'en').settings.fontFeatures).toEqual(['tnum', 'liga', 'calt']);
    expect(featureSettings(DEFAULT_FEATURES)).toBe('"tnum" 1');
  });

  it('turns the browser’s own features off explicitly, and the rest on', () => {
    expect(featureSettings(['ss01', 'cv05'])).toBe('"ss01" 1, "cv05" 1, "liga" 0, "calt" 0');
  });

  it('flips the four parts of disambiguation at once, and never sends ss02 itself', () => {
    const on = setFeature(DEFAULT_FEATURES, 'ss02', true);
    expect(on).toEqual(['cv04', 'cv03', 'cv01', 'zero', 'tnum', 'liga', 'calt']);
    expect(featureOn(on, 'ss02')).toBe(true);
    expect(featureSettings(on)).not.toContain('ss02');
    expect(featureOn(setFeature(on, 'cv03', false), 'ss02')).toBe(false);
    expect(setFeature(on, 'ss02', false)).toEqual([...DEFAULT_FEATURES]);
  });

  it('keeps one zero: slashed or dotted', () => {
    const dotted = setFeature(['zero', 'tnum'], 'cv05', true);
    expect(dotted).toEqual(['cv05', 'tnum']);
    expect(setFeature(dotted, 'ss02', true)).not.toContain('cv05');
    expect(savedFeatures(['zero', 'cv05'])).toEqual(['cv05']);
  });

  it('cleans what was saved: unknown names, groups and repeats go, a non-list gives the defaults', () => {
    expect(savedFeatures(['calt', 'sups', 'ss02', 'ss01', 'ss01', 7])).toEqual(['ss01', 'calt']);
    expect(savedFeatures([])).toEqual([]);
    expect(savedFeatures('ss01')).toEqual([...DEFAULT_FEATURES]);
    expect(new Store(saved({ fontFeatures: ['frac', 'bogus'] }), 'en').settings.fontFeatures).toEqual(['frac']);
  });

  it('names every feature in every interface language', () => {
    for (const lang of LANGS) {
      const names = stringsOf(lang).menu.fontFeatures;
      for (const feature of FONT_FEATURES) {
        expect(names[feature].name, `${lang}: ${feature}`).toBeTruthy();
        expect(names[feature].title, `${lang}: ${feature}`).toBeTruthy();
      }
    }
  });
});
