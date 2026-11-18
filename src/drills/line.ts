import { fingerKind } from '../core/fingers';
import { makePairs, makeWords } from '../core/generator';
import type { KeyEvt } from '../core/input';
import { el, flash } from '../ui/dom';
import type { Drill, DrillHost, Note, OptionGroup } from './types';
import { matches, toNotes } from './types';

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
    const { layout, settings, weakness } = this.host;
    const source =
      this.id === 'pairs'
        ? makePairs(layout, settings.lang, 14, { size: settings.pairSize, focus: settings.pairFocus }, weakness)
        : makeWords(layout, settings.lang, settings.setWords, { caps: settings.caps }, weakness);
    this.notes = toNotes(layout, source);
    this.cells = [];
    this.cursor = 0;
    this.done = false;
    this.text.replaceChildren();
    this.text.style.translate = '0 0';

    let word = el('span.word');
    let cell: HTMLElement | null = null;
    this.total = 0;
    this.notes.forEach((note, i) => {
      const firstOfChar = i === 0 || this.notes[i - 1].last;
      if (firstOfChar) {
        // The finger shown is the one that finishes the character.
        const closing = this.notes.slice(i).find((candidate) => candidate.last) ?? note;
        cell = el(note.char === ' ' ? 'span.ch.sp' : 'span.ch', { 'data-f': fingerKind(closing.finger) }, note.char === ' ' ? String.fromCharCode(0xa0) : note.char);
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
        {
          label: 'groups',
          value: String(settings.pairSize),
          choices: [
            { value: '2', label: 'pairs' },
            { value: '3', label: 'triples' },
          ],
          set: (value) => refresh({ pairSize: value === '3' ? 3 : 2 }),
        },
        {
          label: 'focus',
          value: settings.pairFocus,
          choices: [
            { value: 'weak', label: 'ring and pinky' },
            { value: 'all', label: 'all fingers' },
          ],
          set: (value) => refresh({ pairFocus: value as 'all' | 'weak' }),
        },
      ];
    }
    return [
      {
        label: 'words',
        value: String(settings.setWords),
        choices: [15, 30, 60].map((count) => ({ value: String(count), label: String(count) })),
        set: (value) => refresh({ setWords: Number(value) as 15 | 30 | 60 }),
      },
      {
        label: 'capitals',
        value: settings.caps ? 'on' : 'off',
        choices: [
          { value: 'off', label: 'off' },
          { value: 'on', label: 'on' },
        ],
        set: (value) => refresh({ caps: value === 'on' }),
      },
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

  private show(): void {
    const current = this.cells[this.cursor] ?? null;
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
