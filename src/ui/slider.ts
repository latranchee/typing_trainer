import type { Axis } from '../core/font';
import { el } from './dom';

export interface SliderOptions {
  name: string;
  axis: Axis;
  value: number;
  /** While the thumb moves: a live preview, nothing saved. */
  onInput: (value: number) => void;
  /** Once it is let go: the value to keep. */
  onChange: (value: number) => void;
}

/**
 * A range with its value beside it. It lives on between redraws of the settings list,
 * so a drag is never cut short by a redraw.
 */
export class Slider {
  readonly root = el('div.slider');
  private input: HTMLInputElement;
  private out = el('output.slider-value');
  private pointer = false;

  constructor(options: SliderOptions) {
    const { axis } = options;
    this.input = el('input.slider-input', { type: 'range', min: axis.min, max: axis.max, step: axis.step });
    this.input.value = String(options.value);
    this.root.append(this.input, this.out);
    this.relabel(options.name);
    this.paint();
    this.input.addEventListener('pointerdown', () => {
      this.pointer = true;
    });
    this.input.addEventListener('input', () => {
      this.paint();
      options.onInput(this.value);
    });
    this.input.addEventListener('change', () => {
      options.onChange(this.value);
      // Let go after a drag, the keys go back to the drill; arrow keys keep the focus here.
      if (this.pointer) this.input.blur();
      this.pointer = false;
    });
  }

  get value(): number {
    return Number(this.input.value);
  }

  /** Moves the thumb. `display` stands in for the number (the optical size's "auto"). */
  set(value: number, display: string | null = null): void {
    this.input.value = String(value);
    this.paint(display);
  }

  /** Shows `display` in place of the number, or the number again with null. */
  show(display: string | null): void {
    this.paint(display);
  }

  relabel(name: string): void {
    this.input.setAttribute('aria-label', name);
  }

  private paint(display: string | null = null): void {
    const min = Number(this.input.min);
    const max = Number(this.input.max);
    this.input.style.setProperty('--fill', `${((this.value - min) / (max - min)) * 100}%`);
    this.root.dataset.auto = String(display !== null);
    this.out.textContent = display ?? String(this.value);
    this.input.setAttribute('aria-valuetext', display ?? String(this.value));
  }
}
