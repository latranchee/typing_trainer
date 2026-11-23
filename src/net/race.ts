import type { InputKind, RoomState, ServerMsg } from '../core/online';
import type { LayoutId } from '../core/layouts';
import type { Board } from '../core/physical';
import type { LogEvent } from '../core/replay';
import { api } from './api';

/** Progress goes out at most this often: a fast typist finishes ten characters a second. */
const PROGRESS_MS = 120;
const RETRY_MS = [800, 2000, 5000];

export interface Hello {
  name: string;
  layout: LayoutId;
  board: Board;
  input: InputKind;
}

export interface RaceEvents {
  state(state: RoomState): void;
  progress(id: string, done: number): void;
  /** A finish the room turned down (`machine`, `too-fast`, `incomplete`), or a room gone or full. */
  error(code: string): void;
  /** The socket dropped and is coming back (true), or came back (false). */
  lost(lost: boolean): void;
}

/**
 * One room, from the page: the socket, the server's clock and the latest state. A dropped
 * socket reconnects a few times; the room sees a new racer, who waits for the next round.
 */
export class RaceClient {
  readonly code: string;
  state: RoomState | null = null;
  /** Server time minus page time, from the last pong: the countdown runs on the server's clock. */
  private offset = 0;
  private ws: WebSocket | null = null;
  private hello: Hello;
  private events: RaceEvents;
  private closed = false;
  private tries = 0;
  private sentDone = -1;
  private pendingDone: number | null = null;
  private progressTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  constructor(code: string, hello: Hello, events: RaceEvents) {
    this.code = code;
    this.hello = hello;
    this.events = events;
    this.connect();
  }

  /** The room's clock, in ms. */
  now(): number {
    return Date.now() + this.offset;
  }

  get you(): string | null {
    return this.state?.you ?? null;
  }

  get isHost(): boolean {
    return this.state?.racers.some((racer) => racer.id === this.state!.you && racer.host) ?? false;
  }

  /** True while this racer may type: the race is on, they are in it and have not finished. */
  get open(): boolean {
    const state = this.state;
    if (!state || state.phase !== 'race' || state.startAt === null || this.now() < state.startAt) return false;
    const me = state.racers.find((racer) => racer.id === state.you);
    return me !== undefined && !me.waiting && me.place === null;
  }

  rename(name: string): void {
    this.hello = { ...this.hello, name };
    this.send({ t: 'hello', ...this.hello });
  }

  start(): void {
    this.send({ t: 'start' });
  }

  progress(done: number): void {
    this.pendingDone = done;
    if (this.progressTimer) return;
    const flush = (): void => {
      this.progressTimer = null;
      if (this.pendingDone === null || this.pendingDone === this.sentDone) return;
      this.sentDone = this.pendingDone;
      this.send({ t: 'progress', done: this.pendingDone });
      this.progressTimer = setTimeout(flush, PROGRESS_MS);
    };
    flush();
  }

  finish(log: LogEvent[], hardcore: boolean): void {
    if (this.progressTimer) clearTimeout(this.progressTimer);
    this.progressTimer = null;
    this.send({ t: 'finish', log, hardcore });
  }

  close(): void {
    this.closed = true;
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.progressTimer) clearTimeout(this.progressTimer);
    this.ws?.close();
    this.ws = null;
  }

  private send(msg: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  private connect(): void {
    const ws = api.roomSocket(this.code);
    this.ws = ws;
    let opened = false;
    ws.addEventListener('open', () => {
      opened = true;
      if (this.tries > 0) this.events.lost(false);
      this.tries = 0;
      this.sentDone = -1;
      this.send({ t: 'hello', ...this.hello });
      this.ping();
      this.pingTimer ??= setInterval(() => this.ping(), 10_000);
    });
    ws.addEventListener('message', (event) => {
      let msg: ServerMsg;
      try {
        msg = JSON.parse(String(event.data)) as ServerMsg;
      } catch {
        return;
      }
      if (msg.t === 'room') {
        // Until a pong says better, the state's own stamp sets the clock.
        if (this.state === null) this.offset = msg.now - Date.now();
        this.state = msg;
        this.events.state(msg);
      } else if (msg.t === 'p') {
        const racer = this.state?.racers.find((item) => item.id === msg.id);
        if (racer) racer.done = msg.done;
        this.events.progress(msg.id, msg.done);
      } else if (msg.t === 'pong') {
        const back = Date.now();
        this.offset = msg.now - (msg.at + back) / 2;
      } else if (msg.t === 'error') {
        this.events.error(msg.code);
      }
    });
    ws.addEventListener('close', (event) => {
      if (this.ws !== ws || this.closed) return;
      this.ws = null;
      // Turned away before it opened: the room is full or gone. No point knocking again.
      if (!opened && this.tries === 0) {
        void api
          .room(this.code)
          .then((info) => this.events.error(info.racers >= 8 ? 'full' : 'no-room'))
          .catch(() => this.events.error('no-room'));
        return;
      }
      if (this.tries >= RETRY_MS.length || event.code === 1008) {
        this.events.error('no-room');
        return;
      }
      this.events.lost(true);
      setTimeout(() => {
        if (!this.closed) this.connect();
      }, RETRY_MS[this.tries++]);
    });
  }

  private ping(): void {
    this.send({ t: 'ping', at: Date.now() });
  }
}
