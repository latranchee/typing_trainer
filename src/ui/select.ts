import { el } from './dom';

export interface SelectOption {
  value: string;
  label: string;
}

const CHEVRON = 'M1 3l4 4 4-4';

/** A small listbox dropdown. Arrow keys move, Enter picks, Escape closes. */
export class Select {
  readonly root = el('div.select');
  private button = el('button.select-btn.ctl', { type: 'button', 'aria-haspopup': 'listbox', 'aria-expanded': 'false' });
  private label = el('span');
  private menu = el('ul.select-menu', { role: 'listbox', tabindex: '-1' });
  private items: HTMLButtonElement[] = [];
  private cursor = 0;
  private options: SelectOption[];
  private value: string;
  private onChange: (value: string) => void;

  constructor(name: string, options: SelectOption[], value: string, onChange: (value: string) => void) {
    this.options = options;
    this.value = value;
    this.onChange = onChange;
    this.button.setAttribute('aria-label', name);
    this.menu.setAttribute('aria-label', name);

    const chevron = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    chevron.setAttribute('viewBox', '0 0 10 10');
    chevron.setAttribute('class', 'select-chevron');
    chevron.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', CHEVRON);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '1.4');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    chevron.append(path);

    this.button.append(this.label, chevron);
    for (const option of options) {
      const item = el('button.select-option.ctl', { type: 'button', role: 'option', tabindex: '-1' }, option.label);
      item.addEventListener('click', () => this.pick(option.value));
      this.items.push(item);
      this.menu.append(el('li', { role: 'presentation' }, item));
    }
    this.root.append(this.button, this.menu);
    this.render();

    this.button.addEventListener('click', () => this.toggle());
    this.root.addEventListener('keydown', (event) => this.onKey(event));
    document.addEventListener('pointerdown', (event) => {
      if (this.isOpen && !this.root.contains(event.target as Node)) this.close(false);
    });
  }

  get isOpen(): boolean {
    return this.root.classList.contains('is-open');
  }

  set(value: string): void {
    this.value = value;
    this.render();
  }

  private render(): void {
    const current = this.options.find((option) => option.value === this.value) ?? this.options[0];
    this.label.textContent = current.label;
    this.items.forEach((item, i) => {
      item.setAttribute('aria-selected', String(this.options[i].value === this.value));
      item.classList.toggle('is-cursor', this.isOpen && i === this.cursor);
    });
  }

  private toggle(): void {
    if (this.isOpen) this.close(true);
    else this.open();
  }

  private open(): void {
    this.cursor = Math.max(0, this.options.findIndex((option) => option.value === this.value));
    this.root.classList.add('is-open');
    this.button.setAttribute('aria-expanded', 'true');
    this.render();
    this.items[this.cursor].focus();
  }

  /** `release` hands the keyboard back to the drill. */
  private close(release: boolean): void {
    this.root.classList.remove('is-open');
    this.button.setAttribute('aria-expanded', 'false');
    this.render();
    if (release && this.root.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
  }

  private pick(value: string): void {
    const changed = value !== this.value;
    this.value = value;
    this.close(true);
    if (changed) this.onChange(value);
  }

  private onKey(event: KeyboardEvent): void {
    if (!this.isOpen) return;
    const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    if (step !== 0) {
      event.preventDefault();
      this.cursor = (this.cursor + step + this.items.length) % this.items.length;
      this.render();
      this.items[this.cursor].focus();
    } else if (event.key === 'Escape' || event.key === 'Tab') {
      event.preventDefault();
      event.stopPropagation();
      this.close(true);
    }
  }
}
