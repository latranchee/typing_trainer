import type { SizeKind, SwitchKind } from './keyboards';
import type { Lang } from './lang';
import type { LayoutId } from './layouts';
import type { Board } from './physical';
import type { LogEvent } from './replay';
import type { TextKind } from './texts';

/**
 * What the page and the Worker say to each other: accounts, sets, boards and races.
 * One file, imported on both sides, so a change on one side shows on the other at compile time.
 */

/** A public name: lowercase letters, digits, and `_ . -` inside, 2 to 20 characters. */
export const HANDLE = /^[a-z0-9][a-z0-9_.-]{0,18}[a-z0-9]$/;
export const RESERVED_HANDLES = new Set(['admin', 'petitdoigt', 'ghost', 'guest', 'invite', 'moderator', 'support', 'system', 'you', 'toi', 'moi', 'me']);

export interface KeyboardInfo {
  model: string | null;
  switch: SwitchKind | null;
  size: SizeKind | null;
}

export interface Account {
  /** Null until the typist picks one: until then nothing of theirs shows on a board. */
  handle: string | null;
  email: string;
  keyboard: KeyboardInfo;
  since: number;
}

/** The drills a set can rank in, and the way each moves: along a line, or down the highway. */
export type RankedDrill = 'words' | 'pairs' | 'highway';
export const RANKED_DRILLS: RankedDrill[] = ['words', 'pairs', 'highway'];
export type Mode = 'line' | 'highway';
export const modeOf = (drill: RankedDrill): Mode => (drill === 'highway' ? 'highway' : 'line');
/** How the keys came in: a keyboard, or a phone's own keyboard. The two never share a board. */
export type InputKind = 'keys' | 'touch';

export interface RunSubmit {
  text: string;
  kind: TextKind;
  lang: Lang;
  drill: RankedDrill;
  layout: LayoutId;
  board: Board;
  input: InputKind;
  hardcore: boolean;
  log: LogEvent[];
}

export interface Placing {
  /** 1 for first. */
  rank: number;
  /** Typists on that board, this one included. */
  of: number;
  /** True when this set is the typist's best there. */
  best: boolean;
}

export interface RunAnswer {
  textId: string;
  wpm: number;
  acc: number;
  /** False when the set was saved but is off the boards: too short or under the accuracy bar. */
  ranked: boolean;
  /** Where the set puts the typist on the board of its drill and input, all time. Null when it does not rank. */
  board: Placing | null;
  /** Where it puts them among everyone who typed this very text in this mode. */
  text: Placing;
}

export type Period = 'day' | 'week' | 'all';
export const PERIODS: Period[] = ['day', 'week', 'all'];

export interface BoardQuery {
  drill: RankedDrill;
  input: InputKind;
  period: Period;
  lang: Lang | 'all';
  layout: LayoutId | 'all';
}

export interface PlayerRow {
  handle: string;
  wpm: number;
  acc: number;
  layout: LayoutId;
  lang: Lang;
  keyboard: string | null;
  at: number;
  textId: string;
}

export type KeyboardGroup = 'model' | 'switch' | 'size';
export const KEYBOARD_GROUPS: KeyboardGroup[] = ['model', 'switch', 'size'];

export interface KeyboardRow {
  /** The model as first typed, or the id of a switch or a size. */
  name: string;
  /** Typists on it with a ranked set. */
  players: number;
  /** The mean of their best sets. */
  mean: number;
  top: number;
}

export interface GhostRun {
  handle: string;
  wpm: number;
  acc: number;
  layout: LayoutId;
  at: number;
  /** See `encodeGhost`. */
  ghost: string;
}

export interface TextInfo {
  id: string;
  lang: Lang;
  kind: TextKind;
  text: string;
  /** Typists who finished it in this mode. */
  players: number;
  /** The best run of each, fastest first. */
  runs: GhostRun[];
  /** The caller's own best, when signed in and on the text. */
  mine: GhostRun | null;
}

export interface TextRow {
  id: string;
  lang: Lang;
  kind: TextKind;
  /** The first words of the text. */
  start: string;
  players: number;
  top: number;
  topHandle: string;
}

// ---------- races ----------

export const ROOM_CODE = /^[A-HJ-NP-Z2-9]{5}$/;
export const MAX_RACERS = 8;
/** From the start signal to the first key allowed. */
export const COUNTDOWN_MS = 4000;
/** After the first racer finishes, the others have this long. */
export const FINISH_GRACE_MS = 45_000;
/** No race runs longer than this. */
export const RACE_MAX_MS = 5 * 60_000;
/** Ghosts in a race: the best runs of a known text, up to this many. */
export const RACE_GHOSTS = 3;

export interface RoomConfig {
  mode: Mode;
  lang: Lang;
  kind: TextKind;
  words: 15 | 30 | 60;
  /** A known text to race on, with the ghosts of its best runs; null for new text each round. */
  textId: string | null;
}

export type Phase = 'lobby' | 'countdown' | 'race' | 'done';

export interface RacerView {
  id: string;
  name: string;
  /** True when the name is an account's handle, false for a guest. */
  signed: boolean;
  host: boolean;
  /** Characters finished this round. */
  done: number;
  wpm: number | null;
  acc: number | null;
  place: number | null;
  /** Joined while a round ran: races from the next one. */
  waiting: boolean;
}

export interface RoomState {
  t: 'room';
  you: string;
  code: string;
  config: RoomConfig;
  phase: Phase;
  round: number;
  text: string | null;
  textId: string | null;
  /** Server time the keys open. */
  startAt: number | null;
  /** Server time when this was sent. */
  now: number;
  racers: RacerView[];
  ghosts: GhostRun[];
}

export type ServerMsg =
  | RoomState
  | { t: 'p'; id: string; done: number }
  | { t: 'pong'; at: number; now: number }
  | { t: 'error'; code: string };

export type ClientMsg =
  | { t: 'hello'; name: string; layout: LayoutId; board: Board; input: InputKind }
  | { t: 'start' }
  | { t: 'progress'; done: number }
  | { t: 'finish'; log: LogEvent[]; hardcore: boolean }
  | { t: 'ping'; at: number };
