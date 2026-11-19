import { describe, expect, it } from 'vitest';
import { DEFAULT_FOCUS, TYPING_FINGERS } from '../src/core/generator';
import { stringsOf } from '../src/core/i18n';
import { BOARDS } from '../src/core/physical';
import { HOT_BASE, HOT_PACE, HOT_STROKES, isAhead, isHot, streakHeat } from '../src/core/rewards';
import type { KeyValueStore } from '../src/core/store';
import { DEFAULT_SETTINGS, LANGS, Store } from '../src/core/store';

function memory(seed: Record<string, unknown> = {}): KeyValueStore & { map: Map<string, string> } {
  const map = new Map(Object.entries(seed).map(([key, value]) => [key, JSON.stringify(value)]));
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}

const saved = (settings: Record<string, unknown>): KeyValueStore =>
  memory({ 'auriculaire:v2': { v: 2, active: 'main', profiles: [{ id: 'main', name: 'main', settings, layouts: {} }] } });

describe('board and focus settings', () => {
  it('starts on an ANSI board nobody picked, with ring and pinky to train', () => {
    const { settings } = new Store(memory(), 'en');
    expect(settings.board).toBe('ansi');
    expect(settings.boardSet).toBe(false);
    expect(settings.focus).toEqual(['LP', 'LR', 'RR', 'RP']);
    expect(DEFAULT_FOCUS).toEqual(['LP', 'LR', 'RR', 'RP']);
  });

  it('gives options saved before the board and the focus existed their defaults', () => {
    const { settings } = new Store(saved({ layout: 'us', lang: 'en', ui: 'en' }), 'en');
    expect(settings.board).toBe('ansi');
    expect(settings.boardSet).toBe(false);
    expect(settings.focus).toEqual(DEFAULT_FOCUS);
  });

  it('keeps a saved board and focus, and puts the focus back in hand order', () => {
    const { settings } = new Store(saved({ board: 'iso', boardSet: true, focus: ['RI', 'LM', 'LP'] }), 'en');
    expect(settings.board).toBe('iso');
    expect(settings.boardSet).toBe(true);
    expect(settings.focus).toEqual(['LP', 'LM', 'RI']);
  });

  it('keeps an empty focus: no finger favored is a choice', () => {
    expect(new Store(saved({ focus: [] }), 'en').settings.focus).toEqual([]);
  });

  it('drops what is not a board or a typing finger', () => {
    const { settings } = new Store(saved({ board: 'ortho', boardSet: 'yes', focus: ['LP', 'LT', 'thumb', 'LP', 7] }), 'en');
    expect(settings.board).toBe('ansi');
    expect(settings.boardSet).toBe(false);
    expect(settings.focus).toEqual(['LP']);
    expect(new Store(saved({ focus: 'pinky' }), 'en').settings.focus).toEqual(DEFAULT_FOCUS);
  });

  it('drops the options the finger focus replaced', () => {
    const settings = new Store(saved({ pairFocus: 'weak', anchorFinger: 'LP' }), 'en').settings as unknown as Record<string, unknown>;
    expect('pairFocus' in settings).toBe(false);
    expect('anchorFinger' in settings).toBe(false);
  });

  it('never hands two profiles the same list of fingers', () => {
    const store = new Store(memory(), 'en');
    expect(store.settings.focus).not.toBe(DEFAULT_SETTINGS.focus);
    const first = store.settings.focus;
    store.addProfile('guest');
    expect(store.settings.focus).toEqual(first);
    expect(store.settings.focus).not.toBe(first);
    store.update({ focus: ['LM'] });
    store.switchProfile('main');
    expect(store.settings.focus).toEqual(DEFAULT_FOCUS);
  });

  it('saves the board and the focus with the profile', () => {
    const storage = memory();
    const store = new Store(storage, 'en');
    store.update({ board: 'jis', boardSet: true, focus: ['LP', 'LR', 'LM', 'LI'] });
    store.flush();
    const again = new Store(storage, 'en').settings;
    expect(again.board).toBe('jis');
    expect(again.boardSet).toBe(true);
    expect(again.focus).toEqual(['LP', 'LR', 'LM', 'LI']);
  });

  it('names the eight typing fingers left pinky to right pinky', () => {
    expect(TYPING_FINGERS).toEqual(['LP', 'LR', 'LM', 'LI', 'RI', 'RM', 'RR', 'RP']);
  });
});

describe('glow', () => {
  it('warms the streak at 25, 50 and 100 keys', () => {
    expect([0, 24, 25, 49, 50, 99, 100, 640].map(streakHeat)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });

  it('lights a finger that is ahead of its own average, once it has enough clean strokes', () => {
    const base = 200;
    const pace = base * HOT_PACE;
    expect(isHot(HOT_STROKES, pace * HOT_STROKES, base)).toBe(true);
    expect(isHot(HOT_STROKES, (pace + 1) * HOT_STROKES, base)).toBe(false);
    expect(isHot(HOT_STROKES - 1, 100 * (HOT_STROKES - 1), base)).toBe(false);
    expect(isHot(40, 40 * 150, base)).toBe(true);
    expect(isHot(40, 40 * 200, base)).toBe(false);
  });

  it('lights no finger without a saved average', () => {
    expect(isHot(40, 40 * 50, undefined)).toBe(false);
    expect(isHot(40, 40 * 50, 0)).toBe(false);
    expect(HOT_BASE).toBeGreaterThanOrEqual(HOT_STROKES);
  });

  it('lights the numeral over the usual pace by a margin, and keeps it lit down to that pace', () => {
    expect(isAhead(100, null, false)).toBe(false);
    expect(isAhead(100, 0, false)).toBe(false);
    expect(isAhead(62, 60, false)).toBe(false);
    expect(isAhead(63, 60, false)).toBe(true);
    expect(isAhead(60, 60, true)).toBe(true);
    expect(isAhead(59.9, 60, true)).toBe(false);
  });
});

describe('settings strings', () => {
  it('describes every board in every language', () => {
    for (const lang of LANGS) {
      const { menu, layoutNotes } = stringsOf(lang);
      for (const board of BOARDS) {
        expect(menu.boards[board], `${lang} ${board}`).toBeTruthy();
        expect(menu.boardNotes[board], `${lang} ${board}`).toBeTruthy();
        expect(menu.boardFound(menu.boards[board])).toContain(board);
      }
      expect(layoutNotes['colemak-dh|iso'], lang).toBeTruthy();
      expect(layoutNotes['colemak-dh|iso']).not.toBe(layoutNotes['colemak-dh']);
      expect(menu.focusOn('x')).not.toBe(menu.focusOff('x'));
    }
  });

  it('keeps every label of the settings list inside its column: eleven letters at most', () => {
    for (const lang of LANGS) {
      const s = stringsOf(lang);
      const labels = [
        s.menu.focus, s.menu.layout, s.menu.board, s.menu.profile, s.menu.interface, s.top.tracking, s.options.keys,
        s.options.language, s.hardcore.label, s.hardcore.floor, s.hardcore.difficulty, s.hardcore.sound,
        s.highway.text, s.highway.tempo, s.line.text, s.line.words, s.line.capitals, s.line.groups, s.anchors.anchors,
        s.stats.chart, s.stats.range, s.stats.saved,
      ];
      for (const label of labels) expect(label.length, `${lang}: ${label}`).toBeLessThanOrEqual(11);
    }
  });
});
