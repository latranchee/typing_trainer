import { o, t } from '../core/i18n';
import type { Lang } from '../core/lang';
import { LANGS } from '../core/lang';
import type { Mode, RacerView, RoomConfig, RoomState } from '../core/online';
import type { TextKind } from '../core/texts';
import { TEXT_KINDS } from '../core/texts';
import { roomLink } from '../net/api';
import type { RaceClient } from '../net/race';
import { el } from './dom';

export interface RaceActions {
  start(): void;
  leave(): void;
  rename(name: string): void;
  open(config: RoomConfig): void;
}

const seg = <T extends string>(label: string, values: readonly T[], current: T, name: (value: T) => string, pick: (value: T) => void): HTMLElement =>
  el(
    'div.seg',
    { role: 'group', 'aria-label': label },
    ...values.map((value) => {
      const button = el(value === current ? 'button.seg-btn.ctl.is-on' : 'button.seg-btn.ctl', { type: 'button', 'aria-pressed': String(value === current) }, name(value));
      button.addEventListener('click', () => pick(value));
      return button;
    }),
  );

/**
 * A race, on the stage: the room before the start, the count before the keys open, the
 * places at the end. While the race runs the overlay steps aside for the text, and the
 * strip above it carries the racers.
 */
export class RaceView {
  readonly root = el('div.race', { role: 'region' });
  private actions: RaceActions;
  private nameInput = el('input.profile-input.race-name', { type: 'text', maxlength: '20', autocomplete: 'nickname', spellcheck: 'false', autocapitalize: 'none' });
  private copied = false;
  private setup: { mode: Mode; kind: TextKind; words: 15 | 30 | 60; lang: Lang } | null = null;

  constructor(actions: RaceActions) {
    this.actions = actions;
  }

  /** The form that opens a room, with the drill's own defaults. */
  showSetup(defaults: { mode: Mode; kind: TextKind; words: 15 | 30 | 60; lang: Lang }, busy: boolean, error: string): void {
    this.setup ??= { ...defaults };
    const setup = this.setup;
    const redraw = (): void => this.showSetup(defaults, busy, '');
    const go = el('button.race-go.ctl', { type: 'button', disabled: busy }, o.create);
    go.addEventListener('click', () => this.actions.open({ ...setup, textId: null }));
    const leave = el('button.race-quiet.ctl', { type: 'button' }, o.leaveRoom);
    leave.addEventListener('click', () => this.actions.leave());
    this.root.dataset.phase = 'setup';
    this.root.replaceChildren(
      el(
        'div.race-card',
        {},
        el('h2.race-title', {}, o.newRace),
        el(
          'dl.race-form',
          {},
          el('dt', {}, o.mode),
          el('dd', {}, seg(o.mode, ['line', 'highway'] as Mode[], setup.mode, (mode) => o.modes[mode], (mode) => ((setup.mode = mode), redraw()))),
          el('dt', {}, o.kindLabel),
          el('dd', {}, seg(o.kindLabel, TEXT_KINDS, setup.kind, (kind) => o.kinds[kind], (kind) => ((setup.kind = kind), redraw()))),
          el('dt', {}, o.words),
          el('dd', {}, seg(o.words, ['15', '30', '60'], String(setup.words) as '15' | '30' | '60', (count) => count, (count) => ((setup.words = Number(count) as 15 | 30 | 60), redraw()))),
          el('dt', {}, t.options.language),
          el('dd', {}, seg(t.options.language, LANGS, setup.lang, (lang) => t.languages[lang], (lang) => ((setup.lang = lang), redraw()))),
        ),
        error ? el('p.race-error', { role: 'alert' }, error) : null,
        el('div.race-actions', {}, go, leave),
      ),
    );
  }

  /** The room as the server last told it. `signed` says the name is the account's, so there is no field for it. */
  render(state: RoomState, client: RaceClient, signed: boolean, countdown: number | null): void {
    const me = state.racers.find((racer) => racer.id === state.you);
    this.root.dataset.phase = state.phase;
    // Joined while a round runs: the room, and a word that the next round is theirs.
    const waiting = me?.waiting === true && (state.phase === 'countdown' || state.phase === 'race');
    if (state.phase === 'race' && countdown === null && !waiting) {
      // The keys are open: the text is the race now.
      this.root.replaceChildren();
      return;
    }
    if (!waiting && (state.phase === 'countdown' || (state.phase === 'race' && countdown !== null))) {
      const value = countdown !== null && countdown > 0 ? String(countdown) : o.go;
      this.root.replaceChildren(el('div.race-count', { 'aria-live': 'assertive' }, value));
      return;
    }
    const link = roomLink(state.code);
    const copy = el('button.race-quiet.ctl', { type: 'button' }, this.copied ? o.copied : o.copyLink);
    copy.addEventListener('click', () => {
      void navigator.clipboard?.writeText(link).catch(() => undefined);
      this.copied = true;
      copy.textContent = o.copied;
    });
    const leave = el('button.race-quiet.ctl', { type: 'button' }, o.leaveRoom);
    leave.addEventListener('click', () => this.actions.leave());

    const parts: (HTMLElement | null)[] = [
      el('div.race-top', {}, el('h2.race-title', {}, o.room(state.code)), el('span.race-config', {}, this.configLine(state.config))),
      el('p.race-link', {}, el('span.race-url', {}, link.replace(/^https?:\/\//, '')), copy),
    ];
    if (state.phase === 'done') parts.push(this.places(state));
    parts.push(this.racers(state));
    if (!signed && me) {
      if (document.activeElement !== this.nameInput) this.nameInput.value = me.name;
      this.nameInput.setAttribute('aria-label', o.yourName);
      const form = el('form.race-rename', {}, el('label.race-label', {}, o.yourName), this.nameInput);
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        this.nameInput.blur();
      });
      this.nameInput.onchange = () => this.actions.rename(this.nameInput.value);
      parts.push(form);
    }
    const alone = state.racers.length < 2;
    const actions = el('div.race-actions');
    if (client.isHost && !waiting) {
      const start = el('button.race-go.ctl', { type: 'button' }, state.phase === 'done' ? o.again : o.start);
      start.addEventListener('click', () => this.actions.start());
      actions.append(start);
    }
    actions.append(leave);
    parts.push(el('p.race-note', {}, waiting ? o.waitNext : client.isHost ? (alone ? o.alone : o.invite) : o.waitHost), actions);
    this.root.replaceChildren(el('div.race-card', {}, ...parts));
  }

  private configLine(config: RoomConfig): string {
    // A known text, or fresh text of a kind and a length; the highway says so, words are the default.
    const text = config.textId ? [o.thisText] : [...(config.kind === 'words' ? [] : [o.kinds[config.kind]]), `${config.words} ${o.words}`];
    return [...(config.mode === 'highway' ? [o.modes.highway] : []), ...text, t.languages[config.lang]].join(` ${String.fromCharCode(0xb7)} `);
  }

  private racers(state: RoomState): HTMLElement {
    return el(
      'ul.race-racers',
      {},
      ...state.racers.map((racer: RacerView) =>
        el(
          racer.id === state.you ? 'li.race-racer.is-you' : 'li.race-racer',
          {},
          el('span.race-racer-name', {}, racer.name),
          racer.host ? el('span.race-tag', {}, o.host) : null,
          racer.id === state.you ? el('span.race-tag', {}, o.you) : null,
          racer.waiting ? el('span.race-tag', {}, o.waitNext) : null,
        ),
      ),
    );
  }

  private places(state: RoomState): HTMLElement {
    const done = state.racers.filter((racer) => racer.place !== null).sort((a, b) => a.place! - b.place!);
    const rest = state.racers.filter((racer) => racer.place === null && !racer.waiting);
    return el(
      'ol.race-places',
      { 'aria-label': o.places },
      ...done.map((racer) =>
        el(
          racer.id === state.you ? 'li.race-place.is-you' : 'li.race-place',
          {},
          el('span.race-place-n', {}, o.placeOf(racer.place!)),
          el('span.race-racer-name', {}, racer.name),
          el('span.race-place-wpm', {}, `${Math.round(racer.wpm ?? 0)} ${o.cols.wpm}`),
          el('span.race-place-acc', {}, `${Math.round((racer.acc ?? 0) * 100)}%`),
        ),
      ),
      ...rest.map((racer) => el('li.race-place.is-out', {}, el('span.race-place-n', {}, '·'), el('span.race-racer-name', {}, racer.name), el('span.race-place-wpm', {}, o.stillTyping))),
    );
  }
}
