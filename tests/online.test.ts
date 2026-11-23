import { describe, expect, it } from 'vitest';
import { DEFAULT_FOCUS, makePairs, makeSentences, makeWords } from '../src/core/generator';
import { cleanModel, modelKey } from '../src/core/keyboards';
import { getLayout } from '../src/core/layouts';
import { SetStats } from '../src/core/metrics';
import type { LogEvent } from '../src/core/replay';
import { decodeGhost, encodeGhost, ERASE, ghostAt, KeyLog, ranks, replay, verdict } from '../src/core/replay';
import { LANGS } from '../src/core/store';
import { isTrainerText, raceText, seeded, textId } from '../src/core/texts';

const us = getLayout('us');
const caFr = getLayout('ca-fr');
const colemak = getLayout('colemak-dh');
const biased = { weakness: () => 0, focus: new Set(DEFAULT_FOCUS) };

/** Types a text perfectly, one stroke every `gap` ms with a little jitter, as a hand would. */
function typeText(text: string, gap = 120, layout = us): LogEvent[] {
  const log = new KeyLog();
  let time = 1000;
  const random = seeded(7);
  for (const target of layout.targets(text)) {
    for (const stroke of target.strokes) {
      log.stroke(stroke.code, stroke.shift, time);
      time += gap * (0.6 + random() * 0.8);
    }
  }
  return log.take();
}

describe('replay', () => {
  it('scores a clean set exactly as the drill counts it', () => {
    const text = 'the cat sat';
    const log = typeText(text);
    const run = replay(us, text, log, false);
    // The same strokes through the drill's own counter.
    const stats = new SetStats();
    let time = 0;
    for (const [dt] of log) {
      time += dt;
      stats.hit(time, true);
    }
    expect(run.complete).toBe(true);
    expect(run.chars).toBe(text.length);
    expect(run.acc).toBe(1);
    expect(run.wpm).toBeCloseTo(stats.wpm, 6);
    expect(run.marks).toHaveLength(text.length);
  });

  it('counts a wrong key as a miss and keeps the cursor', () => {
    const log: LogEvent[] = [
      [0, 'KeyA', 0],
      [100, 'KeyX', 0],
      [100, 'KeyB', 0],
      [100, 'KeyC', 0],
    ];
    const run = replay(us, 'abc', log, false);
    expect(run.complete).toBe(true);
    expect(run.wrong).toBe(1);
    expect(run.correct).toBe(3);
  });

  it('makes every key after a hardcore typo a miss until Backspace clears it', () => {
    const log: LogEvent[] = [
      [0, 'KeyA', 0],
      [100, 'KeyX', 0],
      [100, 'KeyB', 0],
      [100, ERASE, 0],
      [100, ERASE, 0],
      [100, 'KeyB', 0],
      [100, 'KeyC', 0],
    ];
    // The B after the typo lands as a second typo, and both are erased before the B that counts.
    const hard = replay(us, 'abc', log, true);
    expect(hard.complete).toBe(true);
    expect(hard.wrong).toBe(2);
    expect(hard.correct).toBe(3);
    // The same keys outside hardcore: the first B counts, the erases do nothing, and the second B misses the C.
    const soft = replay(us, 'abc', log, false);
    expect(soft.complete).toBe(true);
    expect(soft.wrong).toBe(2);
  });

  it('takes the dead key and the letter as one character on Canadian French', () => {
    const text = 'fête';
    const run = replay(caFr, text, typeText(text, 120, caFr), false);
    expect(run.complete).toBe(true);
    expect(run.chars).toBe(4);
    expect(run.correct).toBe(5);
  });

  it('flags a log that stops short of the end', () => {
    const run = replay(us, 'abc', [[0, 'KeyA', 0]], false);
    expect(verdict(run)).toBe('incomplete');
  });

  it('turns away a metronome and a burst no hand types', () => {
    const text = makeWords(us, 'en', 30, { caps: false }, biased, seeded(1));
    const steady: LogEvent[] = typeText(text).map(([, code, flag], i) => [i === 0 ? 0 : 90, code, flag]);
    expect(verdict(replay(us, text, steady, false))).toBe('machine');
    const burst: LogEvent[] = typeText(text).map(([, code, flag], i) => [i === 0 ? 0 : 5, code, flag]);
    expect(verdict(replay(us, text, burst, false))).not.toBe('ok');
    expect(verdict(replay(us, text, typeText(text), false))).toBe('ok');
  });

  it('ranks only accurate sets long enough to say something', () => {
    const text = makeWords(us, 'en', 15, { caps: false }, biased, seeded(2));
    expect(ranks(replay(us, text, typeText(text), false))).toBe(true);
    expect(ranks(replay(us, 'the cat', typeText('the cat'), false))).toBe(false);
  });
});

describe('ghosts', () => {
  it('round-trips a run to within ten milliseconds a character', () => {
    const marks = [0, 140, 305, 470, 2600, 2711];
    const back = decodeGhost(encodeGhost(marks));
    expect(back).toHaveLength(marks.length);
    back.forEach((mark, i) => expect(Math.abs(mark - marks[i])).toBeLessThanOrEqual(5));
  });

  it('says how far a ghost got at any moment', () => {
    const marks = [0, 100, 200, 300];
    expect(ghostAt(marks, -1)).toBe(0);
    expect(ghostAt(marks, 0)).toBe(1);
    expect(ghostAt(marks, 150)).toBe(2);
    expect(ghostAt(marks, 5000)).toBe(4);
  });
});

describe('texts', () => {
  it('knows the texts the trainer makes, in every language and kind', () => {
    for (const lang of LANGS) {
      for (let seed = 1; seed <= 5; seed++) {
        expect(isTrainerText(lang, 'words', makeWords(caFr, lang, 30, { caps: true }, biased, seeded(seed))), `${lang} words`).toBe(true);
        expect(isTrainerText(lang, 'sentences', makeSentences(caFr, lang, 30, { caps: seed % 2 === 0 }, biased, seeded(seed))), `${lang} sentences`).toBe(true);
        expect(isTrainerText(lang, 'pairs', makePairs(caFr, lang, 14, { size: seed % 2 === 0 ? 2 : 3 }, biased, seeded(seed))), `${lang} pairs`).toBe(true);
      }
    }
  });

  it('turns away text the trainer never makes', () => {
    expect(isTrainerText('en', 'words', 'a a a a a a a a')).toBe(false);
    expect(isTrainerText('en', 'words', 'the and that ')).toBe(false);
    expect(isTrainerText('en', 'pairs', 'th th th zzzz')).toBe(false);
    expect(isTrainerText('en', 'sentences', 'The quick brown fox.')).toBe(false);
  });

  it('gives a text the same id every time, and another text another id', async () => {
    const a = await textId('en', 'the cat sat');
    expect(a).toMatch(/^[a-z2-9]{12}$/);
    expect(await textId('en', 'the cat sat')).toBe(a);
    expect(await textId('fr', 'the cat sat')).not.toBe(a);
  });

  it('draws a race text every racer can type, the same from the same seed', () => {
    const one = raceText([caFr, colemak], 'fr', 'words', 30, 42);
    expect(raceText([caFr, colemak], 'fr', 'words', 30, 42)).toBe(one);
    expect(colemak.canType(one)).toBe(true);
    expect(caFr.canType(one)).toBe(true);
    expect(isTrainerText('fr', 'words', one)).toBe(true);
  });
});

describe('keyboards', () => {
  it('meets two spellings of one model on one key', () => {
    expect(modelKey('Keychron K2 V2')).toBe(modelKey('keychron  k2-v2'));
    expect(modelKey('Keychron K2')).not.toBe(modelKey('Keychron K2 V2'));
    expect(cleanModel('  HHKB   Pro\u0007 2 ')).toBe('HHKB Pro 2');
  });
});
