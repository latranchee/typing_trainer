import type { Finger } from './fingers';

/** One physical key of an ANSI board. `w` is its width in key units. */
export interface PhysKey {
  code: string;
  w: number;
  /** Fixed legend for keys that never carry a layout character. */
  label?: string;
}

const k = (code: string, w = 1, label?: string): PhysKey => ({ code, w, label });
const letters = (codes: string): PhysKey[] => codes.split(' ').map((c) => k(c));

/** Every row is 15 units wide. */
export const ROWS: PhysKey[][] = [
  [...letters('Backquote Digit1 Digit2 Digit3 Digit4 Digit5 Digit6 Digit7 Digit8 Digit9 Digit0 Minus Equal'), k('Backspace', 2, 'bksp')],
  [k('Tab', 1.5, 'tab'), ...letters('KeyQ KeyW KeyE KeyR KeyT KeyY KeyU KeyI KeyO KeyP BracketLeft BracketRight'), k('Backslash', 1.5)],
  [k('CapsLock', 1.75, 'caps'), ...letters('KeyA KeyS KeyD KeyF KeyG KeyH KeyJ KeyK KeyL Semicolon Quote'), k('Enter', 2.25, 'enter')],
  [k('ShiftLeft', 2.25, 'shift'), ...letters('KeyZ KeyX KeyC KeyV KeyB KeyN KeyM Comma Period Slash'), k('ShiftRight', 2.75, 'shift')],
  [k('ControlLeft', 1.75, 'ctrl'), k('AltLeft', 1.75, 'alt'), k('Space', 8, 'space'), k('AltRight', 1.75, 'alt'), k('ControlRight', 1.75, 'ctrl')],
];

/**
 * Which row a key sits on. The row sets a note's shape and shade: the finger
 * reaches up for the top row, rests on the home row, curls down for the bottom row.
 */
export type Row = 'number' | 'top' | 'home' | 'bottom' | 'thumb';
export const ROW_IDS: Row[] = ['number', 'top', 'home', 'bottom', 'thumb'];

const ROW_OF = new Map<string, Row>(ROWS.flatMap((row, i) => row.map((key) => [key.code, ROW_IDS[i]] as [string, Row])));
export const rowOf = (code: string): Row => ROW_OF.get(code) ?? 'home';

const assign = (finger: Finger, codes: string): [string, Finger][] => codes.split(' ').map((c) => [c, finger]);

/** Standard touch-typing finger for each physical key. Layouts may override single keys. */
export const DEFAULT_FINGER: Record<string, Finger> = Object.fromEntries([
  ...assign('LP', 'Backquote Digit1 KeyQ KeyA KeyZ Tab CapsLock ShiftLeft ControlLeft'),
  ...assign('LR', 'Digit2 KeyW KeyS KeyX'),
  ...assign('LM', 'Digit3 KeyE KeyD KeyC'),
  ...assign('LI', 'Digit4 Digit5 KeyR KeyT KeyF KeyG KeyV KeyB'),
  ...assign('LT', 'AltLeft'),
  ...assign('RT', 'Space AltRight'),
  ...assign('RI', 'Digit6 Digit7 KeyY KeyU KeyH KeyJ KeyN KeyM'),
  ...assign('RM', 'Digit8 KeyI KeyK Comma'),
  ...assign('RR', 'Digit9 KeyO KeyL Period'),
  ...assign('RP', 'Digit0 Minus Equal KeyP BracketLeft BracketRight Backslash Semicolon Quote Slash Enter ShiftRight Backspace ControlRight'),
]);

/** Where each finger rests. Physical positions: the same on every layout. */
export const HOME_CODE: Record<Finger, string> = {
  LP: 'KeyA', LR: 'KeyS', LM: 'KeyD', LI: 'KeyF', LT: 'Space',
  RT: 'Space', RI: 'KeyJ', RM: 'KeyK', RR: 'KeyL', RP: 'Semicolon',
};

/** Keys in the three letter rows: the reach of the anchor drills. */
export const LETTER_ROW_CODES: string[] = ROWS.slice(1, 4)
  .flat()
  .filter((key) => !key.label)
  .map((key) => key.code);

export const ALL_CODES: Set<string> = new Set(ROWS.flat().map((key) => key.code));
