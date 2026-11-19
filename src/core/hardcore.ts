/**
 * Hardcore mode. Rules on top of a drill:
 *
 * - A wrong key sticks. It lands in the text, and so does every key after it,
 *   until Backspace has erased them all. Only then does a right key count.
 * - With a floor set, the rolling WPM must stay at or above it. Below it the
 *   fuse burns, faster the further under; above it the fuse grows back slowly.
 *   A wrong key burns a piece of it at once. A burnt-out fuse fails the set.
 * - Part of whatever burns never grows back: the fuse is scarred shorter.
 * - Sets cleared in a row form a run. The floor climbs with the time the run
 *   has lasted, and the scars stay until the run ends.
 * - A difficulty, 1 to 3, sets how fast the fuse burns and grows back and how
 *   much the typos, the scars and the climb weigh. At 1 only the fuse is left.
 */

/** WPM floors offered, 0 meaning none. */
export const FLOORS = [0, 40, 60, 80, 100, 120] as const;
export type Floor = (typeof FLOORS)[number];

/** Wrong keys a typo run holds. Past this the keyboard flashes and nothing lands. */
export const MAX_TYPOS = 10;

/** How hard the fuse is on the typist, from 1 (the fuse alone) to 3 (every rule at full strength). */
export const DIFFICULTIES = [1, 2, 3] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
export const DEFAULT_DIFFICULTY: Difficulty = 2;

/** What one difficulty asks. The rates are shares of a whole fuse per second. */
export interface Rules {
  /**
   * The fuse is lit this long after the first right key of a set. The rolling rate
   * is read over at least this span while a floor is set, so it means something by then.
   */
  warmupMs: number;
  /** Fuse lost per second just under the floor. */
  burnMin: number;
  /** Extra burn per second at a quarter under the floor and beyond. */
  burnExtra: number;
  /** Fuse regained per second at or above the floor. */
  regrow: number;
  /** Fuse a wrong key burns at once. */
  typoBurn: number;
  /** Share of whatever burns that never grows back. */
  scar: number;
  /** WPM the floor rises each time the run has lasted `CLIMB_EVERY_MS` longer. */
  climbStep: number;
}

/** A whole fuse that lasts `slow` seconds just under the floor and `fast` seconds a quarter under it or worse. */
const burns = (slow: number, fast: number): Pick<Rules, 'burnMin' | 'burnExtra'> => ({
  burnMin: 1 / slow,
  burnExtra: 1 / fast - 1 / slow,
});

export const RULES: Record<Difficulty, Rules> = {
  // The fuse alone. It grows back whole, from empty in about 8 s.
  1: { warmupMs: 3000, ...burns(5, 2), regrow: 0.12, typoBurn: 0, scar: 0, climbStep: 0 },
  // Typos burn it, burns scar it and the floor climbs, each at half strength. From empty in about 11 s.
  2: { warmupMs: 2000, ...burns(4, 1.5), regrow: 0.09, typoBurn: 0.04, scar: 0.125, climbStep: 1 },
  // Every rule at full strength. From empty in about 17 s.
  3: { warmupMs: 1500, ...burns(3, 1.2), regrow: 0.06, typoBurn: 0.08, scar: 0.25, climbStep: 2 },
};

/** How far under the floor, as a share of it, the burn reaches full speed. */
const BURN_SPAN = 0.25;
/** The scars stop here: a run always keeps this much fuse to work with. */
export const MIN_CAP = 0.35;

/** Below this much fuse the screen starts to warn. */
export const DANGER_AT = 0.7;
/** Below this much fuse the screen narrows to the letters being typed. */
export const TUNNEL_AT = 0.5;
/** At this much fuse the narrowing is complete. */
const TUNNEL_FULL = 0.1;
/** Below this much fuse the stage trembles. */
export const TREMOR_AT = 0.12;

/** A rolling WPM held against a floor. */
export class Fuse {
  /** What is left, from 1 (full) to 0 (burnt out). */
  life = 1;
  /** What it can grow back to. Scars lower it; it never drops under `MIN_CAP`. */
  cap = 1;
  /** The numbers of the difficulty it burns under. */
  rules: Rules;

  constructor(rules: Rules) {
    this.rules = rules;
  }

  /** Advance by `dt` ms at a rolling `wpm`. Returns true once the fuse is burnt out. */
  step(wpm: number, floor: number, dt: number): boolean {
    if (floor <= 0 || this.life <= 0) return this.life <= 0;
    const seconds = dt / 1000;
    if (wpm < floor) {
      const under = Math.min(1, (floor - wpm) / (floor * BURN_SPAN));
      return this.burn((this.rules.burnMin + this.rules.burnExtra * under) * seconds);
    }
    this.life = Math.min(this.cap, this.life + this.rules.regrow * seconds);
    return false;
  }

  /** A wrong key: a piece of the fuse goes at once. Returns true once the fuse is burnt out. */
  hit(amount = this.rules.typoBurn): boolean {
    return this.burn(amount);
  }

  /** A new set in the same run: back to what the scars leave. */
  refill(): void {
    this.life = this.cap;
  }

  /** A new run: whole again, under `rules` when the difficulty changed. */
  reset(rules: Rules = this.rules): void {
    this.rules = rules;
    this.life = 1;
    this.cap = 1;
  }

  private burn(amount: number): boolean {
    const lost = Math.min(this.life, amount);
    this.life -= lost;
    this.cap = Math.max(MIN_CAP, this.cap - lost * this.rules.scar);
    return this.life <= 0;
  }
}

/** The floor rises by the difficulty's step each time the run has lasted this much longer. */
export const CLIMB_EVERY_MS = 15000;

/**
 * Sets cleared in a row under one floor. The clock runs only while the fuse is
 * lit, so the pause between two sets is not held time.
 */
export class Run {
  /** The floor the run started at: the one picked in the options. */
  readonly base: number;
  /** WPM the floor rises for each stretch held: the difficulty's step, 0 for a floor that stays put. */
  readonly step: number;
  /** Time held with the fuse lit, in ms. */
  ms = 0;
  /** Sets cleared. */
  sets = 0;

  constructor(base: number, step = 0) {
    this.base = base;
    this.step = step;
  }

  /** The floor right now: the base plus one step for each stretch held. */
  get floor(): number {
    return this.base <= 0 ? 0 : this.base + this.step * Math.floor(this.ms / CLIMB_EVERY_MS);
  }

  /** True once the run holds something to lose. */
  get started(): boolean {
    return this.ms > 0 || this.sets > 0;
  }

  /** Advance the clock by `dt` ms of lit fuse. Returns true when the floor just climbed. */
  tick(dt: number): boolean {
    const before = this.floor;
    this.ms += dt;
    return this.floor > before;
  }
}

/** The longest run and the most sets cleared in a row. They may come from two runs. */
export interface RunBest {
  ms: number;
  sets: number;
}

/** Where a run's bests are saved. A run is only held against runs typed under the same rules. */
export const runKey = (layout: string, drill: string, floor: number, difficulty: Difficulty): string =>
  `${layout}|${drill}|${floor}|${difficulty}`;

/**
 * How loud the warning is, 0 to 3. It sets the heartbeat: none, then slow,
 * quicker and fast as the fuse runs down.
 */
export function dangerLevel(life: number): 0 | 1 | 2 | 3 {
  if (life >= DANGER_AT) return 0;
  if (life >= 0.4) return 1;
  if (life >= 0.2) return 2;
  return 3;
}

/**
 * The heartbeat's pace, 0 to 3. Under the floor the heart always beats; back
 * above it, it keeps beating one step calmer until the fuse has grown out of danger.
 */
export function beatLevel(life: number, under: boolean): 0 | 1 | 2 | 3 {
  const level = dangerLevel(life);
  if (under) return level === 0 ? 1 : level;
  return level >= 2 ? ((level - 1) as 1 | 2) : 0;
}

const share = (value: number): number => Math.min(1, Math.max(0, value));

/** The warning's strength from 0 to 1: nothing above the danger mark, full at an empty fuse. */
export const dangerAmount = (life: number): number => share((DANGER_AT - life) / DANGER_AT);

/** How far the screen has narrowed, 0 to 1. */
export const tunnelAmount = (life: number): number => share((TUNNEL_AT - life) / (TUNNEL_AT - TUNNEL_FULL));

/** How hard the stage trembles, 0 to 1. */
export const tremorAmount = (life: number): number => share((TREMOR_AT - life) / TREMOR_AT);

/** Length of one heartbeat at each pace, in ms. */
export const BEAT_MS = [0, 1200, 820, 520] as const;
/** Where in a beat the second thump starts. */
const DUB_AT = 0.22;
/** The beat's shape, as [share of the beat, strength]: up, half down, up again, then rest. */
const PULSE: readonly (readonly [number, number])[] = [
  [0, 0],
  [0.1, 1],
  [DUB_AT, 0.15],
  [0.32, 0.7],
  [0.5, 0],
  [1, 0],
];

export interface Beat {
  /** How far the beat has swollen, 0 to 1. */
  pulse: number;
  /** True on the frame the first thump starts. */
  lub: boolean;
  /** True on the frame the second thump starts. */
  dub: boolean;
}

/**
 * The heartbeat, stepped by the frame loop so the picture and the sound share
 * one clock. A beat always runs to its end: a change of pace, or the calm
 * coming back, takes hold on the next one.
 */
export class Heart {
  private period = 0;
  private phase = 0;

  step(dt: number, level: 0 | 1 | 2 | 3): Beat {
    let lub = false;
    let dub = false;
    if (this.period === 0) {
      if (level === 0) return { pulse: 0, lub, dub };
      this.period = BEAT_MS[level];
      this.phase = 0;
      lub = true;
    } else {
      const before = this.phase;
      this.phase += dt / this.period;
      if (before < DUB_AT && this.phase >= DUB_AT) dub = true;
      if (this.phase >= 1) {
        if (level === 0) {
          this.period = 0;
          this.phase = 0;
          return { pulse: 0, lub, dub };
        }
        this.phase = Math.min(this.phase - 1, DUB_AT / 2);
        this.period = BEAT_MS[level];
        lub = true;
      }
    }
    return { pulse: pulseAt(this.phase), lub, dub };
  }

  reset(): void {
    this.period = 0;
    this.phase = 0;
  }
}

function pulseAt(phase: number): number {
  for (let i = 1; i < PULSE.length; i++) {
    const [at, value] = PULSE[i];
    if (phase > at) continue;
    const [from, start] = PULSE[i - 1];
    return start + ((value - start) * (phase - from)) / (at - from);
  }
  return 0;
}

/** A stretch of typing time as `m:ss`. */
export function clock(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
