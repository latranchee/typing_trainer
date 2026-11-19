import type { Finger, FingerKind } from '../core/fingers';
import { FINGER_KINDS, fingerKind } from '../core/fingers';
import type { Weakness } from '../core/generator';
import type { Difficulty, Floor, Rules, RunBest } from '../core/hardcore';
import {
  beatLevel,
  CLIMB_EVERY_MS,
  clock,
  dangerAmount,
  DEFAULT_DIFFICULTY,
  DIFFICULTIES,
  FLOORS,
  Fuse,
  Heart,
  MAX_TYPOS,
  RULES,
  Run,
  runKey,
  tremorAmount,
  tunnelAmount,
} from '../core/hardcore';
import type { KeyTally } from '../core/history';
import { LANG_NAMES, setUiLang, t } from '../core/i18n';
import type { Command, KeyEvt } from '../core/input';
import { attachInput } from '../core/input';
import type { Layout } from '../core/layouts';
import { getLayout, LAYOUTS } from '../core/layouts';
import { intervalToWpm, MIN_SAMPLES, RollingWpm, SetStats } from '../core/metrics';
import type { Row } from '../core/physical';
import { rowOf } from '../core/physical';
import { dayStreak, fingerGain, setVerdict, Streak, STREAK_SHOWN_FROM, streakKey } from '../core/rewards';
import type { DrillId, Lang, Settings } from '../core/store';
import { DRILL_IDS, LANGS, Store } from '../core/store';
import type { KeySound } from '../core/switches';
import { SWITCHES } from '../core/switches';
import { AnchorsDrill } from '../drills/anchors';
import type { HighwayFixture } from '../drills/highway';
import { HighwayDrill } from '../drills/highway';
import { LineDrill } from '../drills/line';
import { StatsView } from '../drills/stats';
import type { Drill, DrillHost, NextHint, Note, OptionGroup } from '../drills/types';
import { toggleOption } from '../drills/types';
import { css, el, fitCanvas, flash } from './dom';
import { HandsView } from './hands';
import type { KeyRole } from './keyboard';
import { KeyboardView } from './keyboard';
import { brandMark } from './mark';
import { ProfileMenu } from './profile';
import { Select } from './select';
import { Sound } from './sound';

/** A gap longer than this between strokes is a pause and is not measured. */
const PAUSE_MS = 2000;
/** Options come back after this long without a keypress. */
const IDLE_MS = 3500;
const SPARK_SAMPLES = 120;
const SPARK_EVERY_MS = 500;
const WINDOWS: Settings['window'][] = [5, 10, 30];
const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';
/** A result's WPM counts up from zero for this long. */
const COUNT_UP_MS = 520;
/** The key sounds on offer, in the order of the list. The first choice is silence, named in the interface language. */
const keySoundNames = (): string[] => [t.options.keySoundOff, ...SWITCHES.map((item) => item.name)];

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

  /** Right keys in a row, from one set to the next, held against the longest streak on this layout and drill. */
  private streak = new Streak();
  private streakKey = '';
  /** True once a key of this set took the streak past the best it began against. */
  private recordInSet = false;
  private shownStreak = '';

  /** Hardcore: wrong keys typed past the cursor, oldest first, waiting for Backspace. */
  private typos: string[] = [];
  /** The hint the drill last gave. While typos wait, the rails show Backspace instead. */
  private drillHint: NextHint = { note: null };
  /** Hardcore: the fuse. Each run sets it to the rules of the difficulty picked in the options. */
  private fuse = new Fuse(RULES[DEFAULT_DIFFICULTY]);
  /** Hardcore: the sets cleared in a row under the floor. It carries the climbing floor and the held time. */
  private run = new Run(0);
  /** Where the run's bests are saved: its layout, drill, starting floor and difficulty. */
  private runKey = '';
  /** The best run under that key as it stood when this run began: what there is to beat. */
  private runBest: RunBest = { ms: 0, sets: 0 };
  /** When the set's first right key landed: the fuse is lit a warm-up after it. */
  private firstHitAt: number | null = null;
  /** True while the fuse is lit: the warm-up is over and no result is open. */
  private lit = false;
  private heart = new Heart();
  private beat: 0 | 1 | 2 | 3 = 0;
  private sound = new Sound();
  private calm = window.matchMedia('(prefers-reduced-motion: reduce)');
  /** Where the edges, the narrowing and the tremor are heading, and where they are: each eases to its mark. */
  private stressTo = { danger: 0, tunnel: 0, tremor: 0 };
  private stress = { danger: 0, tunnel: 0, tremor: 0 };
  private shownStress = { danger: '', tunnel: '', tremor: '', pulse: '' };
  private shownLife = -1;
  private shownCap = -1;
  private shownRun = '';
  private fuseState = '';

  private root: HTMLElement;
  private tabs = new Map<DrillId, HTMLButtonElement>();
  private uiButtons = new Map<Lang, HTMLButtonElement>();
  /** Every fixed string on screen: each entry writes one text or attribute in the current interface language. */
  private labels: (() => void)[] = [];
  private layoutSelect!: Select;
  /** What the keys sound like. One dropdown for every drill: it is put back into the options each time they are drawn. */
  private soundSelect!: Select;
  /** The label of the switch just clicked: it is drawn again in its old state and slides to the new one. */
  private flipped: string | null = null;
  private profileMenu!: ProfileMenu;
  private mark = brandMark();
  private trackLabel = el('span');
  private trackSwitch = el('button.track.toggle.ctl', { type: 'button', role: 'switch' }, this.trackLabel, el('span.switch', { 'aria-hidden': 'true' }));
  private wpmEl = el('output.wpm', {}, '0');
  /** "/100" after the live WPM: the hardcore floor. */
  private floorEl = el('span.wpm-floor');
  /** Hardcore: the cord across the top of the centre column that burns while the rolling WPM is under the floor. */
  private fuseEl = el('div.fuse', { 'aria-hidden': 'true' }, el('span.fuse-track'), el('span.fuse-cord'));
  /** Hardcore: the coral that closes in from the screen edges as the fuse runs out. */
  private dangerEl = el('div.danger', { 'aria-hidden': 'true' });
  /** Hardcore: the coral that blinks at the screen edges on a wrong key. */
  private stingEl = el('div.sting', { 'aria-hidden': 'true' });
  /** Hardcore: the run's held time and cleared sets, each followed by the best to beat. */
  private heldEl = el('span.stat-value', {}, '0:00');
  private heldBestEl = el('span.stat-best');
  private setsEl = el('span.stat-value', {}, '0');
  private setsBestEl = el('span.stat-best');
  private wpmCap = el('button.wpm-cap.ctl', { type: 'button' });
  private spark = el('canvas.spark', { role: 'img' });
  private accEl = el('span.stat-value', {}, '100%');
  private streakEl = el('span.stat-value', {}, '0');
  /** Under the streak: the longest one, the number to beat. */
  private streakBestEl = el('span.stat-best');
  private comboCount = el('span.combo-count', {}, '0');
  private comboLabel = el('span.combo-label');
  /**
   * The streak again, over the right end of the keyboard, close to where the eyes are:
   * it comes up once the streak is worth a look. The left rail holds the same number for a screen reader.
   */
  private comboEl = el('div.combo', { 'aria-hidden': 'true', 'data-on': 'false' }, this.comboCount, this.comboLabel);
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
    this.sound.use(this.settings.keySound);

    attachInput({
      key: (event) => this.onKey(event),
      down: (code) => {
        this.held.add(code);
        this.keyboard.down(code);
        // A keypress is the gesture a browser asks for before it plays a sound.
        this.sound.wake();
        // While the list of switches is open the keys stay quiet: the list plays the switch under the cursor.
        if (!this.soundSelect.isOpen) this.sound.press(code);
        this.drill.held?.(this.held);
      },
      up: (code) => {
        const wasDown = this.held.delete(code);
        this.keyboard.up(code);
        if (wasDown && !this.soundSelect.isOpen) this.sound.release(code);
        this.drill.held?.(this.held);
      },
      command: (command) => this.onCommand(command),
      erase: (all, time) => this.onErase(all, time),
    });
    window.addEventListener('pointermove', () => {
      if (performance.now() - this.lastKeyAt > 400) this.setTyping(false);
    });
    // A click wakes the audio as well, so the first key after one already has its sound.
    window.addEventListener('pointerdown', () => this.sound.wake(), { passive: true });
    window.addEventListener('hashchange', () => this.setDrill(this.drillFromHash()));
    window.addEventListener('pagehide', () => {
      // A streak still running is banked as it stands.
      this.store.recordStreak(this.streakKey, this.streak.count);
      this.store.flush();
    });
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
    const step = this.streak.hit();
    if (step.record) this.celebrate();
    else if (step.milestone) this.markMilestone();
    this.touch(now);
    if (++this.hitsSinceBars >= 25) this.updateBars();
  }

  miss(expected: Note, event: KeyEvt): void {
    this.stats.miss(event.time);
    this.store.recordError(this.layout.id, expected.stroke.code);
    (this.setKeys[expected.stroke.code] ??= [0, 0, 0])[1]++;
    this.keyboard.wrong(event.code);
    this.missedSince = true;
    this.endStreak(true);
    this.touch(event.time);
    if (this.hardcore) this.wrongKey(event);
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
    const { stats, layout, settings, store } = this;
    this.updateBars();
    // The set is held against the ones before it, so both are read before it joins them.
    const verdict = setVerdict(store.history, layout.id, this.drill.id, settings.lang, stats.wpm);
    const gain = fingerGain(store.history, layout, this.setKeys);
    // The streak runs on into the next set: it is banked as it stands.
    store.recordStreak(this.streakKey, this.streak.count);
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
    // A record is only called one when it is being kept.
    const badge = (text: string, earned: boolean): HTMLElement | null => (earned ? el('span.result-best', {}, text) : null);
    const rows: (Node | string)[] = [
      el('dt', {}, t.result.accuracy),
      el('dd', {}, `${Math.round(stats.accuracy * 100)}%`, badge(t.result.clean, stats.wrong === 0 && stats.correct > 0)),
      el('dt', {}, t.result.bestStreak),
      // The longest streak that ran through this set: one carried in from the set before counts whole.
      el('dd', {}, String(Math.max(stats.bestStreak, this.streak.count)), badge(t.result.newBest, this.recordInSet && store.tracking)),
      el('dt', {}, t.result.time),
      el('dd', {}, `${Math.round(stats.activeMs / 1000)} s`),
    ];
    if (gain) {
      rows.push(
        el('dt', {}, t.result.gain),
        el(
          'dd',
          {},
          el('span.tok', { 'data-f': fingerKind(gain.finger), style: '--size:1.125rem' }),
          t.result.gainValue(gain.finger, Math.round(gain.wpm), Math.round(gain.gain)),
        ),
      );
    }
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
    const { floor, run } = this;
    if (floor > 0) {
      // A cleared set joins the run, and the run's numbers are banked at once.
      run.sets++;
      this.store.recordRun(this.runKey, run.ms, run.sets);
      rows.push(el('dt', {}, t.hardcore.floor), el('dd', {}, t.hardcore.held(floor)), el('dt', {}, t.hardcore.run), this.runValue(run));
      this.showRun();
    }
    // Under the figure, what it is worth: against the last ten sets of this kind, and the days of practice in a row.
    const wpm = Math.round(stats.wpm);
    const notes: string[] = [];
    if (verdict.usual !== null) {
      const delta = wpm - Math.round(verdict.usual);
      notes.push(delta > 0 ? t.result.over(delta) : delta < 0 ? t.result.under(-delta) : t.result.level);
    }
    const days = store.tracking ? dayStreak(store.history, Date.now()) : 0;
    if (days >= 2) notes.push(t.result.days(days));
    const isBest = verdict.isBest && store.tracking;
    const figure = el('span.result-figure', { style: `min-width:${String(wpm).length}ch` }, String(wpm));
    this.openResult(
      el('p.result-wpm', {}, figure, el('small', {}, t.result.forSet)),
      isBest || notes.length > 0 ? el('p.result-vs', {}, badge(t.result.newBest, isBest), notes.join(' · ')) : null,
      el('dl.result-list', {}, ...rows),
      // A set typed with tracking off: the page says it kept nothing.
      store.tracking ? null : el('p.result-unsaved', {}, t.result.unsaved),
    );
    this.countUp(figure, wpm);
    if (isBest) this.cheer();
  }

  /** Runs a figure up from zero to its value. Under reduced motion it is simply there. */
  private countUp(node: HTMLElement, to: number): void {
    if (this.calm.matches || to <= 0) return;
    const startedAt = performance.now();
    const step = (now: number): void => {
      if (!node.isConnected) return;
      const progress = Math.min(1, (now - startedAt) / COUNT_UP_MS);
      // Fast at first, then settling on the number.
      node.textContent = String(Math.round(to * (1 - (1 - progress) ** 4)));
      if (progress < 1) requestAnimationFrame(step);
    };
    node.textContent = '0';
    requestAnimationFrame(step);
  }

  /**
   * The fuse burnt out: the set ends here, failed. It stays out of the set history,
   * which holds finished sets; its keys were already counted as they were typed.
   */
  private fail(cause: 'slow' | 'typos'): void {
    const { stats, run } = this;
    const floor = this.floor;
    this.typos = [];
    this.drillHint = { note: null };
    this.showHint();
    this.updateBars();
    flash(this.root, 'is-failing', 900);
    this.sound.fail();
    this.store.recordRun(this.runKey, run.ms, run.sets);
    const { runBest } = this;
    const rows: (Node | string)[] = [
      el('dt', {}, t.hardcore.lasted),
      el('dd', {}, `${Math.round(stats.activeMs / 1000)} s`),
      el('dt', {}, t.result.accuracy),
      el('dd', {}, `${Math.round(stats.accuracy * 100)}%`),
      el('dt', {}, t.result.bestStreak),
      el('dd', {}, String(stats.bestStreak)),
      // What the fuse took with it: the run, next to the best one it is held against.
      el('dt', {}, t.hardcore.runOver),
      this.runValue(run),
    ];
    // The best it began against gets its own row unless this run reached it on both counts.
    if (runBest.ms > run.ms || runBest.sets > run.sets) {
      const best = this.store.bestRun(this.runKey);
      rows.push(el('dt', {}, t.hardcore.bestRun), el('dd', {}, t.hardcore.runValue(best.sets, clock(best.ms))));
    }
    this.openResult(
      el('p.result-failed', {}, cause === 'typos' ? t.hardcore.failedTypos : t.hardcore.failed(floor)),
      el('p.result-wpm.is-failed', {}, String(Math.round(stats.wpm)), el('small', {}, t.result.forSet)),
      el('dl.result-list', {}, ...rows),
      el('p.result-unsaved', {}, t.hardcore.notSaved),
    );
    // The run is over: the next set starts a new one at the floor picked in the options, with a whole fuse.
    this.run = new Run(0);
    this.freshRun();
  }

  /** A run's sets and held time, marked when either passes the best the run began against. */
  private runValue(run: Run): HTMLElement {
    const { runBest } = this;
    const beaten = this.store.tracking && (run.ms > runBest.ms || run.sets > runBest.sets) && (runBest.ms > 0 || runBest.sets > 0);
    return el('dd', {}, t.hardcore.runValue(run.sets, clock(run.ms)), beaten ? el('span.result-best', {}, t.hardcore.newBest) : null);
  }

  private openResult(...parts: (HTMLElement | null)[]): void {
    this.result.replaceChildren(...parts.filter((part) => part !== null), el('p.result-hint', {}, el('kbd', {}, t.result.enter), t.result.nextSet));
    this.stage.append(this.result);
    this.resultOpen = true;
    this.lit = false;
    this.showRun();
    // A result is read on a still stage: the tremor stops at once instead of easing out.
    this.stress.tremor = 0;
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
      this.touch(event.time);
      this.wrongKey(event);
      return;
    }
    this.drill.key(event);
  }

  // ---------- streak ----------

  /** True while a set has been started and not finished: leaving it now gives up the run and the streak. */
  private get underWay(): boolean {
    return !this.resultOpen && this.firstHitAt !== null;
  }

  /** A streak belongs to one layout and one drill: this starts one against the longest saved for them. */
  private loadStreak(): void {
    this.streakKey = streakKey(this.layout.id, this.drill.id);
    this.streak = new Streak(this.store.bestStreak(this.streakKey));
    this.recordInSet = false;
    this.showStreak();
  }

  /**
   * Ends the streak and banks it. `broken` is true for a wrong key: the counter
   * then shows what was lost, in coral, as it goes.
   */
  private endStreak(broken = false): void {
    const length = this.streak.end();
    if (length === 0) return;
    this.store.recordStreak(this.streakKey, length);
    if (broken && length >= STREAK_SHOWN_FROM) {
      this.comboCount.textContent = String(length);
      flash(this.comboEl, 'is-lost', 520);
    }
    this.showStreak();
  }

  /** The streak in the left rail, over the longest one, and in the counter over the keyboard. */
  private showStreak(): void {
    const { count, best, past, record } = this.streak;
    const state = `${count}|${best}`;
    if (state === this.shownStreak) return;
    this.shownStreak = state;
    this.streakEl.textContent = String(count);
    // Past the longest streak, its number goes and the word left there takes the accent, as for a run.
    this.streakBestEl.textContent = best === 0 ? '' : past ? t.streak.passed : t.streak.best(best);
    this.streakBestEl.classList.toggle('is-past', past);
    const on = count >= STREAK_SHOWN_FROM;
    // Under ten the counter is out of sight, and keeps the number it went out on: the streak just lost.
    if (on) this.comboCount.textContent = String(count);
    this.comboLabel.textContent = record ? t.streak.newBest : t.streak.inRow;
    this.comboEl.dataset.on = String(on);
    this.comboEl.dataset.record = String(record);
  }

  /** A milestone of the streak: the counter swells once and a tick sounds over the keys. */
  private markMilestone(): void {
    flash(this.comboEl, 'is-pop', 320);
    this.sound.tick();
  }

  /** The streak just passed the longest one saved: the counter says so and the screen cheers. */
  private celebrate(): void {
    this.recordInSet = true;
    flash(this.comboEl, 'is-pop', 320);
    this.cheer();
  }

  /** A record fell: a wave crosses the keyboard, the mark at the top drums its fingers and three notes go up. */
  private cheer(): void {
    this.sound.chime();
    this.keyboard.cheer();
    flash(this.mark, 'is-waving', 900);
  }

  private setKeySound(sound: KeySound): void {
    this.store.update({ keySound: sound });
    this.sound.use(sound);
    // The switch just picked is heard at once: the click that picked it is the gesture audio waits for.
    this.sound.audition(sound);
  }

  // ---------- hardcore ----------

  /** Hardcore runs on the drills that can show a typo run: the highway, words and pairs. */
  private get hardcore(): boolean {
    return this.settings.hardcore && this.drill?.typos !== undefined;
  }

  /** The floor picked in the options, 0 when there is none. */
  private get baseFloor(): number {
    return this.hardcore ? this.settings.floor : 0;
  }

  /** The numbers of the difficulty picked in the options. */
  private get rules(): Rules {
    return RULES[this.settings.difficulty];
  }

  /** The rolling WPM the set fails under right now, 0 when there is none. It climbs with the run. */
  private get floor(): number {
    const base = this.baseFloor;
    return base > 0 && this.run.base === base ? this.run.floor : base;
  }

  /** A wrong key in hardcore: it lands as a typo, kicks the stage and, with the fuse lit, burns a piece of it at once. */
  private wrongKey(event: KeyEvt): void {
    this.addTypo(event);
    this.jolt();
    this.sound.typo();
    if (this.lit && this.fuse.hit()) this.fail('typos');
  }

  /** The kick of a wrong key: the edges blink coral and the stage is knocked aside, harder as the typos pile up. */
  private jolt(): void {
    this.stingEl.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 280, easing: EASE_OUT });
    // The blink is a change of color and stays; the knock is motion and does not.
    if (this.calm.matches) return;
    const reach = Math.min(0.5, 0.2 + this.typos.length * 0.035);
    const side = Math.random() < 0.5 ? -1 : 1;
    this.stage.animate(
      [{ translate: `${side * reach}rem ${reach * 0.3}rem` }, { translate: `${-side * reach * 0.45}rem 0`, offset: 0.4 }, { translate: '0 0' }],
      { duration: 190, easing: EASE_OUT },
    );
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

  /**
   * A fresh set: no typos, and the fuse back to what the run's scars leave of it,
   * unlit until the first right key and the warm-up after it.
   */
  private resetHardcore(): void {
    this.typos = [];
    this.fuse.refill();
    this.firstHitAt = null;
    this.lit = false;
    this.drill?.typos?.(this.typos);
    this.showHint();
    this.paintFuse(false, false);
  }

  /**
   * Ends the run in progress, keeping whatever it beat, and starts one at the floor
   * picked in the options, with a whole fuse. `announce` says what the run came to.
   */
  private freshRun(announce = false): void {
    const { run } = this;
    if (run.base > 0 && run.started) {
      this.store.recordRun(this.runKey, run.ms, run.sets);
      if (announce) this.say(t.hardcore.runEnded(t.hardcore.runValue(run.sets, clock(run.ms))));
    }
    this.run = new Run(this.baseFloor, this.rules.climbStep);
    this.runKey = runKey(this.layout.id, this.drill.id, this.run.base, this.settings.difficulty);
    this.runBest = this.store.bestRun(this.runKey);
    this.fuse.reset(this.rules);
    this.lit = false;
    this.shownRun = '';
    this.showFloor();
    this.showRun();
  }

  /** Burns or regrows the fuse for one frame of the rolling WPM, and fails the set once it is out. */
  private burn(now: number, dt: number, wpm: number): void {
    const lit = this.baseFloor > 0 && !this.resultOpen && this.firstHitAt !== null && now - this.firstHitAt >= this.rules.warmupMs;
    this.lit = lit;
    if (lit) {
      // The run's clock only runs with the fuse lit. Each stretch held raises the floor a step.
      if (this.run.tick(dt)) this.climbed();
      if (this.fuse.step(wpm, this.floor, dt)) {
        this.fail('slow');
        return;
      }
      this.showRun();
    }
    this.paintFuse(lit, lit && wpm < this.floor);
  }

  /** The floor just rose a step: the numeral, the sparkline's rule and a line under the stage say so. */
  private climbed(): void {
    this.showFloor();
    flash(this.floorEl, 'is-climbing', 700);
    this.drawSpark();
    this.sound.climb();
    this.say(t.hardcore.climbed(this.floor));
  }

  /**
   * Hands the fuse to the stylesheet: `--life` (1 full, 0 out) and `--cap` (what the
   * scars leave) on the cord, and three attributes: whether there is a fuse and whether
   * it is lit, whether the rolling WPM is under the floor, and how fast the heartbeat
   * runs. It also sets where the edges, the narrowing and the tremor are heading.
   */
  private paintFuse(lit: boolean, under: boolean): void {
    const { fuse } = this;
    const life = Math.round(fuse.life * 400) / 400;
    if (life !== this.shownLife) {
      this.shownLife = life;
      this.fuseEl.style.setProperty('--life', String(life));
    }
    const cap = Math.round(fuse.cap * 400) / 400;
    if (cap !== this.shownCap) {
      this.shownCap = cap;
      this.fuseEl.style.setProperty('--cap', String(cap));
    }
    // The stress only holds while the fuse is lit: a result or a set not yet begun sees the whole screen.
    this.stressTo.danger = lit ? dangerAmount(fuse.life) : 0;
    this.stressTo.tunnel = lit ? tunnelAmount(fuse.life) : 0;
    this.stressTo.tremor = lit ? tremorAmount(fuse.life) : 0;
    this.beat = lit ? beatLevel(fuse.life, under) : 0;
    const state = this.baseFloor > 0 ? (lit ? 'lit' : 'ready') : 'off';
    const key = `${state}|${under}|${this.beat}`;
    if (key === this.fuseState) return;
    this.fuseState = key;
    const crossed = this.root.dataset.under !== String(under);
    this.root.dataset.fuse = state;
    this.root.dataset.under = String(under);
    this.root.dataset.beat = String(this.beat);
    // The floor rule on the sparkline turns coral the moment the rate crosses it.
    if (crossed) this.drawSpark();
  }

  /**
   * One frame of the stress cues. The edges, the narrowing and the tremor ease to their
   * marks, so lighting the fuse on a scarred cord does not snap them in. The heartbeat
   * is stepped here as well: its swell goes to the numeral and the edges, its two thumps
   * to the speakers, off one clock.
   */
  private paintStress(dt: number): void {
    const { stress, stressTo, shownStress } = this;
    const ease = Math.min(1, dt * 0.008);
    for (const name of ['danger', 'tunnel', 'tremor'] as const) {
      stress[name] += (stressTo[name] - stress[name]) * ease;
      if (Math.abs(stressTo[name] - stress[name]) < 0.004) stress[name] = stressTo[name];
    }
    const danger = stress.danger.toFixed(3);
    if (danger !== shownStress.danger) {
      shownStress.danger = danger;
      this.dangerEl.style.setProperty('--danger', danger);
    }
    // The narrowing reaches most of the screen, so it moves in fiftieths.
    const tunnel = String(Math.round(stress.tunnel * 50) / 50);
    if (tunnel !== shownStress.tunnel) {
      shownStress.tunnel = tunnel;
      this.root.style.setProperty('--tunnel', tunnel);
    }
    const tremor = this.calm.matches ? '0' : String(Math.round(stress.tremor * 20) / 20);
    if (tremor !== shownStress.tremor) {
      shownStress.tremor = tremor;
      this.stage.style.setProperty('--tremor', tremor);
      this.root.dataset.tremor = String(tremor !== '0');
    }

    const beat = this.heart.step(dt, this.beat);
    if (beat.lub) this.sound.lub(stress.danger);
    if (beat.dub) this.sound.dub(stress.danger);
    // Under reduced motion the heart is heard, not seen.
    const pulse = this.calm.matches ? '0' : beat.pulse.toFixed(3);
    if (pulse !== shownStress.pulse) {
      shownStress.pulse = pulse;
      this.wpmEl.style.setProperty('--pulse', pulse);
      this.dangerEl.style.setProperty('--pulse', pulse);
    }
  }

  /** "/100" after the live WPM: the floor as it stands, climbs included. */
  private showFloor(): void {
    const { floor } = this;
    this.floorEl.textContent = floor > 0 ? `/${floor}` : '';
    this.floorEl.title = floor > 0 ? t.hardcore.floorTitle(floor, this.rules.climbStep, CLIMB_EVERY_MS / 1000) : '';
  }

  /**
   * The run in the left rail: time held and sets cleared, each over the best to beat.
   * The best time is coral while a lit run is behind it. Once passed, the number
   * goes and the word "best" stays, in the accent.
   */
  private showRun(): void {
    const { run, runBest, lit } = this;
    const held = clock(run.ms);
    const state = `${held}|${run.sets}|${runBest.ms}|${runBest.sets}|${lit}`;
    if (state === this.shownRun) return;
    this.shownRun = state;
    const pastTime = runBest.ms > 0 && run.ms > runBest.ms;
    const pastSets = runBest.sets > 0 && run.sets > runBest.sets;
    this.heldEl.textContent = held;
    this.heldBestEl.textContent = runBest.ms === 0 ? '' : pastTime ? t.hardcore.best : `${t.hardcore.best} ${clock(runBest.ms)}`;
    this.heldBestEl.classList.toggle('is-behind', lit && runBest.ms > 0 && !pastTime);
    this.heldBestEl.classList.toggle('is-past', pastTime);
    this.setsEl.textContent = String(run.sets);
    this.setsBestEl.textContent = runBest.sets === 0 ? '' : pastSets ? t.hardcore.best : `${t.hardcore.best} ${runBest.sets}`;
    this.setsBestEl.classList.toggle('is-past', pastSets);
  }

  /**
   * The hardcore switch and, when it is on, the floor and the difficulty.
   * They join the options of every drill that takes part.
   */
  private hardcoreOptions(): OptionGroup[] {
    const { settings } = this;
    const groups: OptionGroup[] = [
      toggleOption(t.hardcore.label, settings.hardcore, (hardcore) => {
        this.store.update({ hardcore });
        this.newSet();
      }),
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
      // The difficulty weighs on the fuse alone, and there is no fuse without a floor.
      if (settings.floor > 0) {
        groups.push({
          label: t.hardcore.difficulty,
          value: String(settings.difficulty),
          choices: DIFFICULTIES.map((level) => ({ value: String(level), label: String(level), title: t.hardcore.difficultyNotes[level] })),
          set: (value) => {
            this.store.update({ difficulty: Number(value) as Difficulty });
            this.newSet();
          },
        });
      }
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
    // Leaving a set under way gives the run up: new text is no way out from under a burning fuse.
    if (!this.resultOpen && this.firstHitAt !== null) this.freshRun(true);
    this.newSet();
  }

  private newSet(): void {
    // A set left before its end takes the streak with it, as it takes the run.
    if (this.underWay) this.endStreak();
    this.recordInSet = false;
    this.result.remove();
    this.resultOpen = false;
    this.syncRest();
    this.stats = new SetStats();
    this.setKeys = {};
    this.lastHitAt = null;
    this.missedSince = false;
    this.previousChar = '';
    this.typos = [];
    // The break between two sets is not typing: the rolling rate starts over with the new text.
    this.rolling.reset();
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
    // A streak belongs to one drill: the one left behind ends here.
    this.endStreak();
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
    this.rolling.reset();
    this.drill.mount(this.stage);
    this.loadStreak();
    // A run belongs to one drill: the one left behind ends here.
    this.freshRun();
    this.resetHardcore();
    this.syncRest();
    this.renderOptions();
    this.updateReadouts();
    this.setTyping(false);
  }

  private setLayout(id: string): void {
    // The streak was typed on the layout being left.
    this.endStreak();
    this.store.update({ layout: getLayout(id).id });
    this.layout = getLayout(id);
    this.keyboard.setLayout(this.layout);
    this.loadStreak();
    this.updateBars();
    this.freshRun();
    this.newSet();
    this.renderOptions();
  }

  private setUi(lang: Lang): void {
    if (lang === this.settings.ui) return;
    // The practice text follows the interface: picking French brings French words and sentences.
    // The drill's own language option still sets the text apart afterwards.
    this.store.update({ ui: lang, lang });
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
    this.soundSelect.relabel(t.options.keySound, keySoundNames());
    this.profileMenu.refresh();
    // The streak's labels are written with its numbers: they are written again in the new language.
    this.shownStreak = '';
    this.showStreak();
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
    // The run under way ends under the switch it was typed with. So does the streak: one typed with tracking off is not kept.
    this.freshRun();
    if (this.store.tracking) this.endStreak();
    this.store.update({ track: on });
    this.loadStreak();
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
    // The run under way belonged to the profile just left: it is dropped, not saved under this one. So is the streak.
    this.run = new Run(0);
    this.streak = new Streak();
    this.layout = getLayout(settings.layout);
    this.applyUi();
    this.layoutSelect.set(this.layout.id);
    this.soundSelect.set(settings.keySound);
    this.sound.use(settings.keySound);
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
    this.showStreak();
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
    // One line for what is typed, one for how hard it is, one for what is heard. The key hints close the last one.
    const lines: (HTMLElement | null)[][] = [this.drill.options().map((group) => this.optionEl(group))];
    if (this.drill.typos) lines.push(this.hardcoreOptions().map((group) => this.optionEl(group)));
    // With hardcore on its line is full: the sounds and the hints take the next one.
    if (lines.length === 1 || this.settings.hardcore) lines.push([]);
    const last = lines[lines.length - 1];
    // Hardcore's own sounds sit beside the sound of the keys. They change nothing about the text or the rules: the set and the run go on.
    const heartbeat = this.hardcore
      ? this.optionEl(toggleOption(t.hardcore.sound, this.settings.sound, (sound) => this.store.update({ sound }), { keeps: true, title: t.hardcore.soundTitle }))
      : null;
    this.flipped = null;
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
    // The stats view types nothing: it has no key sound to pick and no key to hint at.
    if (this.drill.id !== 'stats') {
      last.push(el('div.opt', { title: t.options.keySoundTitle }, el('span', {}, t.options.keys), this.soundSelect.root), heartbeat);
      if (hints.childElementCount > 0) last.push(hints);
    }
    // A note takes its own line under the options.
    this.optionsEl.replaceChildren(
      el('div.opt-groups', {}, ...lines.filter((line) => line.length > 0).map((line) => el('div.opt-line', {}, ...line)), note),
    );
    this.wpmCap.textContent = this.captionText();
    this.sound.cues = this.hardcore && this.settings.sound;
    this.showFloor();
  }

  /** One option: a switch for an off / on pair, a row of segments for anything else. */
  private optionEl(group: OptionGroup): HTMLElement {
    const pick = (value: string, button: HTMLElement): void => {
      const leaving = this.underWay;
      group.set(value);
      // An option that brings new text ends the run and the streak: no typo is left behind and the fuse starts whole.
      if (!group.keeps) {
        if (leaving) this.endStreak();
        this.freshRun();
        this.resetHardcore();
      }
      button.blur();
      this.renderOptions();
    };
    if (group.toggle) {
      const on = group.value === 'on';
      // The options are drawn anew on every click. The switch just clicked starts from its old side and slides across.
      const slides = this.flipped === group.label;
      const button = el(
        'button.opt-toggle.toggle.ctl',
        { type: 'button', role: 'switch', 'aria-checked': String(slides ? !on : on) },
        el('span', {}, group.label),
        el('span.switch', { 'aria-hidden': 'true' }),
      );
      if (slides) requestAnimationFrame(() => requestAnimationFrame(() => button.setAttribute('aria-checked', String(on))));
      if (group.title) button.title = group.title;
      button.addEventListener('click', () => {
        this.flipped = group.label;
        pick(on ? 'off' : 'on', button);
      });
      return button;
    }
    return el(
      'div.opt',
      {},
      // A group whose choices name themselves keeps its label for a screen reader only.
      group.bare ? null : el('span', {}, group.label),
      el(
        'div.seg',
        { role: 'group', 'aria-label': group.label },
        ...group.choices.map((choice) => {
          const on = choice.value === group.value;
          const button = el(on ? 'button.seg-btn.ctl.is-on' : 'button.seg-btn.ctl', { type: 'button', 'aria-pressed': String(on) }, choice.label);
          if (choice.title) button.title = choice.title;
          button.addEventListener('click', () => pick(choice.value, button));
          return button;
        }),
      ),
    );
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
      // With a floor the rate is read over the fuse's warm-up at least, so the fuse is lit on a number that holds.
      const value = this.rolling.value(now, this.baseFloor > 0 ? this.rules.warmupMs : undefined);
      // Ease the number so it reads as a rate, not as flicker.
      this.shownWpm += (value - this.shownWpm) * Math.min(1, dt * 0.008);
      const text = String(Math.round(this.shownWpm));
      if (text !== this.shownText) {
        this.shownText = text;
        this.wpmEl.textContent = text;
      }
      this.burn(now, dt, value);
      this.paintStress(dt);
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
    // The list opens upward, over the keyboard: the options sit at the bottom of the screen.
    // Moving through it plays the switch under the cursor.
    const soundNames = keySoundNames();
    this.soundSelect = new Select(
      t.options.keySound,
      [{ value: 'off', label: soundNames[0] }, ...SWITCHES.map((item) => ({ value: item.id as string, label: item.name as string }))],
      this.settings.keySound,
      (value) => this.setKeySound(value as KeySound),
      { up: true, onCursor: (value) => this.sound.audition(value as KeySound) },
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
    const runPair = this.label(
      el(
        'div.pair.run',
        {},
        el('div.stat', {}, this.label(el('span.stat-label'), () => t.hardcore.runHeld), this.heldEl, this.heldBestEl),
        el('div.pair-rule'),
        el('div.stat', {}, this.label(el('span.stat-label'), () => t.hardcore.runSets), this.setsEl, this.setsBestEl),
      ),
      () => t.hardcore.runTitle,
      'title',
    );

    // The caption doubles as the control for the rolling window: 5, 10 or 30 seconds.
    this.wpmCap.addEventListener('click', () => {
      const window = WINDOWS[(WINDOWS.indexOf(this.settings.window) + 1) % WINDOWS.length];
      this.store.update({ window });
      this.rolling.windowMs = window * 1000;
      this.wpmCap.textContent = this.captionText();
      this.wpmCap.blur();
    });

    this.root.append(
      el('header.top', {}, el('div.top-in', {}, el('span.wordmark', {}, this.mark, 'petitdoigt'), tabs, el('div.top-right', {}, this.trackSwitch, el('div.top-selects', {}, this.profileMenu.root, this.layoutSelect.root), lang))),
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
              this.label(el('div.stat', {}, this.label(el('span.stat-label'), () => t.rail.streak), this.streakEl, this.streakBestEl), () => t.streak.title, 'title'),
            ),
            runPair,
            fingers,
            this.label(el('p.rail-note'), () => t.rail.untracked),
          ),
          () => t.rail.region,
          'aria-label',
        ),
        this.label(el('section.centre', {}, this.stage, this.keyboard.root, el('div.foot', {}, this.optionsEl, this.noteEl), this.fuseEl, this.comboEl), () => t.options.region, 'aria-label'),
        this.label(el('aside.rail-right', {}, this.hands.root, this.nextEl), () => t.next.region, 'aria-label'),
      ),
      this.dangerEl,
      this.stingEl,
    );
  }
}
