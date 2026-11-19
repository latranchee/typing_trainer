import { PAIRS, SENTENCES, TRIPLES, WORDS } from './corpus';
import type { Finger } from './fingers';
import { fingerHand, fingerKind, isWeakFinger } from './fingers';
import type { Layout, Stroke } from './layouts';
import { HOME_CODE, LETTER_ROW_CODES } from './physical';
import type { Lang } from './store';

/** How hard a key needs work, 0 to 1. Supplied by the store. */
export type Weakness = (code: string) => number;

const pool = (items: string[], layout: Layout): string[] => [...new Set(items)].filter((item) => layout.canType(item));

/** Share of a text's strokes that land on a ring or pinky finger. */
export function weakShare(layout: Layout, text: string): number {
  const strokes = layout.targets(text).flatMap((target) => target.strokes);
  if (strokes.length === 0) return 0;
  return strokes.filter((stroke) => isWeakFinger(layout.fingerOf(stroke.code))).length / strokes.length;
}

function weightOf(layout: Layout, text: string, weakness: Weakness): number {
  const strokes = layout.targets(text).flatMap((target) => target.strokes);
  if (strokes.length === 0) return 0;
  const personal = strokes.reduce((sum, stroke) => sum + weakness(stroke.code), 0) / strokes.length;
  return 1 + 4 * weakShare(layout, text) + 3 * personal;
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

/** Words for the selected language, weighted toward ring and pinky work and the typist's slow keys. */
export function makeWords(
  layout: Layout,
  lang: Lang,
  count: number,
  options: WordOptions,
  weakness: Weakness,
  random: () => number = Math.random,
): string {
  const words = pool(WORDS[lang], layout).filter((word) => word.length > 1);
  if (words.length === 0) return '';
  const next = sampler(words, words.map((word) => weightOf(layout, word, weakness)), random);
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
  weakness: Weakness,
  random: () => number = Math.random,
): string {
  const sentences = pool(
    SENTENCES[lang].map((sentence) => (options.caps ? sentence : sentence.toLowerCase())),
    layout,
  );
  if (sentences.length === 0) return '';
  const next = sampler(sentences, sentences.map((sentence) => weightOf(layout, sentence, weakness)), random);
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
  focus: 'all' | 'weak';
}

/** Letter associations with no words: each group is typed three times, then the next one. */
export function makePairs(
  layout: Layout,
  lang: Lang,
  groups: number,
  options: PairOptions,
  weakness: Weakness,
  random: () => number = Math.random,
): string {
  let items = pool(options.size === 2 ? PAIRS[lang] : TRIPLES[lang], layout);
  if (options.focus === 'weak') {
    const weak = items.filter((item) => weakShare(layout, item) > 0);
    if (weak.length >= 6) items = weak;
  }
  if (items.length === 0) return '';
  // Earlier entries are more frequent in the language, so they come up more often.
  const weights = items.map((item, i) => (1 + (items.length - i) / items.length) * weightOf(layout, item, weakness));
  const next = sampler(items, weights, random);
  const out: string[] = [];
  for (let i = 0; i < groups; i++) {
    const item = next();
    out.push(item, item, item);
  }
  return out.join(' ');
}

export type AnchorFinger = 'LP' | 'LR' | 'RR' | 'RP';
export const ANCHOR_FINGERS: AnchorFinger[] = ['LP', 'LR', 'RR', 'RP'];

export interface AnchorSet {
  finger: AnchorFinger;
  /** Home keys the other fingers of that hand must keep pressed. */
  anchors: string[];
  taps: Stroke[];
}

/**
 * An isolation set: the other fingers of the hand hold their home keys, so only
 * the trained finger can reach the targets. Key events can verify the hold.
 */
export function makeAnchorSet(
  layout: Layout,
  finger: AnchorFinger,
  anchorCount: number,
  taps: number,
  random: () => number = Math.random,
): AnchorSet {
  const hand = fingerHand(finger);
  const home = HOME_CODE[finger];
  const reach = LETTER_ROW_CODES.filter((code) => layout.fingerOf(code) === finger && layout.legend(code));
  const others = reach.filter((code) => code !== home);

  // Nearest neighbours first, so reducing the count keeps the anchors that matter most.
  const order: Record<AnchorFinger, Finger[]> = {
    LP: ['LR', 'LM', 'LI'],
    LR: ['LM', 'LP', 'LI'],
    RR: ['RM', 'RP', 'RI'],
    RP: ['RR', 'RM', 'RI'],
  };
  const anchors = order[finger]
    .filter((other) => fingerHand(other) === hand && fingerKind(other) !== 'thumb')
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
