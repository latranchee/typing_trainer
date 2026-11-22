import { el } from './dom';

const SVG = 'http://www.w3.org/2000/svg';

/** Three sliders: a line and its knob, three times. Drawn with the chevron's stroke. */
function slidersIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('class', 'menu-icon');
  svg.setAttribute('aria-hidden', 'true');
  for (const [y, knob] of [
    [4, 10.5],
    [8, 5.5],
    [12, 9],
  ]) {
    const line = document.createElementNS(SVG, 'path');
    line.setAttribute('d', `M2 ${y}h12`);
    line.setAttribute('fill', 'none');
    line.setAttribute('stroke', 'currentColor');
    line.setAttribute('stroke-width', '1.4');
    line.setAttribute('stroke-linecap', 'round');
    const dot = document.createElementNS(SVG, 'circle');
    dot.setAttribute('cx', String(knob));
    dot.setAttribute('cy', String(y));
    dot.setAttribute('r', '1.9');
    dot.setAttribute('fill', 'currentColor');
    svg.append(line, dot);
  }
  return svg;
}

/** A cross, drawn with the same stroke as the sliders. */
function closeIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('class', 'menu-icon');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG, 'path');
  path.setAttribute('d', 'M3.5 3.5l9 9M12.5 3.5l-9 9');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '1.4');
  path.setAttribute('stroke-linecap', 'round');
  svg.append(path);
  return svg;
}

/**
 * The settings panel and the button that opens it. The panel takes the place of
 * the right rail: the stage and the board stay in view, so a change shows at once.
 * It closes on its button, on Escape, on a click outside it, and when typing starts.
 */
export class Panel {
  readonly button = el('button.menu-btn.ctl', { type: 'button', 'aria-expanded': 'false', 'aria-controls': 'settings' });
  readonly root = el('section.settings', { id: 'settings', inert: true });
  /** The rows of the list. The app writes them. */
  readonly body = el('div.set-list');
  private label = el('span');
  /** On a phone the list is a sheet over the screen: its name and a button that closes it head it. */
  private title = el('h2.sheet-title');
  private closer = el('button.sheet-close.ctl', { type: 'button' }, closeIcon());
  private onToggle: (open: boolean) => void;

  /** `onToggle` runs after the panel opened or closed. */
  constructor(onToggle: (open: boolean) => void) {
    this.onToggle = onToggle;
    this.button.append(slidersIcon(), this.label);
    this.root.append(el('div.sheet-head', {}, this.title, this.closer), this.body);
    this.closer.addEventListener('click', () => this.close(true));

    this.button.addEventListener('click', (event) => {
      // A click from the keyboard has no pointer behind it: the focus then moves into the list.
      if (this.isOpen) this.close(true);
      else this.open(event.detail === 0);
    });
    this.root.addEventListener('keydown', (event) => {
      // A dropdown of the list closes itself on Escape and stops the key there.
      if (event.key === 'Escape' && this.isOpen) this.close(true);
    });
    document.addEventListener('pointerdown', (event) => {
      const target = event.target as Node;
      if (this.isOpen && !this.root.contains(target) && !this.button.contains(target)) this.close(false);
    });
  }

  get isOpen(): boolean {
    return this.button.getAttribute('aria-expanded') === 'true';
  }

  /** The button's word, the panel's name and the word of its close button, in the interface language. */
  relabel(button: string, region: string, close: string): void {
    this.label.textContent = button;
    this.title.textContent = region;
    this.root.setAttribute('aria-label', region);
    this.closer.setAttribute('aria-label', close);
  }

  open(focus = false): void {
    if (this.isOpen) return;
    this.button.setAttribute('aria-expanded', 'true');
    this.root.inert = false;
    this.onToggle(true);
    if (focus) this.root.querySelector<HTMLElement>('button')?.focus();
    else this.button.blur();
  }

  /** `release` hands the keyboard back to the drill. */
  close(release = false): void {
    if (!this.isOpen) return;
    const inside = this.root.contains(document.activeElement) || document.activeElement === this.button;
    this.button.setAttribute('aria-expanded', 'false');
    this.root.inert = true;
    if ((release || inside) && document.activeElement instanceof HTMLElement) document.activeElement.blur();
    this.onToggle(false);
  }
}
