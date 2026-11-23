/**
 * Allo's three axes, as the settings move them. The font is Allo by Josh Puckett
 * (https://allo.joshpuckett.me, SIL Open Font License 1.1).
 */
export interface Axis {
  min: number;
  max: number;
  step: number;
  /** The font's own default. */
  base: number;
}

export const AXES = {
  /** `wght`: the weight of plain text. Every other weight moves by the same amount. */
  weight: { min: 100, max: 900, step: 10, base: 400 },
  /** `ROND`: 0 sharp, 50 friendly, 100 round. */
  round: { min: 0, max: 100, step: 1, base: 50 },
  /** `opsz`: left to the browser (null), which matches it to each size, or fixed for every size. */
  optical: { min: 9, max: 32, step: 1, base: 14 },
} as const satisfies Record<string, Axis>;

/**
 * Allo's OpenType features the settings switch for the whole page. Left out: `sups`, `subs`, `numr`
 * and `dnom`, which set every figure on the page as a superscript, subscript or fraction part.
 * `ss02` is not sent to the browser: it is the four switches it bundles (see `FEATURE_GROUP`).
 */
export const FONT_FEATURES = ['ss01', 'ss02', 'cv04', 'cv03', 'cv01', 'zero', 'cv05', 'ss03', 'tnum', 'frac', 'case', 'liga', 'calt'] as const;
export type FontFeature = (typeof FONT_FEATURES)[number];

/** On before the typist changes anything: the browser's own (`liga`, `calt`) and the page's tabular figures. */
export const DEFAULT_FEATURES: readonly FontFeature[] = ['tnum', 'liga', 'calt'];

/** `ss02`, disambiguation, is the serifed I, the tailed l, the footed 1 and the slashed zero at once. */
export const FEATURE_GROUP: Partial<Record<FontFeature, readonly FontFeature[]>> = { ss02: ['cv04', 'cv03', 'cv01', 'zero'] };

/** A zero is slashed or dotted, not both. */
const RIVALS: Partial<Record<FontFeature, FontFeature>> = { zero: 'cv05', cv05: 'zero' };

const isFeature = (value: unknown): value is FontFeature => FONT_FEATURES.includes(value as FontFeature);

/** Whether a feature is on. A group is on when every feature in it is. */
export function featureOn(on: readonly FontFeature[], feature: FontFeature): boolean {
  const group = FEATURE_GROUP[feature];
  return group ? group.every((part) => on.includes(part)) : on.includes(feature);
}

/** The features on after one switch is flipped: a group flips its parts, and a zero turned on turns its rival off. */
export function setFeature(on: readonly FontFeature[], feature: FontFeature, value: boolean): FontFeature[] {
  const parts = FEATURE_GROUP[feature] ?? [feature];
  const next = new Set(on);
  for (const part of parts) {
    if (value) {
      next.add(part);
      const rival = RIVALS[part];
      if (rival) next.delete(rival);
    } else {
      next.delete(part);
    }
  }
  return FONT_FEATURES.filter((feature) => next.has(feature));
}

/** A saved list of features, cleaned: known names only, no group, one zero, in the list's order. Anything else gives the defaults. */
export function savedFeatures(value: unknown): FontFeature[] {
  if (!Array.isArray(value)) return [...DEFAULT_FEATURES];
  let on: FontFeature[] = [];
  for (const item of value) if (isFeature(item) && !FEATURE_GROUP[item]) on = setFeature(on, item, true);
  return on;
}

/** The page's `font-feature-settings`: only what differs from the browser's own, or '' for none. */
export function featureSettings(on: readonly FontFeature[]): string {
  return FONT_FEATURES.filter((feature) => !FEATURE_GROUP[feature])
    .flatMap((feature) => {
      const wanted = on.includes(feature);
      const browser = feature === 'liga' || feature === 'calt';
      return wanted === browser ? [] : [`"${feature}" ${wanted ? 1 : 0}`];
    })
    .join(', ');
}

/** A saved value inside its axis, or `fallback` when it is not a number. */
export function onAxis<T>(value: unknown, axis: Axis, fallback: T): number | T {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(axis.max, Math.max(axis.min, Math.round(value)));
}
