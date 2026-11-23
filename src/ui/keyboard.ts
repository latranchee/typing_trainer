import { fingerKind } from '../core/fingers';
import { fingerName, t } from '../core/i18n';
import type { Layout } from '../core/layouts';
import type { Board } from '../core/physical';
import { ROW_IDS, rowsOf } from '../core/physical';
import { css, el, flash } from './dom';

/** `erase`: hardcore's Backspace, waiting for typos to be erased. */
export type KeyRole = 'next' | 'shift' | 'anchor' | 'erase';

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

/** The on-screen board: the selected layout's legends on the keys of the board on the desk. */
export class KeyboardView {
  readonly root = el('div.kb', { 'aria-hidden': 'true' });
  private keys = new Map<string, HTMLElement>();
  private marked: HTMLElement[] = [];
  private board: Board | null = null;
  private layout: Layout | null = null;
  private picker: ((code: string) => void) | null = null;
  private picked: string | null = null;
  /** Keys whose Shift character differs from the one printed big, and whether it is the capital of a letter. */
  private alts = new Map<string, boolean>();
  /** The modifiers that change what the keys type, as the last key event left them. */
  private shift = false;
  private caps = false;

  constructor() {
    const pick = (event: Event): void => {
      const keyEl = (event.target as Element).closest<HTMLElement>('.key[data-f]');
      if (this.picker && keyEl?.dataset.code) this.picker(keyEl.dataset.code);
    };
    this.root.addEventListener('click', pick);
    this.root.addEventListener('keydown', (event) => {
      if (!this.picker || (event.key !== 'Enter' && event.key !== ' ')) return;
      event.preventDefault();
      pick(event);
    });
    this.setBoard('ansi');

    // The board shows what the keys type right now: Shift and Caps Lock are read off every key event,
    // whichever drill is open, so the board follows them even when a press reaches no drill.
    const read = (event: KeyboardEvent): void => this.setLayer(event.getModifierState('Shift'), event.getModifierState('CapsLock'));
    window.addEventListener('keydown', read, true);
    window.addEventListener('keyup', read, true);
    // A Shift let go in another window never comes back as a keyup here.
    window.addEventListener('blur', () => this.setLayer(false, this.caps));
  }

  /** Draws the keys of a board. The legends, the targets and the heat are set again by the caller. */
  setBoard(board: Board): void {
    if (board === this.board) return;
    this.board = board;
    this.root.dataset.board = board;
    this.keys.clear();
    this.alts.clear();
    this.marked = [];
    this.root.replaceChildren(
      ...rowsOf(board).map((row, rowIndex) => {
        // The row sets the shade of its keys and the legend mark beside it.
        const rowEl = el('div.kb-row', { 'data-row': ROW_IDS[rowIndex] });
        let left = 0;
        for (const key of row) {
          const keyEl = el('div.key', { 'data-code': key.code, 'data-row': ROW_IDS[rowIndex] });
          keyEl.style.setProperty('--span', String(key.w * 4));
          // Where the key's middle sits across the board, 0 at the left edge and 1 at the right: the wave travels by it.
          keyEl.style.setProperty('--x', ((left + key.w / 2) / 15).toFixed(3));
          left += key.w;
          if (rowIndex === QUIET_ROW) keyEl.classList.add('is-quiet');
          // A tall key reaches into the row below, where it is `--tail` of its own width.
          if (key.tail) {
            keyEl.classList.add('is-tall');
            keyEl.style.setProperty('--tail', (key.tail / key.w).toFixed(4));
          }
          // A word on a key one unit wide is set smaller.
          if (key.label && key.w <= 1) keyEl.classList.add('is-tight');
          keyEl.append(el('div.cap'));
          this.keys.set(key.code, keyEl);
          rowEl.append(keyEl);
        }
        return rowEl;
      }),
    );
  }

  setLayout(layout: Layout): void {
    this.layout = layout;
    this.setBoard(layout.board);
    this.alts.clear();
    for (const key of rowsOf(layout.board).flat()) {
      const keyEl = this.keys.get(key.code)!;
      const cap = keyEl.firstElementChild as HTMLElement;
      const legend = layout.legend(key.code);
      cap.replaceChildren();
      if (!legend) {
        keyEl.removeAttribute('data-f');
        cap.textContent = key.label ? (t.keyCaps[key.label] ?? key.label) : '';
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
      // What the key types with Shift, alone and full size: shown while the layer is up.
      if (legend.base !== legend.shift) {
        cap.append(el('span.leg-alt', {}, legend.shift));
        this.alts.set(key.code, legend.letter);
      }
    }
    this.paintLayer();
  }

  /**
   * Shift up: every key shows its Shift character. Caps Lock: letters show their capital, other keys
   * keep their own. Both: letters fall back to small, the other keys stay shifted, as on the desk.
   */
  setLayer(shift: boolean, caps: boolean): void {
    if (shift === this.shift && caps === this.caps) return;
    this.shift = shift;
    this.caps = caps;
    this.paintLayer();
  }

  private paintLayer(): void {
    for (const [code, letter] of this.alts) this.keys.get(code)?.classList.toggle('is-alt', letter ? this.shift !== this.caps : this.shift);
    this.keys.get('CapsLock')?.classList.toggle('is-locked', this.caps);
  }

  /** Mark the keys the drill wants next. Replaces the previous marks. */
  setTargets(targets: { code: string; role: KeyRole }[]): void {
    for (const keyEl of this.marked) {
      keyEl.classList.remove('is-next', 'is-shift', 'is-anchor', 'is-erase');
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

  /** A record fell: one wave runs across the board, left to right, each cap lifting as it passes. */
  cheer(): void {
    flash(this.root, 'is-cheering', 900);
  }

  /** Where a key's cap is on screen, and the color it carries: its finger's hue in its row's shade, grey for a key with no finger. */
  capOf(code: string): { box: DOMRect; color: string } | null {
    const keyEl = this.keys.get(code);
    const cap = keyEl?.firstElementChild;
    if (!keyEl || !cap) return null;
    return { box: cap.getBoundingClientRect(), color: getComputedStyle(keyEl).getPropertyValue('--f').trim() || css('--text-2') };
  }

  /**
   * Stats view: key strength follows how much work the key needs, on a fixed
   * five-step ramp. Row shades switch off there, so brightness means one thing.
   */
  setHeat(weakness: ((code: string) => number) | null): void {
    this.root.classList.toggle('is-heat', weakness !== null);
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
   * Stats view: with a picker, every key that has a finger becomes a button, and
   * `picked` is the one shown as chosen. Without one the board is a picture again.
   */
  setPicker(picker: ((code: string) => void) | null, picked: string | null = null): void {
    this.picker = picker;
    this.picked = picker ? picked : null;
    this.root.classList.toggle('is-pick', picker !== null);
    if (picker) this.root.removeAttribute('aria-hidden');
    else {
      if (this.root.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
      this.root.setAttribute('aria-hidden', 'true');
    }
    for (const [code, keyEl] of this.keys) {
      const on = picker !== null && keyEl.hasAttribute('data-f') && !keyEl.dataset.fTarget;
      keyEl.classList.toggle('is-picked', on && code === this.picked);
      if (!on) {
        for (const name of ['role', 'tabindex', 'aria-label', 'aria-pressed']) keyEl.removeAttribute(name);
        continue;
      }
      const label = code === 'Space' ? t.keyboard.space : t.keyboard.key(this.layout?.legend(code)?.base ?? code);
      keyEl.setAttribute('role', 'button');
      keyEl.setAttribute('tabindex', '0');
      keyEl.setAttribute('aria-label', this.layout ? `${label}, ${fingerName(this.layout.fingerOf(code))}` : label);
      keyEl.setAttribute('aria-pressed', String(code === this.picked));
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
