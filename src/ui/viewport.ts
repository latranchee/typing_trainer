/**
 * The part of the page a phone actually shows. When the on-screen keyboard opens, iOS
 * and Android shrink the visual viewport and leave the layout viewport (and `100dvh`)
 * as it was, so a screen sized in `dvh` runs on under the keyboard. The shell is sized
 * from `--vv-h` and pinned at `--vv-top` instead, both written here.
 */

export class Viewport {
  /**
   * Runs when the field takes or loses the focus: on a phone, when its keyboard comes up or
   * goes away. The focus is the signal, not the height: some Android browsers shrink the
   * whole page under the keyboard, so the visible height never falls behind the page's.
   */
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
    field.addEventListener('focus', () => this.set(true));
    field.addEventListener('blur', () => {
      this.set(false);
      // iOS leaves the page scrolled where it took the field into view.
      if (window.scrollY !== 0) window.scrollTo(0, 0);
    });
    sync();
  }

  /** True while the field has the focus. */
  get keyboardOpen(): boolean {
    return this.open;
  }

  /**
   * Reads the focus again. Called after the app moves the focus itself: a browser whose
   * window does not have the focus moves it without sending the event.
   */
  refresh(): void {
    this.set(document.activeElement === this.field);
  }

  private set(open: boolean): void {
    this.sync();
    if (open === this.open) return;
    this.open = open;
    this.onKeyboard(open);
  }

  private sync(): void {
    const vv = window.visualViewport;
    const height = vv?.height ?? window.innerHeight;
    const top = vv?.offsetTop ?? 0;
    const style = document.documentElement.style;
    style.setProperty('--vv-h', `${Math.round(height)}px`);
    style.setProperty('--vv-top', `${Math.round(top)}px`);
  }
}
