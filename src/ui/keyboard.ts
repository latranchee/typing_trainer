import { fingerKind } from '../core/fingers';
import type { Layout } from '../core/layouts';
import { ROWS } from '../core/physical';
import { el, flash } from './dom';

export type KeyRole = 'next' | 'shift' | 'anchor';

/** Number-row keys carry a finger but stay quiet so the letter rows lead. */
const QUIET_ROW = 0;
/**
 * Fill strength per weakness step in the stats view. The first three steps are
 * dim enough for light legends, the last two bright enough for dark ones, so
 * every step keeps its legend readable and weak keys stand out.
 */
const HEAT_STEPS = [0.14, 0.24, 0.34, 0.82, 1];
const DIM_STEPS = 3;
/** Left edge of each lane, by home key: four fingers, the thumb gap over G and H, four fingers. */
const LANE_START_CODES = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon'];

/** The on-screen board: the selected layout's legends on the physical key positions. */
export class KeyboardView {
  readonly root = el('div.kb', { 'aria-hidden': 'true' });
  private keys = new Map<string, HTMLElement>();
  private marked: HTMLElement[] = [];

  constructor() {
    ROWS.forEach((row, rowIndex) => {
      const rowEl = el('div.kb-row');
      for (const key of row) {
        const keyEl = el('div.key', { 'data-code': key.code });
        keyEl.style.setProperty('--span', String(key.w * 4));
        if (rowIndex === QUIET_ROW) keyEl.classList.add('is-quiet');
        keyEl.append(el('div.cap'));
        this.keys.set(key.code, keyEl);
        rowEl.append(keyEl);
      }
      this.root.append(rowEl);
    });
  }

  setLayout(layout: Layout): void {
    for (const key of ROWS.flat()) {
      const keyEl = this.keys.get(key.code)!;
      const cap = keyEl.firstElementChild as HTMLElement;
      const legend = layout.legend(key.code);
      cap.replaceChildren();
      if (!legend) {
        keyEl.removeAttribute('data-f');
        cap.textContent = key.label ?? '';
        // Shift keys take the pinky colour when they become a target.
        if (key.code.startsWith('Shift')) keyEl.dataset.fTarget = 'pinky';
        continue;
      }
      keyEl.dataset.f = fingerKind(layout.fingerOf(key.code));
      if (legend.letter || legend.base === legend.shift) {
        cap.append(el('span.leg-base', {}, legend.base));
      } else {
        cap.append(el('span.leg-shift', {}, legend.shift), el('span.leg-base', {}, legend.base));
      }
    }
  }

  /** Mark the keys the drill wants next. Replaces the previous marks. */
  setTargets(targets: { code: string; role: KeyRole }[]): void {
    for (const keyEl of this.marked) {
      keyEl.classList.remove('is-next', 'is-shift', 'is-anchor');
      if (keyEl.dataset.fTarget) keyEl.removeAttribute('data-f');
    }
    this.marked = [];
    for (const { code, role } of targets) {
      const keyEl = this.keys.get(code);
      if (!keyEl) continue;
      if (keyEl.dataset.fTarget) keyEl.dataset.f = keyEl.dataset.fTarget;
      keyEl.classList.add(`is-${role}`);
      this.marked.push(keyEl);
    }
  }

  down(code: string): void {
    this.keys.get(code)?.classList.add('is-down');
  }

  up(code: string): void {
    this.keys.get(code)?.classList.remove('is-down');
  }

  wrong(code: string): void {
    const keyEl = this.keys.get(code);
    if (keyEl) flash(keyEl, 'is-wrong', 220);
  }

  /** Stats view: key strength follows how much work the key needs, on a fixed five-step ramp. */
  setHeat(weakness: ((code: string) => number) | null): void {
    for (const [code, keyEl] of this.keys) {
      if (!weakness) {
        keyEl.style.removeProperty('--heat');
        keyEl.classList.remove('is-dim');
        continue;
      }
      const step = Math.min(HEAT_STEPS.length - 1, Math.floor(weakness(code) * HEAT_STEPS.length));
      keyEl.style.setProperty('--heat', String(HEAT_STEPS[step]));
      keyEl.classList.toggle('is-dim', step < DIM_STEPS);
    }
  }

  /**
   * Highway geometry in viewport x. Notes fall on `centres`: each finger's home
   * key, and the middle of the two keys between the hands for the thumb. The
   * lanes share the boundaries between those keys, and the two pinky lanes run
   * out to the ends of the board, which is the pinkies' territory.
   */
  lanes(): { edges: number[]; centres: number[] } {
    const rects = LANE_START_CODES.map((code) => this.keys.get(code)!.getBoundingClientRect());
    const board = this.root.getBoundingClientRect();
    const edges = [board.left, ...rects.slice(1).map((rect) => rect.left), board.right];
    const centres = rects.map((rect, i) =>
      // The thumb lane starts at G and ends where J begins.
      i === 4 ? (rect.left + rects[5].left) / 2 : (rect.left + rect.right) / 2,
    );
    return { edges, centres };
  }
}
