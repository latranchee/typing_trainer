import { o, t } from '../core/i18n';
import type { SizeKind, SwitchKind } from '../core/keyboards';
import { SWITCH_NAMES } from '../core/keyboards';
import type { Lang } from '../core/lang';
import { LANGS } from '../core/lang';
import type { LayoutId } from '../core/layouts';
import type { BoardQuery, InputKind, KeyboardGroup, KeyboardRow, Mode, Period, PlayerRow, RankedDrill, TextRow } from '../core/online';
import { KEYBOARD_GROUPS, PERIODS, RANKED_DRILLS } from '../core/online';
import { ApiError, api } from '../net/api';
import type { Online } from '../net/online';
import { el } from '../ui/dom';
import type { Drill, DrillHost, OptionGroup } from './types';

type View = 'players' | 'keyboards' | 'texts';
const VIEWS: View[] = ['players', 'keyboards', 'texts'];

/** What the boards view asks of the app: open a text to type, open a race, go to the account. */
export interface BoardsActions {
  online: Online;
  typeText(id: string, mode: Mode): void;
  newRace(): void;
  signIn(): void;
}

/** The view and filters are kept while the typist goes off to type and comes back. */
let kept: { view: View; query: BoardQuery; group: KeyboardGroup } | null = null;

const percent = (value: number): string => `${Math.round(value * 100)}%`;
const DOT = String.fromCharCode(0xb7);

/**
 * Who types fastest: typists, the keyboards they type on, and the texts typed most.
 * Each board is one drill on one kind of input; filters narrow it by language, layout and time.
 */
export class BoardsView implements Drill {
  readonly id = 'boards' as const;
  private host: DrillHost;
  private actions: BoardsActions;
  private root = el('div.boards');
  private head = el('div.boards-head');
  private status = el('div.boards-status');
  private body = el('div.boards-body');
  private view: View;
  private query: BoardQuery;
  private group: KeyboardGroup;
  private ticket = 0;

  constructor(host: DrillHost, actions: BoardsActions) {
    this.host = host;
    this.actions = actions;
    const { settings } = host;
    const drill: RankedDrill = RANKED_DRILLS.includes(settings.drill as RankedDrill) ? (settings.drill as RankedDrill) : 'words';
    const input: InputKind = window.matchMedia('(pointer: coarse) and (hover: none)').matches ? 'touch' : 'keys';
    this.view = kept?.view ?? 'players';
    this.query = kept?.query ?? { drill, input, period: 'week', lang: settings.lang, layout: 'all' };
    this.group = kept?.group ?? 'model';
    this.root.append(this.head, this.status, this.body);
    actions.online.onChange(() => {
      if (this.root.isConnected) this.renderStatus();
    });
  }

  mount(stage: HTMLElement): void {
    stage.append(this.root);
    this.restart();
  }

  unmount(): void {
    kept = { view: this.view, query: { ...this.query }, group: this.group };
    this.root.remove();
  }

  restart(): void {
    this.renderHead();
    this.renderStatus();
    void this.load();
  }

  key(): void {}

  /** The filters that narrow every board sit in the settings, as a drill's options do. */
  options(): OptionGroup[] {
    const { query } = this;
    const set = (patch: Partial<BoardQuery>): void => {
      Object.assign(this.query, patch);
      this.restart();
    };
    const mine = this.host.layout.id;
    return [
      {
        label: t.options.language,
        value: query.lang,
        choices: [{ value: 'all', label: o.allLangs }, ...LANGS.map((lang) => ({ value: lang, label: t.languages[lang] }))],
        set: (value) => set({ lang: value as Lang | 'all' }),
        keeps: true,
      },
      {
        label: t.menu.layout,
        value: query.layout === 'all' ? 'all' : 'mine',
        choices: [
          { value: 'all', label: o.allLayouts },
          { value: 'mine', label: t.layouts[mine] },
        ],
        set: (value) => set({ layout: value === 'mine' ? mine : 'all' }),
        keeps: true,
      },
      {
        label: o.keyboard,
        value: query.input,
        choices: (['keys', 'touch'] as InputKind[]).map((input) => ({ value: input, label: o.inputs[input] })),
        set: (value) => set({ input: value as InputKind }),
        keeps: true,
      },
    ];
  }

  private seg<T extends string>(label: string, values: readonly T[], current: T, name: (value: T) => string, pick: (value: T) => void): HTMLElement {
    return el(
      'div.seg',
      { role: 'group', 'aria-label': label },
      ...values.map((value) => {
        const on = value === current;
        const button = el(on ? 'button.seg-btn.ctl.is-on' : 'button.seg-btn.ctl', { type: 'button', 'aria-pressed': String(on) }, name(value));
        button.addEventListener('click', () => {
          button.blur();
          if (value !== current) pick(value);
        });
        return button;
      }),
    );
  }

  private renderHead(): void {
    const { query } = this;
    const race = el('button.boards-race.ctl', { type: 'button' }, o.newRace);
    race.addEventListener('click', () => this.actions.newRace());
    const filters: HTMLElement[] = [
      this.seg(o.boards, VIEWS, this.view, (view) => o.views[view], (view) => {
        this.view = view;
        this.restart();
      }),
      this.seg(o.mode, RANKED_DRILLS, query.drill, (drill) => t.drills[drill], (drill) => {
        this.query.drill = drill;
        this.restart();
      }),
    ];
    // Texts are ranked by how many typed them, over all time.
    if (this.view !== 'texts') {
      filters.push(
        this.seg(o.cols.when, PERIODS, query.period, (period) => o.periods[period], (period: Period) => {
          this.query.period = period;
          this.restart();
        }),
      );
    }
    if (this.view === 'keyboards') {
      filters.push(
        this.seg(o.keyboard, KEYBOARD_GROUPS, this.group, (group) => o.groups[group], (group) => {
          this.group = group;
          this.restart();
        }),
      );
    }
    // What the settings narrow it to, said in one line so no filter hides behind the button.
    const scope = [query.lang === 'all' ? o.allLangs : t.languages[query.lang], query.layout === 'all' ? o.allLayouts : t.layouts[query.layout], o.inputs[query.input]];
    this.head.replaceChildren(el('div.boards-filters', {}, ...filters), el('div.boards-side', {}, el('p.boards-scope', {}, scope.join(` ${DOT} `)), race));
  }

  private renderStatus(): void {
    const { online } = this.actions;
    if (!online.available || (online.account?.handle && online.linked)) {
      this.status.replaceChildren();
      return;
    }
    const label = online.account ? o.pickName : o.joinBoards;
    const button = el('button.boards-join.ctl', { type: 'button' }, label);
    button.addEventListener('click', () => this.actions.signIn());
    this.status.replaceChildren(button);
  }

  private async load(): Promise<void> {
    const ticket = ++this.ticket;
    this.body.replaceChildren(el('p.boards-empty.is-loading', {}, o.loading));
    try {
      const { query } = this;
      const node =
        this.view === 'players'
          ? this.players((await api.players(query)).rows)
          : this.view === 'keyboards'
            ? this.keyboards((await api.keyboardBoard(query, this.group)).rows)
            : this.texts((await api.texts(query)).rows);
      if (ticket === this.ticket) this.body.replaceChildren(node);
    } catch (error) {
      if (ticket !== this.ticket) return;
      const offline = error instanceof ApiError && (error.code === 'offline' || error.code === 'no-api');
      this.body.replaceChildren(el('p.boards-empty', {}, offline ? o.errors.offline : o.failed));
    }
  }

  private table(head: string[], rows: HTMLElement[], numeric: number[], empty: string, wide: number[] = []): HTMLElement {
    if (rows.length === 0) return el('p.boards-empty', {}, empty);
    return el(
      'table.boards-table',
      {},
      el('thead', {}, el('tr', {}, ...head.map((label, i) => el(`th${numeric.includes(i) ? '.is-num' : ''}${wide.includes(i) ? '.is-wide' : ''}`, { scope: 'col' }, label)))),
      el('tbody', {}, ...rows),
    );
  }

  private typeButton(id: string): HTMLElement {
    const mode: Mode = this.query.drill === 'highway' ? 'highway' : 'line';
    const button = el('button.boards-type.ctl', { type: 'button' }, o.typeIt);
    button.addEventListener('click', () => this.actions.typeText(id, mode));
    return button;
  }

  private players(rows: PlayerRow[]): HTMLElement {
    const me = this.actions.online.account?.handle ?? null;
    const now = Date.now();
    return this.table(
      ['#', o.cols.name, o.cols.wpm, o.cols.acc, o.cols.layout, o.cols.keyboard, o.cols.when, ''],
      rows.map((row, i) =>
        el(
          row.handle === me ? 'tr.is-you' : 'tr',
          {},
          el('td.is-rank', {}, String(i + 1)),
          el('td.is-name', {}, row.handle),
          el('td.is-num.is-wpm', {}, String(Math.round(row.wpm))),
          el('td.is-num', {}, percent(row.acc)),
          el('td.is-wide', {}, t.layouts[row.layout as LayoutId] ?? row.layout),
          el('td.is-wide.is-dim', {}, row.keyboard ?? ''),
          el('td.is-wide.is-dim', {}, o.ago(now - row.at)),
          el('td.is-act', {}, this.typeButton(row.textId)),
        ),
      ),
      [2, 3],
      o.empty,
      [4, 5, 6],
    );
  }

  private keyboardName(name: string): string {
    if (this.group === 'switch') return SWITCH_NAMES[name as SwitchKind] ?? name;
    if (this.group === 'size') return o.sizes[name as SizeKind] ?? name;
    return name;
  }

  private keyboards(rows: KeyboardRow[]): HTMLElement {
    const table = this.table(
      ['#', o.groups[this.group], o.cols.players, o.cols.mean, o.cols.top],
      rows.map((row, i) =>
        el(
          'tr',
          {},
          el('td.is-rank', {}, String(i + 1)),
          el('td.is-name', {}, this.keyboardName(row.name)),
          el('td.is-num', {}, String(row.players)),
          el('td.is-num.is-wpm', {}, String(Math.round(row.mean))),
          el('td.is-num', {}, String(Math.round(row.top))),
        ),
      ),
      [2, 3, 4],
      o.emptyKeyboards,
    );
    return rows.length > 0 ? el('div', {}, table, el('p.boards-note', {}, o.keyboardsNote)) : table;
  }

  private texts(rows: TextRow[]): HTMLElement {
    return this.table(
      ['#', o.cols.text, o.cols.players, o.cols.top, ''],
      rows.map((row, i) =>
        el(
          'tr',
          {},
          el('td.is-rank', {}, String(i + 1)),
          el('td.is-text', {}, el('span.boards-start', { lang: row.lang }, `${row.start}…`), el('span.boards-kind', {}, `${t.languages[row.lang]} ${DOT} ${o.kinds[row.kind]}`)),
          el('td.is-num', {}, String(row.players)),
          el('td.is-num.is-wpm', {}, `${Math.round(row.top)}`, el('span.boards-by', {}, row.topHandle)),
          el('td.is-act', {}, this.typeButton(row.id)),
        ),
      ),
      [2, 3],
      o.emptyTexts,
    );
  }
}
