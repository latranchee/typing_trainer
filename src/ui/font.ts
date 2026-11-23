import { AXES } from '../core/font';

/** The weight canvas text moves by, the same as the page's. */
let shift = 0;

/**
 * Sets the font on the whole page. The weight moves every weight by the same amount, so a
 * heading stays heavier than the text under it. Roundness and a fixed optical size reach
 * every letter set as text; with the optical size on auto the browser matches it to each size.
 */
export function applyFont(weight: number, round: number, optical: number | null): void {
  const root = document.documentElement;
  shift = weight - AXES.weight.base;
  root.style.setProperty('--wght-shift', String(shift));
  const axes = [`"ROND" ${round}`];
  if (optical !== null) axes.push(`"opsz" ${optical}`);
  root.style.fontVariationSettings = axes.join(', ');
}

/**
 * A weight for text drawn on a canvas, moved like the page's. A canvas takes no
 * roundness or optical size: its letters keep the font's defaults on those two.
 */
export const weighted = (base: number): number => Math.min(AXES.weight.max, Math.max(AXES.weight.min, base + shift));
