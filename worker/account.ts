import { cleanModel, isSizeKind, isSwitchKind, modelKey } from '../src/core/keyboards';
import type { Account, KeyboardInfo } from '../src/core/online';
import { HANDLE, RESERVED_HANDLES } from '../src/core/online';
import type { User } from './auth';
import { HttpError, readJson } from './http';

/** Largest synced profile: a few years of history fits well under it. */
const PROFILE_MAX = 900_000;

/** The account as the page sees it: the email is shown to its owner only, here. */
export async function accountOf(db: D1Database, user: User): Promise<Account> {
  const model = user.kb_model ? await db.prepare('SELECT name FROM keyboards WHERE id = ?').bind(user.kb_model).first<{ name: string }>() : null;
  const keyboard: KeyboardInfo = { model: model?.name ?? null, switch: (user.kb_switch as KeyboardInfo['switch']) ?? null, size: (user.kb_size as KeyboardInfo['size']) ?? null };
  return { handle: user.handle, email: user.email, keyboard, since: user.created_at };
}

/** The keyboard model's row, made on first use: two spellings of one model share it. */
async function modelId(db: D1Database, name: string): Promise<number | null> {
  const clean = cleanModel(name);
  const key = modelKey(clean);
  if (!key) return null;
  await db.prepare('INSERT INTO keyboards (name, key, created_at) VALUES (?, ?, ?) ON CONFLICT (key) DO NOTHING').bind(clean, key, Date.now()).run();
  const row = await db.prepare('SELECT id FROM keyboards WHERE key = ?').bind(key).first<{ id: number }>();
  return row?.id ?? null;
}

/** PATCH /api/me {handle?, keyboard?, lang?} */
export async function updateAccount(request: Request, db: D1Database, user: User): Promise<User> {
  const body = await readJson<{ handle?: unknown; keyboard?: Partial<Record<keyof KeyboardInfo, unknown>>; lang?: unknown }>(request, 4096);
  const sets: string[] = [];
  const values: unknown[] = [];

  if (body.handle !== undefined) {
    const handle = typeof body.handle === 'string' ? body.handle.trim().toLowerCase() : '';
    if (!HANDLE.test(handle)) throw new HttpError(400, 'bad-handle');
    if (RESERVED_HANDLES.has(handle)) throw new HttpError(409, 'handle-taken');
    const taken = await db.prepare('SELECT id FROM users WHERE handle = ? AND id != ?').bind(handle, user.id).first();
    if (taken) throw new HttpError(409, 'handle-taken');
    sets.push('handle = ?');
    values.push(handle);
  }
  if (body.keyboard) {
    const { model, switch: kind, size } = body.keyboard;
    if (model !== undefined) {
      sets.push('kb_model = ?');
      values.push(typeof model === 'string' && model.trim() ? await modelId(db, model) : null);
    }
    if (kind !== undefined) {
      if (kind !== null && !isSwitchKind(kind)) throw new HttpError(400, 'bad-switch');
      sets.push('kb_switch = ?');
      values.push(kind);
    }
    if (size !== undefined) {
      if (size !== null && !isSizeKind(size)) throw new HttpError(400, 'bad-size');
      sets.push('kb_size = ?');
      values.push(size);
    }
  }
  if (typeof body.lang === 'string' && ['en', 'fr', 'de', 'es'].includes(body.lang)) {
    sets.push('lang = ?');
    values.push(body.lang);
  }
  if (sets.length > 0) {
    try {
      await db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).bind(...values, user.id).run();
    } catch (error) {
      // Two people taking one name at the same moment: the unique index decides.
      if (String((error as Error).message).includes('UNIQUE')) throw new HttpError(409, 'handle-taken');
      throw error;
    }
  }
  const fresh = await db.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first<User>();
  return fresh ?? user;
}

/** GET /api/keyboards?q=: models others typed, most used first, for the field's suggestions. */
export async function suggestKeyboards(db: D1Database, query: string): Promise<{ name: string; n: number }[]> {
  const key = modelKey(query);
  const { results } = await db
    .prepare(
      `SELECT k.name AS name, COUNT(u.id) AS n FROM keyboards k LEFT JOIN users u ON u.kb_model = k.id
       WHERE k.key LIKE ? GROUP BY k.id HAVING n > 0 OR k.key = ? ORDER BY n DESC, k.name LIMIT 8`,
    )
    .bind(`%${key}%`, key)
    .all<{ name: string; n: number }>();
  return results;
}

/** GET /api/me/profile: the profile last saved from any device. */
export async function readProfile(db: D1Database, user: User): Promise<{ data: unknown; at: number | null }> {
  const row = await db.prepare('SELECT profile, profile_at FROM users WHERE id = ?').bind(user.id).first<{ profile: string | null; profile_at: number | null }>();
  return { data: row?.profile ? JSON.parse(row.profile) : null, at: row?.profile_at ?? null };
}

/** PUT /api/me/profile {data, base}: saved unless another device saved since `base`; the page then merges and tries again. */
export async function writeProfile(request: Request, db: D1Database, user: User): Promise<{ at: number }> {
  const text = await request.text();
  if (text.length > PROFILE_MAX) throw new HttpError(413, 'too-large');
  let body: { data?: unknown; base?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    throw new HttpError(400, 'bad-json');
  }
  if (!body.data || typeof body.data !== 'object') throw new HttpError(400, 'bad-profile');
  const base = typeof body.base === 'number' ? body.base : null;
  const at = Date.now();
  const result = await db
    .prepare('UPDATE users SET profile = ?, profile_at = ? WHERE id = ? AND (profile_at IS NULL OR profile_at = ?)')
    .bind(JSON.stringify(body.data), at, user.id, base)
    .run();
  if (result.meta.changes === 0) throw new HttpError(409, 'profile-moved');
  return { at };
}

/** DELETE /api/me: the account and everything typed under it. Texts stay: they hold no one's data. */
export async function deleteAccount(db: D1Database, user: User): Promise<void> {
  await db.batch([
    db.prepare('DELETE FROM runs WHERE user_id = ?').bind(user.id),
    db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id),
    db.prepare('DELETE FROM logins WHERE email = ?').bind(user.email),
    db.prepare('DELETE FROM users WHERE id = ?').bind(user.id),
  ]);
}
