import { DurableObject } from 'cloudflare:workers';
import type { LayoutId } from '../src/core/layouts';
import { getLayout, LAYOUT_IDS } from '../src/core/layouts';
import type { ClientMsg, GhostRun, InputKind, Phase, RacerView, RankedDrill, RoomConfig, RoomState, ServerMsg } from '../src/core/online';
import { COUNTDOWN_MS, FINISH_GRACE_MS, MAX_RACERS, RACE_GHOSTS, RACE_MAX_MS } from '../src/core/online';
import type { Board } from '../src/core/physical';
import { BOARDS } from '../src/core/physical';
import { replay, verdict } from '../src/core/replay';
import { raceText } from '../src/core/texts';
import type { User } from './auth';
import { database } from './db';
import type { Env } from './env';
import { randomFrom } from './http';
import { recordRun, textInfo } from './runs';

/** A room nobody is in is forgotten after this long. */
const IDLE_MS = 30 * 60_000;
const GUEST_NAME = /[^\p{L}\p{N} _.-]/gu;

/** One racer, kept on their socket so it outlives the object's sleep. */
interface Racer {
  id: string;
  userId: string | null;
  handle: string | null;
  name: string;
  hello: boolean;
  layout: LayoutId;
  board: Board;
  input: InputKind;
  /** The round they race in. Below the room's round: waiting for the next one. */
  round: number;
  done: number;
  wpm: number | null;
  acc: number | null;
  place: number | null;
}

interface Room {
  code: string;
  config: RoomConfig;
  phase: Phase;
  round: number;
  text: string | null;
  textId: string | null;
  startAt: number | null;
  firstFinish: number | null;
  places: number;
  host: string | null;
  ghosts: GhostRun[];
  emptySince: number | null;
}

/**
 * A race room: everyone in it types the same text from the same start signal and sees
 * the others move. The room holds the sockets (hibernated between messages), the text,
 * the countdown and the places; each finished set is played back here before it counts,
 * and a signed-in racer's set is saved like any other.
 */
export class RaceRoom extends DurableObject<Env> {
  private room: Room | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.room = (await ctx.storage.get<Room>('room')) ?? null;
    });
  }

  /** Called once, by the request that made the room. */
  async create(code: string, config: RoomConfig): Promise<boolean> {
    if (this.room) return false;
    this.room = { code, config, phase: 'lobby', round: 0, text: null, textId: config.textId, startAt: null, firstFinish: null, places: 0, host: null, ghosts: [], emptySince: Date.now() };
    await this.save();
    return true;
  }

  async info(): Promise<{ config: RoomConfig; phase: Phase; racers: number } | null> {
    if (!this.room) return null;
    return { config: this.room.config, phase: this.room.phase, racers: this.racers().length };
  }

  async fetch(request: Request): Promise<Response> {
    if (!this.room) return new Response('no room', { status: 404 });
    if (request.headers.get('upgrade') !== 'websocket') return new Response('websocket only', { status: 426 });
    if (this.ctx.getWebSockets().length >= MAX_RACERS) return new Response('full', { status: 409 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    const handle = request.headers.get('x-handle');
    const racer: Racer = {
      id: randomFrom('abcdefghijkmnpqrstuvwxyz23456789', 8),
      userId: request.headers.get('x-user') || null,
      handle: handle || null,
      name: handle || 'guest',
      hello: false,
      layout: 'us',
      board: 'ansi',
      input: 'keys',
      round: -1,
      done: 0,
      wpm: null,
      acc: null,
      place: null,
    };
    server.serializeAttachment(racer);
    this.room.emptySince = null;
    await this.save();
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const room = this.room;
    if (!room || typeof raw !== 'string' || raw.length > 200_000) return;
    let msg: ClientMsg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    const racer = ws.deserializeAttachment() as Racer;
    switch (msg.t) {
      case 'ping':
        this.send(ws, { t: 'pong', at: msg.at, now: Date.now() });
        return;
      case 'hello': {
        racer.hello = true;
        if (!racer.handle) racer.name = cleanGuest(msg.name);
        racer.layout = LAYOUT_IDS.includes(msg.layout) ? msg.layout : 'us';
        racer.board = BOARDS.includes(msg.board) ? msg.board : 'ansi';
        racer.input = msg.input === 'touch' ? 'touch' : 'keys';
        // In the lobby a newcomer is in the next round; mid-race they wait for it.
        racer.round = room.phase === 'lobby' || room.phase === 'done' ? room.round + 1 : -1;
        ws.serializeAttachment(racer);
        room.host ??= racer.id;
        await this.save();
        this.broadcast();
        return;
      }
      case 'start':
        if (racer.id !== room.host || (room.phase !== 'lobby' && room.phase !== 'done')) return;
        await this.start();
        return;
      case 'progress': {
        if (room.phase !== 'race' || racer.round !== room.round || racer.place !== null || !room.text) return;
        const done = Math.max(0, Math.min([...room.text].length, Math.floor(Number(msg.done) || 0)));
        if (done === racer.done) return;
        racer.done = done;
        ws.serializeAttachment(racer);
        for (const other of this.ctx.getWebSockets()) if (other !== ws) this.send(other, { t: 'p', id: racer.id, done });
        return;
      }
      case 'finish':
        await this.finish(ws, racer, msg);
        return;
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.leave(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.leave(ws);
  }

  async alarm(): Promise<void> {
    const room = this.room;
    if (!room) return;
    const now = Date.now();
    if (room.phase === 'countdown' && room.startAt !== null && now >= room.startAt - 50) {
      room.phase = 'race';
    } else if (room.phase === 'race' && this.raceOver(now)) {
      room.phase = 'done';
    } else if (room.emptySince !== null && now - room.emptySince >= IDLE_MS && this.ctx.getWebSockets().length === 0) {
      await this.ctx.storage.deleteAll();
      this.room = null;
      return;
    }
    await this.save();
    this.broadcast();
  }

  // ---------- the race ----------

  private async start(): Promise<void> {
    const room = this.room!;
    const sockets = this.ctx.getWebSockets();
    const racers = sockets.map((ws) => ws.deserializeAttachment() as Racer).filter((racer) => racer.hello);
    if (racers.length === 0) return;
    room.round++;
    if (room.config.textId) {
      // A known text: the same each round, raced against its best runs.
      const info = await textInfo(await database(this.env.DB), room.config.textId, room.config.mode, 'keys', null).catch(() => null);
      if (!info) return;
      room.text = info.text;
      room.textId = info.id;
      room.ghosts = info.runs.slice(0, RACE_GHOSTS);
    } else {
      const layouts = racers.map((racer) => getLayout(racer.layout, racer.board));
      room.text = raceText(layouts, room.config.lang, room.config.kind, room.config.words, crypto.getRandomValues(new Uint32Array(1))[0]);
      room.textId = null;
      room.ghosts = [];
    }
    for (const ws of sockets) {
      const racer = ws.deserializeAttachment() as Racer;
      if (!racer.hello) continue;
      Object.assign(racer, { round: room.round, done: 0, wpm: null, acc: null, place: null });
      ws.serializeAttachment(racer);
    }
    room.phase = 'countdown';
    room.startAt = Date.now() + COUNTDOWN_MS;
    room.firstFinish = null;
    room.places = 0;
    await this.save();
    this.broadcast();
  }

  private async finish(ws: WebSocket, racer: Racer, msg: Extract<ClientMsg, { t: 'finish' }>): Promise<void> {
    const room = this.room!;
    if (room.phase !== 'race' || racer.round !== room.round || racer.place !== null || !room.text || !Array.isArray(msg.log)) return;
    const layout = getLayout(racer.layout, racer.board);
    const run = replay(layout, room.text, msg.log, msg.hardcore === true);
    const judged = verdict(run);
    if (judged !== 'ok') {
      this.send(ws, { t: 'error', code: judged });
      return;
    }
    const now = Date.now();
    racer.wpm = Math.round(run.wpm * 100) / 100;
    racer.acc = Math.round(run.acc * 10000) / 10000;
    racer.done = [...room.text].length;
    racer.place = ++room.places;
    ws.serializeAttachment(racer);
    room.firstFinish ??= now;
    if (this.raceOver(now)) room.phase = 'done';
    await this.save();
    this.broadcast();

    // A signed-in racer's set joins their numbers and the text's board.
    if (racer.userId) {
      const db = await database(this.env.DB);
      const user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(racer.userId).first<User>();
      const drill: RankedDrill = room.config.mode === 'highway' ? 'highway' : room.config.kind === 'pairs' ? 'pairs' : 'words';
      if (user) {
        await recordRun(
          db,
          user,
          { text: room.text, kind: room.config.kind, lang: room.config.lang, drill, layout: racer.layout, board: racer.board, input: racer.input, hardcore: msg.hardcore === true, log: msg.log },
          true,
        ).catch((error) => console.error('race run not saved', (error as Error).message));
      }
    }
  }

  /** Everyone racing has finished, the grace after the first finish ran out, or the race ran too long. `leaving` is a socket on its way out. */
  private raceOver(now: number, leaving?: WebSocket): boolean {
    const room = this.room!;
    const racing = this.racers(leaving).filter((racer) => racer.round === room.round);
    if (racing.length > 0 && racing.every((racer) => racer.place !== null)) return true;
    if (racing.length === 0) return true;
    if (room.firstFinish !== null && now >= room.firstFinish + FINISH_GRACE_MS) return true;
    return room.startAt !== null && now >= room.startAt + RACE_MAX_MS;
  }

  private async leave(ws: WebSocket): Promise<void> {
    const room = this.room;
    if (!room) return;
    const gone = ws.deserializeAttachment() as Racer | null;
    try {
      ws.close(1000, 'bye');
    } catch {
      // Already closed.
    }
    const left = this.racers(ws);
    if (gone && room.host === gone.id) room.host = left.find((racer) => racer.hello)?.id ?? null;
    // The last racer of the round gone, the round is over: a newcomer can start the next one.
    if ((room.phase === 'race' || room.phase === 'countdown') && this.raceOver(Date.now(), ws)) room.phase = 'done';
    if (this.ctx.getWebSockets().filter((other) => other !== ws).length === 0) room.emptySince = Date.now();
    await this.save();
    this.broadcast(ws);
  }

  // ---------- state ----------

  /** The racers on open sockets, leaving out `except`. */
  private racers(except?: WebSocket): Racer[] {
    return this.ctx
      .getWebSockets()
      .filter((ws) => ws !== except)
      .map((ws) => ws.deserializeAttachment() as Racer);
  }

  private async save(): Promise<void> {
    const room = this.room;
    if (!room) return;
    await this.ctx.storage.put('room', room);
    // One alarm at a time: the next thing the room has to do on its own.
    const next =
      room.phase === 'countdown' && room.startAt !== null
        ? room.startAt
        : room.phase === 'race' && room.startAt !== null
          ? Math.min(room.startAt + RACE_MAX_MS, room.firstFinish === null ? Infinity : room.firstFinish + FINISH_GRACE_MS)
          : room.emptySince !== null
            ? room.emptySince + IDLE_MS
            : null;
    if (next === null) await this.ctx.storage.deleteAlarm();
    else await this.ctx.storage.setAlarm(next);
  }

  private view(racer: Racer): RacerView {
    const room = this.room!;
    return {
      id: racer.id,
      name: racer.name,
      signed: racer.handle !== null,
      host: racer.id === room.host,
      done: racer.round === room.round ? racer.done : 0,
      wpm: racer.round === room.round ? racer.wpm : null,
      acc: racer.round === room.round ? racer.acc : null,
      place: racer.round === room.round ? racer.place : null,
      waiting: racer.round < room.round || (racer.round > room.round && room.phase !== 'lobby' && room.phase !== 'done'),
    };
  }

  private broadcast(except?: WebSocket): void {
    const room = this.room;
    if (!room) return;
    const racers = this.racers(except).filter((racer) => racer.hello);
    const views = racers.map((racer) => this.view(racer));
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      const racer = ws.deserializeAttachment() as Racer;
      const state: RoomState = {
        t: 'room',
        you: racer.id,
        code: room.code,
        config: room.config,
        phase: room.phase,
        round: room.round,
        text: room.text,
        textId: room.textId,
        startAt: room.startAt,
        now: Date.now(),
        racers: views,
        ghosts: room.ghosts,
      };
      this.send(ws, state);
    }
  }

  private send(ws: WebSocket, msg: ServerMsg): void {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      // A socket closing under the send: its close handler tidies up.
    }
  }
}

function cleanGuest(name: unknown): string {
  const clean = typeof name === 'string' ? name.replace(GUEST_NAME, '').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 20) : '';
  return clean || `guest-${randomFrom('23456789', 3)}`;
}
