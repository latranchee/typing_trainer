import { fingerKind } from '../core/fingers';
import { makePairs, makeSentences, makeWords } from '../core/generator';
import { t } from '../core/i18n';
import type { KeyEvt } from '../core/input';
import { el, flash } from '../ui/dom';
import type { Drill, DrillHost, Note, OptionGroup } from './types';
import { languageOption, matches, toggleOption, toNotes } from './types';

/** Line-height of the text block, in rem. Matches `.line-text` in the stylesheet. */
const LINE_REM = 3.5;

/**
 * Typing along a line of text. Used for words and for letter pairs: the only
 * difference is where the text comes from. The cursor is the next character
 * drawn in its finger's color; a wrong key does not advance.
 */
export class LineDrill implements Drill {
  readonly id: 'words' | 'pairs';
  private host: DrillHost;
  private root = el('div.line-drill');
  private meta = el('p.line-meta');
  private text = el('div.line-text');
  private notes: Note[] = [];
  /** Character element for each note; a dead-key pair shares one element. */
  private cells: HTMLElement[] = [];
  private cursor = 0;
  private total = 0;
  private done = false;
  /** Hardcore: the wrong keys typed past the cursor, drawn in coral where the next letter goes. */
  private run = el('span.typo-run');
  private here: Element | null = null;
  private near: Element | null = null;

  constructor(id: 'words' | 'pairs', host: DrillHost) {
    this.id = id;
    this.host = host;
    this.root.append(this.meta, el('div.line-view', {}, this.text));
  }

  mount(stage: HTMLElement): void {
    stage.append(this.root);
    this.restart();
  }

  unmount(): void {
    this.root.remove();
  }

  restart(): void {
    const { layout, settings, bias } = this.host;
    const source =
      this.id === 'pairs'
        ? makePairs(layout, settings.lang, 14, { size: settings.pairSize, training: settings.pairTraining }, bias)
        : settings.wordsSource === 'sentences'
          ? makeSentences(layout, settings.lang, settings.setWords, { caps: settings.caps }, bias)
          : makeWords(layout, settings.lang, settings.setWords, { caps: settings.caps }, bias);
    this.notes = toNotes(layout, source);
    this.cells = [];
    this.cursor = 0;
    this.done = false;
    this.here = null;
    this.near = null;
    this.text.replaceChildren();
    this.text.classList.remove('has-typos');
    this.text.style.translate = '0 0';

    let word = el('span.word');
    let cell: HTMLElement | null = null;
    this.total = 0;
    this.notes.forEach((note, i) => {
      const firstOfChar = i === 0 || this.notes[i - 1].last;
      if (firstOfChar) {
        // The finger and row shown are those of the stroke that finishes the character.
        const closing = this.notes.slice(i).find((candidate) => candidate.last) ?? note;
        cell = el(
          note.char === ' ' ? 'span.ch.sp' : 'span.ch',
          { 'data-f': fingerKind(closing.finger), 'data-row': closing.row },
          note.char === ' ' ? String.fromCharCode(0xa0) : note.char,
        );
        word.append(cell);
        this.total++;
        if (note.char === ' ') {
          this.text.append(word);
          word = el('span.word');
        }
      }
      this.cells.push(cell!);
    });
    if (word.childElementCount > 0) this.text.append(word);
    this.show();
  }

  options(): OptionGroup[] {
    const { settings, store } = this.host;
    const refresh = (patch: Parameters<typeof store.update>[0]) => {
      store.update(patch);
      this.restart();
    };
    if (this.id === 'pairs') {
      return [
        languageOption(settings, refresh),
        {
          label: t.line.groups,
          value: String(settings.pairSize),
          choices: [
            { value: '2', label: t.line.pairs },
            { value: '3', label: t.line.triples },
          ],
          set: (value) => refresh({ pairSize: value === '3' ? 3 : 2 }),
        },
        {
          label: t.line.training,
          value: settings.pairTraining,
          choices: [
            { value: 'adaptive', label: t.line.adaptive, title: t.line.adaptiveNote },
            { value: 'classic', label: t.line.classic, title: t.line.classicNote },
          ],
          set: (value) => refresh({ pairTraining: value === 'classic' ? 'classic' : 'adaptive' }),
        },
      ];
    }
    return [
      {
        label: t.line.text,
        value: settings.wordsSource,
        choices: [
          { value: 'words', label: t.line.words },
          { value: 'sentences', label: t.line.sentences },
        ],
        set: (value) => refresh({ wordsSource: value as typeof settings.wordsSource }),
      },
      languageOption(settings, refresh),
      {
        label: t.line.words,
        value: String(settings.setWords),
        choices: [15, 30, 60].map((count) => ({ value: String(count), label: String(count) })),
        set: (value) => refresh({ setWords: Number(value) as 15 | 30 | 60 }),
      },
      toggleOption(t.line.capitals, settings.caps, (caps) => refresh({ caps })),
    ];
  }

  key(event: KeyEvt): void {
    if (this.done) return;
    const note = this.notes[this.cursor];
    if (!note) return;
    if (!matches(note, event)) {
      flash(this.cells[this.cursor], 'is-wrong', 220);
      this.host.miss(note, event);
      return;
    }
    this.cursor++;
    this.host.hit(note, event);
    if (this.cursor >= this.notes.length) {
      this.done = true;
      this.show();
      this.host.setNext({ note: null });
      this.host.finish();
      return;
    }
    this.show();
  }

  typos(typed: readonly string[]): void {
    const current = this.cells[this.cursor];
    this.run.replaceChildren(
      ...typed.map((label) => (label === ' ' ? el('span.ch.typo.sp', {}, String.fromCharCode(0xa0)) : el('span.ch.typo', {}, label))),
    );
    const on = typed.length > 0 && current !== undefined;
    // The run sits inside the word, just before the letter it replaced, so it wraps with that word.
    if (on) current.before(this.run);
    else this.run.remove();
    this.text.classList.toggle('has-typos', on);
    this.show();
  }

  private show(): void {
    const current = this.cells[this.cursor] ?? null;
    // The word being typed and the one after it: hardcore keeps these two in sight as the screen narrows.
    const here = current?.parentElement ?? null;
    if (here !== this.here) {
      this.here?.classList.remove('is-here');
      this.near?.classList.remove('is-near');
      this.here = here;
      this.near = here?.nextElementSibling ?? null;
      this.here?.classList.add('is-here');
      this.near?.classList.add('is-near');
    }
    let typed = 0;
    let seen: HTMLElement | null = null;
    this.cells.forEach((cell, i) => {
      if (cell === seen) return;
      seen = cell;
      const isDone = i < this.cursor && cell !== current;
      cell.classList.toggle('is-done', isDone);
      cell.classList.toggle('is-now', cell === current);
      if (isDone) typed++;
    });
    this.meta.textContent = `${typed} / ${this.total}`;

    if (current) {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      const line = Math.round(current.offsetTop / (LINE_REM * rem));
      // Keep the line being typed second from the top once the text has scrolled.
      this.text.style.translate = `0 ${-Math.max(0, line - 1) * LINE_REM}rem`;
    }
    this.host.setNext({ note: this.notes[this.cursor] ?? null });
  }
}
