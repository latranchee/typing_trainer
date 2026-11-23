import { describe, expect, it } from 'vitest';
import { makeWords } from '../src/core/generator';
import { getLayout } from '../src/core/layouts';
import type { RoomState, RunAnswer, ServerMsg, TextInfo } from '../src/core/online';
import type { LogEvent } from '../src/core/replay';
import { KeyLog } from '../src/core/replay';
import { NEUTRAL, seeded } from '../src/core/texts';

/**
 * The Worker end to end, against a running `wrangler dev` with ECHO_LINKS=1:
 *   API_URL=http://127.0.0.1:8787 npx vitest run tests/api.test.ts
 * Skipped without API_URL, so `npm test` never needs a server.
 */
const API = process.env.API_URL ?? '';
const us = getLayout('us');

class Client {
  cookie = '';
  async call<T>(method: string, path: string, body?: unknown): Promise<{ status: number; data: T }> {
    const response = await fetch(`${API}/api${path}`, {
      method,
      headers: { origin: API, 'content-type': 'application/json', ...(this.cookie ? { cookie: this.cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = response.headers.get('set-cookie');
    if (set) this.cookie = set.split(';')[0];
    return { status: response.status, data: (await response.json()) as T };
  }
}

function typed(text: string, gap = 140, seed = 3): LogEvent[] {
  const log = new KeyLog();
  const random = seeded(seed);
  let time = 0;
  for (const target of us.targets(text)) {
    for (const stroke of target.strokes) {
      log.stroke(stroke.code, stroke.shift, time);
      time += gap * (0.5 + random());
    }
  }
  return log.take();
}

async function signIn(client: Client, email: string, handle: string, byCode = false): Promise<void> {
  const start = await client.call<{ echo: { link: string; code: string } }>('POST', '/auth/start', { email, lang: 'fr' });
  expect(start.status).toBe(200);
  const token = start.data.echo.link.split('#signin=')[1];
  const finish = byCode ? await client.call('POST', '/auth/finish', { email, code: start.data.echo.code }) : await client.call('POST', '/auth/finish', { token });
  expect(finish.status).toBe(200);
  const named = await client.call<{ account: { handle: string } }>('PATCH', '/me', { handle, keyboard: { model: 'Keychron  K2', switch: 'mx-brown', size: '75' } });
  expect(named.status).toBe(200);
  expect(named.data.account.handle).toBe(handle);
}

describe.skipIf(!API)('api', () => {
  const stamp = Date.now().toString(36);
  const text = makeWords(us, 'en', 20, { caps: false }, NEUTRAL, seeded(Number.parseInt(stamp.slice(-4), 36)));

  it('signs in by link and by code, once each', async () => {
    const client = new Client();
    const start = await client.call<{ echo: { link: string; code: string } }>('POST', '/auth/start', { email: `link-${stamp}@example.com`, lang: 'en' });
    const token = start.data.echo.link.split('#signin=')[1];
    expect((await client.call('POST', '/auth/finish', { token })).status).toBe(200);
    // The same link a second time is spent.
    expect((await new Client().call('POST', '/auth/finish', { token })).status).toBe(400);
    const me = await client.call<{ account: { email: string } | null }>('GET', '/me');
    expect(me.data.account?.email).toBe(`link-${stamp}@example.com`);

    const other = new Client();
    const again = await other.call<{ echo: { code: string } }>('POST', '/auth/start', { email: `link-${stamp}@example.com`, lang: 'en' });
    expect((await other.call('POST', '/auth/finish', { email: `link-${stamp}@example.com`, code: '000000' === again.data.echo.code ? '111111' : '000000' })).status).toBe(400);
    expect((await other.call('POST', '/auth/finish', { email: `link-${stamp}@example.com`, code: again.data.echo.code })).status).toBe(200);
    expect((await other.call('POST', '/auth/out', {})).status).toBe(200);
    expect((await other.call<{ account: null }>('GET', '/me')).data.account).toBeNull();
  });

  it('refuses a request from another site', async () => {
    const response = await fetch(`${API}/api/auth/start`, {
      method: 'POST',
      headers: { origin: 'https://evil.example', 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'x@example.com' }),
    });
    expect(response.status).toBe(403);
  });

  it('replays a set, ranks it, and keeps the text with its ghosts', async () => {
    const a = new Client();
    const b = new Client();
    await signIn(a, `a-${stamp}@example.com`, `a${stamp}`);
    await signIn(b, `b-${stamp}@example.com`, `b${stamp}`, true);
    const submit = { text, kind: 'words', lang: 'en', drill: 'words', layout: 'us', board: 'ansi', input: 'keys', hardcore: false };
    const first = await a.call<RunAnswer>('POST', '/runs', { ...submit, log: typed(text, 160) });
    expect(first.status).toBe(200);
    expect(first.data.ranked).toBe(true);
    expect(first.data.text).toEqual({ rank: 1, of: 1, best: true });
    const second = await b.call<RunAnswer>('POST', '/runs', { ...submit, log: typed(text, 110) });
    expect(second.data.wpm).toBeGreaterThan(first.data.wpm);
    expect(second.data.text).toEqual({ rank: 1, of: 2, best: true });

    const info = await a.call<TextInfo>('GET', `/texts/${first.data.textId}?mode=line`);
    expect(info.data.text).toBe(text);
    expect(info.data.players).toBe(2);
    expect(info.data.runs[0].handle).toBe(`b${stamp}`);
    expect(info.data.mine?.wpm).toBe(first.data.wpm);
    expect(info.data.runs[0].ghost.length).toBe(text.length * 2);

    const board = await a.call<{ rows: { handle: string }[] }>('GET', '/boards?drill=words&input=keys&period=day');
    expect(board.data.rows.map((row) => row.handle)).toContain(`b${stamp}`);
    const kb = await a.call<{ rows: { name: string; players: number }[] }>('GET', '/boards?view=keyboards&by=model&drill=words');
    expect(kb.data.rows.find((row) => row.name === 'Keychron K2')?.players).toBeGreaterThanOrEqual(2);
  });

  it('turns away a forged set', async () => {
    const a = new Client();
    await signIn(a, `c-${stamp}@example.com`, `c${stamp}`);
    const base = { text, kind: 'words', lang: 'en', drill: 'words', layout: 'us', board: 'ansi', input: 'keys', hardcore: false };
    const robot = typed(text).map(([, code, flag], i): LogEvent => [i === 0 ? 0 : 3, code, flag]);
    expect((await a.call<{ error: string }>('POST', '/runs', { ...base, log: robot })).status).toBe(422);
    expect((await a.call('POST', '/runs', { ...base, text: 'aaa aaa aaa aaa', log: typed('aaa aaa aaa aaa') })).status).toBe(422);
    expect((await a.call('POST', '/runs', { ...base, log: typed(text).slice(0, 10) })).status).toBe(422);
  });

  it('races two typists in a room', async () => {
    const a = new Client();
    await signIn(a, `d-${stamp}@example.com`, `d${stamp}`);
    const room = await a.call<{ code: string }>('POST', '/rooms', { mode: 'line', lang: 'en', kind: 'words', words: 15 });
    expect(room.status).toBe(200);
    const url = `${API.replace('http', 'ws')}/api/rooms/${room.data.code}/ws`;
    const open = (cookie: string) =>
      new Promise<{ ws: WebSocket; next: (pred: (msg: ServerMsg) => boolean) => Promise<ServerMsg> }>((resolve) => {
        // Node's WebSocket takes headers through the second argument's options.
        const ws = new WebSocket(url, { headers: { origin: API, ...(cookie ? { cookie } : {}) } } as unknown as string[]);
        const queue: ServerMsg[] = [];
        const waiting: { pred: (msg: ServerMsg) => boolean; done: (msg: ServerMsg) => void }[] = [];
        ws.addEventListener('message', (event) => {
          const msg = JSON.parse(String(event.data)) as ServerMsg;
          const hit = waiting.findIndex((w) => w.pred(msg));
          if (hit >= 0) waiting.splice(hit, 1)[0].done(msg);
          else queue.push(msg);
        });
        const next = (pred: (msg: ServerMsg) => boolean) =>
          new Promise<ServerMsg>((done) => {
            const found = queue.findIndex(pred);
            if (found >= 0) done(queue.splice(found, 1)[0]);
            else waiting.push({ pred, done });
          });
        ws.addEventListener('open', () => resolve({ ws, next }));
      });
    const host = await open(a.cookie);
    const guest = await open('');
    host.ws.send(JSON.stringify({ t: 'hello', name: 'ignored', layout: 'us', board: 'ansi', input: 'keys' }));
    guest.ws.send(JSON.stringify({ t: 'hello', name: 'Zoé!!', layout: 'colemak-dh', board: 'ansi', input: 'keys' }));
    const lobby = (await guest.next((msg) => msg.t === 'room' && msg.racers.length === 2)) as RoomState;
    expect(lobby.racers.map((r) => r.name).sort()).toEqual([`d${stamp}`, 'zoé'].sort());
    host.ws.send(JSON.stringify({ t: 'start' }));
    const countdown = (await host.next((msg) => msg.t === 'room' && msg.phase === 'countdown')) as RoomState;
    expect(countdown.text).toBeTruthy();
    const race = (await host.next((msg) => msg.t === 'room' && msg.phase === 'race')) as RoomState;
    host.ws.send(JSON.stringify({ t: 'progress', done: 3 }));
    const seen = await guest.next((msg) => msg.t === 'p');
    expect(seen).toMatchObject({ t: 'p', done: 3 });
    host.ws.send(JSON.stringify({ t: 'finish', log: typed(race.text!), hardcore: false }));
    const placed = (await guest.next((msg) => msg.t === 'room' && msg.racers.some((r) => r.place === 1))) as RoomState;
    expect(placed.racers.find((r) => r.signed)?.place).toBe(1);
    host.ws.close();
    guest.ws.close();
  }, 20_000);
});
