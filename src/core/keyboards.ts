/**
 * The keyboard a typist says they type on: a model in their own words, a switch and a
 * size from fixed lists. The boards rank keyboards by the speed of the people on them.
 * That says who types on what, not what a keyboard does for a typist.
 */

/** Switches: the sound list's switches, then the common kinds. */
export const SWITCH_KINDS = [
  'mx-red',
  'mx-brown',
  'mx-blue',
  'mx-black',
  'mx-silver',
  'gateron-yellow',
  'holy-panda',
  'cream',
  'box-navy',
  'ink',
  'tealios',
  'alpaca',
  'alps',
  'buckling-spring',
  'topre',
  'hall-effect',
  'optical',
  'low-profile',
  'scissor',
  'membrane',
  'other',
] as const;
export type SwitchKind = (typeof SWITCH_KINDS)[number];

/** Names as the makers write them: the same in every language. */
export const SWITCH_NAMES: Record<SwitchKind, string> = {
  'mx-red': 'cherry mx red',
  'mx-brown': 'cherry mx brown',
  'mx-blue': 'cherry mx blue',
  'mx-black': 'cherry mx black',
  'mx-silver': 'cherry mx silver',
  'gateron-yellow': 'gateron yellow',
  'holy-panda': 'holy panda',
  cream: 'novelkeys cream',
  'box-navy': 'kailh box navy',
  ink: 'gateron ink',
  tealios: 'tealios',
  alpaca: 'alpaca',
  alps: 'alps',
  'buckling-spring': 'buckling spring',
  topre: 'topre',
  'hall-effect': 'hall effect',
  optical: 'optical',
  'low-profile': 'low profile',
  scissor: 'scissor',
  membrane: 'membrane',
  other: 'other',
};

export const SIZE_KINDS = ['full', '96', 'tkl', '75', '65', '60', '40', 'split', 'ergo', 'laptop', 'other'] as const;
export type SizeKind = (typeof SIZE_KINDS)[number];

export const isSwitchKind = (value: unknown): value is SwitchKind => SWITCH_KINDS.includes(value as SwitchKind);
export const isSizeKind = (value: unknown): value is SizeKind => SIZE_KINDS.includes(value as SizeKind);

/** Longest model name kept. */
export const MODEL_MAX = 48;

/** A model as typed, tidied for display: single spaces, no control characters, cut at the limit. */
export function cleanModel(name: string): string {
  return name
    .replace(/[\p{C}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MODEL_MAX);
}

/** The key two spellings of one model share: `Keychron K2 V2`, `keychron k2-v2` and `KEYCHRON  K2v2` meet. */
export function modelKey(name: string): string {
  return cleanModel(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}
