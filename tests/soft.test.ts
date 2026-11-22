import { describe, expect, it } from 'vitest';
import { getLayout } from '../src/core/layouts';
import { diffTyped, foldTyped, SENTINEL } from '../src/core/soft';

describe('phone keyboard text', () => {
  it('reads one typed character after the invisible start', () => {
    expect(diffTyped(SENTINEL, `${SENTINEL}a`)).toEqual({ removed: 0, added: ['a'] });
  });

  it('reads Backspace as a deleted character, even with nothing typed', () => {
    expect(diffTyped(SENTINEL, SENTINEL.slice(1))).toEqual({ removed: 1, added: [] });
  });

  it('follows a word a keyboard composes one letter at a time', () => {
    expect(diffTyped(`${SENTINEL}he`, `${SENTINEL}hel`)).toEqual({ removed: 0, added: ['l'] });
  });

  it('reads an autocorrection as the deletions and the replacement it made', () => {
    expect(diffTyped(`${SENTINEL}teh`, `${SENTINEL}the `)).toEqual({ removed: 2, added: ['h', 'e', ' '] });
  });

  it('joins a letter and its combining accent into the one character the layouts know', () => {
    expect(diffTyped(SENTINEL, `${SENTINEL}é`)).toEqual({ removed: 0, added: ['é'] });
  });

  it('never splits a character made of two code units', () => {
    expect(diffTyped(`${SENTINEL}\u{1F600}`, `${SENTINEL}\u{1F601}`)).toEqual({ removed: 1, added: ['\u{1F601}'] });
  });

  it('drops the invisible characters when a keyboard puts them back', () => {
    expect(diffTyped('', `${SENTINEL}x`)).toEqual({ removed: 0, added: ['x'] });
  });
});

describe('typographic marks', () => {
  const qwerty = getLayout('us');
  const canType = (char: string): boolean => qwerty.strokesFor(char) !== null;

  it('folds smart quotes and dashes back to what the layout types', () => {
    expect(foldTyped('’', canType)).toBe("'");
    expect(foldTyped('“', canType)).toBe('"');
    expect(foldTyped('—', canType)).toBe('-');
  });

  it('keeps a character the layout types as it is', () => {
    expect(foldTyped('a', canType)).toBe('a');
    expect(foldTyped("'", canType)).toBe("'");
  });

  it('leaves a character nothing folds to as it is', () => {
    expect(foldTyped('é', canType)).toBe('é');
  });
});
