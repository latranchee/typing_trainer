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

/** A saved value inside its axis, or `fallback` when it is not a number. */
export function onAxis<T>(value: unknown, axis: Axis, fallback: T): number | T {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(axis.max, Math.max(axis.min, Math.round(value)));
}
