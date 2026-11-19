import { describe, expect, it } from 'vitest';
import type { HistoryEntry, KeyTally } from '../src/core/history';
import { compactHistory, rolling, series, trend } from '../src/core/history';
import { getLayout } from '../src/core/layouts';
import { intervalToWpm } from '../src/core/metrics';
import type { KeyValueStore } from '../src/core/store';
import { Store } from '../src/core/store';

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

const set = (t: number, wpm: number, keys?: Record<string, KeyTally>, layout: HistoryEntry['layout'] = 'us'): HistoryEntry => {
  const entry: HistoryEntry = { t, drill: 'words', layout, lang: 'en', wpm, acc: 0.95, chars: 100, secs: (100 / 5) * (60 / wpm) };
  if (keys) entry.keys = keys;
  return entry;
};

describe('store', () => {
  it('carries the single-profile numbers over as the first profile and leaves the old key alone', () => {
    const legacy = {
      v: 1,
      settings: { layout: 'colemak-dh', lang: 'fr', window: 30 },
      profiles: { 'colemak-dh': { keys: { KeyA: { n: 12, err: 1, ms: 180 } }, pairs: {}, shiftOk: 3, shiftBad: 1 } },
      history: [set(NOON, 61, undefined, 'colemak-dh')],
    };
    const storage = memory({ 'auriculaire:v1': legacy });
    const before = storage.map.get('auriculaire:v1');
    const store = new Store(storage);

    expect(store.profiles).toEqual([{ id: 'main', name: 'main' }]);
    expect(store.settings.layout).toBe('colemak-dh');
    expect(store.settings.lang).toBe('fr');
    expect(store.settings.window).toBe(30);
    expect(store.tracking).toBe(true);
    expect(store.layoutStats('colemak-dh').keys.KeyA).toEqual({ n: 12, err: 1, ms: 180 });
    expect(store.history).toHaveLength(1);
    expect(storage.map.get('auriculaire:v1')).toBe(before);

    // The carried numbers are written at once, so a second start reads them from the new keys.
    const again = new Store(storage);
    expect(again.history[0].wpm).toBe(61);
    expect(again.layoutStats('colemak-dh').shiftOk).toBe(3);
  });

  it('starts clean when nothing was saved', () => {
    const store = new Store(memory());
    expect(store.profiles).toHaveLength(1);
    expect(store.history).toEqual([]);
    expect(store.settings.track).toBe(true);
  });

  it('starts a typist with nothing saved in the preferred language, interface and practice text', () => {
    const french = new Store(memory(), 'fr');
    expect(french.settings.ui).toBe('fr');
    expect(french.settings.lang).toBe('fr');
    expect(french.profiles).toEqual([{ id: 'main', name: 'principal' }]);

    const english = new Store(memory(), 'en');
    expect(english.settings.ui).toBe('en');
    expect(english.settings.lang).toBe('en');
    expect(english.profiles).toEqual([{ id: 'main', name: 'main' }]);
  });

  it('gives options saved before the interface had a language the preferred one, and keeps the practice language', () => {
    const saved = { v: 2, active: 'main', profiles: [{ id: 'main', name: 'main', settings: { lang: 'en', layout: 'us' }, layouts: {} }] };
    const storage = memory({ 'auriculaire:v2': saved });
    const store = new Store(storage, 'fr');
    expect(store.settings.ui).toBe('fr');
    expect(store.settings.lang).toBe('en');
    expect(store.profileName).toBe('main');

    // A choice made with the picker outlives the browser's preference.
    store.update({ ui: 'en' });
    store.flush();
    expect(new Store(storage, 'fr').settings.ui).toBe('en');

    // Numbers carried from the single-profile version keep their practice language too.
    const legacy = new Store(memory({ 'auriculaire:v1': { v: 1, settings: { lang: 'en' } } }), 'fr');
    expect(legacy.settings.ui).toBe('fr');
    expect(legacy.settings.lang).toBe('en');
    expect(legacy.profileName).toBe('main');
  });

  it('gives a new profile the interface language of the one it was made from', () => {
    const store = new Store(memory(), 'fr');
    store.addProfile('invité');
    expect(store.settings.ui).toBe('fr');
  });

  it('keeps each profile its own options, numbers and sets', () => {
    const storage = memory();
    const store = new Store(storage);
    store.update({ layout: 'us' });
    store.recordStroke('us', 'KeyA', 200);
    store.addHistory(set(NOON, 70));
    const first = store.profileId;

    expect(store.addProfile('  guest  ')).toBeNull();
    expect(store.profileName).toBe('guest');
    expect(store.settings.layout).toBe('us');
    expect(store.history).toEqual([]);
    expect(store.layoutStats('us').keys).toEqual({});

    store.update({ layout: 'colemak-dh' });
    store.recordStroke('colemak-dh', 'KeyS', 400);
    store.addHistory(set(NOON, 20, undefined, 'colemak-dh'));
    store.flush();

    const reopened = new Store(storage);
    expect(reopened.profileName).toBe('guest');
    expect(reopened.history.map((entry) => entry.wpm)).toEqual([20]);
    reopened.switchProfile(first);
    expect(reopened.settings.layout).toBe('us');
    expect(reopened.history.map((entry) => entry.wpm)).toEqual([70]);
    expect(reopened.layoutStats('us').keys.KeyA.n).toBe(1);
  });

  it('refuses an empty or taken profile name', () => {
    const store = new Store(memory());
    expect(store.addProfile('   ')).toBe('empty');
    expect(store.addProfile('MAIN')).toBe('taken');
    expect(store.profiles).toHaveLength(1);
    // Renaming a profile to its own name is not a clash.
    expect(store.renameProfile('Main')).toBeNull();
    expect(store.profileName).toBe('Main');
  });

  it('deletes a profile with its sets and keeps the last one', () => {
    const storage = memory();
    const store = new Store(storage);
    expect(store.deleteProfile()).toBe(false);
    store.addProfile('guest');
    const guest = store.profileId;
    store.addHistory(set(NOON, 30));
    expect(storage.map.has(`auriculaire:v2:sets:${guest}`)).toBe(true);
    expect(store.deleteProfile()).toBe(true);
    expect(storage.map.has(`auriculaire:v2:sets:${guest}`)).toBe(false);
    expect(store.profiles.map((profile) => profile.name)).toEqual(['main']);
  });

  it('saves nothing while tracking is off', () => {
    const storage = memory();
    const store = new Store(storage);
    store.update({ track: false });
    store.recordStroke('us', 'KeyA', 200);
    store.recordError('us', 'KeyA');
    store.recordPair('us', 'th', 150);
    store.recordShift('us', true);
    expect(store.addHistory(set(NOON, 70))).toBe(false);
    store.flush();

    expect(store.history).toEqual([]);
    expect(store.layoutStats('us')).toEqual({ keys: {}, pairs: {}, shiftOk: 0, shiftBad: 0 });
    expect(storage.map.has(`auriculaire:v2:sets:${store.profileId}`)).toBe(false);

    store.update({ track: true });
    expect(store.addHistory(set(NOON, 70))).toBe(true);
    expect(store.history).toHaveLength(1);
  });

  it('erases only the active profile', () => {
    const store = new Store(memory());
    store.addHistory(set(NOON, 70));
    const first = store.profileId;
    store.addProfile('guest');
    store.addHistory(set(NOON, 30));
    store.resetStats();
    expect(store.history).toEqual([]);
    store.switchProfile(first);
    expect(store.history).toHaveLength(1);
  });
});

describe('history', () => {
  const us = getLayout('us');
  // KeyA and KeyQ are the left pinky's, KeyS the left ring's.
  const sets = [
    set(NOON, 60, { KeyA: [4, 1, 800], KeyQ: [2, 0, 700], KeyS: [5, 0, 500] }),
    set(NOON + 60000, 80, { KeyA: [6, 0, 900], KeyS: [5, 1, 450] }),
  ];

  it('sums a finger from its keys', () => {
    const [first, second] = series(sets, us, { kind: 'finger', finger: 'LP' }, 'wpm');
    expect(first.value).toBeCloseTo(intervalToWpm(1500 / 6));
    expect(first.n).toBe(6);
    expect(second.value).toBeCloseTo(intervalToWpm(900 / 6));
    const accuracy = series(sets, us, { kind: 'finger', finger: 'LP' }, 'acc');
    expect(accuracy[0].value).toBeCloseTo(6 / 7);
    expect(accuracy[1].value).toBe(1);
  });

  it('follows one key and leaves a gap where the key was not typed', () => {
    const points = series(sets, us, { kind: 'key', code: 'KeyQ' }, 'wpm');
    expect(points[0].value).toBeCloseTo(intervalToWpm(350));
    expect(points[1].value).toBeNull();
    // The average holds across the gap instead of dropping to nothing.
    expect(rolling(points, 10, 2)).toEqual([points[0].value, points[0].value]);
  });

  it('only shows sets of the selected layout, and old sets carry no key history', () => {
    const mixed = [set(NOON, 50, undefined, 'ca-fr'), set(NOON, 60), ...sets];
    expect(series(mixed, us, { kind: 'all' }, 'wpm').map((point) => point.value)).toEqual([60, 60, 80]);
    expect(series(mixed, us, { kind: 'key', code: 'KeyA' }, 'wpm')[0].value).toBeNull();
  });

  it('pools the rolling average by typing time, and waits for enough strokes', () => {
    const points = series(sets, us, { kind: 'all' }, 'wpm');
    const [first, both] = rolling(points, 10, 5);
    expect(first).toBe(60);
    // 200 characters over 20 s + 15 s of typing.
    expect(both).toBeCloseTo((200 / 5) * (60 / 35));
    expect(rolling(series(sets, us, { kind: 'key', code: 'KeyQ' }, 'wpm'), 10, 5)).toEqual([null, null]);
  });

  it('reports the change between the latest sets and the ones before', () => {
    const steady = [50, 50, 50, 60, 60, 60].map((speed, i) => set(NOON + i * 60000, speed));
    expect(trend(series(steady, us, { kind: 'all' }, 'wpm'), 10, 5)).toBeCloseTo(10);
    expect(trend(series(steady.slice(0, 3), us, { kind: 'all' }, 'wpm'), 10, 5)).toBeNull();
  });

  it('merges old sets into one entry per day and keeps their key numbers', () => {
    const old = [
      set(NOON - 2 * DAY, 40, { KeyA: [2, 1, 600] }),
      set(NOON - 2 * DAY + 60000, 60, { KeyA: [3, 0, 600], KeyS: [1, 0, 100] }),
      set(NOON - DAY, 50, { KeyA: [1, 0, 250] }),
    ];
    const recent = [set(NOON, 70), set(NOON + 60000, 72)];
    const compact = compactHistory([...old, ...recent], 2, 0);

    expect(compact).toHaveLength(4);
    const [day] = compact;
    expect(day.sets).toBe(2);
    expect(day.chars).toBe(200);
    // 200 characters over 30 s + 20 s of typing is 48 wpm.
    expect(day.wpm).toBeCloseTo(48);
    expect(day.keys).toEqual({ KeyA: [5, 1, 1200], KeyS: [1, 0, 100] });
    expect(compact[1].sets).toBe(1);
    expect(compact.slice(2)).toEqual(recent);
    // The source entries are not edited in place.
    expect(old[0].keys).toEqual({ KeyA: [2, 1, 600] });
    // Below the limit nothing changes.
    expect(compactHistory(recent, 2, 0)).toBe(recent);

    // A later pass merges into the existing day entry.
    const next = compactHistory([...compact, set(NOON + 120000, 75), set(NOON + 180000, 76)], 2, 0);
    expect(next.filter((entry) => entry.sets !== undefined).map((entry) => entry.sets)).toEqual([2, 1, 2]);
  });
});
