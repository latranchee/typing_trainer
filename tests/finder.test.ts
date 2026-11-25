import { describe, expect, it } from 'vitest';
// @ts-expect-error plain ES module without types
import { evaluate, parse } from '../scripts/data-pages/finder.js';
// @ts-expect-error plain ES module without types
import { dbPath, finderDb, keyboards, LISTS } from '../scripts/data-pages/db.mjs';

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

  it('keeps every preset list non-empty', () => {
    for (const l of LISTS) expect(l.items.length, l.id).toBeGreaterThan(0);
  });
});
