import { describe, expect, it } from 'vitest';
import { PAIRS, SENTENCES, TRIPLES, WORDS } from '../src/core/corpus';
import type { Finger } from '../src/core/fingers';
import type { Bias } from '../src/core/generator';
import { anchorTurns, DEFAULT_FOCUS, fingerShare, makeAnchorSet, makePairs, makeSentences, makeWords, scramble, TYPING_FINGERS } from '../src/core/generator';
import { getLayout, isTypingCode, LAYOUTS } from '../src/core/layouts';
import { RollingWpm, SetStats } from '../src/core/metrics';
import { seeded } from '../src/core/texts';
import { LANGS } from '../src/core/store';
import { boardOf, BOARDS, hasCode, letterRowCodes, rowOf, rowsOf } from '../src/core/physical';

/** No slow keys of the typist's own, and the focus a profile starts with: ring and pinky. */
const focusOn = (fingers: readonly Finger[]): Bias => ({ weakness: () => 0, focus: new Set(fingers) });
const plain = focusOn(DEFAULT_FOCUS);
const LEFT_HAND: Finger[] = ['LP', 'LR', 'LM', 'LI'];
const BACKSLASH = String.fromCharCode(92);
const E_ACUTE = String.fromCharCode(0xe9);
const E_GRAVE = String.fromCharCode(0xe8);
const C_CEDILLA = String.fromCharCode(0xe7);
const E_CIRC = String.fromCharCode(0xea);

describe('physical board', () => {
  it('has fifteen units in every row of every board, a tall key filling the end of the row under it', () => {
    for (const board of BOARDS) {
      const rows = rowsOf(board);
      rows.forEach((row, i) => {
        const tail = rows[i - 1]?.reduce((sum, key) => sum + (key.tail ?? 0), 0) ?? 0;
        expect(row.reduce((sum, key) => sum + key.w, 0) + tail, `${board} row ${i}`).toBe(15);
      });
    }
  });

  it('gives each board its own keys', () => {
    expect(hasCode('ansi', 'IntlBackslash')).toBe(false);
    expect(hasCode('iso', 'IntlBackslash')).toBe(true);
    expect(hasCode('jis', 'IntlBackslash')).toBe(false);
    for (const code of ['IntlYen', 'IntlRo', 'NonConvert', 'Convert', 'KanaMode']) {
      expect(hasCode('jis', code), code).toBe(true);
      expect(hasCode('iso', code), code).toBe(false);
    }
    // Every board keeps the keys the fingers rest on and the lanes are drawn from.
    for (const board of BOARDS) {
      for (const code of ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Space', 'Enter', 'Backspace']) {
        expect(hasCode(board, code), `${board} ${code}`).toBe(true);
      }
    }
  });

  it('moves the key beside Enter down a row on ISO and JIS', () => {
    expect(rowOf('Backslash')).toBe('top');
    expect(rowOf('Backslash', 'iso')).toBe('home');
    expect(rowOf('Backslash', 'jis')).toBe('home');
    expect(rowOf('IntlBackslash', 'iso')).toBe('bottom');
    expect(rowOf('IntlYen', 'jis')).toBe('number');
    for (const board of BOARDS) expect(rowOf('Enter', board)).toBe('home');
  });

  it('tells a board by a key only that board has', () => {
    expect(boardOf('IntlBackslash')).toBe('iso');
    expect(boardOf('IntlYen')).toBe('jis');
    expect(boardOf('KeyA')).toBeNull();
    expect(boardOf('Backslash')).toBeNull();
  });

  it('counts the keys of every board as typing, and no modifier', () => {
    for (const code of ['KeyA', 'Space', 'IntlBackslash', 'IntlYen', 'IntlRo', 'Backslash']) expect(isTypingCode(code), code).toBe(true);
    for (const code of ['ShiftLeft', 'Enter', 'Backspace', 'Tab', 'NonConvert', 'KanaMode', 'Escape']) expect(isTypingCode(code), code).toBe(false);
  });

  it('adds the key beside the left Shift to the reach of the anchor drills on ISO', () => {
    expect(letterRowCodes('ansi')).not.toContain('IntlBackslash');
    expect(letterRowCodes('iso')).toContain('IntlBackslash');
    expect(letterRowCodes('iso')).toContain('Backslash');
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

  it('puts every letter on a key of its own, and the punctuation of the sentences within reach, on every layout and board', () => {
    for (const board of BOARDS) {
      for (const { id } of LAYOUTS) {
        const layout = getLayout(id, board);
        const codes = [...'abcdefghijklmnopqrstuvwxyz'].map((letter) => {
          const strokes = layout.strokesFor(letter);
          expect(strokes, `${id} ${board} ${letter}`).toHaveLength(1);
          expect(strokes![0].shift, `${id} ${board} ${letter}`).toBe(false);
          expect(layout.strokesFor(letter.toUpperCase()), `${id} ${board} ${letter}`).toEqual([{ code: strokes![0].code, shift: true }]);
          return strokes![0].code;
        });
        expect(new Set(codes).size, `${id} ${board}`).toBe(26);
        expect(layout.canType(".,'?"), `${id} ${board}`).toBe(true);
      }
    }
  });

  it('types French AZERTY: letters moved, accents on the number row, digits with Shift', () => {
    const layout = getLayout('azerty');
    const key = (code: string, shift = false) => [{ code, shift }];
    expect(layout.strokesFor('a')).toEqual(key('KeyQ'));
    expect(layout.strokesFor('q')).toEqual(key('KeyA'));
    expect(layout.strokesFor('z')).toEqual(key('KeyW'));
    expect(layout.strokesFor('w')).toEqual(key('KeyZ'));
    expect(layout.strokesFor('m')).toEqual(key('Semicolon'));
    expect(layout.strokesFor(E_ACUTE)).toEqual(key('Digit2'));
    expect(layout.strokesFor(E_GRAVE)).toEqual(key('Digit7'));
    expect(layout.strokesFor(C_CEDILLA)).toEqual(key('Digit9'));
    expect(layout.strokesFor(String.fromCharCode(0xe0))).toEqual(key('Digit0'));
    expect(layout.strokesFor(String.fromCharCode(0xf9))).toEqual(key('Quote'));
    expect(layout.strokesFor(E_CIRC)).toEqual([...key('BracketLeft'), ...key('KeyE')]);
    expect(layout.strokesFor(String.fromCharCode(0xeb))).toEqual([...key('BracketLeft', true), ...key('KeyE')]);
    expect(layout.strokesFor('1')).toEqual(key('Digit1', true));
    expect(layout.strokesFor("'")).toEqual(key('Digit4'));
    expect(layout.strokesFor(',')).toEqual(key('KeyM'));
    expect(layout.strokesFor('.')).toEqual(key('Comma', true));
    expect(layout.strokesFor('?')).toEqual(key('KeyM', true));
    // Capital accented letters need Caps Lock or AltGr, which the trainer does not ask for.
    expect(layout.canType(String.fromCharCode(0xc9))).toBe(false);
    expect(layout.legend('Digit2')).toEqual({ base: E_ACUTE, shift: '2', letter: false });
    expect(layout.canType('<')).toBe(false);
    expect(getLayout('azerty', 'iso').strokesFor('<')).toEqual(key('IntlBackslash'));
  });

  it('types German QWERTZ: Z and Y swapped, umlauts on their keys, French accents from dead keys', () => {
    const layout = getLayout('qwertz');
    const key = (code: string, shift = false) => [{ code, shift }];
    expect(layout.strokesFor('z')).toEqual(key('KeyY'));
    expect(layout.strokesFor('y')).toEqual(key('KeyZ'));
    expect(layout.strokesFor(String.fromCharCode(0xfc))).toEqual(key('BracketLeft'));
    expect(layout.strokesFor(String.fromCharCode(0xdf))).toEqual(key('Minus'));
    expect(layout.strokesFor(E_ACUTE)).toEqual([...key('Equal'), ...key('KeyE')]);
    expect(layout.strokesFor(E_GRAVE)).toEqual([...key('Equal', true), ...key('KeyE')]);
    expect(layout.strokesFor(E_CIRC)).toEqual([...key('Backquote'), ...key('KeyE')]);
    expect(layout.strokesFor("'")).toEqual(key('Backslash', true));
    expect(layout.strokesFor('-')).toEqual(key('Slash'));
    expect(layout.canType(C_CEDILLA)).toBe(false);
  });

  it('types Swiss German QWERTZ: no ß, French accents on Shift of the umlauts, capital umlauts from the dead diaeresis', () => {
    const layout = getLayout('qwertz-ch');
    const key = (code: string, shift = false) => [{ code, shift }];
    expect(layout.strokesFor('z')).toEqual(key('KeyY'));
    expect(layout.strokesFor(String.fromCharCode(0xfc))).toEqual(key('BracketLeft'));
    expect(layout.strokesFor(E_GRAVE)).toEqual(key('BracketLeft', true));
    expect(layout.strokesFor(E_ACUTE)).toEqual(key('Semicolon', true));
    expect(layout.strokesFor(String.fromCharCode(0xe0))).toEqual(key('Quote', true));
    expect(layout.strokesFor(C_CEDILLA)).toEqual(key('Digit4', true));
    expect(layout.strokesFor(String.fromCharCode(0xdc))).toEqual([...key('BracketRight'), ...key('KeyU', true)]);
    expect(layout.strokesFor(E_CIRC)).toEqual([...key('Equal'), ...key('KeyE')]);
    expect(layout.strokesFor("'")).toEqual(key('Minus'));
    expect(layout.strokesFor('?')).toEqual(key('Minus', true));
    expect(layout.canType(String.fromCharCode(0xdf))).toBe(false);
  });

  it('types Spanish: ñ beside L, acute and diaeresis from the dead key beside it, ¿ and ¡ on the number row', () => {
    const layout = getLayout('es');
    const key = (code: string, shift = false) => [{ code, shift }];
    expect(layout.strokesFor(String.fromCharCode(0xf1))).toEqual(key('Semicolon'));
    expect(layout.strokesFor(String.fromCharCode(0xd1))).toEqual(key('Semicolon', true));
    expect(layout.strokesFor(String.fromCharCode(0xe1))).toEqual([...key('Quote'), ...key('KeyA')]);
    expect(layout.strokesFor(String.fromCharCode(0xc1))).toEqual([...key('Quote'), ...key('KeyA', true)]);
    expect(layout.strokesFor(String.fromCharCode(0xfc))).toEqual([...key('Quote', true), ...key('KeyU')]);
    expect(layout.strokesFor(String.fromCharCode(0xa1))).toEqual(key('Equal'));
    expect(layout.strokesFor(String.fromCharCode(0xbf))).toEqual(key('Equal', true));
    expect(layout.strokesFor(C_CEDILLA)).toEqual(key('Backslash'));
    expect(layout.strokesFor(E_GRAVE)).toEqual([...key('BracketLeft'), ...key('KeyE')]);
    expect(layout.strokesFor("'")).toEqual(key('Minus'));
  });

  it('types Latin American: the acute beside P, ¿ before ¡, no grave or circumflex', () => {
    const layout = getLayout('latam');
    const key = (code: string, shift = false) => [{ code, shift }];
    expect(layout.strokesFor(String.fromCharCode(0xf1))).toEqual(key('Semicolon'));
    expect(layout.strokesFor(E_ACUTE)).toEqual([...key('BracketLeft'), ...key('KeyE')]);
    expect(layout.strokesFor(String.fromCharCode(0xbf))).toEqual(key('Equal'));
    expect(layout.strokesFor(String.fromCharCode(0xa1))).toEqual(key('Equal', true));
    expect(layout.strokesFor('{')).toEqual(key('Quote'));
    expect(layout.canType(E_GRAVE)).toBe(false);
    expect(layout.canType(E_CIRC)).toBe(false);
  });

  it('maps Dvorak, Colemak and Workman letters to their physical keys', () => {
    const homeRow = (id: string) => ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon'].map((code) => getLayout(id).legend(code)?.base).join('');
    expect(homeRow('dvorak')).toBe('aoeuidhtns');
    expect(homeRow('colemak')).toBe('arstdhneio');
    expect(homeRow('workman')).toBe('ashtgyneoi');
    expect(getLayout('dvorak').strokesFor("'")).toEqual([{ code: 'KeyQ', shift: false }]);
    expect(getLayout('dvorak').strokesFor('z')).toEqual([{ code: 'Slash', shift: false }]);
    expect(getLayout('dvorak').strokesFor('-')).toEqual([{ code: 'Quote', shift: false }]);
    expect(getLayout('colemak').strokesFor(';')).toEqual([{ code: 'KeyP', shift: false }]);
    expect(getLayout('colemak').strokesFor('k')).toEqual([{ code: 'KeyN', shift: false }]);
    expect(getLayout('workman').strokesFor('m')).toEqual([{ code: 'KeyC', shift: false }]);
    // Plain finger maps: only Colemak-DH changes the fingering.
    for (const id of ['dvorak', 'colemak', 'workman']) expect(getLayout(id).fingerOf('KeyZ'), id).toBe('LP');
  });

  it('asks for the Shift key on the opposite hand', () => {
    const layout = getLayout('us');
    expect(layout.properShift('KeyA')).toBe('ShiftRight');
    expect(layout.properShift('KeyP')).toBe('ShiftLeft');
  });

  it('shows dead keys with a spacing accent', () => {
    expect(getLayout('ca-fr').legend('BracketLeft')?.base).toBe('^');
  });

  it('gives an unknown layout the first one, and builds each layout once per board', () => {
    expect(getLayout('nope').id).toBe('ca-fr');
    expect(getLayout('us')).toBe(LAYOUTS.find((layout) => layout.id === 'us'));
    expect(getLayout('us', 'iso')).toBe(getLayout('us', 'iso'));
    expect(getLayout('us', 'iso').board).toBe('iso');
  });

  it('types the guillemets in Canadian French on an ISO board only', () => {
    const open = String.fromCharCode(0xab);
    expect(getLayout('ca-fr').canType(open)).toBe(false);
    expect(getLayout('ca-fr', 'jis').canType(open)).toBe(false);
    expect(getLayout('ca-fr', 'iso').strokesFor(open)).toEqual([{ code: 'IntlBackslash', shift: false }]);
    expect(getLayout('ca-fr', 'iso').legend('IntlBackslash')?.shift).toBe(String.fromCharCode(0xbb));
    expect(getLayout('ca-fr').legend('IntlBackslash')).toBeNull();
  });

  it('puts the Colemak-DH z beside the left Shift on an ISO board, and the backslash in its place', () => {
    const ansi = getLayout('colemak-dh');
    const iso = getLayout('colemak-dh', 'iso');
    expect(ansi.strokesFor('z')).toEqual([{ code: 'KeyB', shift: false }]);
    expect(iso.strokesFor('z')).toEqual([{ code: 'IntlBackslash', shift: false }]);
    expect(iso.fingerOf('IntlBackslash')).toBe('LP');
    expect(iso.legend('KeyB')?.base).toBe(BACKSLASH);
    // The rest of the row does not move, and keeps the angle fingering.
    for (const [letter, code] of [['x', 'KeyZ'], ['c', 'KeyX'], ['d', 'KeyC'], ['v', 'KeyV'], ['k', 'KeyN'], ['h', 'KeyM']]) {
      expect(iso.strokesFor(letter), letter).toEqual([{ code, shift: false }]);
      expect(ansi.strokesFor(letter), letter).toEqual([{ code, shift: false }]);
    }
    expect(iso.fingerOf('KeyZ')).toBe('LR');
    // A JIS board has no key there either: it types the layout as an ANSI board does.
    expect(getLayout('colemak-dh', 'jis').strokesFor('z')).toEqual([{ code: 'KeyB', shift: false }]);
  });

  it('asks for a character two keys can type on the key the board moved', () => {
    expect(getLayout('us', 'iso').strokesFor(BACKSLASH)).toEqual([{ code: 'Backslash', shift: false }]);
    expect(getLayout('colemak-dh', 'iso').strokesFor(BACKSLASH)).toEqual([{ code: 'KeyB', shift: false }]);
  });

  it('types the same sentences on every board', () => {
    for (const board of BOARDS) {
      for (const layout of LAYOUTS) expect(getLayout(layout.id, board).canType('the quick brown fox jumps over a lazy dog'), `${layout.id} ${board}`).toBe(true);
    }
  });

  it('reads a key row from the board the layout was built for', () => {
    expect(getLayout('ca-fr').rowOf('Backslash')).toBe('top');
    expect(getLayout('ca-fr', 'iso').rowOf('Backslash')).toBe('home');
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
    for (const lang of LANGS) {
      expect(PAIRS[lang].every((pair) => pair.length === 2)).toBe(true);
      expect(TRIPLES[lang].every((triple) => triple.length === 3)).toBe(true);
    }
  });

  it('has sentences every layout that speaks the language can type, with and without capitals', () => {
    for (const layout of LAYOUTS) {
      for (const sentence of SENTENCES.en) {
        expect(layout.canType(sentence), `${layout.id}: ${sentence}`).toBe(true);
        expect(layout.canType(sentence.toLowerCase()), `${layout.id}: ${sentence}`).toBe(true);
      }
    }
    const french = getLayout('ca-fr');
    for (const sentence of SENTENCES.fr) {
      expect(french.canType(sentence), sentence).toBe(true);
      expect(french.canType(sentence.toLowerCase()), sentence).toBe(true);
    }
  });

  it('types French on AZERTY as on Canadian French, capital accents aside', () => {
    const layout = getLayout('azerty');
    expect(WORDS.fr.filter((word) => layout.canType(word)).length / WORDS.fr.length).toBeGreaterThan(0.97);
    for (const sentence of SENTENCES.fr) expect(layout.canType(sentence.toLowerCase()), sentence).toBe(true);
  });

  it('keeps most French words on QWERTZ, through its dead keys', () => {
    const layout = getLayout('qwertz');
    expect(WORDS.fr.filter((word) => layout.canType(word)).length / WORDS.fr.length).toBeGreaterThan(0.9);
    expect(layout.canType('fen' + E_CIRC + 'tre')).toBe(true);
  });

  it('keeps French, German and Spanish sentences for the layouts without accent keys', () => {
    for (const id of ['us', 'dvorak', 'colemak', 'colemak-dh', 'workman'] as const) {
      const layout = getLayout(id);
      for (const lang of ['fr', 'de', 'es'] as const) {
        expect(SENTENCES[lang].filter((sentence) => layout.canType(sentence)).length, `${id} ${lang}`).toBeGreaterThanOrEqual(30);
      }
    }
  });

  it('types every German word and sentence on German QWERTZ, and all but the ß on Swiss QWERTZ', () => {
    const german = getLayout('qwertz');
    for (const word of WORDS.de) expect(german.canType(word), word).toBe(true);
    for (const sentence of SENTENCES.de) {
      expect(german.canType(sentence), sentence).toBe(true);
      expect(german.canType(sentence.toLowerCase()), sentence).toBe(true);
    }
    const swiss = getLayout('qwertz-ch');
    const SHARP_S = String.fromCharCode(0xdf);
    for (const sentence of SENTENCES.de.filter((s) => !s.includes(SHARP_S))) expect(swiss.canType(sentence), sentence).toBe(true);
  });

  it('types every Spanish word and sentence on both Spanish layouts', () => {
    for (const id of ['es', 'latam'] as const) {
      const layout = getLayout(id);
      for (const word of WORDS.es) expect(layout.canType(word), `${id}: ${word}`).toBe(true);
      for (const sentence of SENTENCES.es) {
        expect(layout.canType(sentence), `${id}: ${sentence}`).toBe(true);
        expect(layout.canType(sentence.toLowerCase()), `${id}: ${sentence}`).toBe(true);
      }
    }
  });

  it('keeps most German and Spanish words on the layouts without their letters', () => {
    const us = getLayout('us');
    expect(WORDS.de.filter((word) => us.canType(word)).length / WORDS.de.length).toBeGreaterThan(0.75);
    expect(WORDS.es.filter((word) => us.canType(word)).length / WORDS.es.length).toBeGreaterThan(0.7);
  });

  it('writes each sentence once, whole, in one line', () => {
    for (const lang of LANGS) {
      expect(new Set(SENTENCES[lang]).size).toBe(SENTENCES[lang].length);
      expect(SENTENCES[lang].length).toBeGreaterThanOrEqual(60);
      for (const sentence of SENTENCES[lang]) {
        expect(sentence, sentence).toMatch(/^\S.*[.?]$/);
        expect(sentence, sentence).not.toMatch(/\s{2,}/);
        expect(sentence[0], sentence).toBe(sentence[0].toUpperCase());
        const words = sentence.split(' ').length;
        expect(words, sentence).toBeGreaterThanOrEqual(4);
        expect(words, sentence).toBeLessThanOrEqual(12);
      }
    }
  });
});

describe('generator', () => {
  it('returns the requested number of typeable words', () => {
    for (const layout of LAYOUTS) {
      const text = makeWords(layout, 'fr', 30, { caps: true }, plain);
      expect(text.split(' ')).toHaveLength(30);
      expect(layout.canType(text)).toBe(true);
    }
  });

  it('strings whole sentences together until the word count is reached', () => {
    for (const layout of LAYOUTS) {
      for (const lang of LANGS) {
        for (const count of [15, 30, 60]) {
          const text = makeSentences(layout, lang, count, { caps: true }, plain);
          expect(layout.canType(text)).toBe(true);
          const words = text.split(' ').length;
          expect(words).toBeGreaterThanOrEqual(count);
          // The last sentence may run past the count, by less than its own length.
          expect(words).toBeLessThan(count + 12);
          // Every sentence is there whole: the text ends on one, and none comes twice.
          const parts = text.match(/[^.?]+[.?]/g)?.map((part) => part.trim()) ?? [];
          expect(parts.join(' ')).toBe(text);
          expect(parts.every((part) => SENTENCES[lang].includes(part))).toBe(true);
          expect(new Set(parts).size).toBe(parts.length);
        }
      }
    }
  });

  it('types sentences in lowercase when capitals are off, punctuation kept', () => {
    const text = makeSentences(getLayout('ca-fr'), 'fr', 30, { caps: false }, plain);
    expect(text).toBe(text.toLowerCase());
    expect(text).toMatch(/[.?]$/);
    expect(makeSentences(getLayout('ca-fr'), 'fr', 30, { caps: true }, plain)).toMatch(/^[A-ZÀ-Ü]/);
  });

  it('leans the words toward the fingers picked to train', () => {
    const layout = getLayout('us');
    const all = [...new Set(WORDS.en)].join(' ');
    for (const fingers of [DEFAULT_FOCUS, LEFT_HAND, ['RM'] as Finger[]]) {
      const focus = new Set(fingers);
      const leaning = fingerShare(layout, makeWords(layout, 'en', 600, { caps: false }, focusOn(fingers)), focus);
      expect(leaning, fingers.join(' ')).toBeGreaterThan(fingerShare(layout, all, focus) * 1.2);
    }
  });

  it('favors no finger when none is picked, or all eight', () => {
    const layout = getLayout('us');
    const ringPinky = new Set<Finger>(DEFAULT_FOCUS);
    const seeded = (): (() => number) => {
      let state = 7;
      return () => (state = (state * 16807) % 2147483647) / 2147483647;
    };
    const none = makeWords(layout, 'en', 300, { caps: false }, focusOn([]), seeded());
    const every = makeWords(layout, 'en', 300, { caps: false }, focusOn(TYPING_FINGERS), seeded());
    // The same draws give the same words: neither focus weighs on the choice.
    expect(every).toBe(none);
    expect(fingerShare(layout, none, ringPinky)).toBeLessThan(fingerShare(layout, makeWords(layout, 'en', 300, { caps: false }, plain, seeded()), ringPinky));
    expect(fingerShare(layout, 'was', new Set())).toBe(0);
  });

  it('types each letter group three times, scrambled so no group follows itself', () => {
    for (const layout of LAYOUTS) {
      for (const lang of LANGS) {
        for (const size of [2, 3] as const) {
          for (let seed = 1; seed <= 40; seed++) {
            const groups = makePairs(layout, lang, 14, { size }, plain, seeded(seed)).split(' ');
            const where = `${layout.id} ${lang} ${size} seed ${seed}`;
            expect(groups, where).toHaveLength(42);
            const counts = new Map<string, number>();
            for (const group of groups) counts.set(group, (counts.get(group) ?? 0) + 1);
            expect([...counts.values()].every((count) => count % 3 === 0), where).toBe(true);
            expect(groups.some((group, i) => group === groups[i + 1]), `${where}: ${groups.join(' ')}`).toBe(false);
          }
        }
      }
    }
  });

  it('keeps scrambled copies apart even when one group fills half the set, and runs a lone group on', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const out = scramble(['th', 'he', 'th', 'in', 'th', 'er', 'th', 'an', 'th', 'on'], seeded(seed));
      expect(out.filter((group) => group === 'th')).toHaveLength(15);
      expect(out.some((group, i) => group === out[i + 1]), out.join(' ')).toBe(false);
    }
    expect(scramble(['th'], seeded(1))).toEqual(['th', 'th', 'th']);
  });

  it('only draws letter groups that give a focus finger a letter', () => {
    const layout = getLayout('us');
    const focus = new Set<Finger>(['LP']);
    const groups = makePairs(layout, 'en', 40, { size: 2 }, focusOn(['LP'])).split(' ');
    expect(groups.every((group) => fingerShare(layout, group, focus) > 0)).toBe(true);
    // With no finger picked every group is in the draw.
    const free = makePairs(layout, 'en', 200, { size: 2 }, focusOn([])).split(' ');
    expect(free.some((group) => fingerShare(layout, group, focus) === 0)).toBe(true);
  });

  it('anchors the neighbouring fingers and returns home every other tap', () => {
    const set = makeAnchorSet(getLayout('us'), 'RP', 3, 12);
    expect(set.anchors).toEqual(['KeyL', 'KeyK', 'KeyJ']);
    expect(set.taps).toHaveLength(12);
    expect(set.taps.filter((_, i) => i % 2 === 0).every((tap) => tap.code === 'Semicolon')).toBe(true);
    expect(makeAnchorSet(getLayout('us'), 'LP', 1, 4).anchors).toEqual(['KeyS']);
  });

  it('anchors any of the eight fingers, on its own hand', () => {
    const layout = getLayout('us');
    expect(makeAnchorSet(layout, 'LM', 3, 8).anchors).toEqual(['KeyS', 'KeyF', 'KeyA']);
    expect(makeAnchorSet(layout, 'RI', 2, 8).anchors).toEqual(['KeyK', 'KeyL']);
    for (const finger of TYPING_FINGERS) {
      const set = makeAnchorSet(layout, finger, 3, 16);
      expect(set.anchors, finger).toHaveLength(3);
      expect(set.taps.every((tap) => layout.fingerOf(tap.code) === finger), finger).toBe(true);
      expect(new Set(set.taps.map((tap) => tap.code)).size, finger).toBeGreaterThan(1);
    }
  });

  it('takes the focus fingers in turn in the anchor drill, hand order, and the default four when none is picked', () => {
    expect(anchorTurns(new Set<Finger>(['RI', 'LM']))).toEqual(['LM', 'RI']);
    expect(anchorTurns(new Set<Finger>(LEFT_HAND))).toEqual(LEFT_HAND);
    expect(anchorTurns(new Set())).toEqual(DEFAULT_FOCUS);
  });

  it('lets the left pinky reach the key beside the left Shift on an ISO board', () => {
    const set = makeAnchorSet(getLayout('ca-fr', 'iso'), 'LP', 3, 200);
    expect(set.taps.some((tap) => tap.code === 'IntlBackslash')).toBe(true);
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
