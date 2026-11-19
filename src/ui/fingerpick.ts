import type { FingerKind } from '../core/fingers';
import { fingerHand, fingerKind } from '../core/fingers';
import type { TypingFinger } from '../core/generator';
import { TYPING_FINGERS } from '../core/generator';
import { fingerName, t } from '../core/i18n';
import { el } from './dom';

/** How tall each finger stands against the middle one: the proportions of the mark beside the name. */
const HEIGHT: Record<FingerKind, number> = { pinky: 0.56, ring: 0.89, middle: 1, index: 0.78, thumb: 0 };

/**
 * The fingers to train more: two hands of four bars, the mark's own shape. A lit
 * bar is a finger whose letters come up more often. Each bar is a button.
 */
export class FingerPick {
  readonly root = el('div.fpick', { role: 'group' });
  private bars = new Map<TypingFinger, HTMLButtonElement>();
  private lit = new Set<TypingFinger>();

  /** `onChange` gets the lit fingers, left pinky to right pinky. */
  constructor(onChange: (fingers: TypingFinger[]) => void) {
    for (const hand of ['left', 'right'] as const) {
      const group = el('div.fpick-hand');
      for (const finger of TYPING_FINGERS.filter((candidate) => fingerHand(candidate) === hand)) {
        const kind = fingerKind(finger);
        const stem = el('span');
        stem.style.setProperty('--h', String(HEIGHT[kind]));
        const bar = el('button.fpick-bar.ctl', { type: 'button', 'data-f': kind, 'aria-pressed': 'false' }, stem);
        bar.addEventListener('click', () => {
          if (this.lit.has(finger)) this.lit.delete(finger);
          else this.lit.add(finger);
          bar.blur();
          this.paint();
          onChange(TYPING_FINGERS.filter((candidate) => this.lit.has(candidate)));
        });
        this.bars.set(finger, bar);
        group.append(bar);
      }
      this.root.append(group);
    }
    this.paint();
  }

  set(fingers: readonly TypingFinger[]): void {
    this.lit = new Set(fingers);
    this.paint();
  }

  /** Writes each bar's state and its name in the interface language. */
  paint(): void {
    this.root.setAttribute('aria-label', t.menu.focusGroup);
    for (const [finger, bar] of this.bars) {
      const on = this.lit.has(finger);
      bar.setAttribute('aria-pressed', String(on));
      bar.setAttribute('aria-label', fingerName(finger));
      bar.title = on ? t.menu.focusOn(fingerName(finger)) : t.menu.focusOff(fingerName(finger));
    }
  }
}
