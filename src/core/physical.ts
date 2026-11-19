import type { Finger } from './fingers';

/** One physical key. `w` is its width in key units. */
export interface PhysKey {
  code: string;
  w: number;
  /** Fixed legend for keys that never carry a layout character. */
  label?: string;
  /**
   * A tall key: it reaches down into the row below, where it is this many units wide,
   * against the right edge. The Enter key of ISO and JIS boards.
   */
  tail?: number;
}

/**
 * The shape of the keyboard on the desk. ANSI: a wide left Shift and a flat Enter.
 * ISO: a tall Enter and one more key beside the left Shift. JIS: a tall Enter, a short
 * Backspace with a key beside it, a key beside the right Shift and three around the space bar.
 */
export type Board = 'ansi' | 'iso' | 'jis';
export const BOARDS: Board[] = ['ansi', 'iso', 'jis'];

const k = (code: string, w = 1, label?: string): PhysKey => ({ code, w, label });
const letters = (codes: string): PhysKey[] => codes.split(' ').map((c) => k(c));

const NUMBER = 'Backquote Digit1 Digit2 Digit3 Digit4 Digit5 Digit6 Digit7 Digit8 Digit9 Digit0 Minus Equal';
const TOP = 'KeyQ KeyW KeyE KeyR KeyT KeyY KeyU KeyI KeyO KeyP BracketLeft BracketRight';
const HOME = 'KeyA KeyS KeyD KeyF KeyG KeyH KeyJ KeyK KeyL Semicolon Quote';
const BOTTOM = 'KeyZ KeyX KeyC KeyV KeyB KeyN KeyM Comma Period Slash';

const tab = (): PhysKey => k('Tab', 1.5, 'tab');
const caps = (): PhysKey => k('CapsLock', 1.75, 'caps');
/** The tall Enter: a unit and a half on the top letter row, a unit and a quarter on the home row under it. */
const tallEnter = (): PhysKey => ({ code: 'Enter', w: 1.5, label: 'enter', tail: 1.25 });
const thumbRow = (): PhysKey[] => [
  k('ControlLeft', 1.75, 'ctrl'),
  k('AltLeft', 1.75, 'alt'),
  k('Space', 8, 'space'),
  k('AltRight', 1.75, 'alt'),
  k('ControlRight', 1.75, 'ctrl'),
];

/**
 * Every row is 15 units wide. Under a tall key the row below stops short by the
 * width of that key's lower part, which fills the rest.
 */
const BOARD_ROWS: Record<Board, PhysKey[][]> = {
  ansi: [
    [...letters(NUMBER), k('Backspace', 2, 'bksp')],
    [tab(), ...letters(TOP), k('Backslash', 1.5)],
    [caps(), ...letters(HOME), k('Enter', 2.25, 'enter')],
    [k('ShiftLeft', 2.25, 'shift'), ...letters(BOTTOM), k('ShiftRight', 2.75, 'shift')],
    thumbRow(),
  ],
  iso: [
    [...letters(NUMBER), k('Backspace', 2, 'bksp')],
    [tab(), ...letters(TOP), tallEnter()],
    [caps(), ...letters(HOME), k('Backslash')],
    [k('ShiftLeft', 1.25, 'shift'), k('IntlBackslash'), ...letters(BOTTOM), k('ShiftRight', 2.75, 'shift')],
    thumbRow(),
  ],
  jis: [
    [...letters(NUMBER), k('IntlYen'), k('Backspace', 1, 'bksp')],
    [tab(), ...letters(TOP), tallEnter()],
    [caps(), ...letters(HOME), k('Backslash')],
    [k('ShiftLeft', 2.25, 'shift'), ...letters(BOTTOM), k('IntlRo'), k('ShiftRight', 1.75, 'shift')],
    [
      k('ControlLeft', 1.75, 'ctrl'),
      k('AltLeft', 1.25, 'alt'),
      // The three keys around a JIS space bar keep the legends printed on them.
      k('NonConvert', 1.25, '無変換'),
      k('Space', 4.75, 'space'),
      k('Convert', 1.25, '変換'),
      k('KanaMode', 1.25, 'かな'),
      k('AltRight', 1.25, 'alt'),
      k('ControlRight', 2.25, 'ctrl'),
    ],
  ],
};

export const rowsOf = (board: Board): PhysKey[][] => BOARD_ROWS[board];

/**
 * Which row a key sits on. The row sets a note's shape and shade: the finger
 * reaches up for the top row, rests on the home row, curls down for the bottom row.
 */
export type Row = 'number' | 'top' | 'home' | 'bottom' | 'thumb';
export const ROW_IDS: Row[] = ['number', 'top', 'home', 'bottom', 'thumb'];

const ROW_OF = Object.fromEntries(
  BOARDS.map((board) => {
    const map = new Map<string, Row>(BOARD_ROWS[board].flatMap((row, i) => row.map((key) => [key.code, ROW_IDS[i]] as [string, Row])));
    // A tall Enter starts a row higher, and is still reached from the home row.
    map.set('Enter', 'home');
    return [board, map];
  }),
) as Record<Board, Map<string, Row>>;

/** The row of a key on a board. One key moves with the board: the one beside Enter sits a row lower on ISO and JIS. */
export const rowOf = (code: string, board: Board = 'ansi'): Row => ROW_OF[board].get(code) ?? 'home';

export const hasCode = (board: Board, code: string): boolean => ROW_OF[board].has(code);

/**
 * A key that only some boards have says which board is on the desk: the key beside
 * the left Shift is ISO's, the ones around the space bar and beside Backspace are JIS's.
 */
export function boardOf(code: string): Board | null {
  if (code === 'IntlBackslash') return 'iso';
  if (code === 'IntlYen' || code === 'NonConvert' || code === 'Convert') return 'jis';
  return null;
}

const assign = (finger: Finger, codes: string): [string, Finger][] => codes.split(' ').map((c) => [c, finger]);

/** Standard touch-typing finger for each physical key. Layouts may override single keys. */
export const DEFAULT_FINGER: Record<string, Finger> = Object.fromEntries([
  ...assign('LP', 'Backquote Digit1 KeyQ KeyA KeyZ Tab CapsLock ShiftLeft ControlLeft IntlBackslash'),
  ...assign('LR', 'Digit2 KeyW KeyS KeyX'),
  ...assign('LM', 'Digit3 KeyE KeyD KeyC'),
  ...assign('LI', 'Digit4 Digit5 KeyR KeyT KeyF KeyG KeyV KeyB'),
  ...assign('LT', 'AltLeft NonConvert'),
  ...assign('RT', 'Space AltRight Convert KanaMode'),
  ...assign('RI', 'Digit6 Digit7 KeyY KeyU KeyH KeyJ KeyN KeyM'),
  ...assign('RM', 'Digit8 KeyI KeyK Comma'),
  ...assign('RR', 'Digit9 KeyO KeyL Period'),
  ...assign(
    'RP',
    'Digit0 Minus Equal KeyP BracketLeft BracketRight Backslash Semicolon Quote Slash Enter ShiftRight Backspace ControlRight IntlYen IntlRo',
  ),
]);

/** Where each finger rests. Physical positions: the same on every layout and every board. */
export const HOME_CODE: Record<Finger, string> = {
  LP: 'KeyA', LR: 'KeyS', LM: 'KeyD', LI: 'KeyF', LT: 'Space',
  RT: 'Space', RI: 'KeyJ', RM: 'KeyK', RR: 'KeyL', RP: 'Semicolon',
};

/** Keys in the three letter rows of a board: the reach of the anchor drills. */
export const letterRowCodes = (board: Board): string[] =>
  BOARD_ROWS[board]
    .slice(1, 4)
    .flat()
    .filter((key) => !key.label)
    .map((key) => key.code);

/** Every key that carries a character on some board. A press on one of them is typing, whatever board is picked. */
export const CHARACTER_CODES: Set<string> = new Set(
  BOARDS.flatMap((board) => BOARD_ROWS[board].flat())
    .filter((key) => !key.label)
    .map((key) => key.code),
);
