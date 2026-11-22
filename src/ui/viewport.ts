/**
 * The part of the page a phone actually shows. When the on-screen keyboard opens, iOS
 * and Android shrink the visual viewport and leave the layout viewport (and `100dvh`)
 * as it was, so a screen sized in `dvh` runs on under the keyboard. The shell is sized
 * from `--vv-h` and pinned at `--vv-top` instead, both written here.
 */

/** A keyboard takes more than this off the visible height. A browser's own bars take less. */
const KEYBOARD_MIN_PX = 150;

export class Viewport {
  /** Runs when the on-screen keyboard shows or hides. */
  onKeyboard: (open: boolean) => void = () => {};
  private open = false;
  private field: HTMLElement;

  constructor(field: HTMLElement) {
    this.field = field;
    const vv = window.visualViewport;
    const sync = (): void => this.sync();
    vv?.addEventListener('resize', sync);
    vv?.addEventListener('scroll', sync);
    window.addEventListener('resize', sync);
    field.addEventListener('focus', sync);
    field.addEventListener('blur', () => {
      sync();
      // iOS leaves the page scrolled where it took the field into view.
      if (window.scrollY !== 0) window.scrollTo(0, 0);
    });
    sync();
  }

  /** True while the field has the focus and a keyboard covers part of the screen. */
  get keyboardOpen(): boolean {
    return this.open;
  }

  private sync(): void {
    const vv = window.visualViewport;
    const height = vv?.height ?? window.innerHeight;
    const top = vv?.offsetTop ?? 0;
    const style = document.documentElement.style;
    style.setProperty('--vv-h', `${Math.round(height)}px`);
    style.setProperty('--vv-top', `${Math.round(top)}px`);
    const open = document.activeElement === this.field && window.innerHeight - height > KEYBOARD_MIN_PX;
    if (open !== this.open) {
      this.open = open;
      this.onKeyboard(open);
    }
  }
}
