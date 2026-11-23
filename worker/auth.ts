import type { Lang } from '../src/core/lang';
import { isLang } from '../src/core/lang';
import type { Env } from './env';
import { clientIp, cookie, HttpError, limit, randomFrom, randomToken, readJson, sha256 } from './http';
import { signInMail } from './mail';

/**
 * Sign-in by email, with no password. Asking sends a link that signs this device in and
 * a six-digit code for another device; both work once, for 15 minutes. Signing in opens
 * a session held in an HttpOnly cookie for 30 days, renewed while the account is used.
 * Only hashes of the link, the code and the session are stored.
 */

const LINK_MS = 15 * 60_000;
const SESSION_MS = 30 * 86_400_000;
/** A session with less than this left is renewed on its next use. */
const RENEW_MS = 15 * 86_400_000;
const CODE_TRIES = 5;
export const SESSION_COOKIE = 'pd_session';
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,63}$/;

export interface User {
  id: string;
  email: string;
  handle: string | null;
  kb_model: number | null;
  kb_switch: string | null;
  kb_size: string | null;
  lang: Lang;
  created_at: number;
}

export interface Session {
  user: User;
  /** A Set-Cookie to send back when the session was renewed. */
  renew: string | null;
}

const sessionCookie = (request: Request, token: string, maxAge: number): string => {
  // A page served over plain http (the local dev server) cannot keep a Secure cookie on every browser.
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
};

export const clearCookie = (request: Request): string => sessionCookie(request, '', 0);

/** POST /api/auth/start {email, lang}: sends the link and the code. */
export async function startSignIn(request: Request, env: Env, db: D1Database): Promise<Record<string, unknown>> {
  const body = await readJson<{ email?: unknown; lang?: unknown }>(request, 2048);
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!EMAIL.test(email) || email.length > 254) throw new HttpError(400, 'bad-email');
  const lang: Lang = isLang(body.lang) ? body.lang : 'en';
  // A few links an hour for one address, a few more for one network.
  await limit(db, `mail:${email}`, 4, 15 * 60_000);
  await limit(db, `mail-ip:${clientIp(request)}`, 12, 60 * 60_000);

  const token = randomToken();
  const code = randomFrom('0123456789', 6);
  const now = Date.now();
  await db
    .prepare('INSERT INTO logins (hash, email, code_hash, expires_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256(token), email, await sha256(`${email}:${code}`), now + LINK_MS)
    .run();

  // The token rides in the fragment: a mail scanner that fetches the link never sends it to the server.
  const link = `${env.SITE}/#signin=${token}`;
  const mail = signInMail(lang, link, code);
  if (env.ECHO_LINKS === '1') {
    // Local development: no mail leaves the machine, the page shows what would have been sent.
    return { ok: true, echo: { link: link.replace(env.SITE, new URL(request.url).origin), code } };
  }
  try {
    await env.EMAIL.send({ to: email, from: { email: env.MAIL_FROM, name: 'petitdoigt' }, subject: mail.subject, html: mail.html, text: mail.text });
  } catch (error) {
    console.error('sign-in mail failed', (error as Error).message);
    throw new HttpError(502, 'mail-failed');
  }
  return { ok: true };
}

/** POST /api/auth/finish {token} or {email, code}: opens a session. */
export async function finishSignIn(request: Request, db: D1Database): Promise<{ user: User; cookie: string; created: boolean }> {
  const body = await readJson<{ token?: unknown; email?: unknown; code?: unknown }>(request, 2048);
  const now = Date.now();
  let email: string | null = null;

  if (typeof body.token === 'string' && body.token.length >= 20 && body.token.length <= 100) {
    const hash = await sha256(body.token);
    // Spent in the same statement that reads it: two tabs opening one link cannot both sign in.
    const row = await db
      .prepare('UPDATE logins SET used = 1 WHERE hash = ? AND used = 0 AND expires_at > ? RETURNING email')
      .bind(hash, now)
      .first<{ email: string }>();
    if (!row) throw new HttpError(400, 'link-expired');
    email = row.email;
  } else if (typeof body.email === 'string' && typeof body.code === 'string') {
    const asked = body.email.trim().toLowerCase();
    const code = body.code.replace(/\D/g, '');
    await limit(db, `code-ip:${clientIp(request)}`, 30, 60 * 60_000);
    const row = await db
      .prepare('SELECT hash, code_hash, attempts FROM logins WHERE email = ? AND used = 0 AND expires_at > ? ORDER BY expires_at DESC LIMIT 1')
      .bind(asked, now)
      .first<{ hash: string; code_hash: string; attempts: number }>();
    if (!row || row.attempts >= CODE_TRIES) throw new HttpError(400, 'code-expired');
    if ((await sha256(`${asked}:${code}`)) !== row.code_hash) {
      await db.prepare('UPDATE logins SET attempts = attempts + 1 WHERE hash = ?').bind(row.hash).run();
      throw new HttpError(400, 'bad-code', { left: CODE_TRIES - row.attempts - 1 });
    }
    const spent = await db.prepare('UPDATE logins SET used = 1 WHERE hash = ? AND used = 0 RETURNING hash').bind(row.hash).first();
    if (!spent) throw new HttpError(400, 'code-expired');
    email = asked;
  } else {
    throw new HttpError(400, 'bad-request');
  }

  let user = await db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<User>();
  const created = !user;
  if (!user) {
    const id = randomFrom('abcdefghijkmnpqrstuvwxyz23456789', 16);
    await db.prepare('INSERT INTO users (id, email, created_at) VALUES (?, ?, ?) ON CONFLICT (email) DO NOTHING').bind(id, email, now).run();
    user = await db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<User>();
    if (!user) throw new HttpError(500, 'no-user');
  }
  const token = randomToken();
  await db
    .prepare('INSERT INTO sessions (hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256(token), user.id, now, now + SESSION_MS)
    .run();
  return { user, cookie: sessionCookie(request, token, SESSION_MS / 1000), created };
}

/** The signed-in user, or null. A session close to its end is renewed. */
export async function session(request: Request, db: D1Database): Promise<Session | null> {
  const token = cookie(request, SESSION_COOKIE);
  if (!token) return null;
  const hash = await sha256(token);
  const now = Date.now();
  const row = await db
    .prepare('SELECT u.*, s.expires_at AS s_expires FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.hash = ?')
    .bind(hash)
    .first<User & { s_expires: number }>();
  if (!row || row.s_expires < now) return null;
  let renew: string | null = null;
  if (row.s_expires - now < RENEW_MS) {
    await db.prepare('UPDATE sessions SET expires_at = ? WHERE hash = ?').bind(now + SESSION_MS, hash).run();
    renew = sessionCookie(request, token, SESSION_MS / 1000);
  }
  const { s_expires: _, ...user } = row;
  return { user, renew };
}

export async function requireUser(request: Request, db: D1Database): Promise<Session> {
  const found = await session(request, db);
  if (!found) throw new HttpError(401, 'signed-out');
  return found;
}

/** POST /api/auth/out: this device's session ends. */
export async function signOut(request: Request, db: D1Database): Promise<void> {
  const token = cookie(request, SESSION_COOKIE);
  if (token) await db.prepare('DELETE FROM sessions WHERE hash = ?').bind(await sha256(token)).run();
}
