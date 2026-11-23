/** Small pieces every route shares: JSON in and out, errors, the caller's address, rate limits. */

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly extra: Record<string, unknown>;
  constructor(status: number, code: string, extra: Record<string, unknown> = {}) {
    super(code);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  // Answers carry accounts and ranks: never cached by a browser or a proxy.
  if (!headers.has('cache-control')) headers.set('cache-control', 'no-store');
  return new Response(JSON.stringify(data), { ...init, headers });
}

/** Reads a JSON body no longer than `max` bytes. */
export async function readJson<T>(request: Request, max = 65536): Promise<T> {
  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > max) throw new HttpError(413, 'too-large');
  const text = await request.text();
  if (text.length > max) throw new HttpError(413, 'too-large');
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(400, 'bad-json');
  }
}

/**
 * A request that changes something must come from the page itself. A form on another
 * site cannot send JSON without asking first, and its Origin would not match.
 */
export function checkOrigin(request: Request): void {
  if (request.method === 'GET' || request.method === 'HEAD') return;
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (!origin || !host) throw new HttpError(403, 'origin');
  try {
    if (new URL(origin).host !== host) throw new HttpError(403, 'origin');
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(403, 'origin');
  }
  if (!(request.headers.get('content-type') ?? '').startsWith('application/json')) throw new HttpError(415, 'json-only');
}

export const clientIp = (request: Request): string => request.headers.get('cf-connecting-ip') ?? 'local';

/**
 * At most `max` hits per `windowMs` for one key, counted in the database so every
 * Worker instance shares the count. The key is stored hashed: no address, mail or IP, sits in the table.
 * Now and then the sweep drops hits older than a day, sign-ins never finished and sessions run out.
 */
export async function limit(db: D1Database, name: string, max: number, windowMs: number): Promise<void> {
  const now = Date.now();
  const key = await sha256(name);
  const row = await db.prepare('SELECT COUNT(*) AS n FROM hits WHERE key = ? AND at > ?').bind(key, now - windowMs).first<{ n: number }>();
  if ((row?.n ?? 0) >= max) throw new HttpError(429, 'slow-down');
  const writes = [db.prepare('INSERT INTO hits (key, at) VALUES (?, ?)').bind(key, now)];
  if (Math.random() < 0.02) {
    const day = now - 86_400_000;
    writes.push(
      db.prepare('DELETE FROM hits WHERE at < ?').bind(day),
      db.prepare('DELETE FROM logins WHERE expires_at < ?').bind(day),
      db.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now),
    );
  }
  await db.batch(writes);
}

/** `bytes` random bytes as base64url: tokens for sign-in links and sessions. */
export function randomToken(bytes = 32): string {
  const raw = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...raw))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Random characters from an alphabet, without bias. */
export function randomFrom(alphabet: string, length: number): string {
  let out = '';
  while (out.length < length) {
    for (const byte of crypto.getRandomValues(new Uint8Array(length * 2))) {
      // Bytes past the largest multiple of the alphabet's size would favor its first letters.
      if (byte >= 256 - (256 % alphabet.length)) continue;
      out += alphabet[byte % alphabet.length];
      if (out.length === length) break;
    }
  }
  return out;
}

export async function sha256(text: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** A cookie's value from the request, or null. */
export function cookie(request: Request, name: string): string | null {
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}
