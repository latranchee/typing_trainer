import { fingerKind, fingerName } from '../core/fingers';
import type { AnchorFinger, AnchorSet } from '../core/generator';
import { ANCHOR_FINGERS, makeAnchorSet } from '../core/generator';
import type { KeyEvt } from '../core/input';
import { rowOf } from '../core/physical';
import { el, flash } from '../ui/dom';
import type { Drill, DrillHost, Note, OptionGroup } from './types';

const TAPS = 24;

/**
 * Isolation sets. The other fingers of the hand hold their home keys while the
 * trained finger taps its own keys. Held keys are something key events can
 * prove, so this is the one drill that can check the right finger did the work.
 */
export class AnchorsDrill implements Drill {
  readonly id = 'anchors' as const;
  private host: DrillHost;
  private root = el('div.anchor-drill');
  private head = el('p.anchor-head');
  private sub = el('p.anchor-sub');
  private hold = el('div.anchor-hold');
  private track = el('div.anchor-track');
  private status = el('p.anchor-status', { role: 'status' });
  private set!: AnchorSet;
  private notes: Note[] = [];
  private tokens: HTMLElement[] = [];
  private holdKeys = new Map<string, HTMLElement>();
  private cursor = 0;
  private rotation = 0;
  private done = false;

  constructor(host: DrillHost) {
    this.host = host;
    this.root.append(el('div', {}, this.head, this.sub), this.hold, this.track, this.status);
  }

  mount(stage: HTMLElement): void {
    stage.append(this.root);
    this.restart();
  }

  unmount(): void {
    this.root.remove();
  }

  restart(): void {
    const { layout, settings } = this.host;
    const finger: AnchorFinger =
      settings.anchorFinger === 'rotate' ? ANCHOR_FINGERS[this.rotation++ % ANCHOR_FINGERS.length] : settings.anchorFinger;
    this.set = makeAnchorSet(layout, finger, settings.anchorCount, TAPS);
    const kind = fingerKind(finger);
    this.notes = this.set.taps.map((stroke) => ({
      stroke,
      label: layout.strokeLabel(stroke),
      finger,
      row: rowOf(stroke.code),
      char: layout.strokeLabel(stroke),
      last: true,
    }));
    this.cursor = 0;
    this.done = false;

    this.head.textContent = fingerName(finger);
    this.sub.textContent =
      this.set.anchors.length > 0
        ? 'Keep the other fingers of this hand down on their home keys. Only this finger can reach the notes.'
        : 'No anchors: tap the notes with this finger and keep the hand on the home row.';

    this.hold.replaceChildren();
    this.holdKeys.clear();
    if (this.set.anchors.length > 0) {
      this.hold.append('hold');
      for (const code of this.set.anchors) {
        const key = el('span.hold-key', { 'data-f': fingerKind(layout.fingerOf(code)) }, layout.strokeLabel({ code, shift: false }));
        this.holdKeys.set(code, key);
        this.hold.append(key);
      }
    }

    // One finger, so one color: the shape and shade say which row each tap reaches.
    this.tokens = this.notes.map((note) => el('span.tok', { 'data-f': kind, 'data-row': note.row }, el('span', {}, note.label)));
    this.track.replaceChildren(...this.tokens);
    this.status.textContent = '';
    this.status.classList.remove('is-error');
    this.show();
  }

  options(): OptionGroup[] {
    const { settings, store } = this.host;
    const refresh = (patch: Parameters<typeof store.update>[0]) => {
      store.update(patch);
      this.rotation = 0;
      this.restart();
    };
    return [
      {
        label: 'finger',
        value: settings.anchorFinger,
        choices: [
          { value: 'rotate', label: 'all four' },
          ...ANCHOR_FINGERS.map((finger) => ({ value: finger, label: fingerName(finger) })),
        ],
        set: (value) => refresh({ anchorFinger: value as typeof settings.anchorFinger }),
      },
      {
        label: 'anchors',
        value: String(settings.anchorCount),
        choices: [3, 2, 1, 0].map((count) => ({ value: String(count), label: count === 0 ? 'off' : String(count) })),
        set: (value) => refresh({ anchorCount: Number(value) as 0 | 1 | 2 | 3 }),
      },
    ];
  }

  key(event: KeyEvt): void {
    if (this.done) return;
    // Pressing an anchor is part of the exercise, never an error.
    if (this.set.anchors.includes(event.code)) return;
    const note = this.notes[this.cursor];
    if (!note) return;

    if (note.stroke.code !== event.code) {
      flash(this.tokens[this.cursor], 'is-wrong', 220);
      this.host.miss(note, event);
      return;
    }

    const missing = this.set.anchors.filter((code) => !event.held.has(code));
    if (missing.length > 0) {
      for (const code of missing) flash(this.holdKeys.get(code)!, 'is-missing', 600);
      const names = missing.map((code) => this.host.layout.strokeLabel({ code, shift: false })).join(' ');
      this.status.textContent = `anchor lifted: keep ${names} down. If your keyboard cannot register this many keys at once, press esc and lower the "anchors" setting under the keyboard.`;
      this.status.classList.add('is-error');
      return;
    }

    this.status.textContent = '';
    this.status.classList.remove('is-error');
    this.cursor++;
    this.host.hit(note, event);
    if (this.cursor >= this.notes.length) {
      this.done = true;
      this.host.setNext({ note: null });
      this.host.finish();
      return;
    }
    this.show();
  }

  /** Lights each anchor while its key is physically down. */
  held(held: ReadonlySet<string>): void {
    for (const [code, key] of this.holdKeys) key.classList.toggle('is-held', held.has(code));
  }

  private show(): void {
    this.tokens.forEach((token, i) => {
      token.classList.toggle('is-done', i < this.cursor);
      token.classList.toggle('is-now', i === this.cursor);
    });
    this.host.setNext({ note: this.notes[this.cursor] ?? null, anchors: this.set.anchors });
  }
}
