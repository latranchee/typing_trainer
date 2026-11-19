import type { Finger, FingerKind } from '../core/fingers';
import { FINGER_KINDS, fingerKind } from '../core/fingers';
import type { Weakness } from '../core/generator';
import type { Floor } from '../core/hardcore';
import { dangerAmount, dangerLevel, FLOORS, Fuse, MAX_TYPOS, WARMUP_MS } from '../core/hardcore';
import type { KeyTally } from '../core/history';
import { LANG_NAMES, setUiLang, t } from '../core/i18n';
import type { Command, KeyEvt } from '../core/input';
import { attachInput } from '../core/input';
import type { Layout } from '../core/layouts';
import { getLayout, LAYOUTS } from '../core/layouts';
import { intervalToWpm, MIN_SAMPLES, RollingWpm, SetStats } from '../core/metrics';
import type { Row } from '../core/physical';
import { rowOf } from '../core/physical';
import type { DrillId, Lang, Settings } from '../core/store';
import { DRILL_IDS, LANGS, Store } from '../core/store';
import { AnchorsDrill } from '../drills/anchors';
import type { HighwayFixture } from '../drills/highway';
import { HighwayDrill } from '../drills/highway';
import { LineDrill } from '../drills/line';
import { StatsView } from '../drills/stats';
import type { Drill, DrillHost, NextHint, Note, OptionGroup } from '../drills/types';
import { css, el, fitCanvas, flash } from './dom';
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

  /** Hardcore: wrong keys typed past the cursor, oldest first, waiting for Backspace. */
  private typos: string[] = [];
  /** The hint the drill last gave. While typos wait, the rails show Backspace instead. */
  private drillHint: NextHint = { note: null };
  private fuse = new Fuse();
  /** When the set's first right key landed: the fuse is lit a warm-up after it. */
  private firstHitAt: number | null = null;
  private shownLife = -1;
  private fuseState = '';

  private root: HTMLElement;
  private tabs = new Map<DrillId, HTMLButtonElement>();
  private uiButtons = new Map<Lang, HTMLButtonElement>();
  /** Every fixed string on screen: each entry writes one text or attribute in the current interface language. */
  private labels: (() => void)[] = [];
  private layoutSelect!: Select;
  private profileMenu!: ProfileMenu;
  private trackLabel = el('span');
  private trackSwitch = el('button.track.ctl', { type: 'button', role: 'switch' }, this.trackLabel, el('span.switch', { 'aria-hidden': 'true' }));
  private wpmEl = el('output.wpm', {}, '0');
  /** "/100" after the live WPM: the hardcore floor. */
  private floorEl = el('span.wpm-floor');
  /** Hardcore: the cord across the top of the centre column that burns while the rolling WPM is under the floor. */
  private fuseEl = el('div.fuse', { 'aria-hidden': 'true' }, el('span.fuse-cord'));
  /** Hardcore: the coral that closes in from the screen edges as the fuse runs out. */
  private dangerEl = el('div.danger', { 'aria-hidden': 'true' });
  private wpmCap = el('button.wpm-cap.ctl', { type: 'button' });
  private spark = el('canvas.spark', { role: 'img' });
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
    setUiLang(this.store.settings.ui);
    document.documentElement.lang = this.store.settings.ui;
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
      erase: (all, time) => this.onErase(all, time),
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
      if (!correct) this.say(t.next.useShift(proper === 'ShiftLeft' ? 'left' : 'right'), 'error');
    }

    this.lastHitAt = now;
    this.missedSince = false;
    this.firstHitAt ??= now;
    this.touch(now);
    if (++this.hitsSinceBars >= 25) this.updateBars();
  }

  miss(expected: Note, event: KeyEvt): void {
    this.stats.miss(event.time);
    this.store.recordError(this.layout.id, expected.stroke.code);
    (this.setKeys[expected.stroke.code] ??= [0, 0, 0])[1]++;
    this.keyboard.wrong(event.code);
    this.missedSince = true;
    if (this.hardcore) this.addTypo(event);
    this.touch(event.time);
  }

  setNext(hint: NextHint): void {
    this.drillHint = hint;
    this.showHint();
  }

  /** Puts the drill's next key on the board, the hands and the right rail, or Backspace while typos wait. */
  private showHint(): void {
    if (this.frozen) return;
    if (this.typos.length > 0) {
      this.keyboard.setTargets([{ code: 'Backspace', role: 'erase' }]);
      this.hands.setActive([{ finger: 'RP', row: rowOf('Backspace') }]);
      this.nextEl.classList.remove('is-empty');
      this.nextEl.classList.add('is-erase');
      this.showNext(t.keyCaps.bksp, 'RP', rowOf('Backspace'), t.hardcore.erase(this.typos.length), `${t.finger('RP')}, ${t.keyCaps.bksp}`);
      return;
    }
    this.nextEl.classList.remove('is-erase');
    const hint = this.drillHint;
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
        extra = t.next.plusShift(proper === 'ShiftLeft' ? 'left' : 'right');
      }
      if (hint.anchors?.length) {
        extra = t.next.hold(hint.anchors.map((code) => this.layout.strokeLabel({ code, shift: false })).join(' '));
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
      el('dt', {}, t.result.accuracy),
      el('dd', {}, `${Math.round(stats.accuracy * 100)}%`),
      el('dt', {}, t.result.bestStreak),
      el('dd', {}, String(stats.bestStreak)),
      el('dt', {}, t.result.time),
      el('dd', {}, `${Math.round(stats.activeMs / 1000)} s`),
    ];
    if (slowest) {
      rows.push(
        el('dt', {}, t.result.slowest),
        el(
          'dd',
          {},
          el('span.tok', { 'data-f': fingerKind(slowest.finger), style: '--size:1.125rem' }),
          t.result.slowestValue(slowest.finger, Math.round(intervalToWpm(slowest.ms))),
        ),
      );
    }
    if (this.floor > 0) rows.push(el('dt', {}, t.hardcore.floor), el('dd', {}, t.hardcore.held(this.floor)));
    this.openResult(
      el('p.result-wpm', {}, String(Math.round(stats.wpm)), el('small', {}, t.result.forSet)),
      el('dl.result-list', {}, ...rows),
      // A set typed with tracking off: the page says it kept nothing.
      this.store.tracking ? null : el('p.result-unsaved', {}, t.result.unsaved),
    );
  }

  /**
   * The fuse burnt out: the set ends here, failed. It stays out of the set history,
   * which holds finished sets; its keys were already counted as they were typed.
   */
  private fail(): void {
    const { stats } = this;
    const floor = this.floor;
    this.typos = [];
    this.drillHint = { note: null };
    this.showHint();
    this.updateBars();
    flash(this.root, 'is-failing', 900);
    this.openResult(
      el('p.result-failed', {}, t.hardcore.failed(floor)),
      el('p.result-wpm.is-failed', {}, String(Math.round(stats.wpm)), el('small', {}, t.result.forSet)),
      el(
        'dl.result-list',
        {},
        el('dt', {}, t.hardcore.lasted),
        el('dd', {}, `${Math.round(stats.activeMs / 1000)} s`),
        el('dt', {}, t.result.accuracy),
        el('dd', {}, `${Math.round(stats.accuracy * 100)}%`),
        el('dt', {}, t.result.bestStreak),
        el('dd', {}, String(stats.bestStreak)),
      ),
      el('p.result-unsaved', {}, t.hardcore.notSaved),
    );
  }

  private openResult(...parts: (HTMLElement | null)[]): void {
    this.result.replaceChildren(...parts.filter((part) => part !== null), el('p.result-hint', {}, el('kbd', {}, t.result.enter), t.result.nextSet));
    this.stage.append(this.result);
    this.resultOpen = true;
    this.syncRest();
    this.setTyping(false);
    this.paintFuse(false, false);
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
    // Hardcore: past a typo every key lands as one more, right or wrong, until Backspace clears them.
    if (this.hardcore && this.typos.length > 0) {
      this.stats.miss(event.time);
      this.keyboard.wrong(event.code);
      this.addTypo(event);
      this.touch(event.time);
      return;
    }
    this.drill.key(event);
  }

  // ---------- hardcore ----------

  /** Hardcore runs on the drills that can show a typo run: the highway, words and pairs. */
  private get hardcore(): boolean {
    return this.settings.hardcore && this.drill?.typos !== undefined;
  }

  /** The rolling WPM the set fails under, 0 when there is none. */
  private get floor(): number {
    return this.hardcore ? this.settings.floor : 0;
  }

  private addTypo(event: KeyEvt): void {
    // A full run takes no more: the board still flashes the key.
    if (this.typos.length >= MAX_TYPOS) return;
    this.typos.push(this.layout.strokeLabel({ code: event.code, shift: event.shift }));
    this.drill.typos?.(this.typos);
    this.showHint();
  }

  private onErase(all: boolean, time: number): void {
    if (this.frozen || this.resultOpen || this.typos.length === 0) return;
    if (all) this.typos = [];
    else this.typos.pop();
    // Erasing is typing time: it counts toward the set's pace.
    this.stats.pace(time);
    this.drill.typos?.(this.typos);
    this.showHint();
    this.touch(time);
  }

  /** A fresh set: no typos, a full fuse, unlit until the first right key and the warm-up after it. */
  private resetHardcore(): void {
    this.typos = [];
    this.fuse.reset();
    this.firstHitAt = null;
    this.drill?.typos?.(this.typos);
    this.showHint();
    this.paintFuse(false, false);
  }

  /** Burns or regrows the fuse for one frame of the rolling WPM, and fails the set once it is out. */
  private burn(now: number, dt: number, wpm: number): void {
    const { floor } = this;
    const lit = floor > 0 && !this.resultOpen && this.firstHitAt !== null && now - this.firstHitAt >= WARMUP_MS;
    if (lit && this.fuse.step(wpm, floor, dt)) {
      this.fail();
      return;
    }
    this.paintFuse(lit, lit && wpm < floor);
  }

  /**
   * Hands the fuse to the stylesheet: `--life` (1 full, 0 out), `--danger` (0 to 1 as
   * the end nears) and three attributes: whether there is a fuse and whether it is lit,
   * whether the rolling WPM is under the floor, and how fast the heartbeat runs.
   */
  private paintFuse(lit: boolean, under: boolean): void {
    const life = Math.round(this.fuse.life * 400) / 400;
    if (life !== this.shownLife) {
      this.shownLife = life;
      this.root.style.setProperty('--life', String(life));
      this.root.style.setProperty('--danger', dangerAmount(life).toFixed(3));
    }
    const fuse = this.floor > 0 ? (lit ? 'lit' : 'ready') : 'off';
    const beat = under ? Math.max(1, dangerLevel(life)) : 0;
    const state = `${fuse}|${under}|${beat}`;
    if (state === this.fuseState) return;
    this.fuseState = state;
    const crossed = this.root.dataset.under !== String(under);
    this.root.dataset.fuse = fuse;
    this.root.dataset.under = String(under);
    this.root.dataset.beat = String(beat);
    // The floor rule on the sparkline turns coral the moment the rate crosses it.
    if (crossed) this.drawSpark();
  }

  /** The hardcore switch and, when it is on, the floor. They join the options of every drill that takes part. */
  private hardcoreOptions(): OptionGroup[] {
    const { settings } = this;
    const groups: OptionGroup[] = [
      {
        label: t.hardcore.label,
        value: settings.hardcore ? 'on' : 'off',
        choices: [
          { value: 'off', label: t.line.off },
          { value: 'on', label: t.line.on },
        ],
        set: (value) => {
          this.store.update({ hardcore: value === 'on' });
          this.newSet();
        },
      },
    ];
    if (settings.hardcore) {
      groups.push({
        label: t.hardcore.floor,
        value: String(settings.floor),
        choices: FLOORS.map((floor) => ({ value: String(floor), label: floor === 0 ? t.hardcore.noFloor : String(floor) })),
        set: (value) => {
          this.store.update({ floor: Number(value) as Floor });
          this.newSet();
        },
      });
    }
    return groups;
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
    this.typos = [];
    this.drill.restart();
    this.resetHardcore();
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
    this.typos = [];
    this.drill.mount(this.stage);
    this.resetHardcore();
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

  private setUi(lang: Lang): void {
    if (lang === this.settings.ui) return;
    this.store.update({ ui: lang });
    this.applyUi();
    // A drill writes its own text when it mounts, so the open one is mounted again. The set in progress restarts.
    this.setDrill(this.drill.id, true);
    this.updateBars();
  }

  /** Rewrites every fixed string in the profile's interface language. Drill content follows when the drill mounts. */
  private applyUi(): void {
    const { ui } = this.settings;
    setUiLang(ui);
    document.documentElement.lang = ui;
    for (const write of this.labels) write();
    this.layoutSelect.relabel(
      t.top.layout,
      LAYOUTS.map((layout) => t.layouts[layout.id]),
    );
    this.profileMenu.refresh();
    // The board's fixed legends (shift, enter, space) are interface strings too.
    this.keyboard.setLayout(this.layout);
    for (const [id, button] of this.uiButtons) {
      const active = id === ui;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    }
    this.syncTrack();
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
    this.trackSwitch.title = on ? t.top.trackingOn : t.top.trackingOff;
    this.root.dataset.track = String(on);
  }

  /** Another profile became active: load its layout, languages and numbers. The open tab stays. */
  private applyProfile(): void {
    const { settings } = this;
    this.layout = getLayout(settings.layout);
    this.applyUi();
    this.layoutSelect.set(this.layout.id);
    this.rolling.windowMs = settings.window * 1000;
    this.rolling.reset();
    this.samples = [];
    this.drawSpark();
    this.setDrill(this.drill.id, true);
    this.updateBars();
  }

  // ---------- rendering ----------

  /** `named` replaces the finger-and-row line, for a key that is not a letter. */
  private showNext(label: string, finger: Finger, row: Row, extra: string, named?: string): void {
    const kind = fingerKind(finger);
    this.nextCap.textContent = label === ' ' ? '' : label;
    this.nextCap.dataset.f = kind;
    this.nextCap.dataset.row = row;
    // Finger and row are also spelled out, so neither color nor shape is ever the only cue.
    this.nextFinger.replaceChildren(
      el('span.tok', { 'data-f': kind, 'data-row': row }),
      named ?? (label === ' ' ? t.next.space : t.next.finger(finger, row)),
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
      fill.parentElement!.title = t.rail.bar(kind, speed > 0 ? Math.round(speed) : null);
    }
  }

  private renderOptions(): void {
    // Runs on every drill, layout and option change, so the stats heat map always matches the saved numbers.
    this.keyboard.setHeat(this.drill.id === 'stats' ? this.heat : null);
    // A drill that charts single keys turns the board's keys into buttons.
    const { drill } = this;
    this.keyboard.setPicker(drill.pickKey ? (code) => drill.pickKey?.(code) : null, drill.pickedKey?.() ?? null);
    const groups: OptionGroup[] = [...this.drill.options(), ...(this.drill.typos ? this.hardcoreOptions() : [])];
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
              // An option that brings new text leaves no typo behind and starts a full fuse.
              this.resetHardcore();
              button.blur();
              this.renderOptions();
            });
            return button;
          }),
        ),
      ),
    );
    const hints = el('div.hints');
    if (this.drill.id !== 'stats') hints.append(el('span', {}, el('kbd', {}, t.options.esc), t.options.newText));
    if (this.drill.id === 'highway' && this.settings.tempoLock) hints.append(el('span', {}, el('kbd', {}, t.options.arrows), t.options.tempo));
    if (this.hardcore) hints.append(el('span', {}, el('kbd', {}, t.hardcore.ctrlBksp), t.hardcore.eraseAll));
    // Say plainly what the selected layout changes, so nothing is filtered behind the typist's back.
    const notes: string[] = [];
    const layoutNote = t.layoutNotes[this.layout.id];
    if (layoutNote) notes.push(layoutNote);
    if (this.settings.lang === 'fr' && !this.layout.canType(String.fromCharCode(0xe9))) notes.push(t.options.noAccents);
    const note = notes.length > 0 ? el('p.opt-note', {}, notes.join(', ')) : null;
    // The key hints close the last line of options. A note takes its own line under them.
    this.optionsEl.replaceChildren(el('div.opt-groups', {}, ...groupEls, hints.childElementCount > 0 ? hints : null, note));
    this.wpmCap.textContent = this.captionText();
    const { floor } = this;
    this.floorEl.textContent = floor > 0 ? `/${floor}` : '';
    this.floorEl.title = floor > 0 ? t.hardcore.floorTitle(floor) : '';
  }

  private captionText(): string {
    return t.rail.caption(this.settings.window);
  }

  private drawSpark(): void {
    const { ctx, width, height } = fitCanvas(this.spark);
    ctx.clearRect(0, 0, width, height);
    const points = this.samples;

    const { floor } = this;

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

    // Scale to the recent range so a steady pace still shows its small swings. A hardcore floor stays in view.
    const low = Math.max(0, Math.min(...points, floor > 0 ? floor - 6 : Infinity) - 10);
    const peak = Math.max(low + 20, ...points, floor) + 4;
    if (floor > 0) {
      // The floor: a dashed rule the trace must stay above, coral while it is under.
      const y = Math.round(height - 1.5 - ((floor - low) / (peak - low)) * (height - 3)) + 0.5;
      ctx.save();
      ctx.strokeStyle = this.root.dataset.under === 'true' ? css('--error') : css('--line-strong');
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
      ctx.restore();
    }
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
      this.burn(now, dt, value);
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

  /** Sets a fixed string now, and again whenever the interface language changes. With `attr` it goes in that attribute. */
  private label<T extends Element>(node: T, text: () => string, attr?: string): T {
    const write = (): void => {
      if (attr) node.setAttribute(attr, text());
      else node.textContent = text();
    };
    this.labels.push(write);
    write();
    return node;
  }

  private build(): void {
    const tabs = this.label(el('nav.tabs'), () => t.top.drills, 'aria-label');
    for (const id of DRILL_IDS) {
      const tab = this.label(el('button.tab.ctl', { type: 'button' }), () => t.drills[id]);
      tab.addEventListener('click', () => {
        tab.blur();
        this.setDrill(id);
      });
      this.tabs.set(id, tab);
      tabs.append(tab);
    }

    this.layoutSelect = new Select(
      t.top.layout,
      LAYOUTS.map((layout) => ({ value: layout.id, label: t.layouts[layout.id] })),
      this.layout.id,
      (value) => this.setLayout(value),
    );
    this.profileMenu = new ProfileMenu(this.store, () => this.applyProfile());
    this.label(this.trackLabel, () => t.top.tracking);
    this.trackSwitch.addEventListener('click', () => {
      this.trackSwitch.blur();
      this.setTrack(!this.store.tracking);
    });

    // The interface language. The language of the practice text is a drill option.
    const lang = this.label(el('div.lang', { role: 'group' }), () => t.top.interfaceLanguage, 'aria-label');
    LANGS.forEach((id, i) => {
      const active = id === this.settings.ui;
      const button = el(
        active ? 'button.lang-btn.ctl.is-active' : 'button.lang-btn.ctl',
        { type: 'button', lang: id, title: LANG_NAMES[id], 'aria-label': LANG_NAMES[id], 'aria-pressed': String(active) },
        id,
      );
      button.addEventListener('click', () => {
        button.blur();
        this.setUi(id);
      });
      this.uiButtons.set(id, button);
      if (i > 0) lang.append(el('span', { 'aria-hidden': 'true' }, '/'));
      lang.append(button);
    });

    const fingers = el('section.fingers', {}, this.label(el('h2.fingers-title'), () => t.rail.fingers));
    for (const kind of FINGER_KINDS) {
      const fill = el('div.finger-fill', { 'data-f': kind });
      this.fingerFills.set(kind, fill);
      fingers.append(el('div.finger-row', {}, this.label(el('span'), () => t.kinds[kind]), el('div.finger-track', {}, fill)));
    }

    this.nextEl.append(this.label(el('p.next-label'), () => t.next.title), this.nextCap, this.nextFinger, this.nextExtra);
    this.label(this.wpmEl, () => t.rail.wpm, 'aria-label');
    this.label(this.wpmCap, () => t.rail.window, 'title');
    this.label(this.spark, () => t.rail.spark, 'aria-label');

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
        this.label(
          el(
            'aside.rail-left',
            {},
            el('div.wpm-line', {}, this.wpmEl, this.floorEl),
            this.wpmCap,
            this.spark,
            el(
              'div.pair',
              {},
              el('div.stat', {}, this.label(el('span.stat-label'), () => t.rail.accuracy), this.accEl),
              el('div.pair-rule'),
              el('div.stat', {}, this.label(el('span.stat-label'), () => t.rail.streak), this.streakEl),
            ),
            fingers,
            this.label(el('p.rail-note'), () => t.rail.untracked),
          ),
          () => t.rail.region,
          'aria-label',
        ),
        this.label(el('section.centre', {}, this.stage, this.keyboard.root, el('div.foot', {}, this.optionsEl, this.noteEl), this.fuseEl), () => t.options.region, 'aria-label'),
        this.label(el('aside.rail-right', {}, this.hands.root, this.nextEl), () => t.next.region, 'aria-label'),
      ),
      this.dangerEl,
    );
  }
}
