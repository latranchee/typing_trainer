import type { NameProblem, Store } from '../core/store';
import { NAME_LIMIT } from '../core/store';
import { el } from './dom';

const CHEVRON = 'M1 3l4 4 4-4';
const PROBLEMS: Record<NameProblem, string> = {
  empty: 'type a name first',
  taken: 'that name is taken: pick another',
};

type Mode = 'list' | 'new' | 'rename' | 'delete';

/**
 * The profile switcher: who is typing. Each profile keeps its own options and
 * numbers. The popover also adds, renames and deletes profiles in place.
 */
export class ProfileMenu {
  readonly root = el('div.select.profile');
  private button = el('button.select-btn.ctl', { type: 'button', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'aria-label': 'profile' });
  private label = el('span');
  private menu = el('div.select-menu.profile-menu', { role: 'dialog', 'aria-label': 'profiles' });
  private store: Store;
  private onChange: () => void;
  private mode: Mode = 'list';

  /** `onChange` runs after the active profile changed, so the app can load its options and numbers. */
  constructor(store: Store, onChange: () => void) {
    this.store = store;
    this.onChange = onChange;

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
    this.root.append(this.button, this.menu);
    this.refresh();

    this.button.addEventListener('click', () => (this.isOpen ? this.close(true) : this.open()));
    this.root.addEventListener('keydown', (event) => this.onKey(event));
    document.addEventListener('pointerdown', (event) => {
      if (this.isOpen && !this.root.contains(event.target as Node)) this.close(false);
    });
    // Tabbing out of the popover closes it.
    this.root.addEventListener('focusout', (event) => {
      if (this.isOpen && event.relatedTarget instanceof Node && !this.root.contains(event.relatedTarget)) this.close(false);
    });
  }

  get isOpen(): boolean {
    return this.root.classList.contains('is-open');
  }

  /** Show the active profile's name. Call after the store changed behind the menu's back. */
  refresh(): void {
    this.label.textContent = this.store.profileName;
    this.button.title = `profile: ${this.store.profileName}`;
  }

  private open(): void {
    this.root.classList.add('is-open');
    this.button.setAttribute('aria-expanded', 'true');
    this.show('list');
    this.menu.querySelector<HTMLElement>('[aria-current="true"]')?.focus();
  }

  /** `release` hands the keyboard back to the drill. */
  private close(release: boolean): void {
    this.root.classList.remove('is-open');
    this.button.setAttribute('aria-expanded', 'false');
    if (release && this.root.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
  }

  private action(label: string, run: () => void): HTMLButtonElement {
    const button = el('button.select-option.ctl', { type: 'button' }, label);
    button.addEventListener('click', run);
    return button;
  }

  private show(mode: Mode): void {
    this.mode = mode;
    const { store } = this;
    const name = store.profileName;

    const list = el('div.profile-list', { role: 'group', 'aria-label': 'switch profile' });
    for (const profile of store.profiles) {
      const current = profile.id === store.profileId;
      const item = el('button.select-option.ctl', { type: 'button', 'aria-current': String(current) }, profile.name);
      item.addEventListener('click', () => {
        this.close(true);
        if (current) return;
        store.switchProfile(profile.id);
        this.refresh();
        this.onChange();
      });
      list.append(item);
    }

    const tools = el('div.profile-tools');
    if (mode === 'list') {
      tools.append(
        this.action('new profile', () => this.show('new')),
        this.action(`rename ${name}`, () => this.show('rename')),
      );
      // The last profile stays: there is always someone typing.
      if (store.profiles.length > 1) tools.append(this.action(`delete ${name}`, () => this.show('delete')));
    } else if (mode === 'delete') {
      const keep = el('button.profile-go.ctl', { type: 'button' }, 'keep');
      const gone = el('button.profile-go.ctl', { type: 'button' }, 'delete');
      keep.addEventListener('click', () => this.back());
      gone.addEventListener('click', () => {
        store.deleteProfile();
        this.close(true);
        this.refresh();
        this.onChange();
      });
      tools.append(el('p.profile-ask', {}, `delete ${name} and every number saved for it?`), el('div.profile-confirm', {}, keep, gone));
    } else {
      const adding = mode === 'new';
      const input = el('input.profile-input', {
        type: 'text',
        maxlength: NAME_LIMIT,
        autocomplete: 'off',
        spellcheck: 'false',
        placeholder: 'name',
        'aria-label': adding ? 'name of the new profile' : `new name for ${name}`,
      });
      if (!adding) input.value = name;
      const message = el('p.profile-msg', { role: 'status' }, adding ? 'starts with the current options and no numbers' : '');
      const form = el('form.profile-form', {}, input, el('button.profile-go.ctl', { type: 'submit' }, adding ? 'add' : 'save'), message);
      input.addEventListener('input', () => input.classList.remove('is-bad'));
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const problem = adding ? store.addProfile(input.value) : store.renameProfile(input.value);
        if (problem) {
          input.classList.add('is-bad');
          message.textContent = PROBLEMS[problem];
          input.focus();
          return;
        }
        this.close(true);
        this.refresh();
        if (adding) this.onChange();
      });
      tools.append(form);
    }

    this.menu.replaceChildren(list, el('div.profile-rule', { 'aria-hidden': 'true' }), tools);
    if (mode === 'delete') tools.querySelector<HTMLElement>('button')?.focus();
    const field = tools.querySelector('input');
    if (field) {
      field.focus();
      field.select();
    }
  }

  /** From a form or the delete question back to the list, with the focus on the first action. */
  private back(): void {
    this.show('list');
    this.menu.querySelector<HTMLElement>('.profile-tools button')?.focus();
  }

  private onKey(event: KeyboardEvent): void {
    if (!this.isOpen) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (this.mode === 'list') this.close(true);
      else this.back();
      return;
    }
    const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    if (step === 0 || document.activeElement instanceof HTMLInputElement) return;
    const stops = [...this.menu.querySelectorAll<HTMLElement>('button')];
    if (stops.length === 0) return;
    event.preventDefault();
    const at = stops.indexOf(document.activeElement as HTMLElement);
    stops[(at + step + stops.length) % stops.length].focus();
  }
}
