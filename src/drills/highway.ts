import type { FingerKind } from '../core/fingers';
import { fingerKind, fingerLane } from '../core/fingers';
import { makePairs, makeWords } from '../core/generator';
import type { KeyEvt } from '../core/input';
import { css, el, fitCanvas } from '../ui/dom';
import type { Drill, DrillHost, Note, OptionGroup } from './types';
import { matches, toNotes } from './types';

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
  notes: { kind: FingerKind; lane: number; y: number; label: string }[];
}

/**
 * Falling notes. Each letter comes down its finger's lane with that finger's
 * color and shape. By default the road follows the typist: it brings the next
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
  private flashes: { lane: number; kind: FingerKind; at: number }[] = [];
  private shakeAt = -1e9;
  private fixture: HighwayFixture | null = null;
  private colors: Record<FingerKind, string> | null = null;
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
    const { layout, settings, weakness } = this.host;
    const text =
      settings.highwaySource === 'pairs'
        ? makePairs(layout, settings.lang, 14, { size: settings.pairSize, focus: settings.pairFocus }, weakness)
        : makeWords(layout, settings.lang, settings.setWords, { caps: settings.caps }, weakness);
    this.notes = toNotes(layout, text);
    this.cursor = 0;
    this.progress = -START_LEAD;
    this.speed = 0;
    this.interval = 60000 / (settings.tempoWpm * 5);
    this.started = false;
    this.done = false;
    this.pops = [];
    this.flashes = [];
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
        label: 'text',
        value: settings.highwaySource,
        choices: [
          { value: 'words', label: 'words' },
          { value: 'pairs', label: 'letter pairs' },
        ],
        set: (value) => refresh({ highwaySource: value as 'words' | 'pairs' }),
      },
      {
        label: 'tempo',
        value: settings.tempoLock ? 'lock' : 'follow',
        choices: [
          { value: 'follow', label: 'follows you' },
          { value: 'lock', label: `locked ${settings.tempoWpm} wpm` },
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
    this.host.say(`tempo ${tempoWpm} wpm`);
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
      this.host.say('early: wait for the line', 'error');
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
    this.flashes.push({ lane: fingerLane(note.finger), kind: fingerKind(note.finger), at: event.time });
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

  private palette(): Record<FingerKind, string> {
    return (this.colors ??= {
      pinky: css('--f-pinky'),
      ring: css('--f-ring'),
      middle: css('--f-middle'),
      index: css('--f-index'),
      thumb: css('--f-thumb'),
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
      ctx.fillStyle = colors[flash.kind];
      ctx.fillRect(edges[flash.lane], this.lineY - 3, edges[flash.lane + 1] - edges[flash.lane], 4);
    }
    ctx.globalAlpha = 1;

    if (this.fixture) {
      for (const note of this.fixture.notes) {
        this.token(ctx, laneX(note.lane), note.y * height, size, note.kind, note.label, colors, 1);
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
      this.token(ctx, x, y, size, kind, note.label, colors, 1, note.stroke.shift);
      if (front && wrong) this.ring(ctx, x, y, size, css('--error'));
    }

    this.pops = this.pops.filter((pop) => now - pop.at < POP_MS);
    for (const pop of this.pops) {
      const t = (now - pop.at) / POP_MS;
      const kind = fingerKind(pop.note.finger);
      ctx.globalAlpha = 1 - t;
      this.token(ctx, laneX(fingerLane(pop.note.finger)), pop.y - size * 0.62, size * (this.calm ? 1 : 1 + t * 0.35), kind, '', colors, 1);
    }
    ctx.globalAlpha = 1;
  }

  /** One note: the finger's shape in the finger's color, with its letter. */
  private token(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    kind: FingerKind,
    label: string,
    colors: Record<FingerKind, string>,
    alpha: number,
    shifted = false,
  ): void {
    const half = size / 2;
    const radius = size * 0.14;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = colors[kind];
    ctx.translate(x, y);
    ctx.beginPath();
    if (kind === 'index') {
      ctx.arc(0, 0, half, 0, Math.PI * 2);
    } else if (kind === 'middle') {
      ctx.roundRect(-half * 0.92, -half * 0.92, size * 0.92, size * 0.92, radius);
    } else if (kind === 'pinky') {
      ctx.rotate(Math.PI / 4);
      ctx.roundRect(-half * 0.78, -half * 0.78, size * 0.78, size * 0.78, radius);
    } else if (kind === 'ring') {
      // Rounded triangle: start mid-base so every corner gets an arc.
      const top = -half * 0.98;
      const bottom = half * 0.86;
      const reach = half * 1.12;
      ctx.moveTo(0, bottom);
      ctx.arcTo(reach, bottom, 0, top, radius);
      ctx.arcTo(0, top, -reach, bottom, radius);
      ctx.arcTo(-reach, bottom, 0, bottom, radius);
      ctx.closePath();
    } else {
      ctx.roundRect(-half * 1.25, -half * 0.36, size * 1.25, size * 0.72, half * 0.36);
    }
    ctx.fill();
    ctx.restore();

    if (label.trim() !== '') {
      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.fillStyle = css('--ink');
      ctx.font = `600 ${Math.round(size * 0.46)}px ${css('--font')}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x, y + (kind === 'ring' ? size * 0.14 : size * 0.03));
      ctx.restore();
    }

    if (shifted) {
      // A small caret over the note: this letter needs Shift.
      ctx.save();
      ctx.strokeStyle = colors[kind];
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
