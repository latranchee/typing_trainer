import type { ReadoutFixture } from '../ui/app';

/**
 * A frozen frame of the practice screen mid-set, for visual regression only.
 * Loaded with `?demo=comp`; nothing here runs in normal use. Every note sits in
 * the lane of the finger that types its letter on the default layout and takes
 * the row of that letter's key, and the lowest note is the next key shown in
 * the right rail.
 */

/** A fixed irregular series: a seeded walk, so the trace looks like typing, not like a waveform. */
function series(count: number): number[] {
  let seed = 41;
  const random = (): number => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const out: number[] = [];
  let value = 74;
  for (let i = 0; i < count; i++) {
    const pull = (78 + (i / count) * 9 - value) * 0.18;
    value += pull + (random() - 0.5) * 9 + (random() < 0.08 ? -9 : 0);
    out.push(value);
  }
  return out;
}

export const compFixture: ReadoutFixture = {
  wpm: 87,
  accuracy: 96,
  streak: 41,
  spark: series(120),
  fingers: { pinky: 0.16, ring: 0.54, middle: 0.71, index: 0.88 },
  highway: {
    notes: [
      { kind: 'pinky', row: 'top', lane: 0, y: 0.175, label: 'q' },
      { kind: 'ring', row: 'home', lane: 1, y: 0.255, label: 's' },
      { kind: 'middle', row: 'bottom', lane: 2, y: 0.3, label: 'c' },
      { kind: 'index', row: 'home', lane: 3, y: 0.385, label: 'f' },
      { kind: 'index', row: 'top', lane: 5, y: 0.2, label: 'u' },
      { kind: 'middle', row: 'home', lane: 6, y: 0.325, label: 'k' },
      { kind: 'ring', row: 'bottom', lane: 7, y: 0.445, label: '.' },
      { kind: 'pinky', row: 'home', lane: 8, y: 0.245, label: ';' },
      { kind: 'pinky', row: 'bottom', lane: 0, y: 0.81, label: 'z' },
      { kind: 'pinky', row: 'top', lane: 8, y: 0.86, label: 'p' },
    ],
  },
  next: { code: 'KeyP', label: 'p', finger: 'RP' },
};
