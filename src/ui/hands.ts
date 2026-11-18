import handsPlate from '../../assets/plates/hands.png';
import type { Finger } from '../core/fingers';
import { FINGERS, fingerKind } from '../core/fingers';
import { el } from './dom';

/** Plate size the fingertip coordinates are measured in. */
const PLATE_W = 1383;
const PLATE_H = 856;

/** One fill matte per finger, cut from the hands plate so the fill follows the drawn contour. */
const MATTES = import.meta.glob<string>('../../assets/plates/fingers/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});
const matteOf = (finger: Finger): string => MATTES[`../../assets/plates/fingers/${finger}.png`];

/** Fingertip centres, measured on the hands plate. The right hand mirrors the left. */
const LEFT_TIPS: Partial<Record<Finger, { x: number; y: number }>> = {
  LP: { x: 111, y: 255 },
  LR: { x: 215, y: 149 },
  LM: { x: 320, y: 99 },
  LI: { x: 432, y: 149 },
  LT: { x: 583, y: 403 },
};
const MIRROR: Partial<Record<Finger, Finger>> = { RT: 'LT', RI: 'LI', RM: 'LM', RR: 'LR', RP: 'LP' };

const tipOf = (finger: Finger): { x: number; y: number } => {
  const twin = MIRROR[finger];
  if (!twin) return LEFT_TIPS[finger]!;
  const left = LEFT_TIPS[twin]!;
  return { x: PLATE_W - 1 - left.x, y: left.y };
};

/** Two hands. Each fingertip carries a dot in its finger color; the finger to use fills. */
export class HandsView {
  readonly root = el('div.hands', { 'aria-hidden': 'true' });
  private marks = new Map<Finger, HTMLElement[]>();

  constructor() {
    const dots: HTMLElement[] = [];
    for (const finger of FINGERS) {
      const kind = fingerKind(finger);
      const matte = el('span.finger-matte', { 'data-f': kind });
      matte.style.setProperty('--matte', `url("${matteOf(finger)}")`);
      const tip = tipOf(finger);
      const dot = el('span.fingertip', { 'data-f': kind });
      dot.style.setProperty('--x', `${(tip.x / PLATE_W) * 100}%`);
      dot.style.setProperty('--y', `${(tip.y / PLATE_H) * 100}%`);
      this.marks.set(finger, [matte, dot]);
      // Fills sit under the outline so the drawn line stays crisp over them.
      this.root.append(matte);
      dots.push(dot);
    }
    this.root.append(el('img.hands-plate', { src: handsPlate, alt: '', draggable: 'false' }), ...dots);
  }

  setActive(fingers: Finger[]): void {
    for (const [finger, marks] of this.marks) {
      const active = fingers.includes(finger);
      for (const mark of marks) mark.classList.toggle('is-active', active);
    }
  }
}
