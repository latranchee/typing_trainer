import type { Finger, FingerKind } from '../core/fingers';
import { FINGER_KINDS, fingerKind, fingerName } from '../core/fingers';
import type { Weakness } from '../core/generator';
import type { KeyTally } from '../core/history';
import type { Command, KeyEvt } from '../core/input';
import { attachInput } from '../core/input';
import type { Layout } from '../core/layouts';
import { getLayout, LAYOUTS } from '../core/layouts';
import { intervalToWpm, MIN_SAMPLES, RollingWpm, SetStats } from '../core/metrics';
import type { Row } from '../core/physical';
import { rowOf } from '../core/physical';
import type { DrillId, Lang, Settings } from '../core/store';
import { DRILL_IDS, Store } from '../core/store';
import { AnchorsDrill } from '../drills/anchors';
import type { HighwayFixture } from '../drills/highway';
import { HighwayDrill } from '../drills/highway';
import { LineDrill } from '../drills/line';
import { StatsView } from '../drills/stats';
import type { Drill, DrillHost, NextHint, Note, OptionGroup } from '../drills/types';
import { css, el, fitCanvas } from './dom';
import { HandsView } from './hands';
import type { KeyRole } from './keyboard';
import { KeyboardView } from './keyboard';
import { brandMark } from './mark';
import { ProfileMenu } from './profile';
import { Select } from './select';

/** A gap longer than this between strokes is a pause and is not measured. */
const PAUSE_MS = 2000;
/** Options come back after this long without a keypress. */
const IDLE_MS = 3500;
const SPARK_SAMPLES = 120;
const SPARK_EVERY_MS = 500;
const WINDOWS: Settings['window'][] = [5, 10, 30];

/** Values for a frozen frame, used only by the visual-check fixture. */
export interface ReadoutFixture {
  wpm: number;
  accuracy: number;
  streak: number;
  spark: number[];
  fingers: Record<Exclude<FingerKind, 'thumb'>, number>;
  highway: HighwayFixture;
  next: { code: string; label: string; finger: Finger };
}

const isLetter = (char: string): boolean => char.toLowerCase() !== char.toUpperCase();

export class App implements DrillHost {
  readonly store = new Store();
  layout: Layout;
  readonly weakness: Weakness = (code) => this.store.weakness(this.layout.id, code);
  private readonly heat = (code: string): number => this.store.heat(this.layout.id, code);

  private rolling: RollingWpm;
  private stats = new SetStats();
  private drill!: Drill;
  private keyboard = new KeyboardView();
  private hands = new HandsView();
  private held = new Set<string>();

  private lastHitAt: number | null = null;
  private lastKeyAt = 0;
  private missedSince = false;
  private previousChar = '';
  private previousCharAt = 0;
  private hitsSinceBars = 0;

  private shownWpm = 0;
  private shownText = '';
  private samples: number[] = [];
  private sampledAt = 0;
  private previousFrame = performance.now();
  private frozen = false;
  private resultOpen = false;
  private sayTimer: ReturnType<typeof setTimeout> | null = null;
  /** Per-key numbers of the set in progress. They join the set's history entry when it finishes. */
  private setKeys: Record<string, KeyTally> = {};

  private root: HTMLElement;
  private tabs = new Map<DrillId, HTMLButtonElement>();
  private langButtons = new Map<Lang, HTMLButtonElement>();
  private layoutSelect!: Select;
  private profileMenu!: ProfileMenu;
  private trackSwitch = el('button.track.ctl', { type: 'button', role: 'switch' }, el('span', {}, 'tracking'), el('span.switch', { 'aria-hidden': 'true' }));
  private wpmEl = el('output.wpm', { 'aria-label': 'rolling words per minute' }, '0');
  private wpmCap = el('button.wpm-cap.ctl', { type: 'button', title: 'change the rolling window' });
  private spark = el('canvas.spark', { role: 'img', 'aria-label': 'rolling words per minute over the last minute' });
  private accEl = el('span.stat-value', {}, '100%');
  private streakEl = el('span.stat-value', {}, '0');
  private fingerFills = new Map<FingerKind, HTMLElement>();
  private stage = el('div.stage');
  private result = el('div.result', { role: 'status' });
  private optionsEl = el('div.options');
  private noteEl = el('p.stage-note', { role: 'status' });
  private nextEl = el('div.next.is-empty');
  private nextCap = el('div.next-cap');
  private nextFinger = el('p.next-finger');
  private nextExtra = el('p.next-extra');

  constructor(root: HTMLElement) {
    this.root = root;
    this.layout = getLayout(this.store.settings.layout);
    this.rolling = new RollingWpm(this.store.settings.window * 1000);
    this.build();
    this.keyboard.setLayout(this.layout);
    this.syncTrack();

    attachInput({
      key: (event) => this.onKey(event),
      down: (code) => {
        this.held.add(code);
        this.keyboard.down(code);
        this.drill.held?.(this.held);
      },
      up: (code) => {
        this.held.delete(code);
        this.keyboard.up(code);
        this.drill.held?.(this.held);
      },
      command: (command) => this.onCommand(command),
    });
    window.addEventListener('pointermove', () => {
      if (performance.now() - this.lastKeyAt > 400) this.setTyping(false);
    });
    window.addEventListener('hashchange', () => this.setDrill(this.drillFromHash()));
    window.addEventListener('pagehide', () => this.store.flush());
    new ResizeObserver(() => this.drawSpark()).observe(this.spark);

    this.setDrill(this.drillFromHash());
    this.updateBars();
    requestAnimationFrame(this.frame);
  }

  get settings(): Settings {
    return this.store.settings;
  }

  // ---------- DrillHost ----------

  hit(note: Note, event: KeyEvt): void {
    const now = event.time;
    const { code, shift } = note.stroke;
    const gap = this.lastHitAt === null ? null : now - this.lastHitAt;
    const clean = !this.missedSince && gap !== null && gap < PAUSE_MS;

    this.stats.hit(now, note.last);
    this.store.recordStroke(this.layout.id, code, clean ? gap : null);
    if (clean && gap !== null) {
      const tally = (this.setKeys[code] ??= [0, 0, 0]);
      tally[0]++;
      tally[2] += gap;
    }
    if (note.last) {
      this.rolling.add(now);
      const pairGap = now - this.previousCharAt;
      if (clean && this.previousChar && pairGap < PAUSE_MS && isLetter(note.char) && isLetter(this.previousChar)) {
        this.store.recordPair(this.layout.id, (this.previousChar + note.char).toLowerCase(), pairGap);
      }
      this.previousChar = note.char;
      this.previousCharAt = now;
    }

    // The side of Shift is one of the few things about fingers a keyboard can report.
    if (shift && (event.shiftLeft || event.shiftRight)) {
      const proper = this.layout.properShift(code);
      const correct = proper === 'ShiftLeft' ? event.shiftLeft : event.shiftRight;
      this.store.recordShift(this.layout.id, correct);
      if (!correct) this.say(`use the ${proper === 'ShiftLeft' ? 'left' : 'right'} shift for that key`, 'error');
    }

    this.lastHitAt = now;
    this.missedSince = false;
    this.touch(now);
    if (++this.hitsSinceBars >= 25) this.updateBars();
  }

  miss(expected: Note, event: KeyEvt): void {
    this.stats.miss(event.time);
    this.store.recordError(this.layout.id, expected.stroke.code);
    (this.setKeys[expected.stroke.code] ??= [0, 0, 0])[1]++;
    this.keyboard.wrong(event.code);
    this.missedSince = true;
    this.touch(event.time);
  }

  setNext(hint: NextHint): void {
    if (this.frozen) return;
    const targets: { code: string; role: KeyRole }[] = [];
    const reaches: { finger: Finger; row: Row }[] = [];
    const { note } = hint;
    let extra = '';

    for (const code of hint.anchors ?? []) targets.push({ code, role: 'anchor' });
    if (note) {
      targets.push({ code: note.stroke.code, role: 'next' });
      reaches.push({ finger: note.finger, row: note.row });
      if (note.stroke.shift) {
        const proper = this.layout.properShift(note.stroke.code);
        targets.push({ code: proper, role: 'shift' });
        reaches.push({ finger: proper === 'ShiftLeft' ? 'LP' : 'RP', row: rowOf(proper) });
        extra = `+ ${proper === 'ShiftLeft' ? 'left' : 'right'} shift`;
      }
      if (hint.anchors?.length) {
        extra = `hold ${hint.anchors.map((code) => this.layout.strokeLabel({ code, shift: false })).join(' ')}`;
      }
    }

    this.keyboard.setTargets(targets);
    this.hands.setActive(reaches);
    this.nextEl.classList.toggle('is-empty', !note);
    if (note) this.showNext(note.label, note.finger, note.row, hint.message ?? extra);
  }

  finish(): void {
    const { stats, layout, settings } = this;
    this.updateBars();
    if (stats.chars > 0) {
      // Rounded on the way in: browser storage holds years of these.
      const keys: Record<string, KeyTally> = {};
      for (const [code, [n, err, ms]] of Object.entries(this.setKeys)) keys[code] = [n, err, Math.round(ms)];
      this.store.addHistory({
        t: Date.now(),
        drill: this.drill.id,
        layout: layout.id,
        lang: settings.lang,
        wpm: Math.round(stats.wpm * 100) / 100,
        acc: Math.round(stats.accuracy * 10000) / 10000,
        chars: stats.chars,
        secs: Math.round(stats.activeMs / 100) / 10,
        keys,
      });
    }

    const slowest = this.store
      .fingerSummary(layout)
      .filter((summary) => fingerKind(summary.finger) !== 'thumb' && summary.n >= MIN_SAMPLES)
      .sort((a, b) => b.ms - a.ms)[0];
    const rows: (Node | string)[] = [
      el('dt', {}, 'accuracy'),
      el('dd', {}, `${Math.round(stats.accuracy * 100)}%`),
      el('dt', {}, 'best streak'),
      el('dd', {}, String(stats.bestStreak)),
      el('dt', {}, 'typing time'),
      el('dd', {}, `${Math.round(stats.activeMs / 1000)} s`),
    ];
    if (slowest) {
      rows.push(
        el('dt', {}, 'slowest finger'),
        el(
          'dd',
          {},
          el('span.tok', { 'data-f': fingerKind(slowest.finger), style: '--size:1.125rem' }),
          `${fingerName(slowest.finger)}, ${Math.round(intervalToWpm(slowest.ms))} wpm`,
        ),
      );
    }
    this.result.replaceChildren(
      el('p.result-wpm', {}, String(Math.round(stats.wpm)), el('small', {}, 'wpm for this set')),
      el('dl.result-list', {}, ...rows),
      // A set typed with tracking off: the page says it kept nothing.
      ...(this.store.tracking ? [] : [el('p.result-unsaved', {}, 'not saved: tracking is off')]),
      el('p.result-hint', {}, el('kbd', {}, 'enter'), 'next set'),
    );
    this.stage.append(this.result);
    this.resultOpen = true;
    this.syncRest();
    this.setTyping(false);
  }

  lanes(): { edges: number[]; centres: number[] } {
    return this.keyboard.lanes();
  }

  refresh(): void {
    this.renderOptions();
  }

  say(message: string, tone: 'plain' | 'error' = 'plain'): void {
    this.noteEl.textContent = message;
    this.noteEl.classList.toggle('is-error', tone === 'error');
    this.noteEl.classList.add('is-on');
    if (this.sayTimer) clearTimeout(this.sayTimer);
    this.sayTimer = setTimeout(() => this.noteEl.classList.remove('is-on'), 1600);
  }

  // ---------- fixture ----------

  /** Freeze the screen on fixed values. Only the visual-check fixture calls this. */
  applyFixture(fixture: ReadoutFixture): void {
    this.frozen = true;
    this.setTyping(true);
    this.wpmEl.textContent = String(fixture.wpm);
    this.accEl.textContent = `${fixture.accuracy}%`;
    this.streakEl.textContent = String(fixture.streak);
    this.samples = fixture.spark;
    this.drawSpark();
    for (const kind of FINGER_KINDS) {
      if (kind !== 'thumb') this.fingerFills.get(kind)!.style.setProperty('--v', String(fixture.fingers[kind]));
    }
    if (this.drill instanceof HighwayDrill) this.drill.freeze(fixture.highway);
    const row = rowOf(fixture.next.code);
    this.keyboard.setTargets([{ code: fixture.next.code, role: 'next' }]);
    this.hands.setActive([{ finger: fixture.next.finger, row }]);
    this.nextEl.classList.remove('is-empty');
    this.showNext(fixture.next.label, fixture.next.finger, row, '');
  }

  // ---------- input ----------

  private onKey(event: KeyEvt): void {
    if (this.frozen || this.resultOpen) return;
    this.drill.key(event);
  }

  private onCommand(command: Command): void {
    if (this.frozen) return;
    if (command === 'tempo-up' || command === 'tempo-down') {
      this.drill.nudge?.(command === 'tempo-up' ? 1 : -1);
      this.renderOptions();
      return;
    }
    if (command === 'next' && !this.resultOpen) return;
    this.newSet();
  }

  private newSet(): void {
    this.result.remove();
    this.resultOpen = false;
    this.syncRest();
    this.stats = new SetStats();
    this.setKeys = {};
    this.lastHitAt = null;
    this.missedSince = false;
    this.previousChar = '';
    this.drill.restart();
    this.setTyping(false);
    this.updateReadouts();
  }

  private touch(now: number): void {
    this.lastKeyAt = now;
    this.setTyping(true);
    this.updateReadouts();
  }

  private setTyping(typing: boolean): void {
    this.root.dataset.typing = String(typing);
  }

  /** On a result or the stats view the centre figure leads and the live counter steps back. */
  private syncRest(): void {
    this.root.dataset.rest = String(this.resultOpen || this.drill.id === 'stats');
  }

  // ---------- state changes ----------

  private drillFromHash(): DrillId {
    const id = location.hash.slice(1) as DrillId;
    return DRILL_IDS.includes(id) ? id : this.settings.drill;
  }

  private setDrill(id: DrillId, force = false): void {
    if (!force && this.drill?.id === id) return;
    this.drill?.unmount();
    this.result.remove();
    this.resultOpen = false;
    this.store.update({ drill: id });
    if (location.hash.slice(1) !== id) history.replaceState(null, '', `#${id}`);
    for (const [tabId, tab] of this.tabs) {
      tab.classList.toggle('is-active', tabId === id);
      if (tabId === id) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    }
    this.root.dataset.drill = id;
    this.drill =
      id === 'highway'
        ? new HighwayDrill(this)
        : id === 'anchors'
          ? new AnchorsDrill(this)
          : id === 'stats'
            ? new StatsView(this)
            : new LineDrill(id, this);
    this.stats = new SetStats();
    this.setKeys = {};
    this.lastHitAt = null;
    this.drill.mount(this.stage);
    this.syncRest();
    this.renderOptions();
    this.updateReadouts();
    this.setTyping(false);
  }

  private setLayout(id: string): void {
    this.store.update({ layout: getLayout(id).id });
    this.layout = getLayout(id);
    this.keyboard.setLayout(this.layout);
    this.updateBars();
    this.newSet();
    this.renderOptions();
  }

  private setLang(lang: Lang): void {
    this.store.update({ lang });
    this.syncLang();
    this.newSet();
    this.renderOptions();
  }

  private syncLang(): void {
    for (const [id, button] of this.langButtons) {
      const active = id === this.settings.lang;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    }
  }

  private setTrack(on: boolean): void {
    this.store.update({ track: on });
    this.syncTrack();
    // A set is saved whole or not at all, so the switch starts a fresh one.
    this.newSet();
    this.renderOptions();
  }

  private syncTrack(): void {
    const on = this.store.tracking;
    this.trackSwitch.setAttribute('aria-checked', String(on));
    this.trackSwitch.title = on ? 'sets and key numbers are saved' : 'nothing is saved while this is off';
    this.root.dataset.track = String(on);
  }

  /** Another profile became active: load its layout, language and numbers. The open tab stays. */
  private applyProfile(): void {
    const { settings } = this;
    this.layout = getLayout(settings.layout);
    this.keyboard.setLayout(this.layout);
    this.layoutSelect.set(this.layout.id);
    this.syncLang();
    this.syncTrack();
    this.rolling.windowMs = settings.window * 1000;
    this.rolling.reset();
    this.samples = [];
    this.drawSpark();
    this.setDrill(this.drill.id, true);
    this.updateBars();
  }

  // ---------- rendering ----------

  private showNext(label: string, finger: Finger, row: Row, extra: string): void {
    const kind = fingerKind(finger);
    this.nextCap.textContent = label === ' ' ? '' : label;
    this.nextCap.dataset.f = kind;
    this.nextCap.dataset.row = row;
    // Finger and row are also spelled out, so neither color nor shape is ever the only cue.
    this.nextFinger.replaceChildren(
      el('span.tok', { 'data-f': kind, 'data-row': row }),
      label === ' ' ? 'thumb, space' : `${fingerName(finger)}, ${row} row`,
    );
    this.nextExtra.textContent = extra;
  }

  private updateReadouts(): void {
    this.accEl.textContent = `${Math.round(this.stats.accuracy * 100)}%`;
    this.streakEl.textContent = String(this.stats.streak);
  }

  /** Each bar is that finger's speed as a share of the fastest finger on this layout. */
  private updateBars(): void {
    this.hitsSinceBars = 0;
    const totals = new Map<FingerKind, { n: number; weighted: number }>();
    for (const summary of this.store.fingerSummary(this.layout)) {
      const total = totals.get(fingerKind(summary.finger)) ?? { n: 0, weighted: 0 };
      total.n += summary.n;
      total.weighted += summary.ms * summary.n;
      totals.set(fingerKind(summary.finger), total);
    }
    const speeds = new Map<FingerKind, number>();
    for (const kind of FINGER_KINDS) {
      const total = totals.get(kind);
      speeds.set(kind, total && total.n >= MIN_SAMPLES ? intervalToWpm(total.weighted / total.n) : 0);
    }
    const best = Math.max(...speeds.values(), 1);
    for (const kind of FINGER_KINDS) {
      const fill = this.fingerFills.get(kind)!;
      const speed = speeds.get(kind)!;
      fill.style.setProperty('--v', String(speed / best));
      fill.parentElement!.title = speed > 0 ? `${kind}: ${Math.round(speed)} wpm` : `${kind}: not measured yet`;
    }
  }

  private renderOptions(): void {
    // Runs on every drill, layout and option change, so the stats heat map always matches the saved numbers.
    this.keyboard.setHeat(this.drill.id === 'stats' ? this.heat : null);
    // A drill that charts single keys turns the board's keys into buttons.
    const { drill } = this;
    this.keyboard.setPicker(drill.pickKey ? (code) => drill.pickKey?.(code) : null, drill.pickedKey?.() ?? null);
    const groups: OptionGroup[] = this.drill.options();
    const groupEls = groups.map((group) =>
      el(
        'div.opt',
        {},
        el('span', {}, group.label),
        el(
          'div.seg',
          { role: 'group', 'aria-label': group.label },
          ...group.choices.map((choice) => {
            const on = choice.value === group.value;
            const button = el(on ? 'button.seg-btn.ctl.is-on' : 'button.seg-btn.ctl', { type: 'button', 'aria-pressed': String(on) }, choice.label);
            button.addEventListener('click', () => {
              group.set(choice.value);
              button.blur();
              this.renderOptions();
            });
            return button;
          }),
        ),
      ),
    );
    const hints = el('div.hints');
    if (this.drill.id !== 'stats') hints.append(el('span', {}, el('kbd', {}, 'esc'), 'new text'));
    if (this.drill.id === 'highway' && this.settings.tempoLock) hints.append(el('span', {}, el('kbd', {}, 'up / down'), 'tempo'));
    // Say plainly what the selected layout changes, so nothing is filtered behind the typist's back.
    const notes: string[] = [];
    if (this.layout.note) notes.push(this.layout.note);
    if (this.settings.lang === 'fr' && !this.layout.canType(String.fromCharCode(0xe9))) {
      notes.push('accented words are left out: this layout has no accent keys');
    }
    const note = notes.length > 0 ? el('p.opt-note', {}, notes.join(', ')) : null;
    this.optionsEl.replaceChildren(el('div.opt-groups', {}, ...groupEls, note), hints);
    this.wpmCap.textContent = this.captionText();
  }

  private captionText(): string {
    return `wpm ${String.fromCharCode(0xb7)} rolling ${this.settings.window} s`;
  }

  private drawSpark(): void {
    const { ctx, width, height } = fitCanvas(this.spark);
    ctx.clearRect(0, 0, width, height);
    const points = this.samples;

    // A few seconds of data are needed before a trace says anything. Until then
    // the slot shows an empty track, so it never holds an orphan stub.
    if (points.length < 8 || Math.max(...points) === 0) {
      ctx.strokeStyle = css('--line');
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, height - 0.5);
      ctx.lineTo(width, height - 0.5);
      ctx.stroke();
      return;
    }

    // Scale to the recent range so a steady pace still shows its small swings.
    const low = Math.max(0, Math.min(...points) - 10);
    const peak = Math.max(low + 20, ...points) + 4;
    ctx.strokeStyle = css('--muted');
    ctx.lineWidth = 1.25;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    points.forEach((value, i) => {
      // Newest sample sits at the right edge, like a chart recorder.
      const x = width - ((points.length - 1 - i) / (SPARK_SAMPLES - 1)) * width;
      const y = height - 1.5 - ((value - low) / (peak - low)) * (height - 3);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  private frame = (now: number): void => {
    const dt = Math.min(100, now - this.previousFrame);
    this.previousFrame = now;
    this.drill.tick?.(now, dt);

    if (!this.frozen) {
      const value = this.rolling.value(now);
      // Ease the number so it reads as a rate, not as flicker.
      this.shownWpm += (value - this.shownWpm) * Math.min(1, dt * 0.008);
      const text = String(Math.round(this.shownWpm));
      if (text !== this.shownText) {
        this.shownText = text;
        this.wpmEl.textContent = text;
      }
      if (now - this.sampledAt >= SPARK_EVERY_MS) {
        this.sampledAt = now;
        this.samples.push(value);
        if (this.samples.length > SPARK_SAMPLES) this.samples.shift();
        this.drawSpark();
      }
      if (this.root.dataset.typing === 'true' && now - this.lastKeyAt > IDLE_MS) this.setTyping(false);
    }
    requestAnimationFrame(this.frame);
  };

  private build(): void {
    const tabs = el('nav.tabs', { 'aria-label': 'drills' });
    for (const id of DRILL_IDS) {
      const tab = el('button.tab.ctl', { type: 'button' }, id);
      tab.addEventListener('click', () => {
        tab.blur();
        this.setDrill(id);
      });
      this.tabs.set(id, tab);
      tabs.append(tab);
    }

    this.layoutSelect = new Select(
      'keyboard layout',
      LAYOUTS.map((layout) => ({ value: layout.id, label: layout.name })),
      this.layout.id,
      (value) => this.setLayout(value),
    );
    this.profileMenu = new ProfileMenu(this.store, () => this.applyProfile());
    this.trackSwitch.addEventListener('click', () => {
      this.trackSwitch.blur();
      this.setTrack(!this.store.tracking);
    });

    const lang = el('div.lang', { role: 'group', 'aria-label': 'practice language' });
    (['fr', 'en'] as Lang[]).forEach((id, i) => {
      const active = id === this.settings.lang;
      const button = el(active ? 'button.lang-btn.ctl.is-active' : 'button.lang-btn.ctl', { type: 'button', 'aria-pressed': String(active) }, id);
      button.addEventListener('click', () => {
        button.blur();
        this.setLang(id);
      });
      this.langButtons.set(id, button);
      if (i > 0) lang.append(el('span', { 'aria-hidden': 'true' }, '/'));
      lang.append(button);
    });

    const fingers = el('section.fingers', {}, el('h2.fingers-title', {}, 'fingers'));
    for (const kind of FINGER_KINDS) {
      const fill = el('div.finger-fill', { 'data-f': kind });
      this.fingerFills.set(kind, fill);
      fingers.append(el('div.finger-row', {}, el('span', {}, kind), el('div.finger-track', {}, fill)));
    }

    this.nextEl.append(el('p.next-label', {}, 'next key'), this.nextCap, this.nextFinger, this.nextExtra);

    // The caption doubles as the control for the rolling window: 5, 10 or 30 seconds.
    this.wpmCap.addEventListener('click', () => {
      const window = WINDOWS[(WINDOWS.indexOf(this.settings.window) + 1) % WINDOWS.length];
      this.store.update({ window });
      this.rolling.windowMs = window * 1000;
      this.wpmCap.textContent = this.captionText();
      this.wpmCap.blur();
    });

    this.root.append(
      el('header.top', {}, el('div.top-in', {}, el('span.wordmark', {}, brandMark(), 'petitdoigt'), tabs, el('div.top-right', {}, this.trackSwitch, el('div.top-selects', {}, this.profileMenu.root, this.layoutSelect.root), lang))),
      el(
        'main.cockpit',
        {},
        el(
          'aside.rail-left',
          { 'aria-label': 'speed and accuracy' },
          this.wpmEl,
          this.wpmCap,
          this.spark,
          el(
            'div.pair',
            {},
            el('div.stat', {}, el('span.stat-label', {}, 'acc'), this.accEl),
            el('div.pair-rule'),
            el('div.stat', {}, el('span.stat-label', {}, 'streak'), this.streakEl),
          ),
          fingers,
          el('p.rail-note', {}, 'tracking is off: nothing you type is saved'),
        ),
        el('section.centre', { 'aria-label': 'drill' }, this.stage, this.keyboard.root, el('div.foot', {}, this.optionsEl, this.noteEl)),
        el('aside.rail-right', { 'aria-label': 'finger to use' }, this.hands.root, this.nextEl),
      ),
    );
  }
}
