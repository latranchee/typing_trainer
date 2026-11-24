/**
 * The tables, written by the Worker itself the first time an instance touches the
 * database: a deploy needs no separate migration step. Each entry of MIGRATIONS runs
 * once, in order; the version reached is kept in `meta`. Statements must stay safe to
 * run twice, since two instances can start at the same moment.
 */
const MIGRATIONS: string[][] = [
  [
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      handle TEXT UNIQUE,
      kb_model INTEGER,
      kb_switch TEXT,
      kb_size TEXT,
      lang TEXT NOT NULL DEFAULT 'en',
      created_at INTEGER NOT NULL,
      profile TEXT,
      profile_at INTEGER
    )`,
    `CREATE TABLE IF NOT EXISTS sessions (
      hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    )`,
    'CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id)',
    `CREATE TABLE IF NOT EXISTS logins (
      hash TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      used INTEGER NOT NULL DEFAULT 0,
      expires_at INTEGER NOT NULL
    )`,
    'CREATE INDEX IF NOT EXISTS logins_email ON logins (email, expires_at)',
    'CREATE TABLE IF NOT EXISTS hits (key TEXT NOT NULL, at INTEGER NOT NULL)',
    'CREATE INDEX IF NOT EXISTS hits_key ON hits (key, at)',
    `CREATE TABLE IF NOT EXISTS keyboards (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      key TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS texts (
      id TEXT PRIMARY KEY,
      lang TEXT NOT NULL,
      kind TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS runs (
      id INTEGER PRIMARY KEY,
      user_id TEXT NOT NULL,
      text_id TEXT NOT NULL,
      mode TEXT NOT NULL,
      drill TEXT NOT NULL,
      kind TEXT NOT NULL,
      layout TEXT NOT NULL,
      lang TEXT NOT NULL,
      input TEXT NOT NULL,
      hardcore INTEGER NOT NULL,
      race INTEGER NOT NULL DEFAULT 0,
      wpm REAL NOT NULL,
      acc REAL NOT NULL,
      chars INTEGER NOT NULL,
      ms INTEGER NOT NULL,
      ranked INTEGER NOT NULL,
      kb_model INTEGER,
      kb_switch TEXT,
      kb_size TEXT,
      ghost TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`,
    'CREATE INDEX IF NOT EXISTS runs_board ON runs (ranked, input, drill, wpm)',
    'CREATE INDEX IF NOT EXISTS runs_text ON runs (text_id, mode, wpm)',
    'CREATE INDEX IF NOT EXISTS runs_user ON runs (user_id, created_at)',
  ],
  // The trainer's own percentile curves: one drill, kind of text and input at a time.
  ['CREATE INDEX IF NOT EXISTS runs_centile ON runs (drill, kind, input, ranked, user_id, created_at)'],
];

let ready: Promise<void> | null = null;

/** The database, once its tables are in place. */
export async function database(db: D1Database): Promise<D1Database> {
  ready ??= migrate(db).catch((error) => {
    ready = null;
    throw error;
  });
  await ready;
  return db;
}

async function migrate(db: D1Database): Promise<void> {
  await db.prepare('CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v INTEGER NOT NULL)').run();
  const row = await db.prepare("SELECT v FROM meta WHERE k = 'schema'").first<{ v: number }>();
  for (let version = row?.v ?? 0; version < MIGRATIONS.length; version++) {
    await db.batch([
      ...MIGRATIONS[version].map((sql) => db.prepare(sql)),
      db.prepare("INSERT INTO meta (k, v) VALUES ('schema', ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v").bind(version + 1),
    ]);
  }
}
