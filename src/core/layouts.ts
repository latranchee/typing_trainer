import type { Finger } from './fingers';
import { fingerHand } from './fingers';
import type { Board, Row } from './physical';
import { CHARACTER_CODES, DEFAULT_FINGER, hasCode, rowOf } from './physical';

/** One keypress the trainer expects: a physical key, with or without Shift. */
export interface Stroke {
  code: string;
  shift: boolean;
}

/** One character of practice text and the strokes that produce it on a layout. */
export interface Target {
  char: string;
  strokes: Stroke[];
}

export type LayoutId = 'ca-fr' | 'us' | 'azerty' | 'qwertz' | 'qwertz-ch' | 'es' | 'latam' | 'dvorak' | 'colemak' | 'colemak-dh' | 'workman';

type Keys = Record<string, [string, string]>;

interface LayoutDef {
  id: LayoutId;
  /**
   * `code -> [base, shifted]`. A combining mark (see MARK) makes the key a dead key.
   * A key the board on the desk does not have is left out when the layout is built.
   */
  keys: Keys;
  fingers?: Record<string, Finger>;
  /** Keys that change on a board of another shape. They are asked for before the keys above. */
  boards?: Partial<Record<Board, Keys>>;
}

/** Dead keys are stored as combining marks so composition is plain Unicode normalization. */
const cp = (code: number): string => String.fromCharCode(code);
const MARK = {
  grave: cp(0x300),
  acute: cp(0x301),
  circumflex: cp(0x302),
  diaeresis: cp(0x308),
  cedilla: cp(0x327),
};
const MARK_LEGEND: Record<string, string> = {
  [MARK.grave]: '`',
  [MARK.acute]: cp(0xb4),
  [MARK.circumflex]: '^',
  [MARK.diaeresis]: cp(0xa8),
  [MARK.cedilla]: cp(0xb8),
};
const BACKSLASH = cp(92);

const row = (codes: string, base: string, shifted: string): Keys => {
  const out: Keys = {};
  codes.split(' ').forEach((code, i) => {
    out[code] = [base[i], shifted[i]];
  });
  return out;
};

const NUMBER_CODES = 'Backquote Digit1 Digit2 Digit3 Digit4 Digit5 Digit6 Digit7 Digit8 Digit9 Digit0 Minus Equal';
const TOP_CODES = 'KeyQ KeyW KeyE KeyR KeyT KeyY KeyU KeyI KeyO KeyP';
const HOME_CODES = 'KeyA KeyS KeyD KeyF KeyG KeyH KeyJ KeyK KeyL';
const BOTTOM_CODES = 'KeyZ KeyX KeyC KeyV KeyB KeyN KeyM';

const US: LayoutDef = {
  id: 'us',
  keys: {
    ...row(NUMBER_CODES, '`1234567890-=', '~!@#$%^&*()_+'),
    ...row(TOP_CODES, 'qwertyuiop', 'QWERTYUIOP'),
    ...row(HOME_CODES, 'asdfghjkl', 'ASDFGHJKL'),
    ...row(BOTTOM_CODES, 'zxcvbnm', 'ZXCVBNM'),
    BracketLeft: ['[', '{'],
    BracketRight: [']', '}'],
    Backslash: [BACKSLASH, '|'],
    Semicolon: [';', ':'],
    Quote: ["'", '"'],
    Comma: [',', '<'],
    Period: ['.', '>'],
    Slash: ['/', '?'],
    // ISO boards: the key beside the left Shift is a second backslash.
    IntlBackslash: [BACKSLASH, '|'],
  },
};

/** The classic Quebec layout (Windows "Canadian French"). */
const CA_FR: LayoutDef = {
  id: 'ca-fr',
  keys: {
    ...row(NUMBER_CODES, '#1234567890-=', '|!"/$%?&*()_+'),
    ...row(TOP_CODES, 'qwertyuiop', 'QWERTYUIOP'),
    ...row(HOME_CODES, 'asdfghjkl', 'ASDFGHJKL'),
    ...row(BOTTOM_CODES, 'zxcvbnm', 'ZXCVBNM'),
    BracketLeft: [MARK.circumflex, MARK.circumflex],
    BracketRight: [MARK.cedilla, MARK.diaeresis],
    Backslash: ['<', '>'],
    Semicolon: [';', ':'],
    Quote: [MARK.grave, MARK.grave],
    Comma: [',', "'"],
    Period: ['.', '.'],
    Slash: [cp(0xe9), cp(0xc9)],
    // ISO boards: the guillemets, on the key beside the left Shift.
    IntlBackslash: [cp(0xab), cp(0xbb)],
  },
};

/**
 * Colemak-DH. The left bottom row is typed with the angle fingering the layout is
 * designed for: ring, middle, index, index, index from the key beside the left Shift.
 * An ANSI board has no key left for Z there, so Z sits in the middle of the row. An ISO
 * board has one more key: Z takes it, under the pinky, and the middle key gets the backslash.
 */
const COLEMAK_DH: LayoutDef = {
  id: 'colemak-dh',
  keys: {
    ...row(NUMBER_CODES, '`1234567890-=', '~!@#$%^&*()_+'),
    ...row(TOP_CODES, 'qwfpbjluy;', 'QWFPBJLUY:'),
    ...row(HOME_CODES, 'arstgmnei', 'ARSTGMNEI'),
    ...row(BOTTOM_CODES, 'xcdvzkh', 'XCDVZKH'),
    BracketLeft: ['[', '{'],
    BracketRight: [']', '}'],
    Backslash: [BACKSLASH, '|'],
    Semicolon: ['o', 'O'],
    Quote: ["'", '"'],
    Comma: [',', '<'],
    Period: ['.', '>'],
    Slash: ['/', '?'],
  },
  fingers: { KeyZ: 'LR', KeyX: 'LM', KeyC: 'LI', KeyV: 'LI', KeyB: 'LI' },
  boards: { iso: { IntlBackslash: ['z', 'Z'], KeyB: [BACKSLASH, '|'] } },
};

/** The keys every US-based layout shares, which the alternative layouts below only rearrange letters on. */
const US_SYMBOLS: Keys = {
  ...row(NUMBER_CODES, '`1234567890-=', '~!@#$%^&*()_+'),
  BracketLeft: ['[', '{'],
  BracketRight: [']', '}'],
  Backslash: [BACKSLASH, '|'],
  Quote: ["'", '"'],
  Comma: [',', '<'],
  Period: ['.', '>'],
  Slash: ['/', '?'],
  IntlBackslash: [BACKSLASH, '|'],
};

/**
 * Letters rearranged over the US symbols, as Colemak and Workman do: nine letters on the
 * top row with the semicolon after them, ten on the home row, seven on the bottom row.
 */
const letterRows = (top: string, home: string, bottom: string): Keys => ({
  ...US_SYMBOLS,
  ...row(TOP_CODES, `${top};`, `${top.toUpperCase()}:`),
  ...row(`${HOME_CODES} Semicolon`, home, home.toUpperCase()),
  ...row(BOTTOM_CODES, bottom, bottom.toUpperCase()),
});

/**
 * French AZERTY (Windows "French", France). The number row types its symbols and
 * accented letters as is and its digits with Shift. The circumflex and diaeresis are
 * dead keys; capital accented letters need Caps Lock or AltGr, so they are left out.
 */
const AZERTY: LayoutDef = {
  id: 'azerty',
  keys: {
    Backquote: [cp(0xb2), cp(0xb2)],
    ...row('Digit1 Digit2 Digit3 Digit4 Digit5 Digit6 Digit7 Digit8 Digit9 Digit0 Minus Equal', `&${cp(0xe9)}"'(-${cp(0xe8)}_${cp(0xe7)}${cp(0xe0)})=`, `1234567890${cp(0xb0)}+`),
    ...row(TOP_CODES, 'azertyuiop', 'AZERTYUIOP'),
    ...row(HOME_CODES, 'qsdfghjkl', 'QSDFGHJKL'),
    ...row(BOTTOM_CODES, 'wxcvbn,', 'WXCVBN?'),
    BracketLeft: [MARK.circumflex, MARK.diaeresis],
    BracketRight: ['$', cp(0xa3)],
    Semicolon: ['m', 'M'],
    Quote: [cp(0xf9), '%'],
    Backslash: ['*', cp(0xb5)],
    Comma: [';', '.'],
    Period: [':', '/'],
    Slash: ['!', cp(0xa7)],
    IntlBackslash: ['<', '>'],
  },
};

/**
 * German QWERTZ (Windows "German"). Z and Y trade places, the umlauts and ß have their
 * own keys, and the circumflex, acute and grave are dead keys, so French accents other
 * than the cedilla and the diaeresis can be typed.
 */
const QWERTZ: LayoutDef = {
  id: 'qwertz',
  keys: {
    Backquote: [MARK.circumflex, cp(0xb0)],
    ...row('Digit1 Digit2 Digit3 Digit4 Digit5 Digit6 Digit7 Digit8 Digit9 Digit0 Minus', `1234567890${cp(0xdf)}`, `!"${cp(0xa7)}$%&/()=?`),
    Equal: [MARK.acute, MARK.grave],
    ...row(TOP_CODES, 'qwertzuiop', 'QWERTZUIOP'),
    ...row(HOME_CODES, 'asdfghjkl', 'ASDFGHJKL'),
    ...row(BOTTOM_CODES, 'yxcvbnm', 'YXCVBNM'),
    BracketLeft: [cp(0xfc), cp(0xdc)],
    BracketRight: ['+', '*'],
    Semicolon: [cp(0xf6), cp(0xd6)],
    Quote: [cp(0xe4), cp(0xc4)],
    Backslash: ['#', "'"],
    Comma: [',', ';'],
    Period: ['.', ':'],
    Slash: ['-', '_'],
    IntlBackslash: ['<', '>'],
  },
};

/**
 * Swiss German QWERTZ (Windows "Swiss German"). The German letter rows without ß, with
 * è é à on Shift of ü ö ä and ç on Shift of 4, so French types on it too. The circumflex,
 * grave and diaeresis are dead keys, which is how Ä Ö Ü are typed with capitals on.
 */
const QWERTZ_CH: LayoutDef = {
  id: 'qwertz-ch',
  keys: {
    Backquote: [cp(0xa7), cp(0xb0)],
    ...row('Digit1 Digit2 Digit3 Digit4 Digit5 Digit6 Digit7 Digit8 Digit9 Digit0 Minus', "1234567890'", `+"*${cp(0xe7)}%&/()=?`),
    Equal: [MARK.circumflex, MARK.grave],
    ...row(TOP_CODES, 'qwertzuiop', 'QWERTZUIOP'),
    ...row(HOME_CODES, 'asdfghjkl', 'ASDFGHJKL'),
    ...row(BOTTOM_CODES, 'yxcvbnm', 'YXCVBNM'),
    BracketLeft: [cp(0xfc), cp(0xe8)],
    BracketRight: [MARK.diaeresis, '!'],
    Semicolon: [cp(0xf6), cp(0xe9)],
    Quote: [cp(0xe4), cp(0xe0)],
    Backslash: ['$', cp(0xa3)],
    Comma: [',', ';'],
    Period: ['.', ':'],
    Slash: ['-', '_'],
    IntlBackslash: ['<', '>'],
  },
};

/** The keys the two Spanish layouts share: the letter rows, ñ beside L, and the punctuation of the bottom row. */
const SPANISH_LETTERS: Keys = {
  ...row(TOP_CODES, 'qwertyuiop', 'QWERTYUIOP'),
  ...row(HOME_CODES, 'asdfghjkl', 'ASDFGHJKL'),
  ...row(BOTTOM_CODES, 'zxcvbnm', 'ZXCVBNM'),
  Semicolon: [cp(0xf1), cp(0xd1)],
  Minus: ["'", '?'],
  BracketRight: ['+', '*'],
  Comma: [',', ';'],
  Period: ['.', ':'],
  Slash: ['-', '_'],
  IntlBackslash: ['<', '>'],
};

/**
 * Spanish (Windows "Spanish", Spain). The acute and diaeresis share the key beside ñ,
 * the grave and circumflex the key beside P, and ¡ ¿ sit at the end of the number row.
 */
const ES: LayoutDef = {
  id: 'es',
  keys: {
    ...SPANISH_LETTERS,
    Backquote: [cp(0xba), cp(0xaa)],
    ...row('Digit1 Digit2 Digit3 Digit4 Digit5 Digit6 Digit7 Digit8 Digit9 Digit0', '1234567890', `!"${cp(0xb7)}$%&/()=`),
    Equal: [cp(0xa1), cp(0xbf)],
    BracketLeft: [MARK.grave, MARK.circumflex],
    Quote: [MARK.acute, MARK.diaeresis],
    Backslash: [cp(0xe7), cp(0xc7)],
  },
};

/** Latin American (Windows "Latin American"). The acute and diaeresis sit beside P, ¿ ¡ at the end of the number row. */
const LATAM: LayoutDef = {
  id: 'latam',
  keys: {
    ...SPANISH_LETTERS,
    Backquote: ['|', cp(0xb0)],
    ...row('Digit1 Digit2 Digit3 Digit4 Digit5 Digit6 Digit7 Digit8 Digit9 Digit0', '1234567890', '!"#$%&/()='),
    Equal: [cp(0xbf), cp(0xa1)],
    BracketLeft: [MARK.acute, MARK.diaeresis],
    Quote: ['{', '['],
    Backslash: ['}', ']'],
  },
};

/** Dvorak (US). Vowels under the left hand, the commonest consonants under the right. */
const DVORAK: LayoutDef = {
  id: 'dvorak',
  keys: {
    ...US_SYMBOLS,
    Minus: ['[', '{'],
    Equal: [']', '}'],
    ...row(TOP_CODES, `',.pyfgcrl`, `"<>PYFGCRL`),
    BracketLeft: ['/', '?'],
    BracketRight: ['=', '+'],
    ...row(`${HOME_CODES} Semicolon Quote`, 'aoeuidhtns-', 'AOEUIDHTNS_'),
    ...row(`${BOTTOM_CODES} Comma Period Slash`, ';qjkxbmwvz', ':QJKXBMWVZ'),
  },
};

/** Colemak, the original: Colemak-DH without the moved bottom-left and middle keys. */
const COLEMAK: LayoutDef = {
  id: 'colemak',
  keys: letterRows('qwfpgjluy', 'arstdhneio', 'zxcvbkm'),
};

/** Workman: letters placed to spare the index fingers' sideways reach to the middle columns. */
const WORKMAN: LayoutDef = {
  id: 'workman',
  keys: letterRows('qdrwbjfup', 'ashtgyneoi', 'zxmcvkl'),
};

/** The national layouts first, then the alternative ones. The first is where an unknown id lands. */
const DEFS: LayoutDef[] = [CA_FR, US, AZERTY, QWERTZ, QWERTZ_CH, ES, LATAM, DVORAK, COLEMAK, COLEMAK_DH, WORKMAN];

export interface KeyLegend {
  base: string;
  shift: string;
  /** True when the shifted character is just the capital of the base one. */
  letter: boolean;
}

/** A layout's name and the note about its fingering are interface strings: see `i18n.ts`. */
export interface Layout {
  id: LayoutId;
  /** The board the layout was built for: it decides which keys exist and where two of them sit. */
  board: Board;
  fingerOf(code: string): Finger;
  /** The row a key sits on, on this board. */
  rowOf(code: string): Row;
  legend(code: string): KeyLegend | null;
  /** Strokes for one character, or null when the layout cannot produce it. */
  strokesFor(char: string): Stroke[] | null;
  canType(text: string): boolean;
  targets(text: string): Target[];
  /** The Shift key touch typing asks for: the one on the other hand. */
  properShift(code: string): 'ShiftLeft' | 'ShiftRight';
  /** What a stroke shows on a note or key cap. */
  strokeLabel(stroke: Stroke): string;
}

const isMark = (value: string): boolean => value in MARK_LEGEND;

function buildLayout(def: LayoutDef, board: Board): Layout {
  const fingerOf = (code: string): Finger => def.fingers?.[code] ?? DEFAULT_FINGER[code] ?? 'RI';
  const direct = new Map<string, Stroke[]>();
  const dead = new Map<string, Stroke>();

  // The board's own keys come first, so a character two keys can type is asked for on the key the board moved.
  const moved = def.boards?.[board] ?? {};
  const keys: Keys = Object.fromEntries(
    [...Object.entries(moved), ...Object.entries(def.keys).filter(([code]) => !(code in moved))].filter(([code]) => hasCode(board, code)),
  );

  direct.set(' ', [{ code: 'Space', shift: false }]);
  for (const [code, [base, shifted]] of Object.entries(keys)) {
    [base, shifted].forEach((value, level) => {
      const stroke: Stroke = { code, shift: level === 1 };
      if (isMark(value)) {
        if (!dead.has(value)) dead.set(value, stroke);
      } else if (!direct.has(value)) {
        direct.set(value, [stroke]);
      }
    });
  }

  const strokesFor = (char: string): Stroke[] | null => {
    const hit = direct.get(char);
    if (hit) return hit;
    const parts = char.normalize('NFD');
    if (parts.length !== 2) return null;
    const base = direct.get(parts[0]);
    const mark = dead.get(parts[1]);
    return base && mark ? [mark, ...base] : null;
  };

  const legendValue = (value: string): string => MARK_LEGEND[value] ?? value;

  return {
    id: def.id,
    board,
    fingerOf,
    rowOf: (code) => rowOf(code, board),
    legend(code) {
      const pair = keys[code];
      if (!pair) return null;
      const [base, shift] = pair;
      return {
        base: legendValue(base),
        shift: legendValue(shift),
        letter: base.toUpperCase() === shift && base !== shift,
      };
    },
    strokesFor,
    canType: (text) => [...text].every((char) => strokesFor(char) !== null),
    targets: (text) =>
      [...text].flatMap((char) => {
        const strokes = strokesFor(char);
        return strokes ? [{ char, strokes }] : [];
      }),
    properShift: (code) => (fingerHand(fingerOf(code)) === 'left' ? 'ShiftRight' : 'ShiftLeft'),
    strokeLabel(stroke) {
      if (stroke.code === 'Space') return ' ';
      const pair = keys[stroke.code];
      return pair ? legendValue(pair[stroke.shift ? 1 : 0]) : '';
    },
  };
}

/** Every layout on an ANSI board: the list the layout dropdown and the tests go through. */
export const LAYOUTS: Layout[] = DEFS.map((def) => buildLayout(def, 'ansi'));
export const LAYOUT_IDS: LayoutId[] = DEFS.map((def) => def.id);

const built = new Map<string, Layout>(LAYOUTS.map((layout) => [`${layout.id}|ansi`, layout]));

/** A layout as it sits on a board. An unknown id gives the first layout. */
export function getLayout(id: string, board: Board = 'ansi'): Layout {
  const def = DEFS.find((candidate) => candidate.id === id) ?? DEFS[0];
  const key = `${def.id}|${board}`;
  let layout = built.get(key);
  if (!layout) {
    layout = buildLayout(def, board);
    built.set(key, layout);
  }
  return layout;
}

/** Codes that carry a character on some board, plus Space: a press on one of them is typing. */
export const isTypingCode = (code: string): boolean => code === 'Space' || CHARACTER_CODES.has(code);
