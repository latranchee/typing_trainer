import { fingerKind, fingerName } from '../core/fingers';
import { intervalToWpm } from '../core/metrics';
import { MIN_SAMPLES } from '../core/store';
import { css, el, fitCanvas } from '../ui/dom';
import type { Drill, DrillHost, OptionGroup } from './types';

const ROLLING_SETS = 10;
const CHART_SETS = 40;

const percent = (value: number): string => `${Math.round(value * 100)}%`;
const wpm = (ms: number): string => String(Math.round(intervalToWpm(ms)));

/** What the keyboard has measured on the selected layout. Read-only: no typing here. */
export class StatsView implements Drill {
  readonly id = 'stats' as const;
  private host: DrillHost;
  private root = el('div.stats');
  private chart: HTMLCanvasElement | null = null;
  private armed = false;
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

  options(): OptionGroup[] {
    return [
      {
        label: 'saved numbers',
        value: this.armed ? 'armed' : 'keep',
        choices: this.armed
          ? [
              { value: 'keep', label: 'keep' },
              { value: 'erase', label: 'erase everything' },
            ]
          : [
              { value: 'keep', label: 'keep' },
              { value: 'armed', label: 'erase' },
            ],
        set: (value) => {
          if (value === 'erase') this.host.store.resetStats();
          this.armed = value === 'armed';
          this.render();
        },
      },
    ];
  }

  private render(): void {
    const { store, layout } = this.host;
    const profile = store.profile(layout.id);
    const sets = store.history.filter((entry) => entry.layout === layout.id);
    const measured = Object.entries(profile.keys).filter(([code, stat]) => code !== 'Space' && stat.n >= MIN_SAMPLES);

    this.resizer.disconnect();
    this.chart = null;
    if (sets.length === 0 && measured.length === 0) {
      this.root.replaceChildren(
        el('p.stats-empty', {}, `Nothing measured on ${layout.name} yet. Finish a set in any drill and the per-finger numbers show up here.`),
      );
      return;
    }

    const recent = sets.slice(-ROLLING_SETS);
    const average = recent.length > 0 ? recent.reduce((sum, entry) => sum + entry.wpm, 0) / recent.length : 0;
    this.chart = el('canvas.stats-chart', { role: 'img', 'aria-label': 'words per minute for recent sets' });
    const top = el(
      'div.stats-top',
      {},
      el('div.stats-avg', {}, String(Math.round(average)), el('small', {}, `wpm, average of last ${recent.length} ${recent.length === 1 ? 'set' : 'sets'}`)),
      el('div.stats-chart-wrap', {}, this.chart, el('p.stats-chart-cap', {}, 'bars: wpm of each set. line: average of the last ten.')),
    );

    const fingerRows = store
      .fingerSummary(layout)
      .filter((summary) => fingerKind(summary.finger) !== 'thumb')
      .map((summary) => {
        const enough = summary.n >= MIN_SAMPLES;
        return el(
          'tr',
          {},
          el('td', {}, el('span.stats-name', {}, el('span.tok', { 'data-f': fingerKind(summary.finger) }), fingerName(summary.finger))),
          el(enough ? 'td' : 'td.stats-dim', {}, enough ? wpm(summary.ms) : 'n/a'),
          el(enough ? 'td' : 'td.stats-dim', {}, enough ? percent(summary.n / (summary.n + summary.err)) : 'n/a'),
          el('td.stats-dim', {}, String(summary.n)),
        );
      });
    const fingerTable = el(
      'table.stats-table',
      {},
      el('thead', {}, el('tr', {}, el('th', {}, 'finger'), el('th', {}, 'wpm'), el('th', {}, 'accuracy'), el('th', {}, 'keys'))),
      el('tbody', {}, ...fingerRows),
    );

    const slowKeys = measured
      .sort(([, a], [, b]) => b.ms - a.ms)
      .slice(0, 6)
      .map(([code, stat]) =>
        el(
          'tr',
          {},
          el(
            'td',
            {},
            el('span.stats-name', {}, el('span.tok', { 'data-f': fingerKind(layout.fingerOf(code)) }), layout.strokeLabel({ code, shift: false })),
          ),
          el('td', {}, wpm(stat.ms)),
          el('td', {}, percent(stat.n / (stat.n + stat.err))),
        ),
      );
    const slowPairs = Object.entries(profile.pairs)
      .filter(([, stat]) => stat.n >= MIN_SAMPLES)
      .sort(([, a], [, b]) => b.ms - a.ms)
      .slice(0, 6)
      .map(([pair, stat]) => el('tr', {}, el('td', {}, pair), el('td', {}, wpm(stat.ms)), el('td.stats-dim', {}, String(stat.n))));

    const side = el('div');
    if (slowKeys.length > 0) {
      side.append(
        el('h2', {}, 'slowest keys'),
        el(
          'table.stats-table',
          {},
          el('thead', {}, el('tr', {}, el('th', {}, 'key'), el('th', {}, 'wpm'), el('th', {}, 'accuracy'))),
          el('tbody', {}, ...slowKeys),
        ),
      );
    }
    if (slowPairs.length > 0) {
      side.append(
        el('h2', {}, 'slowest letter pairs'),
        el(
          'table.stats-table',
          {},
          el('thead', {}, el('tr', {}, el('th', {}, 'pair'), el('th', {}, 'wpm'), el('th', {}, 'seen'))),
          el('tbody', {}, ...slowPairs),
        ),
      );
    }

    const shifts = profile.shiftOk + profile.shiftBad;
    const foot = el(
      'p.stats-foot',
      {},
      shifts > 0
        ? `Shift on the opposite hand: ${percent(profile.shiftOk / shifts)} of ${shifts} capitals. `
        : '',
      'The keyboard below shows the same numbers: the stronger the color, the more work the key needs.',
    );

    this.root.replaceChildren(top, el('div.stats-cols', {}, el('div', {}, el('h2', {}, 'by finger'), fingerTable), side), foot);
    this.resizer.observe(this.chart);
    this.drawChart();
  }

  /** One bar per set, with the running average of the last ten sets drawn over them. */
  private drawChart(): void {
    if (!this.chart) return;
    const { ctx, width, height } = fitCanvas(this.chart);
    ctx.clearRect(0, 0, width, height);
    const sets = this.host.store.history.filter((entry) => entry.layout === this.host.layout.id).slice(-CHART_SETS);
    if (sets.length === 0) return;
    const peak = Math.max(...sets.map((entry) => entry.wpm), 20) * 1.1;
    const slot = width / CHART_SETS;
    const barW = Math.max(2, slot * 0.6);
    const y = (value: number): number => height - (value / peak) * (height - 2);

    ctx.fillStyle = css('--key-hover');
    sets.forEach((entry, i) => {
      ctx.beginPath();
      ctx.roundRect(i * slot + (slot - barW) / 2, y(entry.wpm), barW, height - y(entry.wpm), 2);
      ctx.fill();
    });

    ctx.strokeStyle = css('--accent');
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    sets.forEach((_, i) => {
      const from = Math.max(0, i - ROLLING_SETS + 1);
      const window = sets.slice(from, i + 1);
      const average = window.reduce((sum, entry) => sum + entry.wpm, 0) / window.length;
      const x = i * slot + slot / 2;
      if (i === 0) ctx.moveTo(x, y(average));
      else ctx.lineTo(x, y(average));
    });
    ctx.stroke();
  }
}
