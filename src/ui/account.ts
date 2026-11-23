import { o } from '../core/i18n';
import type { SizeKind, SwitchKind } from '../core/keyboards';
import { MODEL_MAX, SIZE_KINDS, SWITCH_KINDS, SWITCH_NAMES } from '../core/keyboards';
import type { Lang } from '../core/lang';
import { HANDLE } from '../core/online';
import { ApiError, api } from '../net/api';
import type { Online } from '../net/online';
import { el } from './dom';
import { Select } from './select';

type Step = 'email' | 'code';

const errorText = (error: unknown): string => {
  const code = error instanceof ApiError ? error.code : 'default';
  return o.errors[code] ?? o.errors.default;
};

/**
 * The account, alone in the settings panel. Signed out: an email, then the code or the
 * link it brings. Signed in: the public name, the keyboard, signing out and deleting.
 * One column of labelled fields; its element lives on between redraws, so a half-typed
 * field stays.
 */
export class AccountView {
  readonly root = el('div.acct');
  private online: Online;
  private lang: () => Lang;
  private step: Step = 'email';
  private email = '';
  private echo: { link: string; code: string } | null = null;
  private busy = false;
  private message = '';
  private confirming = false;
  private suggestTimer: ReturnType<typeof setTimeout> | null = null;
  /** Kept between redraws: the fields the typist is filling in. */
  private emailInput = el('input.profile-input.acct-input', { id: 'acct-email', type: 'email', autocomplete: 'email', inputmode: 'email', spellcheck: 'false', maxlength: '254' });
  private codeInput = el('input.profile-input.acct-input.is-code', { id: 'acct-code', type: 'text', autocomplete: 'one-time-code', inputmode: 'numeric', maxlength: '7', spellcheck: 'false' });
  private handleInput = el('input.profile-input.acct-input', { id: 'acct-handle', type: 'text', autocomplete: 'username', spellcheck: 'false', autocapitalize: 'none', maxlength: '20' });
  private modelInput = el('input.profile-input.acct-input', { id: 'acct-model', type: 'text', autocomplete: 'off', spellcheck: 'false', list: 'acct-models', maxlength: String(MODEL_MAX) });
  private models = el('datalist', { id: 'acct-models' });

  constructor(online: Online, lang: () => Lang) {
    this.online = online;
    this.lang = lang;
    online.onChange(() => {
      if (online.account) {
        this.step = 'email';
        this.echo = null;
      }
      this.render();
    });
    this.modelInput.addEventListener('input', () => this.suggest());
    this.modelInput.addEventListener('change', () => void this.saveKeyboard({ model: this.modelInput.value }));
    this.render();
  }

  /** The keyboard focus is inside the group: the settings must not close under it. */
  get isEditing(): boolean {
    return this.root.contains(document.activeElement) && document.activeElement instanceof HTMLInputElement;
  }

  /** Puts the cursor in the first field, for the top strip's account button. */
  focus(): void {
    const field = this.online.account ? (this.online.account.handle ? null : this.handleInput) : this.step === 'code' ? this.codeInput : this.emailInput;
    field?.focus({ preventScroll: false });
    this.root.scrollIntoView({ block: 'nearest' });
  }

  render(): void {
    const { online } = this;
    this.root.hidden = !online.available;
    if (!online.available) {
      this.root.replaceChildren();
      return;
    }
    const parts = online.account ? this.signedIn() : this.signedOut();
    parts.push(el('p.acct-foot', {}, el('a.acct-link.ctl', { href: `./privacy/#${this.lang()}`, target: '_blank', rel: 'noopener' }, o.privacy)));
    this.root.replaceChildren(...parts, this.models);
  }

  /** What this step is, and one line on it. */
  private head(title: string, lede: HTMLElement | string): HTMLElement {
    return el('header.acct-head', {}, el('h3.acct-title', {}, title), el('p.acct-lede', {}, lede));
  }

  /** A label over its control. `id` ties the label to an input; a dropdown carries its own name. */
  private field(id: string | null, label: string, ...controls: (HTMLElement | null)[]): HTMLElement {
    const name = id ? el('label.acct-label', { for: id }, label) : el('span.acct-label', { 'aria-hidden': 'true' }, label);
    return el('div.acct-field', {}, name, ...controls);
  }

  private button(label: string, run: () => void, kind: 'quiet' | 'danger' = 'quiet'): HTMLButtonElement {
    const button = el(kind === 'danger' ? 'button.acct-danger.ctl' : 'button.acct-quiet.ctl', { type: 'button' }, label);
    if (this.busy && kind === 'danger') button.disabled = true;
    button.addEventListener('click', run);
    return button;
  }

  /** A form sent by one full-width button under its field. */
  private form(field: HTMLElement, label: string, run: () => void): HTMLFormElement {
    const form = el('form.acct-form', { novalidate: true }, field, el('button.acct-go.ctl', { type: 'submit', disabled: this.busy }, label));
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      run();
    });
    return form;
  }

  private note(text: string, tone: 'plain' | 'error' | 'ok' = 'plain'): HTMLElement {
    return el(`p.acct-note${tone === 'plain' ? '' : `.is-${tone}`}`, { role: tone === 'error' ? 'alert' : tone === 'ok' ? 'status' : null }, text);
  }

  private signedOut(): HTMLElement[] {
    const parts: HTMLElement[] = [];
    if (this.step === 'email') {
      this.emailInput.placeholder = o.emailPlaceholder;
      parts.push(
        this.head(o.signIn, o.pitch),
        this.form(this.field('acct-email', o.email, this.emailInput), this.busy ? o.sending : o.send, () => void this.send()),
      );
      if (this.message) parts.push(this.note(this.message, 'error'));
      parts.push(this.note(o.noPassword));
    } else {
      this.codeInput.placeholder = '000000';
      parts.push(this.head(o.checkMail, o.sent(this.email)), this.form(this.field('acct-code', o.code, this.codeInput), o.enter, () => void this.enterCode()));
      if (this.message) parts.push(this.note(this.message, 'error'));
      // Without a mail server the Worker hands the code back: the local page shows it, the live one never gets it.
      if (this.echo) parts.push(this.note(`dev · ${this.echo.code}`));
      parts.push(
        el(
          'div.acct-actions',
          {},
          this.button(o.otherEmail, () => {
            this.step = 'email';
            this.message = '';
            this.render();
            this.emailInput.focus();
          }),
        ),
      );
    }
    return parts;
  }

  private signedIn(): HTMLElement[] {
    const account = this.online.account!;
    const parts: HTMLElement[] = [this.head(account.handle ?? o.account, el('span.acct-who', { title: account.email }, `${o.signedIn} ${account.email}`))];

    if (document.activeElement !== this.handleInput) this.handleInput.value = account.handle ?? '';
    const save = el('button.acct-save.ctl', { type: 'submit', disabled: this.busy }, o.save);
    const name = el('form.acct-form', { novalidate: true }, this.field('acct-handle', o.handle, el('div.acct-pair', {}, this.handleInput, save)), this.note(account.handle ? o.handleRule : o.handlePrompt, account.handle ? 'plain' : 'ok'));
    name.addEventListener('submit', (event) => {
      event.preventDefault();
      void this.saveHandle();
    });
    parts.push(name);

    if (document.activeElement !== this.modelInput) this.modelInput.value = account.keyboard.model ?? '';
    this.modelInput.placeholder = o.modelPlaceholder;
    const switches = new Select(
      o.switchKind,
      [{ value: '', label: o.notSet }, ...SWITCH_KINDS.map((kind) => ({ value: kind as string, label: SWITCH_NAMES[kind] }))],
      account.keyboard.switch ?? '',
      (value) => void this.saveKeyboard({ switch: (value || null) as SwitchKind | null }),
    );
    const sizes = new Select(
      o.size,
      [{ value: '', label: o.notSet }, ...SIZE_KINDS.map((kind) => ({ value: kind as string, label: o.sizes[kind] }))],
      account.keyboard.size ?? '',
      (value) => void this.saveKeyboard({ size: (value || null) as SizeKind | null }),
    );
    parts.push(
      el(
        'div.acct-group',
        {},
        this.field('acct-model', o.keyboard, this.modelInput),
        el('div.acct-two', {}, this.field(null, o.switchKind, switches.root), this.field(null, o.size, sizes.root)),
        this.note(o.keyboardNote),
      ),
    );
    if (this.message) parts.push(this.note(this.message, this.message === o.saved ? 'ok' : 'error'));

    const other = this.online.otherProfile;
    if (other) parts.push(el('div.acct-group', {}, this.note(o.otherProfile(other)), el('div.acct-actions', {}, this.button(o.followHere, () => this.online.bind()))));

    if (this.confirming) {
      parts.push(
        el(
          'div.acct-group.acct-end',
          {},
          this.note(o.removeNote, 'error'),
          el(
            'div.acct-actions',
            {},
            this.button(o.removeSure, () => void this.remove(), 'danger'),
            this.button(o.keep, () => {
              this.confirming = false;
              this.render();
            }),
          ),
        ),
      );
    } else {
      parts.push(
        el(
          'div.acct-group.acct-end',
          {},
          el(
            'div.acct-actions',
            {},
            this.button(o.signOut, () => void this.online.signOut()),
            this.button(o.remove, () => {
              this.confirming = true;
              this.render();
            }),
          ),
        ),
      );
    }
    return parts;
  }

  private async run(task: () => Promise<void>): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.message = '';
    this.render();
    try {
      await task();
    } catch (error) {
      this.message = errorText(error);
    } finally {
      this.busy = false;
      this.render();
    }
  }

  private async send(): Promise<void> {
    const email = this.emailInput.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.message = o.errors['bad-email'];
      this.render();
      this.emailInput.focus();
      return;
    }
    await this.run(async () => {
      this.echo = await this.online.startSignIn(email, this.lang());
      this.email = email;
      this.step = 'code';
      this.codeInput.value = '';
    });
    if (this.step === 'code') this.codeInput.focus();
  }

  private async enterCode(): Promise<void> {
    const code = this.codeInput.value.replace(/\D/g, '');
    if (code.length !== 6) {
      this.message = o.errors['bad-code'];
      this.render();
      return;
    }
    await this.run(async () => {
      await this.online.finishByCode(this.email, code);
    });
    if (this.online.account && !this.online.account.handle) this.handleInput.focus();
  }

  private async saveHandle(): Promise<void> {
    const handle = this.handleInput.value.trim().toLowerCase();
    if (!HANDLE.test(handle)) {
      this.message = o.errors['bad-handle'];
      this.render();
      return;
    }
    this.handleInput.blur();
    await this.run(async () => {
      await this.online.update({ handle });
      this.message = o.saved;
    });
  }

  private async saveKeyboard(patch: { model?: string; switch?: SwitchKind | null; size?: SizeKind | null }): Promise<void> {
    await this.run(async () => {
      await this.online.update({ keyboard: patch });
      this.message = o.saved;
    });
  }

  private async remove(): Promise<void> {
    await this.run(async () => {
      await this.online.deleteAccount();
      this.confirming = false;
    });
  }

  /** Models other typists named, so the same keyboard is spelled one way. */
  private suggest(): void {
    if (this.suggestTimer) clearTimeout(this.suggestTimer);
    const q = this.modelInput.value.trim();
    if (q.length < 2) return;
    this.suggestTimer = setTimeout(() => {
      api
        .keyboards(q)
        .then(({ models }) => this.models.replaceChildren(...models.map((model) => el('option', { value: model.name }))))
        .catch(() => undefined);
    }, 180);
  }
}
