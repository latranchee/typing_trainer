import type { InputKind } from './online';

/**
 * A set's percentile: the share of typists slower than the set. Until the trainer has typists
 * enough of its own for a kind of set, it is held against two published studies of typing speed.
 *
 * A curve gives, at every whole WPM from 0 to `TOP`, the share of its typists whose average speed
 * is below it, in ten-thousandths. Each typist counts once, with their own average.
 */
export interface Curve {
  /** How many typists the curve is drawn from. */
  typists: number;
  /** `TOP + 1` shares, in ten-thousandths, rising from 0. */
  below: number[];
}

export const TOP = 160;
const SCALE = 10000;

/** Typists the trainer needs, on one drill, kind of text and input, before its own curve replaces the study's. */
export const OWN_TYPISTS = 200;
/** A typist enters the trainer's curve once they have this many ranked sets of that kind... */
export const OWN_MIN_SETS = 3;
/** ...with their average taken over their latest sets, at most this many. */
export const OWN_RECENT = 20;

/**
 * The two studies, built by `scripts/centiles/aalto.py`. Free for non-commercial use with
 * attribution to the authors.
 * - keys: Dhakal, Feit, Kristensson, Oulasvirta, "Observations on Typing from 136 Million
 *   Keystrokes", CHI 2018. Typists on a full keyboard or a laptop, each the mean of 15 sentences.
 * - touch: Palin, Feit, Kim, Kristensson, Oulasvirta, "How do People Type on Mobile Devices?
 *   Observations from a Study with 37,000 Volunteers", MobileHCI 2019. Typists on a phone.
 */
export const STUDY: Record<InputKind, Curve & { year: number }> = {
  keys: {
    year: 2018,
    typists: 165009,
    below: [
      0, 0, 0, 0, 0, 0, 1, 2, 3, 7, 13, 21, 33, 47, 71, 97,
      129, 169, 219, 275, 340, 418, 503, 601, 708, 824, 955, 1096, 1248, 1410, 1568, 1737,
      1909, 2093, 2277, 2463, 2652, 2833, 3018, 3203, 3397, 3589, 3780, 3968, 4159, 4339, 4524, 4712,
      4896, 5075, 5248, 5422, 5601, 5773, 5939, 6107, 6269, 6429, 6589, 6739, 6890, 7035, 7175, 7319,
      7458, 7592, 7721, 7849, 7967, 8083, 8198, 8314, 8419, 8520, 8617, 8705, 8789, 8875, 8956, 9030,
      9101, 9168, 9233, 9290, 9344, 9396, 9443, 9487, 9530, 9572, 9609, 9645, 9677, 9705, 9734, 9763,
      9785, 9805, 9825, 9844, 9861, 9876, 9889, 9903, 9914, 9924, 9933, 9941, 9948, 9953, 9959, 9964,
      9968, 9972, 9976, 9979, 9982, 9984, 9986, 9988, 9990, 9991, 9992, 9993, 9994, 9995, 9995, 9996,
      9996, 9997, 9997, 9998, 9998, 9999, 9999, 9999, 9999, 9999, 9999, 9999, 10000, 10000, 10000, 10000,
      10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000,
      10000,
    ],
  },
  touch: {
    year: 2019,
    typists: 37606,
    below: [
      0, 5, 6, 9, 14, 18, 23, 25, 32, 44, 58, 77, 104, 144, 200, 264,
      345, 444, 566, 707, 859, 1040, 1263, 1474, 1713, 1999, 2271, 2580, 2900, 3216, 3528, 3877,
      4210, 4532, 4855, 5178, 5476, 5781, 6058, 6329, 6591, 6849, 7088, 7307, 7513, 7712, 7908, 8069,
      8235, 8376, 8508, 8645, 8775, 8889, 8999, 9103, 9193, 9277, 9349, 9417, 9480, 9539, 9589, 9637,
      9680, 9719, 9753, 9782, 9811, 9832, 9851, 9871, 9888, 9905, 9919, 9931, 9941, 9948, 9956, 9960,
      9964, 9970, 9973, 9975, 9980, 9982, 9984, 9986, 9988, 9989, 9990, 9991, 9991, 9993, 9994, 9994,
      9995, 9996, 9997, 9997, 9997, 9998, 9998, 9998, 9998, 9998, 9998, 9998, 9998, 9998, 9998, 9998,
      9998, 9998, 9998, 9998, 9998, 9998, 9998, 9998, 9998, 9998, 9999, 9999, 9999, 9999, 9999, 9999,
      9999, 9999, 9999, 9999, 9999, 9999, 9999, 9999, 9999, 9999, 9999, 9999, 9999, 9999, 9999, 9999,
      9999, 9999, 9999, 9999, 9999, 10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000,
      10000,
    ],
  },
};

/** The curve of a list of typists' averages, in any order. */
export function curveOf(averages: readonly number[]): Curve {
  const sorted = [...averages].sort((a, b) => a - b);
  const below: number[] = [];
  let i = 0;
  for (let wpm = 0; wpm <= TOP; wpm++) {
    while (i < sorted.length && sorted[i] < wpm) i++;
    below.push(sorted.length === 0 ? 0 : Math.round((i / sorted.length) * SCALE));
  }
  return { typists: sorted.length, below };
}

/** True for a curve as the server sends it: whole shares that never fall, one per WPM. */
export function isCurve(value: unknown): value is Curve {
  const curve = value as Curve | null;
  if (!curve || typeof curve.typists !== 'number' || !Array.isArray(curve.below) || curve.below.length !== TOP + 1) return false;
  return curve.below.every((share, i) => Number.isInteger(share) && share >= 0 && share <= SCALE && (i === 0 || share >= curve.below[i - 1]));
}

/** The share of a curve's typists slower than `wpm`, from 0 to 1, read between the two whole WPMs around it. */
export function shareBelow(curve: Curve, wpm: number): number {
  if (!(wpm > 0)) return 0;
  if (wpm >= TOP) return curve.below[TOP] / SCALE;
  const low = Math.floor(wpm);
  const part = wpm - low;
  return (curve.below[low] * (1 - part) + curve.below[low + 1] * part) / SCALE;
}

/** The server's answer for one drill, kind of text and input: its typists, and their curve once there are enough. */
export interface CentileAnswer {
  typists: number;
  curve: Curve | null;
}

/** Where a set stands, and what it is held against. */
export interface Centile {
  /** Share of the typists slower than the set, from 0 to 1. */
  share: number;
  typists: number;
  /** The trainer's own typists, or a study's. */
  source: 'here' | 'study';
}

/** A set against the trainer's own curve when there is one, else against the study for its input. */
export function centileOf(wpm: number, input: InputKind, own: Curve | null): Centile {
  if (own && own.typists >= OWN_TYPISTS) return { share: shareBelow(own, wpm), typists: own.typists, source: 'here' };
  const study = STUDY[input];
  return { share: shareBelow(study, wpm), typists: study.typists, source: 'study' };
}

/**
 * The figure shown: whole below 99, to a tenth from 99, so the fastest still see a step;
 * never 100. Rounded down, so "faster than" always holds. 0 stands for under 1.
 */
export function centileFigure(share: number): number {
  // A hair added before rounding down: 0.29 * 100 is 28.999… in floating point.
  if (share >= 0.99) return Math.min(99.9, Math.floor(share * 1000 + 1e-6) / 10);
  return Math.floor(share * 100 + 1e-6);
}
