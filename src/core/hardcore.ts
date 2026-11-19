/**
 * Hardcore mode. Two rules on top of a drill:
 *
 * - A wrong key sticks. It lands in the text, and so does every key after it,
 *   until Backspace has erased them all. Only then does a right key count.
 * - With a floor set, the rolling WPM must stay at or above it. Below it the
 *   fuse burns, faster the further under; above it the fuse grows back slowly.
 *   A burnt-out fuse fails the set.
 */

/** WPM floors offered, 0 meaning none. */
export const FLOORS = [0, 40, 60, 80, 100, 120] as const;
export type Floor = (typeof FLOORS)[number];

/** Wrong keys a typo run holds. Past this the keyboard flashes and nothing lands. */
export const MAX_TYPOS = 10;

/** The fuse is lit this long after the first right key, once the rolling rate means something. */
export const WARMUP_MS = 3000;

/** Fuse lost per second just under the floor: an empty fuse after 5 s. */
const BURN_MIN = 0.2;
/** Extra burn per second at a quarter under the floor and beyond: an empty fuse after 2 s. */
const BURN_EXTRA = 0.3;
/** How far under the floor, as a share of it, the burn reaches full speed. */
const BURN_SPAN = 0.25;
/** Fuse regained per second at or above the floor: empty to full in about 8 s. */
const REGROW = 0.12;

/** Below this much fuse the screen starts to warn. */
export const DANGER_AT = 0.4;

/** A rolling WPM held against a floor. */
export class Fuse {
  /** What is left, from 1 (full) to 0 (burnt out). */
  life = 1;

  /** Advance by `dt` ms at a rolling `wpm`. Returns true once the fuse is burnt out. */
  step(wpm: number, floor: number, dt: number): boolean {
    if (floor <= 0 || this.life <= 0) return this.life <= 0;
    const seconds = dt / 1000;
    if (wpm < floor) {
      const under = Math.min(1, (floor - wpm) / (floor * BURN_SPAN));
      this.life -= (BURN_MIN + BURN_EXTRA * under) * seconds;
    } else {
      this.life += REGROW * seconds;
    }
    this.life = Math.min(1, Math.max(0, this.life));
    return this.life <= 0;
  }

  reset(): void {
    this.life = 1;
  }
}

/**
 * How loud the warning is, 0 to 3. It sets the heartbeat: none, then slow,
 * quicker and fast as the fuse runs down.
 */
export function dangerLevel(life: number): 0 | 1 | 2 | 3 {
  if (life >= DANGER_AT) return 0;
  if (life >= 0.25) return 1;
  if (life >= 0.12) return 2;
  return 3;
}

/** The warning's strength from 0 to 1: nothing above the danger mark, full at an empty fuse. */
export const dangerAmount = (life: number): number => Math.min(1, Math.max(0, (DANGER_AT - life) / DANGER_AT));
