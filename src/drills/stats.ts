import type { FingerKind } from '../core/fingers';
import { fingerKind } from '../core/fingers';
import type { HistoryEntry, Metric, Point, Subject } from '../core/history';
import { rolling, series, trend } from '../core/history';
import { fingerName, fingerShort, t } from '../core/i18n';
import { intervalToWpm, MIN_SAMPLES } from '../core/metrics';
import { css, el, fitCanvas } from '../ui/dom';
import type { Drill, DrillHost, OptionGroup } from './types';

const ROLLING_SETS = 10;
const RECENT_SETS = 40;
/** Rows in the slowest-keys and slowest-pairs lists: as many as there are fingers, so the three lists end together. */
const LIST_ROWS = 8;
const DOT = String.fromCharCode(0xb7);
const MINUS = String.fromCharCode(0x2212);
/** Chart geometry in rem: the value labels' gutter, the date band, and the head room over the plot. */
const GUTTER = 2.5;
const DATE_BAND = 1.375;
const HEAD = 0.25;

const percent = (value: number): string => `${Math.round(value * 100)}%`;
const wpm = (ms: number): string => String(Math.round(intervalToWpm(ms)));
const two = (value: number): string => String(value).padStart(2, '0');
const sameDay = (a: number, b: number): boolean => new Date(a).toDateString() === new Date(b).toDateString();
const subjectId = (subject: Subject): string =>
  subject.kind === 'all' ? 'all' : subject.kind === 'finger' ? `finger:${subject.finger}` : `key:${subject.code}`;

function dayLabel(time: number): string {
  const date = new Date(time);
  const label = t.day(t.months[date.getMonth()], date.getDate());
  return date.getFullYear() === new Date().getFullYear() ? label : `${label} ${date.getFullYear()}`;
}

/** When an entry was typed: a day rollup has a date, a set also has its time. */
function when(entry: HistoryEntry): string {
  if (entry.sets !== undefined) return dayLabel(entry.t);
  const date = new Date(entry.t);
  return `${dayLabel(entry.t)}, ${two(date.getHours())}:${two(date.getMinutes())}`;
}

/**
 * What the keyboard has measured on the selected layout, and how it moved over time.
 * The chart follows one subject: the whole layout, a finger, or a key. Read-only: no typing here.
 */
export class StatsView implements Drill {
  readonly id = 'stats' as const;
  private host: DrillHost;
  private root = el('div.stats');
  private chart: HTMLCanvasElement | null = null;
  private cap: HTMLElement | null = null;
  private armed = false;
  private subject: Subject = { kind: 'all' };
  private metric: Metric = 'wpm';
  private range: 'recent' | 'all' = 'recent';
  private points: Point[] = [];
  private line: (number | null)[] = [];
  private hover: number | null = null;
  /** Where the last draw put the slots, for reading the pointer. */
  private slots = { left: 0, width: 1 };
  private resizer = new ResizeObserver(() => this.drawChart());

  constructor(host: DrillHost) {
    this.host = host;
  }

  mount(stage: HTMLElement): void {
    stage.append(this.root);
    this.restart();
  }

  unmount(): void {
    this.resizer.disconnect();
    this.root.remove();
  }

  restart(): void {
    this.armed = false;
    this.render();
    this.host.setNext({ note: null });
  }

  key(): void {}

  /** A key picked on the on-screen keyboard: its history goes on the chart. Picking it again returns to all keys. */
  pickKey(code: string): void {
    this.select({ kind: 'key', code });
  }

  pickedKey(): string | null {
    return this.subject.kind === 'key' ? this.subject.code : null;
  }

  options(): OptionGroup[] {
    return [
      {
        label: t.stats.chart,
        value: this.metric,
        choices: [
          { value: 'wpm', label: t.stats.speed },
          { value: 'acc', label: t.stats.accuracy },
        ],
        set: (value) => {
          this.metric = value as Metric;
          this.hover = null;
          this.render();
        },
      },
      {
        label: t.stats.range,
        value: this.range,
        choices: [
          { value: 'recent', label: t.stats.recent(RECENT_SETS) },
          { value: 'all', label: t.stats.all },
        ],
        set: (value) => {
          this.range = value as 'recent' | 'all';
          this.hover = null;
          this.render();
        },
      },
      {
        label: t.stats.saved,
        value: this.armed ? 'armed' : 'keep',
        choices: this.armed
          ? [
              { value: 'keep', label: t.stats.keep },
              { value: 'erase', label: t.stats.eraseAll(this.host.store.profileName) },
            ]
          : [
              { value: 'keep', label: t.stats.keep },
              { value: 'armed', label: t.stats.erase },
            ],
        set: (value) => {
          if (value === 'erase') {
            this.host.store.resetStats();
            this.subject = { kind: 'all' };
          }
          this.armed = value === 'armed';
          this.render();
        },
      },
    ];
  }

  private select(subject: Subject): void {
    this.subject = subjectId(subject) === subjectId(this.subject) ? { kind: 'all' } : subject;
    this.hover = null;
    // The lists are rebuilt, so the focus goes back to the control that was used.
    const focused = document.activeElement instanceof HTMLElement && this.root.contains(document.activeElement) ? document.activeElement.dataset.pick : undefined;
    this.render();
    if (focused) this.root.querySelector<HTMLElement>(`[data-pick="${focused}"]`)?.focus();
    this.host.refresh();
  }

  private subjectName(subject: Subject): string {
    const { layout } = this.host;
    if (subject.kind === 'all') return t.stats.allKeys;
    if (subject.kind === 'finger') return fingerName(subject.finger);
    if (subject.code === 'Space') return t.stats.spaceBar;
    return t.stats.key(layout.strokeLabel({ code: subject.code, shift: false }), layout.fingerOf(subject.code));
  }

  private subjectToken(): HTMLElement | null {
    const { layout } = this.host;
    if (this.subject.kind === 'all') return null;
    if (this.subject.kind === 'finger') return el('span.tok', { 'data-f': fingerKind(this.subject.finger) });
    return el('span.tok', { 'data-f': fingerKind(layout.fingerOf(this.subject.code)), 'data-row': layout.rowOf(this.subject.code) });
  }

  /** The line takes the subject's color: mustard for the layout, the finger's hue, the key's row shade of it. */
  private subjectColor(): string {
    if (this.subject.kind === 'all') return css('--accent');
    const kind: FingerKind = fingerKind(this.subject.kind === 'finger' ? this.subject.finger : this.host.layout.fingerOf(this.subject.code));
    if (this.subject.kind === 'finger' || kind === 'thumb') return css(`--f-${kind}`);
    const row = this.host.layout.rowOf(this.subject.code);
    return css(row === 'top' || row === 'number' ? `--f-${kind}-top` : row === 'bottom' ? `--f-${kind}-bottom` : `--f-${kind}`);
  }

  private format(value: number): string {
    return this.metric === 'wpm' ? t.stats.value(Math.round(value)) : percent(value);
  }

  /** A change in the chart's unit: words per minute, or points of accuracy. */
  private signed(change: number): string {
    const value = this.metric === 'wpm' ? Math.round(change) : Math.round(change * 1000) / 10;
    if (value === 0) return '0';
    return `${value > 0 ? '+' : MINUS}${Math.abs(value)}`;
  }

  private pick(subject: Subject, ...children: (Node | string)[]): HTMLButtonElement {
    const button = el(
      'button.stats-pick.ctl',
      { type: 'button', 'aria-pressed': String(subjectId(subject) === subjectId(this.subject)), 'data-pick': subjectId(subject) },
      ...children,
    );
    button.addEventListener('click', () => this.select(subject));
    return button;
  }

  private render(): void {
    const { store, layout } = this.host;
    const stats = store.layoutStats(layout.id);
    const sets = store.history.filter((entry) => entry.layout === layout.id);
    const measured = Object.entries(stats.keys).filter(([code, stat]) => code !== 'Space' && stat.n >= MIN_SAMPLES);
    const trackingOff = store.tracking ? '' : t.stats.untracked;

    this.resizer.disconnect();
    this.chart = null;
    this.cap = null;
    if (sets.length === 0 && measured.length === 0) {
      this.root.replaceChildren(
        el(
          'p.stats-empty',
          {},
          t.stats.empty(t.layouts[layout.id], store.profileName) + trackingOff,
        ),
      );
      return;
    }

    this.points = series(store.history, layout, this.subject, this.metric);
    this.line = rolling(this.points, ROLLING_SETS, MIN_SAMPLES);
    const pooled = Math.min(ROLLING_SETS, this.points.filter((point) => point.value !== null).length);
    const current = this.line.length > 0 ? this.line[this.line.length - 1] : null;
    const metricName = this.metric === 'wpm' ? t.stats.wpm : t.stats.accuracy;
    const name = this.subjectName(this.subject);

    const figure = el(
      'div.stats-figure',
      {},
      el(current === null ? 'div.stats-avg.is-none' : 'div.stats-avg', {}, current === null ? t.none : this.metric === 'wpm' ? String(Math.round(current)) : percent(current)),
      el('p.stats-subject', {}, this.subjectToken(), name),
      el('p.stats-window', {}, current === null ? t.stats.tooFew(metricName) : t.stats.window(metricName, pooled)),
    );
    // One slot under the figure: how to pick a subject, or the way back from one.
    if (this.subject.kind === 'all') {
      figure.append(el('p.stats-hint', {}, t.stats.hint));
    } else {
      const clear = el('button.stats-clear.ctl', { type: 'button', 'data-pick': 'all' }, t.stats.back);
      clear.addEventListener('click', () => this.select(this.subject));
      figure.append(clear);
    }

    const wrap = el('div.stats-chart-wrap');
    if (this.points.some((point) => point.value !== null)) {
      const chart = el('canvas.stats-chart', { role: 'img', 'aria-label': t.stats.chartLabel(metricName, name) });
      this.chart = chart;
      this.cap = el('p.stats-chart-cap');
      chart.addEventListener('pointermove', (event) => this.setHover(event));
      chart.addEventListener('pointerdown', (event) => this.setHover(event));
      chart.addEventListener('pointerleave', () => this.setHover(null));
      wrap.append(chart, this.cap);
    } else {
      wrap.append(
        el(
          'p.stats-chart-none',
          {},
          this.subject.kind === 'all' ? t.stats.noSets : t.stats.noHistory(name),
        ),
      );
    }

    const { heads } = t.stats;
    const fingerRows = store
      .fingerSummary(layout)
      .filter((summary) => fingerKind(summary.finger) !== 'thumb')
      .map((summary) => {
        const enough = summary.n >= MIN_SAMPLES;
        const subject: Subject = { kind: 'finger', finger: summary.finger };
        const change = trend(series(store.history, layout, subject, this.metric), ROLLING_SETS, MIN_SAMPLES);
        return el(
          'tr',
          {},
          el('td', {}, this.pick(subject, el('span.tok', { 'data-f': fingerKind(summary.finger) }), fingerShort(summary.finger))),
          el(enough ? 'td' : 'td.stats-dim', {}, enough ? wpm(summary.ms) : t.none),
          el(enough ? 'td' : 'td.stats-dim', {}, enough ? percent(summary.n / (summary.n + summary.err)) : t.none),
          el(change === null ? 'td.stats-dim' : 'td', {}, change === null ? t.none : this.signed(change)),
          el('td.stats-dim', {}, String(summary.n)),
        );
      });
    const fingerTable = el(
      'table.stats-table',
      {},
      el('thead', {}, el('tr', {}, el('th', {}, heads.finger), el('th', {}, t.stats.wpm), el('th', {}, heads.acc), el('th', {}, heads.trend), el('th', {}, heads.keys))),
      el('tbody', {}, ...fingerRows),
    );

    const slowKeys = measured
      .sort(([, a], [, b]) => b.ms - a.ms)
      .slice(0, LIST_ROWS)
      .map(([code, stat]) =>
        el(
          'tr',
          {},
          el(
            'td',
            {},
            this.pick(
              { kind: 'key', code },
              el('span.tok', { 'data-f': fingerKind(layout.fingerOf(code)), 'data-row': layout.rowOf(code) }),
              layout.strokeLabel({ code, shift: false }),
            ),
          ),
          el('td', {}, wpm(stat.ms)),
          el('td', {}, percent(stat.n / (stat.n + stat.err))),
        ),
      );
    const slowPairs = Object.entries(stats.pairs)
      .filter(([, stat]) => stat.n >= MIN_SAMPLES)
      .sort(([, a], [, b]) => b.ms - a.ms)
      .slice(0, LIST_ROWS)
      .map(([pair, stat]) => el('tr', {}, el('td', {}, pair), el('td', {}, wpm(stat.ms)), el('td.stats-dim', {}, String(stat.n))));

    const lists = [el('div', {}, el('h2', {}, t.stats.byFinger), fingerTable)];
    if (slowKeys.length > 0) {
      lists.push(
        el(
          'div',
          {},
          el('h2', {}, t.stats.slowKeys),
          el(
            'table.stats-table',
            {},
            el('thead', {}, el('tr', {}, el('th', {}, heads.key), el('th', {}, t.stats.wpm), el('th', {}, heads.acc))),
            el('tbody', {}, ...slowKeys),
          ),
        ),
      );
    }
    if (slowPairs.length > 0) {
      lists.push(
        el(
          'div',
          {},
          el('h2', {}, t.stats.slowPairs),
          el(
            'table.stats-table',
            {},
            el('thead', {}, el('tr', {}, el('th', {}, heads.pair), el('th', {}, t.stats.wpm), el('th', {}, heads.seen))),
            el('tbody', {}, ...slowPairs),
          ),
        ),
      );
    }

    const shifts = stats.shiftOk + stats.shiftBad;
    const foot = el(
      'p.stats-foot',
      {},
      t.stats.footPick,
      t.stats.footTrend(this.metric === 'wpm'),
      t.stats.footHeat,
      shifts > 0 ? t.stats.footShift(percent(stats.shiftOk / shifts), shifts) : '',
      trackingOff,
    );

    this.root.replaceChildren(el('div.stats-top', {}, figure, wrap), el('div.stats-cols', {}, ...lists), foot);
    if (this.chart) {
      this.resizer.observe(this.chart);
      this.drawChart();
    }
  }

  /** The entries the chart shows: the last forty, or everything saved. */
  private view(): { points: Point[]; line: (number | null)[] } {
    if (this.range === 'all') return { points: this.points, line: this.line };
    return { points: this.points.slice(-RECENT_SETS), line: this.line.slice(-RECENT_SETS) };
  }

  private setHover(event: PointerEvent | null): void {
    let index: number | null = null;
    if (event && this.chart) {
      const at = Math.floor((event.clientX - this.chart.getBoundingClientRect().left - this.slots.left) / this.slots.width);
      if (at >= 0 && at < this.view().points.length) index = at;
    }
    if (index === this.hover) return;
    this.hover = index;
    this.drawChart();
  }

  private caption(): string {
    const { points, line } = this.view();
    if (this.hover !== null && points[this.hover]) {
      const { entry, value } = points[this.hover];
      const average = line[this.hover];
      const parts = [
        when(entry),
        entry.sets !== undefined ? t.stats.sets(entry.sets) : t.drills[entry.drill],
        value === null ? t.stats.nothing : this.format(value),
      ];
      if (average !== null) parts.push(t.stats.lastTen(this.format(average)));
      return parts.join(` ${DOT} `);
    }
    return t.stats.caption(
      this.metric === 'wpm',
      points.some((point) => point.entry.sets !== undefined),
    );
  }

  /** Value range of the chart, and the values that get a labelled rule. */
  private scale(points: Point[], line: (number | null)[]): { low: number; high: number; ticks: number[] } {
    const values = points.flatMap((point) => (point.value === null ? [] : [point.value])).sort((a, b) => a - b);
    const averages = line.flatMap((value) => (value === null ? [] : [value]));
    const at = (share: number): number => values[Math.min(values.length - 1, Math.floor(values.length * share))];
    const ticks: number[] = [];

    if (this.metric === 'wpm') {
      // One lucky interval can read as 200 wpm. The range follows the bulk of the sets and the line, and such a bar is cut at the top.
      const high = Math.max(20, at(0.9) * 1.08, ...averages.map((value) => value * 1.25));
      const step = [5, 10, 20, 25, 50, 100, 200].find((size) => high / size < 4.5) ?? 500;
      for (let tick = step; tick < high * 0.97; tick += step) ticks.push(tick);
      return { low: 0, high, ticks };
    }

    // Accuracy lives near the top of its range, so the chart opens on that part and marks sets with dots, which need no zero line.
    const floor = Math.min(at(0.1), ...averages) - 0.02;
    const low = Math.max(0, Math.min(0.9, Math.floor(floor * 20) / 20));
    const span = 1 - low;
    const step = [0.05, 0.1, 0.2, 0.25].find((size) => span / size <= 4) ?? 0.5;
    for (let tick = 1; tick > low + step / 4; tick -= step) ticks.push(tick);
    return { low, high: 1 + span * 0.08, ticks };
  }

  /** One mark per saved entry, with the average of the last ten drawn over them in the subject's color. */
  private drawChart(): void {
    if (!this.chart) return;
    const { ctx, width, height } = fitCanvas(this.chart);
    ctx.clearRect(0, 0, width, height);
    const { points, line } = this.view();
    if (this.cap) this.cap.textContent = this.caption();
    if (points.length === 0 || width < 4) return;

    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const left = GUTTER * rem;
    const top = HEAD * rem;
    const base = height - DATE_BAND * rem;
    const slot = (width - left) / Math.max(points.length, RECENT_SETS);
    this.slots = { left, width: slot };
    const { low, high, ticks } = this.scale(points, line);
    const y = (value: number): number => base - ((Math.min(high, Math.max(low, value)) - low) / (high - low)) * (base - top);
    const centre = (i: number): number => left + i * slot + slot / 2;
    const muted = css('--muted');
    const color = this.subjectColor();

    // Rules and their values.
    ctx.font = `400 ${0.8125 * rem}px ${css('--font')}`;
    ctx.lineWidth = 1;
    ctx.strokeStyle = css('--line');
    ctx.fillStyle = muted;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (const tick of [low, ...ticks]) {
      const at = Math.round(y(tick)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(left, at);
      ctx.lineTo(width, at);
      ctx.stroke();
      if (tick !== low) ctx.fillText(this.metric === 'wpm' ? String(tick) : percent(tick), left - 0.5 * rem, at);
    }

    // Days along the bottom: a label where a new day starts, when there is room for it.
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    let free = -Infinity;
    points.forEach((point, i) => {
      if (i > 0 && sameDay(points[i - 1].entry.t, point.entry.t)) return;
      const label = dayLabel(point.entry.t);
      const labelWidth = ctx.measureText(label).width;
      const at = Math.min(left + i * slot, width - labelWidth);
      if (at < free) return;
      ctx.fillStyle = css('--line-strong');
      ctx.fillRect(Math.round(left + i * slot), base + 1, 1, 0.25 * rem);
      ctx.fillStyle = muted;
      ctx.fillText(label, at, height - 0.125 * rem);
      free = at + labelWidth + 0.75 * rem;
    });

    if (this.hover !== null && this.hover < points.length) {
      ctx.strokeStyle = css('--line-strong');
      ctx.beginPath();
      ctx.moveTo(Math.round(centre(this.hover)) + 0.5, top);
      ctx.lineTo(Math.round(centre(this.hover)) + 0.5, base);
      ctx.stroke();
    }

    // Each entry: a bar from zero for speed, a dot for accuracy.
    const quiet = css('--key-hover');
    const barWidth = slot >= 4 ? slot * 0.6 : Math.max(1, slot - 0.5);
    const dot = Math.max(1, Math.min(0.1875 * rem, slot * 0.32));
    points.forEach((point, i) => {
      if (point.value === null) return;
      const at = y(point.value);
      ctx.beginPath();
      if (this.metric === 'wpm') {
        ctx.fillStyle = i === this.hover ? muted : quiet;
        ctx.roundRect(centre(i) - barWidth / 2, Math.min(at, base - 1), barWidth, Math.max(1, base - at), slot >= 4 ? 2 : 0);
      } else {
        ctx.fillStyle = i === this.hover ? css('--text') : muted;
        ctx.arc(centre(i), at, dot, 0, Math.PI * 2);
      }
      ctx.fill();
    });

    // The average of the last ten, ending in a dot on the value the figure shows.
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.125 * rem;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    let last = -1;
    line.forEach((value, i) => {
      if (value === null) return;
      if (last < 0) ctx.moveTo(centre(i), y(value));
      else ctx.lineTo(centre(i), y(value));
      last = i;
    });
    ctx.stroke();
    const marked = this.hover !== null && line[this.hover] !== null && line[this.hover] !== undefined ? this.hover : last;
    if (marked >= 0) {
      ctx.fillStyle = color;
      ctx.strokeStyle = css('--bg');
      ctx.lineWidth = 0.125 * rem;
      ctx.beginPath();
      ctx.arc(centre(marked), y(line[marked]!), 0.25 * rem, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
}
