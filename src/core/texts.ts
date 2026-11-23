import { PAIRS, SENTENCES, TRIPLES, WORDS } from './corpus';
import type { Bias } from './generator';
import { makePairs, makeSentences, makeWords } from './generator';
import type { Layout } from './layouts';
import type { Lang } from './lang';
import { LANGS } from './lang';

/**
 * Every set's text has an id, so it can be typed again, shared and ranked on its own.
 * The id is a hash of the language and the text, the same in the page and on the server.
 */

/** Where a text came from: words drawn one by one, whole sentences, or letter groups. */
export type TextKind = 'words' | 'sentences' | 'pairs';
export const TEXT_KINDS: TextKind[] = ['words', 'sentences', 'pairs'];

/** Ids are 12 characters of base32: 60 bits, plenty for texts typed by people. */
const ID_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';
export const TEXT_ID = /^[a-z2-9]{12}$/;
/** The longest text a set makes: 60 words of the longest sentences, with room to spare. */
export const MAX_TEXT = 1200;

export async function textId(lang: Lang, text: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${lang}\n${text}`)));
  let id = '';
  for (let i = 0; i < 12; i++) id += ID_ALPHABET[bytes[i] & 31];
  return id;
}

const wordSets = new Map<Lang, Set<string>>();
const groupSets = new Map<Lang, Set<string>>();
const sentenceSets = new Map<Lang, Set<string>>();

function wordsOf(lang: Lang): Set<string> {
  let set = wordSets.get(lang);
  if (!set) wordSets.set(lang, (set = new Set(WORDS[lang])));
  return set;
}

function groupsOf(lang: Lang): Set<string> {
  let set = groupSets.get(lang);
  if (!set) groupSets.set(lang, (set = new Set([...PAIRS[lang], ...TRIPLES[lang]])));
  return set;
}

function sentencesOf(lang: Lang): Set<string> {
  let set = sentenceSets.get(lang);
  if (!set) sentenceSets.set(lang, (set = new Set(SENTENCES[lang].flatMap((sentence) => [sentence, sentence.toLowerCase()]))));
  return set;
}

const uncapitalize = (word: string): string => word[0].toLowerCase() + word.slice(1);

/** True when the text was made the way the trainer makes texts: words, sentences or groups of its own lists. */
export function isTrainerText(lang: Lang, kind: TextKind, text: string): boolean {
  if (!LANGS.includes(lang) || text.length === 0 || text.length > MAX_TEXT || text !== text.trim()) return false;
  if (kind === 'sentences') return splitsIntoSentences(text, sentencesOf(lang));
  const tokens = text.split(' ');
  if (tokens.length < 3) return false;
  if (kind === 'pairs') {
    const groups = groupsOf(lang);
    return tokens.every((token) => groups.has(token));
  }
  const words = wordsOf(lang);
  return tokens.every((token) => token.length > 0 && (words.has(token) || words.has(uncapitalize(token))));
}

/** The text is whole sentences of the list, one space apart. */
function splitsIntoSentences(text: string, sentences: Set<string>): boolean {
  // Positions already shown to lead nowhere: each is tried once.
  const dead = new Set<number>();
  const walk = (from: number): boolean => {
    if (from === text.length) return true;
    if (dead.has(from)) return false;
    // A sentence can end at any space ahead, or at the end of the text.
    for (let end = from + 1; end <= text.length; end++) {
      if (end < text.length && text[end] !== ' ') continue;
      if (sentences.has(text.slice(from, end)) && (end === text.length || walk(end + 1))) return true;
    }
    dead.add(from);
    return false;
  };
  return walk(0);
}

/** A seeded generator (mulberry32): the same seed gives the same text everywhere. */
export function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** No pull toward any finger and no weak keys: the text a race gives everyone. */
export const NEUTRAL: Bias = { weakness: () => 0, focus: new Set() };

/** A layout that types only what every racer's layout types. */
function common(layouts: readonly Layout[]): Layout {
  const [first] = layouts;
  return { ...first, canType: (text: string) => layouts.every((layout) => layout.canType(text)) };
}

/** A race's text: drawn from a seed, with no one's numbers in it, and typeable on every racer's layout. */
export function raceText(layouts: readonly Layout[], lang: Lang, kind: TextKind, words: number, seed: number): string {
  const layout = common(layouts);
  const random = seeded(seed);
  if (kind === 'pairs') return makePairs(layout, lang, Math.max(4, Math.round(words / 2)), { size: 2, training: 'classic' }, NEUTRAL, random);
  if (kind === 'sentences') return makeSentences(layout, lang, words, { caps: true }, NEUTRAL, random);
  return makeWords(layout, lang, words, { caps: false }, NEUTRAL, random);
}
