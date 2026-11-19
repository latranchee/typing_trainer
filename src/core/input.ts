import { isTypingCode } from './layouts';

/** A typing keypress as the drills see it: a physical key plus the Shift state. */
export interface KeyEvt {
  code: string;
  shift: boolean;
  shiftLeft: boolean;
  shiftRight: boolean;
  time: number;
  /** Every key physically down right now, this one included. */
  held: ReadonlySet<string>;
}

export type Command = 'restart' | 'next' | 'tempo-up' | 'tempo-down';

export interface InputHandlers {
  key(event: KeyEvt): void;
  /** Any key going down or up, modifiers included, for the on-screen keyboard. */
  down(code: string): void;
  up(code: string): void;
  command(command: Command): void;
  /** Backspace: erase one wrong key, or all of them with Ctrl or Alt held. Held down, it repeats. */
  erase(all: boolean, time: number): void;
}

const COMMANDS: Record<string, Command> = {
  Escape: 'restart',
  Enter: 'next',
  ArrowUp: 'tempo-up',
  ArrowDown: 'tempo-down',
};

/** True while focus sits on a control, where keys belong to that control. */
const focusIsOnControl = (): boolean => {
  const active = document.activeElement;
  return active instanceof HTMLElement && active !== document.body && active.matches('button, a, input, select, [role="option"], [role="button"]');
};

/**
 * Listens to physical keys. The trainer applies its own layout to `event.code`,
 * so it behaves the same whatever layout the operating system is set to.
 */
export function attachInput(handlers: InputHandlers): () => void {
  const held = new Set<string>();

  const onDown = (event: KeyboardEvent): void => {
    const { code } = event;
    if (!event.repeat) {
      held.add(code);
      handlers.down(code);
    }
    if (event.metaKey) return;

    if (focusIsOnControl()) {
      if (code === 'Escape') (document.activeElement as HTMLElement).blur();
      return;
    }

    if (code === 'Backspace') {
      event.preventDefault();
      handlers.erase(event.ctrlKey || event.altKey, performance.now());
      return;
    }
    if (event.ctrlKey || event.altKey) return;

    const command = COMMANDS[code];
    if (command) {
      event.preventDefault();
      if (!event.repeat) handlers.command(command);
      return;
    }
    if (!isTypingCode(code)) return;

    // Stops the browser's own use of Space, quote and slash while a drill is running.
    event.preventDefault();
    if (event.repeat) return;
    const shiftLeft = held.has('ShiftLeft');
    const shiftRight = held.has('ShiftRight');
    handlers.key({
      code,
      shift: event.shiftKey || shiftLeft || shiftRight,
      shiftLeft,
      shiftRight,
      time: performance.now(),
      held,
    });
  };

  const onUp = (event: KeyboardEvent): void => {
    held.delete(event.code);
    handlers.up(event.code);
  };

  const releaseAll = (): void => {
    for (const code of held) handlers.up(code);
    held.clear();
  };

  window.addEventListener('keydown', onDown);
  window.addEventListener('keyup', onUp);
  window.addEventListener('blur', releaseAll);
  return () => {
    window.removeEventListener('keydown', onDown);
    window.removeEventListener('keyup', onUp);
    window.removeEventListener('blur', releaseAll);
  };
}
