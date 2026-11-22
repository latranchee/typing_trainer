/**
 * Typing from a phone's on-screen keyboard. A touch keyboard reports characters, not
 * physical keys: `keydown` arrives without a `code` (Android sends key 229) and the
 * text lands in a field. So the trainer keeps one hidden field focused and reads what
 * changed in it after every `input` event.
 *
 * The field always holds a few invisible characters, so Backspace has something to
 * delete (and fires an event) even when nothing was typed. After each change the field
 * goes back to them, unless a keyboard is composing a word: resetting the text under a
 * composition makes Android keyboards type it twice.
 */

/** Zero-width spaces: nothing on screen, nothing a keyboard can autocorrect or capitalize after. */
export const SENTINEL = '​​​​';

/** What one change of the field did: characters deleted from its end, then characters added. */
export interface TypedChange {
  removed: number;
  added: string[];
}

/**
 * The difference between the field's text before and after an `input` event. Text is
 * compared from the start: whatever follows the shared beginning was deleted, and the
 * new text after it was typed. One wrong guess of a keyboard (an autocorrection) shows
 * as deletions followed by its replacement, which is what it did to the text.
 */
export function diffTyped(before: string, after: string): TypedChange {
  let shared = 0;
  const max = Math.min(before.length, after.length);
  while (shared < max && before.charCodeAt(shared) === after.charCodeAt(shared)) shared++;
  // A surrogate pair is one character: never split it.
  if (shared > 0 && isHighSurrogate(before.charCodeAt(shared - 1)) && shared < before.length) shared--;
  const removed = [...before.slice(shared)].length;
  const added = [...after.slice(shared).normalize('NFC')].filter((char) => char !== '​');
  return { removed, added };
}

const isHighSurrogate = (code: number): boolean => code >= 0xd800 && code <= 0xdbff;

/**
 * Typographic marks a phone keyboard puts in place of the plain ones (smart quotes,
 * smart dashes). Folded back when the layout cannot type the mark itself.
 */
const FOLDS: Record<string, string> = {
  '‘': "'",
  '’': "'",
  '‚': "'",
  '′': "'",
  '“': '"',
  '”': '"',
  '„': '"',
  '″': '"',
  '–': '-',
  '—': '-',
  ' ': ' ',
};

/** The character as the layout knows it: itself when the layout types it, its plain form otherwise. */
export function foldTyped(char: string, canType: (char: string) => boolean): string {
  if (canType(char)) return char;
  const plain = FOLDS[char];
  return plain !== undefined && canType(plain) ? plain : char;
}

export interface SoftHandlers {
  /** One character typed. */
  char(char: string, time: number): void;
  /** One character deleted. */
  erase(time: number): void;
}

/** Reads the hidden field. Returns a function that stops listening. */
export function attachSoft(field: HTMLInputElement, handlers: SoftHandlers): () => void {
  let before = SENTINEL;
  let composing = false;

  const reset = (): void => {
    before = SENTINEL;
    if (field.value !== SENTINEL) field.value = SENTINEL;
    const end = SENTINEL.length;
    // Only a focused field has a caret worth moving: setting it on a blurred one can steal focus on some browsers.
    if (document.activeElement === field) field.setSelectionRange(end, end);
  };

  const onInput = (): void => {
    const time = performance.now();
    const { removed, added } = diffTyped(before, field.value);
    before = field.value;
    for (let i = 0; i < removed; i++) handlers.erase(time);
    for (const char of added) handlers.char(char, time);
    if (!composing) reset();
  };

  const onCompositionStart = (): void => {
    composing = true;
  };
  const onCompositionEnd = (): void => {
    composing = false;
    // Some browsers send the last `input` of a composition after its end, some never send one:
    // once both had their turn, whatever the composition left is read and the field starts over.
    setTimeout(onInput, 0);
  };
  const onFocus = (): void => {
    composing = false;
    reset();
  };

  reset();
  field.addEventListener('input', onInput);
  field.addEventListener('compositionstart', onCompositionStart);
  field.addEventListener('compositionend', onCompositionEnd);
  field.addEventListener('focus', onFocus);
  return () => {
    field.removeEventListener('input', onInput);
    field.removeEventListener('compositionstart', onCompositionStart);
    field.removeEventListener('compositionend', onCompositionEnd);
    field.removeEventListener('focus', onFocus);
  };
}
