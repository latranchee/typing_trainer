import { css } from './dom';

/**
 * Where a letter's ink sits. A box centres text on the font's em box, and a lowercase
 * letter with no ascender only fills the lower part of that box: alone in a circle, a
 * triangle or a key cap it looks dropped. These helpers place a letter by its own ink.
 */

/** The size the glyphs are measured at. Everything is returned in em, so the size only sets the precision. */
const PX = 100;

interface Ink {
  /** Ink above and below the baseline, in em. */
  up: number;
  down: number;
}

let ctx: CanvasRenderingContext2D | null = null;
/** Half of what the font's box holds above the baseline, less what it holds below: where a box puts the baseline, in em under its middle. */
let boxDrop = 0;
/** Half the height of a lowercase x, in em. */
let halfX = 0;
const inks = new Map<string, Ink>();

function measure(label: string): Ink {
  if (!ctx) {
    ctx = document.createElement('canvas').getContext('2d')!;
    ctx.font = `600 ${PX}px ${css('--font')}`;
    ctx.textBaseline = 'alphabetic';
    const x = ctx.measureText('x');
    boxDrop = (x.fontBoundingBoxAscent - x.fontBoundingBoxDescent) / 2 / PX;
    halfX = x.actualBoundingBoxAscent / 2 / PX;
  }
  let ink = inks.get(label);
  if (!ink) {
    const box = ctx.measureText(label);
    ink = { up: box.actualBoundingBoxAscent / PX, down: box.actualBoundingBoxDescent / PX };
    inks.set(label, ink);
  }
  return ink;
}

const LETTER = /[\p{L}\p{N}]/u;

/**
 * How far under the middle of its shape a label's baseline goes, in em. A letter or a
 * digit is centred on its own ink. Anything else keeps its place on the line of a
 * lowercase letter: a comma stays low, an apostrophe high, and the two still read apart.
 */
export function baselineDrop(label: string): number {
  const ink = measure(label);
  return LETTER.test(label) ? (ink.up - ink.down) / 2 : halfX;
}

/**
 * Centres a label's ink in an element the page already centres by its text box:
 * the element is moved by the gap between where the box puts the baseline and where
 * the ink needs it. It reads `--ink` in its own `translate`, so a shape can add to it.
 */
export function setInk<T extends HTMLElement>(node: T, label: string): T {
  if (label.trim() === '') node.style.removeProperty('--ink');
  else node.style.setProperty('--ink', `${(baselineDrop(label) - boxDrop).toFixed(4)}em`);
  return node;
}
