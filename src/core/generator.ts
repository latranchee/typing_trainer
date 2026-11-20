import { PAIRS, SENTENCES, TRIPLES, WORDS } from './corpus';
import type { Finger } from './fingers';
import { fingerHand, fingerKind, FINGERS } from './fingers';
import type { Layout, Stroke } from './layouts';
import { MIN_SAMPLES } from './metrics';
import { HOME_CODE, letterRowCodes } from './physical';
import type { Lang } from './store';

/** How hard a key needs work, 0 to 1. Supplied by the store. */
export type Weakness = (code: string) => number;

/** The eight fingers that type letters, left pinky to right pinky. The thumbs only have the space bar. */
export type TypingFinger = Exclude<Finger, 'LT' | 'RT'>;
export const TYPING_FINGERS: TypingFinger[] = FINGERS.filter((finger): finger is TypingFinger => fingerKind(finger) !== 'thumb');

/** The fingers this trainer was made for: where a profile's focus starts. */
export const DEFAULT_FOCUS: TypingFinger[] = ['LP', 'LR', 'RR', 'RP'];

/**
 * What tilts the choice of text: the fingers the typist picked to train more,
 * and the keys their own numbers show as slow.
 */
export interface Bias {
  weakness: Weakness;
  focus: ReadonlySet<Finger>;
  /** The typist's measured transitions, for the adaptive letter groups. Without them the groups are drawn by frequency alone. */
  transitions?: Transitions;
}

/** What the store knows of the typist's transitions, each a pair of letters such as `st`. */
export interface Transitions {
  /** How much a transition needs work, 0 to 1. 0 as well for one measured too few times to tell. */
  weakness(pair: string): number;
  /** Clean transitions measured. */
  samples(pair: string): number;
}

/** How the letter groups are drawn: around the typist's own weak transitions, or by frequency in the language alone. */
export type PairTraining = 'adaptive' | 'classic';

const pool = (items: string[], layout: Layout): string[] => [...new Set(items)].filter((item) => layout.canType(item));

/** Share of a text's strokes that land on one of the `fingers`. */
export function fingerShare(layout: Layout, text: string, fingers: ReadonlySet<Finger>): number {
  const strokes = layout.targets(text).flatMap((target) => target.strokes);
  if (strokes.length === 0 || fingers.size === 0) return 0;
  return strokes.filter((stroke) => fingers.has(layout.fingerOf(stroke.code))).length / strokes.length;
}

/** A focus on no finger, or on all eight, favors nothing. */
const hasFocus = (focus: ReadonlySet<Finger>): boolean => focus.size > 0 && TYPING_FINGERS.some((finger) => !focus.has(finger));

/** How hard the focus pulls on words and sentences. Measured on the word lists: with ring and pinky picked, two letters in three are theirs in English and more than half in French, against one in three unweighted. */
const PULL = 5;
/** Letter groups are few, and one made only of focus letters is common: a softer pull keeps a set from repeating the same handful. */
const GROUP_PULL = 2.5;

/**
 * How much a text is wanted. Each tenth of its strokes that lands on a focus finger
 * multiplies its chances by the same factor, so a word made of their letters comes up
 * many times as often as one with none, and no word is ever left out. The typist's
 * slow keys multiply it again, up to four times.
 */
function weightOf(layout: Layout, text: string, bias: Bias, pull = PULL): number {
  const strokes = layout.targets(text).flatMap((target) => target.strokes);
  if (strokes.length === 0) return 0;
  const personal = strokes.reduce((sum, stroke) => sum + bias.weakness(stroke.code), 0) / strokes.length;
  const share = hasFocus(bias.focus) ? fingerShare(layout, text, bias.focus) : 0;
  return Math.exp(pull * share) * (1 + 3 * personal);
}

/** Weighted pick that never returns the same item twice in a row. */
function sampler(items: string[], weights: number[], random: () => number): () => string {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let previous = '';
  return () => {
    for (let attempt = 0; attempt < 6; attempt++) {
      let roll = random() * total;
      let choice = items[items.length - 1];
      for (let i = 0; i < items.length; i++) {
        roll -= weights[i];
        if (roll <= 0) {
          choice = items[i];
          break;
        }
      }
      if (choice !== previous || items.length === 1) {
        previous = choice;
        return choice;
      }
    }
    return previous;
  };
}

const capitalize = (word: string): string => word[0].toUpperCase() + word.slice(1);

export interface WordOptions {
  caps: boolean;
}

/** Words for the selected language, weighted toward the focus fingers and the typist's slow keys. */
export function makeWords(
  layout: Layout,
  lang: Lang,
  count: number,
  options: WordOptions,
  bias: Bias,
  random: () => number = Math.random,
): string {
  const words = pool(WORDS[lang], layout).filter((word) => word.length > 1);
  if (words.length === 0) return '';
  const next = sampler(words, words.map((word) => weightOf(layout, word, bias)), random);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const word = next();
    out.push(options.caps && random() < 0.4 && layout.canType(capitalize(word)) ? capitalize(word) : word);
  }
  return out.join(' ');
}

/**
 * Whole sentences for the selected language, about `count` words of them: sentences
 * are added until the count is reached, so the last one may run past it. They are
 * weighted like the words, and none comes twice in a set while others are left.
 * Without capitals the sentences are typed in lowercase; their punctuation stays.
 */
export function makeSentences(
  layout: Layout,
  lang: Lang,
  count: number,
  options: WordOptions,
  bias: Bias,
  random: () => number = Math.random,
): string {
  const sentences = pool(
    SENTENCES[lang].map((sentence) => (options.caps ? sentence : sentence.toLowerCase())),
    layout,
  );
  if (sentences.length === 0) return '';
  const next = sampler(sentences, sentences.map((sentence) => weightOf(layout, sentence, bias)), random);
  const used = new Set<string>();
  const out: string[] = [];
  let words = 0;
  while (words < count) {
    let sentence = next();
    for (let attempt = 0; used.has(sentence) && attempt < 8; attempt++) sentence = next();
    // The draw kept landing on sentences already in the set: take the first one that is not.
    if (used.has(sentence)) sentence = sentences.find((candidate) => !used.has(candidate)) ?? sentence;
    used.add(sentence);
    out.push(sentence);
    words += sentence.split(' ').length;
  }
  return out.join(' ');
}

export interface PairOptions {
  size: 2 | 3;
  /** Classic when absent: by frequency in the language alone. */
  training?: PairTraining;
}

/** The transitions inside a letter group: `the` holds `th` and `he`. */
export const transitionsOf = (group: string): string[] =>
  [...group.slice(1)].map((char, i) => (group[i] + char).toLowerCase());

/**
 * How much a letter group needs work, 0 to 1, from its transitions. A pair is its one
 * transition. A triple is half the mean of its two and half the weaker one, so a group
 * with one hard transition counts for more than a mean would give it.
 */
export function groupWeakness(group: string, transitions: Transitions): number {
  const scores = transitionsOf(group).map((pair) => transitions.weakness(pair));
  if (scores.length === 0) return 0;
  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  return 0.5 * mean + 0.5 * Math.max(...scores);
}

/** True while one of a group's transitions has been measured too few times to say anything. */
export const isUnderPracticed = (group: string, transitions: Transitions): boolean =>
  transitionsOf(group).some((pair) => transitions.samples(pair) < MIN_SAMPLES);

/** The adaptive draw, in shares of a set: the typist's weak transitions, common ones, and the ones measured too few times yet. */
export const ADAPTIVE_SHARES = { weak: 0.6, common: 0.25, explore: 0.15 } as const;
type Source = keyof typeof ADAPTIVE_SHARES;
const SOURCES = Object.keys(ADAPTIVE_SHARES) as Source[];
/** Each time a group is drawn its chances halve for the rest of the set, so the weakest one does not fill it. */
const DRAWN_DAMP = 0.5;
/**
 * Weakness under this is the spread of a typist's ordinary pace, not a weak transition:
 * about a fifth slower than the median, or a miss in twenty-five. Groups are drawn as weak
 * by what they score above it, so a transition that turned fluent leaves the weak draw
 * and a typist with no standout transition trains on frequency.
 */
export const WEAK_FLOOR = 0.1;
/**
 * A weak slot draws against this much weight of its own, which hands the slot to the
 * common groups. Against many weak transitions it is a small share. Against a single
 * one it decides: that transition takes the weak slots in proportion to how weak it is,
 * and gives them back little by little as it improves.
 */
const WEAK_YIELD = 0.5;

/**
 * Letter associations with no words: each group is typed three times, then the next one.
 * With a focus, only the groups that give a focus finger a letter are drawn, while enough of them exist.
 * Adaptive training draws most groups from the typist's weak transitions; classic draws by frequency alone.
 */
export function makePairs(
  layout: Layout,
  lang: Lang,
  groups: number,
  options: PairOptions,
  bias: Bias,
  random: () => number = Math.random,
): string {
  let items = pool(options.size === 2 ? PAIRS[lang] : TRIPLES[lang], layout);
  if (hasFocus(bias.focus)) {
    const focused = items.filter((item) => fingerShare(layout, item, bias.focus) > 0);
    if (focused.length >= 6) items = focused;
  }
  if (items.length === 0) return '';
  // Earlier entries are more frequent in the language, so they come up more often.
  const weights = items.map((item, i) => (1 + (items.length - i) / items.length) * weightOf(layout, item, bias, GROUP_PULL));
  const picks =
    options.training === 'adaptive' && bias.transitions
      ? adaptivePicks(items, weights, bias.transitions, groups, random)
      : classicPicks(items, weights, groups, random);
  return picks.flatMap((item) => [item, item, item]).join(' ');
}

function classicPicks(items: string[], weights: number[], groups: number, random: () => number): string[] {
  const next = sampler(items, weights, random);
  return Array.from({ length: groups }, () => next());
}

/** Splits `groups` slots among the sources by their shares, the leftover slots to the largest remainders. */
export function adaptiveQuotas(groups: number): Record<Source, number> {
  const exact = SOURCES.map((source) => groups * ADAPTIVE_SHARES[source]);
  const counts = exact.map(Math.floor);
  const order = SOURCES.map((_, i) => i).sort((a, b) => exact[b] - counts[b] - (exact[a] - counts[a]));
  let left = groups - counts.reduce((sum, count) => sum + count, 0);
  for (let i = 0; left > 0; i++, left--) counts[order[i % order.length]]++;
  return { weak: counts[0], common: counts[1], explore: counts[2] };
}

/**
 * An index drawn in proportion to `weights`, never `skip`. -1 when nothing else has a
 * chance, or when the roll lands on `spare`, a weight that belongs to no index.
 */
function draw(weights: number[], skip: number, random: () => number, spare = 0): number {
  const total = weights.reduce((sum, weight, i) => (i === skip ? sum : sum + weight), 0);
  if (total <= 0) return -1;
  let roll = random() * (total + spare);
  if (roll >= total) return -1;
  let last = -1;
  for (let i = 0; i < weights.length; i++) {
    if (i === skip || weights[i] <= 0) continue;
    last = i;
    roll -= weights[i];
    if (roll <= 0) return i;
  }
  return last;
}

/**
 * The adaptive set. Its slots go to three sources, in shuffled order: the weak groups,
 * drawn in proportion to how much they need work past the floor; the common ones, drawn as in classic
 * training; and the groups with a transition measured too few times, drawn by frequency
 * so they get measured. A source with nothing to give hands its slot to the common
 * groups, so a profile with no numbers yet trains on frequency alone, and the weak
 * slots fill up as weak transitions show up.
 */
function adaptivePicks(items: string[], frequency: number[], transitions: Transitions, groups: number, random: () => number): string[] {
  const pools: Record<Source, number[]> = {
    weak: items.map((item) => Math.max(0, groupWeakness(item, transitions) - WEAK_FLOOR)),
    common: [...frequency],
    explore: items.map((item, i) => (isUnderPracticed(item, transitions) ? frequency[i] : 0)),
  };
  const count = adaptiveQuotas(groups);
  const slots = SOURCES.flatMap((source) => Array<Source>(count[source]).fill(source));
  // Fisher-Yates, so the weak groups do not all come first.
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }

  const out: string[] = [];
  let previous = -1;
  for (const source of slots) {
    let pick = draw(pools[source], previous, random, source === 'weak' ? WEAK_YIELD : 0);
    if (pick < 0) pick = draw(pools.common, previous, random);
    // A single group to draw from: it repeats, as in classic training.
    if (pick < 0) pick = Math.max(0, previous);
    for (const weights of Object.values(pools)) weights[pick] *= DRAWN_DAMP;
    out.push(items[pick]);
    previous = pick;
  }
  return out;
}

/** The fingers the anchor drill takes in turn: the focus fingers, or the default focus when none is picked. */
export function anchorTurns(focus: ReadonlySet<Finger>): TypingFinger[] {
  const picked = TYPING_FINGERS.filter((finger) => focus.has(finger));
  return picked.length > 0 ? picked : DEFAULT_FOCUS;
}

export interface AnchorSet {
  finger: TypingFinger;
  /** Home keys the other fingers of that hand must keep pressed. */
  anchors: string[];
  taps: Stroke[];
}

/** The other fingers of the hand, nearest neighbours first, so a lower count keeps the anchors that matter most. */
const NEIGHBOURS: Record<TypingFinger, TypingFinger[]> = {
  LP: ['LR', 'LM', 'LI'],
  LR: ['LM', 'LP', 'LI'],
  LM: ['LR', 'LI', 'LP'],
  LI: ['LM', 'LR', 'LP'],
  RI: ['RM', 'RR', 'RP'],
  RM: ['RR', 'RI', 'RP'],
  RR: ['RM', 'RP', 'RI'],
  RP: ['RR', 'RM', 'RI'],
};

/**
 * An isolation set: the other fingers of the hand hold their home keys, so only
 * the trained finger can reach the targets. Key events can verify the hold.
 */
export function makeAnchorSet(
  layout: Layout,
  finger: TypingFinger,
  anchorCount: number,
  taps: number,
  random: () => number = Math.random,
): AnchorSet {
  const hand = fingerHand(finger);
  const home = HOME_CODE[finger];
  const reach = letterRowCodes(layout.board).filter((code) => layout.fingerOf(code) === finger && layout.legend(code));
  const others = reach.filter((code) => code !== home);

  const anchors = NEIGHBOURS[finger]
    .filter((other) => fingerHand(other) === hand)
    .slice(0, anchorCount)
    .map((other) => HOME_CODE[other]);

  const sequence: Stroke[] = [];
  let previous = '';
  for (let i = 0; i < taps; i++) {
    // Alternate home and reach so the finger returns to its resting key every other tap.
    let code = home;
    if (i % 2 === 1 && others.length > 0) {
      do code = others[Math.floor(random() * others.length)];
      while (code === previous && others.length > 1);
      previous = code;
    }
    sequence.push({ code, shift: false });
  }
  return { finger, anchors, taps: sequence };
}
