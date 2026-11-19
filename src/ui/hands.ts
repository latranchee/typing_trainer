import handsPlate from '../../assets/plates/hands.png';
import type { Finger } from '../core/fingers';
import { FINGERS, fingerKind } from '../core/fingers';
import type { Row } from '../core/physical';
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

/**
 * Fingertip centres, measured on the hands plate for each hand. The drawn right
 * hand is not an exact mirror of the left (its fingers sit 17 to 25 plate pixels
 * further right), so mirroring the left hand's tips put its dots off the fingers.
 * Each tip sits 35 px under the top of its finger's matte, centred on the matte's top 30 px.
 */
const TIPS: Record<Finger, { x: number; y: number }> = {
  LP: { x: 111, y: 255 },
  LR: { x: 215, y: 149 },
  LM: { x: 320, y: 99 },
  LI: { x: 432, y: 149 },
  LT: { x: 583, y: 403 },
  RT: { x: 821, y: 404 },
  RI: { x: 969, y: 149 },
  RM: { x: 1079, y: 100 },
  RR: { x: 1192, y: 150 },
  RP: { x: 1293, y: 256 },
};

const tipOf = (finger: Finger): { x: number; y: number } => TIPS[finger];

/** Two hands. Each fingertip carries a dot in its finger color; the finger to use fills. */
export class HandsView {
  readonly root = el('div.hands', { 'aria-hidden': 'true' });
  private marks = new Map<Finger, HTMLElement[]>();
  private halos = new Map<Finger, HTMLElement>();

  constructor() {
    const dots: HTMLElement[] = [];
    for (const finger of FINGERS) {
      const kind = fingerKind(finger);
      const matte = el('span.finger-matte', { 'data-f': kind });
      matte.style.setProperty('--matte', `url("${matteOf(finger)}")`);
      const tip = tipOf(finger);
      const x = `${(tip.x / PLATE_W) * 100}%`;
      const y = `${(tip.y / PLATE_H) * 100}%`;
      const dot = el('span.fingertip', { 'data-f': kind });
      dot.style.setProperty('--x', x);
      dot.style.setProperty('--y', y);
      // A soft light around the fingertip, for a finger that is ahead of its own average.
      const halo = el('span.finger-halo', { 'data-f': kind });
      halo.style.setProperty('--x', x);
      halo.style.setProperty('--y', y);
      this.marks.set(finger, [matte, dot]);
      this.halos.set(finger, halo);
      // Fills and halos sit under the outline so the drawn line stays crisp over them.
      this.root.append(halo, matte);
      dots.push(dot);
    }
    this.root.append(el('img.hands-plate', { src: handsPlate, alt: '', draggable: 'false' }), ...dots);
  }

  /** Lights the halo of each finger that is ahead of its own average in this set. */
  setHot(fingers: ReadonlySet<Finger>): void {
    for (const [finger, halo] of this.halos) halo.classList.toggle('is-hot', fingers.has(finger));
  }

  /** Light the fingers to use. Each fills in the shade of the row it is about to reach. */
  setActive(reaches: { finger: Finger; row: Row }[]): void {
    for (const [finger, marks] of this.marks) {
      const reach = reaches.find((candidate) => candidate.finger === finger);
      for (const mark of marks) {
        mark.classList.toggle('is-active', reach !== undefined);
        // Only the fill takes the row's shade: the fingertip dot keeps the finger's own color.
        // The shade stays through the fade-out so a released finger does not flick back.
        if (reach && mark.classList.contains('finger-matte')) mark.dataset.row = reach.row;
      }
    }
  }
}
