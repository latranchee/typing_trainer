const SVG = 'http://www.w3.org/2000/svg';

/** Index, middle, ring, pinky: x, top and height on the favicon's 32-unit grid. */
const FINGERS: ReadonlyArray<readonly [x: number, y: number, height: number]> = [
  [6, 10, 14],
  [12, 6, 18],
  [18, 8, 16],
  [24, 14, 10],
];

/**
 * The brand mark: four fingers of one hand standing on the text baseline,
 * the little one lit in the pinky's color. Same geometry as public/favicon.svg,
 * without the tile.
 */
export function brandMark(): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('class', 'mark');
  svg.setAttribute('viewBox', '6 6 22 18');
  svg.setAttribute('aria-hidden', 'true');
  FINGERS.forEach(([x, y, height], index) => {
    const bar = document.createElementNS(SVG, 'rect');
    bar.setAttribute('x', String(x));
    bar.setAttribute('y', String(y));
    bar.setAttribute('width', '4');
    bar.setAttribute('height', String(height));
    bar.setAttribute('rx', '2');
    if (index === FINGERS.length - 1) bar.setAttribute('class', 'mark-pinky');
    svg.append(bar);
  });
  return svg;
}
