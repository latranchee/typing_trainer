import { describe, expect, it } from 'vitest';
// @ts-expect-error plain ES module without types
import { evaluate, parse } from '../scripts/data-pages/finder.js';
// @ts-expect-error plain ES module without types
import { dbPath, finderDb, keyboards, LISTS, listText } from '../scripts/data-pages/db.mjs';
// @ts-expect-error plain ES module without types
import { strings } from '../scripts/data-pages/strings.mjs';
// @ts-expect-error plain ES module without types
import { recordText } from '../scripts/data-pages/i18n.mjs';

type Filter = { key: string; value: unknown; label: string };
type Board = { id: string; price: number | null; stagger: string; split: string; conn: string[]; swm: string[]; std: string[] };

const db = finderDb('/img/');
const read = (text: string) => parse(text, db) as { filters: Filter[]; unknown: string[] };
const keys = (text: string) => read(text).filters.map((f) => `${f.key}:${f.value}`);

describe('keyboard finder', () => {
  it('reads the sentence the finder was built for', () => {
    const { filters, unknown } = read('i want ainsi, ortholinear, split, wireless keyboard with gateron switches under 500$');
    expect(filters.map((f) => `${f.key}:${f.value}`)).toEqual(
      expect.arrayContaining(['std:ansi', 'stagger:ortholinear', 'split:split', 'pmax:500', 'swmaker:gateron']),
    );
    expect(filters.some((f) => f.key === 'wireless' || f.key === 'conn')).toBe(true);
    expect(unknown).toEqual([]);
  });

  it('sets ANSI aside on a grid search and matches only boards that fit every other filter', () => {
    const { filters } = read('ansi ortholinear split wireless gateron under $500');
    const { exact, setAside } = evaluate(db.keyboards, filters) as { exact: Board[]; setAside: Filter[] };
    expect(setAside.map((f) => f.value)).toEqual(['ansi']);
    for (const k of exact) {
      expect(k.stagger).toBe('ortholinear');
      expect(k.split).toBe('split');
      expect(k.conn.some((c) => c !== 'usb')).toBe(true);
      expect(k.swm).toContain('gateron');
      expect(k.price).not.toBeNull();
      expect(k.price!).toBeLessThan(500.01);
    }
  });

  it('reads prices, sizes and shapes', () => {
    expect(keys('between 100 and $200')).toEqual(['pmin:100', 'pmax:200']);
    expect(keys('columnar')).toEqual(['stagger:column']);
    expect(keys('tkl')).toContain('size:tkl');
  });

  it('reads French, German and Spanish sentences', () => {
    const lang = (l: string, text: string) => parse(text, db, l) as { filters: Filter[]; unknown: string[] };
    const fr = lang('fr', "j'aimerais un clavier split ortholinéaire sans fil avec switchs gateron à moins de 200 $");
    expect(fr.filters.map((f) => `${f.key}:${f.value}`)).toEqual(['split:split', 'stagger:ortholinear', 'wireless:true', 'swmaker:gateron', 'pmax:200']);
    expect(fr.unknown).toEqual([]);
    expect(fr.filters.at(-1)!.label).toBe('moins de 200 $ US');
    const de = lang('de', 'leise mechanische Tastatur für Mac ohne Nummernblock, Aluminiumgehäuse');
    expect(de.filters.map((f) => `${f.key}:${f.value}`)).toEqual(['swtype:silent', 'os:mac', 'size:tkl', 'case:alumin']);
    expect(de.unknown).toEqual([]);
    const es = lang('es', 'quiero un teclado ergonómico escalonado por columnas, inalámbrico, por menos de 100 dólares');
    expect(es.filters.map((f) => `${f.key}:${f.value}`)).toEqual(['ergo:true', 'stagger:column', 'wireless:true', 'pmax:100']);
    expect(es.unknown).toEqual([]);
  });

  it('reads every preset list sentence in every language', () => {
    for (const l of LISTS)
      for (const lng of ['en', 'fr', 'de', 'es']) {
        const { filters, unknown } = parse(listText(l.id, lng).q, db, lng) as { filters: Filter[]; unknown: string[] };
        expect(unknown, `${lng} ${l.id}`).toEqual([]);
        expect(filters.length, `${lng} ${l.id}`).toBeGreaterThan(0);
      }
  });

  it('reads every example the finder page offers, in its language', () => {
    for (const lng of ['en', 'fr', 'de', 'es'])
      for (const example of strings(lng).examples as string[]) {
        const { filters, unknown } = parse(example, db, lng) as { filters: Filter[]; unknown: string[] };
        expect(unknown, `${lng}: ${example}`).toEqual([]);
        expect(filters.length, `${lng}: ${example}`).toBeGreaterThan(1);
      }
  });

  it('gives every keyboard a finder record', () => {
    expect(db.keyboards.length).toBe(keyboards.length);
    expect(new Set(db.keyboards.map((k: Board) => k.id)).size).toBe(keyboards.length);
  });
});

describe('database links', () => {
  it('resolves db: targets to page paths', () => {
    expect(dbPath('finder')).toBe('en/keyboards/finder/');
    expect(dbPath('list/split-keyboards')).toBe('en/keyboards/split-keyboards/');
    expect(dbPath(`keyboard/${keyboards[0].id}`)).toMatch(/^en\/keyboards\/[a-z0-9-]+\/[a-z0-9-]+\/$/);
    expect(() => dbPath('keyboard/no-such-board')).toThrow();
  });

  it('gives each database language its own addresses, and English to the others', () => {
    expect(dbPath('finder', 'fr')).toBe('fr/claviers/recherche/');
    expect(dbPath('switches', 'de')).toBe('de/switches/');
    expect(dbPath('list/split-keyboards', 'es')).toBe('es/teclados/teclados-split/');
    expect(dbPath(`keyboard/${keyboards[0].id}`, 'fr')).toMatch(/^fr\/claviers\/[a-z0-9-]+\/[a-z0-9-]+\/$/);
    expect(dbPath('finder', 'ja')).toBe('en/keyboards/finder/');
  });

  it('shows the English when a translation was made from older English', () => {
    const fr = recordText('fr');
    const k = keyboards.find((x: { id: string }) => x.id === 'keychron-dayz-special-edition');
    expect(fr.note(k)).not.toBe(k.notes);
    const before = fr.stale();
    expect(fr.note({ ...k, notes: `${k.notes} Back in stock.` })).toBe(`${k.notes} Back in stock.`);
    expect(fr.stale()).toBe(before + 1);
  });

  it('keeps every preset list non-empty', () => {
    for (const l of LISTS) expect(l.items.length, l.id).toBeGreaterThan(0);
  });
});
