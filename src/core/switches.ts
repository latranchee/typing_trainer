import type { Row } from './physical';
import { rowOf } from './physical';

/**
 * The key sounds: recordings of real switches, one set per switch, from the
 * kbsim project (MIT, see public/switches/LICENSE-kbsim.md). Each set holds a
 * press for every row of the board and a release. `own` is false for a set with
 * no recording of its own for the space bar, Enter and Backspace.
 */
export const SWITCHES = [
  { id: 'mxblue', name: 'cherry mx blue', own: false },
  { id: 'mxbrown', name: 'cherry mx brown', own: true },
  { id: 'mxblack', name: 'cherry mx black', own: true },
  { id: 'holypanda', name: 'holy panda', own: true },
  { id: 'topre', name: 'topre', own: true },
  { id: 'buckling', name: 'buckling spring', own: true },
  { id: 'boxnavy', name: 'kailh box navy', own: true },
  { id: 'bluealps', name: 'alps skcm blue', own: true },
  { id: 'cream', name: 'novelkeys cream', own: true },
  { id: 'blackink', name: 'gateron black ink', own: true },
  { id: 'redink', name: 'gateron red ink', own: true },
  { id: 'turquoise', name: 'turquoise tealios', own: true },
  { id: 'alpaca', name: 'alpaca', own: true },
] as const;

export type SwitchId = (typeof SWITCHES)[number]['id'];
/** What the keys sound like: one of the switches, or nothing. */
export type KeySound = SwitchId | 'off';

export const SWITCH_IDS: SwitchId[] = SWITCHES.map((item) => item.id);
export const isKeySound = (value: unknown): value is KeySound => value === 'off' || SWITCH_IDS.includes(value as SwitchId);

/** The recorded board has five rows, as this one does: each row of keys has its own press. */
const ROW_PRESS: Record<Row, string> = { number: 'press-r0', top: 'press-r1', home: 'press-r2', bottom: 'press-r3', thumb: 'press-r4' };
/** The keys a full set records apart: they are bigger and sound it. */
const OWN_KEYS: Record<string, string> = { Space: 'space', Enter: 'enter', Backspace: 'backspace' };

const ownsKeys = (id: SwitchId): boolean => SWITCHES.find((item) => item.id === id)?.own ?? false;

/** The recording a key going down plays. */
export function pressSample(id: SwitchId, code: string): string {
  const own = OWN_KEYS[code];
  return own && ownsKeys(id) ? `press-${own}` : ROW_PRESS[rowOf(code)];
}

/** The recording a key coming back up plays. */
export function releaseSample(id: SwitchId, code: string): string {
  const own = OWN_KEYS[code];
  return own && ownsKeys(id) ? `release-${own}` : 'release';
}

/** Every recording of a set, by file name without its extension. */
export function samplesOf(id: SwitchId): string[] {
  const names = [...Object.values(ROW_PRESS), 'release'];
  if (ownsKeys(id)) for (const own of Object.values(OWN_KEYS)) names.push(`press-${own}`, `release-${own}`);
  return names;
}
