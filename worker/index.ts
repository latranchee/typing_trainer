import { isLang } from '../src/core/lang';
import type { InputKind, RankedDrill, RoomConfig, RunSubmit } from '../src/core/online';
import { RANKED_DRILLS, ROOM_CODE } from '../src/core/online';
import type { TextKind } from '../src/core/texts';
import { isTrainerText, TEXT_ID, TEXT_KINDS } from '../src/core/texts';
import { accountOf, deleteAccount, readProfile, suggestKeyboards, updateAccount, writeProfile } from './account';
import { clearCookie, finishSignIn, requireUser, session, signOut, startSignIn } from './auth';
import { database } from './db';
import type { Env } from './env';
import { checkOrigin, clientIp, HttpError, json, limit, randomFrom, readJson } from './http';
import { boardQuery, centileCurve, checkSubmit, isKeyboardGroup, keyboardBoard, playerBoard, popularTexts, recordRun, saveText, textInfo } from './runs';

export { RaceRoom } from './room';

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** The answer with the renewed session cookie, when there is one. */
function withCookie(response: Response, setCookie: string | null): Response {
  if (setCookie) response.headers.append('set-cookie', setCookie);
  return response;
}

async function api(request: Request, env: Env, url: URL): Promise<Response> {
  checkOrigin(request);
  const db = await database(env.DB);
  const path = url.pathname.slice('/api'.length);
  const method = request.method;

  // ---------- accounts ----------
  if (path === '/auth/start' && method === 'POST') return json(await startSignIn(request, env, db));
  if (path === '/auth/finish' && method === 'POST') {
    const { user, cookie, created } = await finishSignIn(request, db);
    return withCookie(json({ account: await accountOf(db, user), created }), cookie);
  }
  if (path === '/auth/out' && method === 'POST') {
    await signOut(request, db);
    return withCookie(json({ ok: true }), clearCookie(request));
  }
  if (path === '/me' && method === 'GET') {
    const found = await session(request, db);
    return withCookie(json({ account: found ? await accountOf(db, found.user) : null }), found?.renew ?? null);
  }
  if (path === '/me' && method === 'PATCH') {
    const { user } = await requireUser(request, db);
    return json({ account: await accountOf(db, await updateAccount(request, db, user)) });
  }
  if (path === '/me' && method === 'DELETE') {
    const { user } = await requireUser(request, db);
    await deleteAccount(db, user);
    return withCookie(json({ ok: true }), clearCookie(request));
  }
  if (path === '/me/profile' && method === 'GET') return json(await readProfile(db, (await requireUser(request, db)).user));
  if (path === '/me/profile' && method === 'PUT') return json(await writeProfile(request, db, (await requireUser(request, db)).user));
  if (path === '/keyboards' && method === 'GET') return json({ models: await suggestKeyboards(db, url.searchParams.get('q') ?? '') });

  // ---------- sets and boards ----------
  if (path === '/runs' && method === 'POST') {
    const { user } = await requireUser(request, db);
    await limit(db, `run:${user.id}`, 40, 60_000);
    const submit = checkSubmit(await readJson<Partial<RunSubmit>>(request, 200_000));
    return json(await recordRun(db, user, submit));
  }
  if (path === '/boards' && method === 'GET') {
    const query = boardQuery(url.searchParams);
    const view = url.searchParams.get('view');
    // Boards change by the minute at most: a short shared cache spares the database.
    const cache = { headers: { 'cache-control': 'public, max-age=20' } };
    if (view === 'keyboards') {
      const group = url.searchParams.get('by');
      return json({ rows: await keyboardBoard(db, query, isKeyboardGroup(group) ? group : 'model') }, cache);
    }
    if (view === 'texts') {
      const lang = url.searchParams.get('lang');
      return json({ rows: await popularTexts(db, query.drill === 'highway' ? 'highway' : 'line', query.input, isLang(lang) ? lang : 'all') }, cache);
    }
    return json({ rows: await playerBoard(db, query) }, cache);
  }
  if (path === '/centiles' && method === 'GET') {
    const drill = url.searchParams.get('drill') as RankedDrill;
    const kind = url.searchParams.get('kind') as TextKind;
    if (!RANKED_DRILLS.includes(drill) || !TEXT_KINDS.includes(kind)) throw new HttpError(400, 'bad-centiles');
    const input: InputKind = url.searchParams.get('input') === 'touch' ? 'touch' : 'keys';
    // A curve of hundreds of typists moves slowly: an hour in the browser's cache is fresh enough.
    return json(await centileCurve(db, drill, kind, input), { headers: { 'cache-control': 'public, max-age=3600' } });
  }
  const textMatch = path.match(/^\/texts\/([a-z2-9]{12})$/);
  if (textMatch && method === 'GET') {
    const found = await session(request, db);
    const mode = url.searchParams.get('mode') === 'highway' ? 'highway' : 'line';
    const input: InputKind = url.searchParams.get('input') === 'touch' ? 'touch' : 'keys';
    return json(await textInfo(db, textMatch[1], mode, input, found?.user ?? null));
  }
  if (path === '/texts' && method === 'POST') {
    // Sharing a text needs no account: the link works for whoever gets it.
    await limit(db, `text-ip:${clientIp(request)}`, 60, 60 * 60_000);
    const body = await readJson<{ lang?: unknown; kind?: unknown; text?: unknown }>(request, 8192);
    if (!isLang(body.lang) || !TEXT_KINDS.includes(body.kind as TextKind) || typeof body.text !== 'string') throw new HttpError(400, 'bad-text');
    if (!isTrainerText(body.lang, body.kind as TextKind, body.text)) throw new HttpError(422, 'not-a-trainer-text');
    return json({ id: await saveText(db, body.lang, body.kind as TextKind, body.text) });
  }

  // ---------- races ----------
  if (path === '/rooms' && method === 'POST') {
    await limit(db, `room-ip:${clientIp(request)}`, 30, 60 * 60_000);
    const body = await readJson<Partial<RoomConfig>>(request, 2048);
    const config: RoomConfig = {
      mode: body.mode === 'highway' ? 'highway' : 'line',
      lang: isLang(body.lang) ? body.lang : 'en',
      kind: TEXT_KINDS.includes(body.kind as TextKind) ? (body.kind as TextKind) : 'words',
      words: body.words === 15 || body.words === 60 ? body.words : 30,
      textId: typeof body.textId === 'string' && TEXT_ID.test(body.textId) ? body.textId : null,
    };
    if (config.textId) {
      const text = await db.prepare('SELECT lang, kind FROM texts WHERE id = ?').bind(config.textId).first<{ lang: RoomConfig['lang']; kind: TextKind }>();
      if (!text) throw new HttpError(404, 'no-text');
      config.lang = text.lang;
      config.kind = text.kind;
    }
    // A fresh code: on the rare clash with a live room, draw again.
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = randomFrom(ROOM_ALPHABET, 5);
      if (await env.ROOMS.getByName(code).create(code, config)) return json({ code, config });
    }
    throw new HttpError(503, 'no-code');
  }
  const roomMatch = path.match(/^\/rooms\/([A-Z2-9]{5})(\/ws)?$/);
  if (roomMatch && ROOM_CODE.test(roomMatch[1])) {
    const stub = env.ROOMS.getByName(roomMatch[1]);
    if (!roomMatch[2] && method === 'GET') {
      const info = await stub.info();
      if (!info) throw new HttpError(404, 'no-room');
      return json(info);
    }
    if (roomMatch[2] && request.headers.get('upgrade') === 'websocket') {
      // Same rule as a POST: a socket opened by another site's page carries its Origin.
      const origin = request.headers.get('origin');
      if (!origin || new URL(origin).host !== request.headers.get('host')) throw new HttpError(403, 'origin');
      // The room learns who is signed in from the Worker, never from the page.
      const found = await session(request, db);
      const headers = new Headers(request.headers);
      headers.delete('x-user');
      headers.delete('x-handle');
      if (found) {
        headers.set('x-user', found.user.id);
        if (found.user.handle) headers.set('x-handle', found.user.handle);
      }
      return stub.fetch(new Request(request.url, { headers }));
    }
  }
  throw new HttpError(404, 'not-found');
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      return await api(request, env, url);
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.code, ...error.extra }, { status: error.status });
      console.error('api error', url.pathname, (error as Error).stack ?? error);
      return json({ error: 'server' }, { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;
