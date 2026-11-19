import type { FingerKind } from '../core/fingers';
import { fingerKind, fingerLane } from '../core/fingers';
import { makePairs, makeSentences, makeWords } from '../core/generator';
import { t } from '../core/i18n';
import type { KeyEvt } from '../core/input';
import type { Row } from '../core/physical';
import { css, el, fitCanvas } from '../ui/dom';
import { baselineDrop } from '../ui/glyph';
import type { Drill, DrillHost, Note, OptionGroup } from './types';
import { languageOption, matches, toNotes } from './types';

/** Notes ahead of the strike line when a set is waiting to start. */
const START_LEAD = 2.4;
/** In locked tempo a note can be hit only this close to the line, in note gaps. */
const HIT_WINDOW = 0.5;
const POP_MS = 150;
const FLASH_MS = 220;
const SHAKE_MS = 180;
const MIN_WPM = 10;
const MAX_WPM = 160;

interface Pop {
  note: Note;
  y: number;
  at: number;
}

/** A frozen frame for visual checks: notes at fixed heights instead of a live queue. */
export interface HighwayFixture {
  notes: { kind: FingerKind; row: Row; lane: number; y: number; label: string }[];
}

/** A finger's hue in its three shades: brighter above the home row, darker below it. */
type Shades = Record<'up' | 'home' | 'down', string>;
const SHADE_OF: Record<Row, keyof Shades> = { number: 'up', top: 'up', home: 'home', bottom: 'down', thumb: 'home' };
const shadesOf = (kind: FingerKind): Shades =>
  kind === 'thumb'
    ? { up: css('--f-thumb'), home: css('--f-thumb'), down: css('--f-thumb') }
    : { up: css(`--f-${kind}-top`), home: css(`--f-${kind}`), down: css(`--f-${kind}-bottom`) };

/**
 * Falling notes. Each letter comes down its finger's lane in that finger's
 * color; its shape and shade say which row the key is on: a brighter triangle
 * pointing up for the top row, a circle for the home row, a darker triangle
 * pointing down for the bottom row. By default the road follows the typist: it brings the next
 * note to the line when the next keypress is due and waits if it is late.
 * With the tempo locked it holds one speed and refuses keys that come early.
 */
export class HighwayDrill implements Drill {
  readonly id = 'highway' as const;
  private host: DrillHost;
  private canvas = el('canvas.highway');
  private notes: Note[] = [];
  private cursor = 0;
  /** Scroll position in notes: note `i` is on the line when `progress === i`. */
  private progress = 0;
  private speed = 0;
  private interval = 300;
  private lastHit = 0;
  private started = false;
  private done = false;
  private pops: Pop[] = [];
  private flashes: { lane: number; kind: FingerKind; row: Row; at: number }[] = [];
  private shakeAt = -1e9;
  /** Hardcore: the wrong keys typed past the front note, waiting for Backspace. */
  private typed: readonly string[] = [];
  private fixture: HighwayFixture | null = null;
  private colors: Record<FingerKind, Shades> | null = null;
  private resizer = new ResizeObserver(() => this.draw(performance.now()));
  /** Shake and pop are feedback flourishes; the falling notes themselves are the task and stay. */
  private calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(host: DrillHost) {
    this.host = host;
  }

  mount(stage: HTMLElement): void {
    stage.append(this.canvas);
    this.resizer.observe(this.canvas);
    this.restart();
  }

  unmount(): void {
    this.resizer.disconnect();
    this.canvas.remove();
  }

  restart(): void {
    const { layout, settings, bias } = this.host;
    const text =
      settings.highwaySource === 'pairs'
        ? makePairs(layout, settings.lang, 14, { size: settings.pairSize }, bias)
        : settings.highwaySource === 'sentences'
          ? makeSentences(layout, settings.lang, settings.setWords, { caps: settings.caps }, bias)
          : makeWords(layout, settings.lang, settings.setWords, { caps: settings.caps }, bias);
    this.notes = toNotes(layout, text);
    this.cursor = 0;
    this.progress = -START_LEAD;
    this.speed = 0;
    this.interval = 60000 / (settings.tempoWpm * 5);
    this.started = false;
    this.done = false;
    this.pops = [];
    this.flashes = [];
    this.typed = [];
    this.fixture = null;
    this.announce();
    this.draw(performance.now());
  }

  freeze(fixture: HighwayFixture): void {
    this.fixture = fixture;
    this.draw(performance.now());
  }

  options(): OptionGroup[] {
    const { settings, store } = this.host;
    const refresh = (patch: Parameters<typeof store.update>[0]) => {
      store.update(patch);
      this.restart();
    };
    return [
      {
        label: t.highway.text,
        value: settings.highwaySource,
        choices: [
          { value: 'words', label: t.highway.words },
          { value: 'sentences', label: t.highway.sentences },
          { value: 'pairs', label: t.highway.pairs },
        ],
        set: (value) => refresh({ highwaySource: value as typeof settings.highwaySource }),
      },
      languageOption(settings, refresh),
      {
        label: t.highway.tempo,
        value: settings.tempoLock ? 'lock' : 'follow',
        choices: [
          { value: 'follow', label: t.highway.follows },
          { value: 'lock', label: t.highway.locked(settings.tempoWpm) },
        ],
        set: (value) => refresh({ tempoLock: value === 'lock' }),
      },
    ];
  }

  nudge(direction: 1 | -1): void {
    const { settings, store } = this.host;
    if (!settings.tempoLock) return;
    const tempoWpm = Math.max(MIN_WPM, Math.min(MAX_WPM, settings.tempoWpm + direction * 5));
    store.update({ tempoWpm });
    this.interval = 60000 / (tempoWpm * 5);
    this.host.say(t.highway.tempoNow(tempoWpm));
  }

  key(event: KeyEvt): void {
    if (this.done || this.fixture) return;
    const note = this.notes[this.cursor];
    if (!note) return;

    if (!matches(note, event)) {
      this.shakeAt = event.time;
      this.host.miss(note, event);
      return;
    }

    const lead = this.cursor - this.progress;
    if (this.host.settings.tempoLock && this.started && lead > HIT_WINDOW) {
      this.shakeAt = event.time;
      this.host.say(t.highway.early, 'error');
      return;
    }

    if (this.started) {
      const gap = event.time - this.lastHit;
      // Pauses do not count as pace.
      if (gap < 2000) this.interval += (Math.max(45, gap) - this.interval) * 0.25;
    }
    this.started = true;
    this.lastHit = event.time;

    this.pops.push({ note, y: this.yOf(this.cursor), at: event.time });
    this.flashes.push({ lane: fingerLane(note.finger), kind: fingerKind(note.finger), row: note.row, at: event.time });
    this.cursor++;
    this.host.hit(note, event);

    if (this.cursor >= this.notes.length) {
      this.done = true;
      this.host.setNext({ note: null });
      this.host.finish();
    } else {
      this.announce();
    }
  }

  typos(typed: readonly string[]): void {
    this.typed = [...typed];
    this.draw(performance.now());
  }

  tick(now: number, dt: number): void {
    if (!this.fixture && this.started && !this.done) {
      const lead = this.cursor - this.progress;
      let target: number;
      if (this.host.settings.tempoLock) {
        target = (this.host.settings.tempoWpm * 5) / 60;
      } else {
        // Bring the next note to the line at the moment the next keypress is due.
        const remaining = Math.max(this.interval - (now - this.lastHit), this.interval * 0.15);
        target = lead / (remaining / 1000);
      }
      this.speed += (target - this.speed) * Math.min(1, dt * 0.012);
      this.progress = Math.min(this.cursor, this.progress + (this.speed * dt) / 1000);
    }
    this.draw(now);
  }

  private announce(): void {
    this.host.setNext({ note: this.notes[this.cursor] ?? null });
  }

  // ---------- drawing ----------

  private gap = 60;
  private lineY = 0;

  private yOf(index: number): number {
    return this.lineY - (index - this.progress) * this.gap;
  }

  private palette(): Record<FingerKind, Shades> {
    return (this.colors ??= {
      pinky: shadesOf('pinky'),
      ring: shadesOf('ring'),
      middle: shadesOf('middle'),
      index: shadesOf('index'),
      thumb: shadesOf('thumb'),
    });
  }

  private draw(now: number): void {
    const { ctx, width, height } = fitCanvas(this.canvas);
    if (width === 0 || height === 0) return;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    // Lanes come from the keyboard: every note falls straight onto its finger's home key.
    const left = this.canvas.getBoundingClientRect().left;
    const lanes = this.host.lanes();
    const edges = lanes.edges.map((x) => x - left);
    const centres = lanes.centres.map((x) => x - left);
    // Sized from an inner lane: one key wide. The pinky lanes are wider but hold the same notes.
    const size = Math.min((edges[2] - edges[1]) * 0.8, 2.875 * rem);
    this.lineY = height - 2;
    this.gap = Math.max(size * 1.35, height / 7.5);
    const laneX = (lane: number): number => centres[lane];
    const colors = this.palette();

    ctx.clearRect(0, 0, width, height);

    ctx.strokeStyle = css('--lane');
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const edge of edges) {
      const x = Math.round(edge) + 0.5;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.lineY);
    }
    ctx.stroke();

    ctx.fillStyle = css('--strike');
    ctx.fillRect(0, this.lineY - 1, width, 2);

    // The lane a note just landed in lights its stretch of the line.
    this.flashes = this.flashes.filter((flash) => now - flash.at < FLASH_MS);
    for (const flash of this.flashes) {
      ctx.globalAlpha = 1 - (now - flash.at) / FLASH_MS;
      ctx.fillStyle = colors[flash.kind][SHADE_OF[flash.row]];
      ctx.fillRect(edges[flash.lane], this.lineY - 3, edges[flash.lane + 1] - edges[flash.lane], 4);
    }
    ctx.globalAlpha = 1;

    if (this.fixture) {
      for (const note of this.fixture.notes) {
        this.token(ctx, laneX(note.lane), note.y * height, size, note.kind, note.row, note.label, colors);
      }
      return;
    }

    const wrong = now - this.shakeAt < SHAKE_MS;
    const shake = wrong && !this.calm ? Math.sin((now - this.shakeAt) / 14) * 0.25 * rem : 0;
    const top = -size;
    for (let i = this.cursor; i < this.notes.length; i++) {
      const y = this.yOf(i) - size * 0.62;
      if (y < top) break;
      const note = this.notes[i];
      const kind = fingerKind(note.finger);
      const front = i === this.cursor;
      const x = laneX(fingerLane(note.finger)) + (front ? shake : 0);
      this.token(ctx, x, y, size, kind, note.row, note.label, colors, note.stroke.shift);
      if (front && (wrong || this.typed.length > 0)) this.ring(ctx, x, y, size, css('--error'));
      if (front && this.typed.length > 0) this.typoRun(ctx, x, y - size * 1.05, size, width);
    }

    this.pops = this.pops.filter((pop) => now - pop.at < POP_MS);
    for (const pop of this.pops) {
      const age = (now - pop.at) / POP_MS;
      const kind = fingerKind(pop.note.finger);
      ctx.globalAlpha = 1 - age;
      this.token(ctx, laneX(fingerLane(pop.note.finger)), pop.y - size * 0.62, size * (this.calm ? 1 : 1 + age * 0.35), kind, pop.note.row, '', colors);
    }
    ctx.globalAlpha = 1;
  }

  /**
   * One note with its letter. The finger gives the hue. The row gives the shade
   * and the shape, which points the way the finger travels from the home row.
   */
  private token(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    kind: FingerKind,
    row: Row,
    label: string,
    colors: Record<FingerKind, Shades>,
    shifted = false,
  ): void {
    const half = size / 2;
    const radius = size * 0.14;
    const fill = colors[kind][SHADE_OF[row]];
    // Where the middle of the letter goes: the middle of a circle, the centroid of a triangle (a third of the way up from its flat side).
    let labelShift = 0;
    ctx.save();
    ctx.fillStyle = fill;
    ctx.translate(x, y);
    ctx.beginPath();
    if (kind === 'thumb') {
      ctx.roundRect(-half * 1.25, -half * 0.36, size * 1.25, size * 0.72, half * 0.36);
    } else if (row === 'top' || row === 'bottom') {
      // Rounded triangle, tip up for the top row and down for the bottom row.
      // Start mid-base so every corner gets an arc.
      const up = row === 'top' ? 1 : -1;
      const tip = -half * 0.98 * up;
      const base = half * 0.86 * up;
      const reach = half * 1.12;
      ctx.moveTo(0, base);
      ctx.arcTo(reach, base, 0, tip, radius);
      ctx.arcTo(0, tip, -reach, base, radius);
      ctx.arcTo(-reach, base, 0, base, radius);
      ctx.closePath();
      labelShift = size * 0.12 * up;
    } else if (row === 'number') {
      ctx.rotate(Math.PI / 4);
      ctx.roundRect(-half * 0.78, -half * 0.78, size * 0.78, size * 0.78, radius);
    } else {
      ctx.arc(0, 0, half, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.restore();

    if (label.trim() !== '') {
      ctx.save();
      ctx.fillStyle = css('--ink');
      const px = Math.round(size * 0.46);
      ctx.font = `600 ${px}px ${css('--font')}`;
      ctx.textAlign = 'center';
      // The letter is set by its own ink: a baseline placed on the em box leaves a lowercase letter under the middle of its shape.
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(label, x, y + labelShift + baselineDrop(label) * px);
      ctx.restore();
    }

    if (shifted) {
      // A small caret over the note: this letter needs Shift.
      ctx.save();
      ctx.strokeStyle = fill;
      ctx.lineWidth = Math.max(1.5, size * 0.07);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(x - size * 0.2, y - half - size * 0.16);
      ctx.lineTo(x, y - half - size * 0.34);
      ctx.lineTo(x + size * 0.2, y - half - size * 0.16);
      ctx.stroke();
      ctx.restore();
    }
  }

  /**
   * Hardcore: the wrong keys typed past the front note, in coral above it, each
   * over a thin bar like a letter of the text drills. The last one carries the
   * heavy cursor bar: that is where the next key lands until Backspace clears the run.
   */
  private typoRun(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, width: number): void {
    const step = size * 0.5;
    const span = step * this.typed.length;
    // Centred on the note, kept inside the stage.
    let left = Math.min(Math.max(x - span / 2, step * 0.25), width - span - step * 0.25);
    if (span > width) left = 0;
    const color = css('--error');
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = `500 ${Math.round(size * 0.5)}px ${css('--font')}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    this.typed.forEach((label, i) => {
      const cx = left + step * (i + 0.5);
      if (label !== ' ') ctx.fillText(label, cx, y);
      const last = i === this.typed.length - 1;
      const bar = last ? Math.max(3, size * 0.09) : Math.max(1.5, size * 0.04);
      ctx.beginPath();
      ctx.roundRect(cx - step * (last ? 0.46 : 0.34), y + size * 0.3, step * (last ? 0.92 : 0.68), bar, bar / 2);
      ctx.fill();
    });
    ctx.restore();
  }

  private ring(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, size * 0.72, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}
