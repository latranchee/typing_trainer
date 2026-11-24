import type { Finger } from '../core/fingers';
import type { Bias } from '../core/generator';
import { t } from '../core/i18n';
import type { KeyEvt } from '../core/input';
import type { Layout, Stroke } from '../core/layouts';
import type { Row } from '../core/physical';
import type { GhostView } from '../core/replay';
import type { DrillId, Lang, Settings, Store } from '../core/store';
import { LANGS } from '../core/store';
import type { TextKind } from '../core/texts';

/** A text typed again instead of drawn fresh: a shared one, one picked on the boards, or a race's. */
export interface FixedText {
  /** Its id on the server; null for a race's text before the room names it. */
  id: string | null;
  lang: Lang;
  kind: TextKind;
  text: string;
}

/** What a set types: its text and where the text came from. */
export interface SetText {
  text: string;
  kind: TextKind;
  lang: Lang;
}

/** One stroke of practice text, ready to draw. */
export interface Note {
  stroke: Stroke;
  /** What the stroke shows: the letter, or the accent for a dead key. */
  label: string;
  /** Sets the note's color. */
  finger: Finger;
  /** Sets the note's shape and shade. */
  row: Row;
  /** The character this stroke belongs to. */
  char: string;
  /** True when this stroke finishes its character. */
  last: boolean;
}

export function toNotes(layout: Layout, text: string): Note[] {
  return layout.targets(text).flatMap((target) =>
    target.strokes.map((stroke, i) => ({
      stroke,
      label: layout.strokeLabel(stroke),
      finger: layout.fingerOf(stroke.code),
      row: layout.rowOf(stroke.code),
      char: target.char,
      last: i === target.strokes.length - 1,
    })),
  );
}

export const matches = (note: Note, event: KeyEvt): boolean =>
  note.stroke.code === event.code && note.stroke.shift === event.shift;

/** What the rails show for the next keypress. */
export interface NextHint {
  note: Note | null;
  /** Keys to keep held (anchor drill). */
  anchors?: string[];
  /** Replaces the usual caption under the next key. */
  message?: string;
}

export interface OptionGroup {
  label: string;
  value: string;
  /** `title` says what a choice does when its label is too short to: it shows on hover. */
  choices: { value: string; label: string; title?: string }[];
  set(value: string): void;
  /** True for an option that leaves the text and the rules alone: picking it restarts nothing. */
  keeps?: boolean;
  /** True for an off / on pair, in that order: it is drawn as one switch beside its label. */
  toggle?: boolean;
  /** What the option does, when its label is too short to say: it shows on hover. */
  title?: string;
}

/** An off / on option, drawn as a switch. */
export function toggleOption(label: string, on: boolean, set: (on: boolean) => void, extra: Pick<OptionGroup, 'keeps' | 'title'> = {}): OptionGroup {
  return {
    label,
    value: on ? 'on' : 'off',
    choices: [
      { value: 'off', label: t.line.off },
      { value: 'on', label: t.line.on },
    ],
    set: (value) => set(value === 'on'),
    toggle: true,
    ...extra,
  };
}

/** The language of the practice text. It sits with the drills that type words; the interface has its own picker. */
export function languageOption(settings: Settings, apply: (patch: Partial<Settings>) => void): OptionGroup {
  return {
    label: t.options.language,
    value: settings.lang,
    choices: LANGS.map((lang) => ({ value: lang, label: t.languages[lang] })),
    set: (value) => apply({ lang: value as Lang }),
  };
}

/** What a drill may ask of the app around it. */
export interface DrillHost {
  readonly layout: Layout;
  readonly settings: Settings;
  readonly store: Store;
  /** What tilts the choice of text: the fingers picked in the settings and the typist's slow keys. */
  readonly bias: Bias;
  /** The text every set types while one is fixed, in place of a fresh one. */
  readonly fixed: FixedText | null;
  hit(note: Note, event: KeyEvt): void;
  miss(expected: Note, event: KeyEvt): void;
  setNext(hint: NextHint): void;
  /** The set is complete: record it and show the result. */
  finish(): void;
  /** Highway geometry in viewport x: lane boundaries, and the home-key centre each lane's notes fall on. */
  lanes(): { edges: number[]; centres: number[] };
  /** A short line under the stage, for timing and technique feedback. */
  say(message: string, tone?: 'plain' | 'error'): void;
  /** Redraw the options and the keyboard's marks after the drill changed its own state. */
  refresh(): void;
}

export interface Drill {
  readonly id: DrillId;
  mount(stage: HTMLElement): void;
  unmount(): void;
  /** Start a fresh set with new text. */
  restart(): void;
  key(event: KeyEvt): void;
  /** Called whenever the set of physically held keys changes. */
  held?(held: ReadonlySet<string>): void;
  tick?(now: number, dt: number): void;
  options(): OptionGroup[];
  /** Tempo nudge from the arrow keys; drills without a tempo ignore it. */
  nudge?(direction: 1 | -1): void;
  /** A key chosen on the on-screen keyboard. Drills that define it turn the board's keys into buttons. */
  pickKey?(code: string): void;
  /** The key the board shows as chosen. */
  pickedKey?(): string | null;
  /**
   * Hardcore: the wrong keys typed past the cursor, oldest first, each as the
   * label of its key. The drill shows them where the next letter goes. Drills
   * that define this take part in hardcore mode.
   */
  typos?(typed: readonly string[]): void;
  /** The text of the set on screen. Drills that type text define it. */
  current?(): SetText | null;
  /** The ghosts of a fixed text as they type it: where each one's caret is, and its wrong keys. */
  ghosts?(views: readonly GhostView[]): void;
}
