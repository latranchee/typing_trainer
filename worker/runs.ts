import { isLang } from '../src/core/lang';
import type { Lang } from '../src/core/lang';
import { getLayout, LAYOUT_IDS } from '../src/core/layouts';
import type { LayoutId } from '../src/core/layouts';
import type {
  BoardQuery,
  GhostRun,
  InputKind,
  KeyboardGroup,
  KeyboardRow,
  Placing,
  PlayerRow,
  RankedDrill,
  RunAnswer,
  RunSubmit,
  TextInfo,
  TextRow,
} from '../src/core/online';
import { KEYBOARD_GROUPS, modeOf, PERIODS, RANKED_DRILLS } from '../src/core/online';
import { BOARDS } from '../src/core/physical';
import type { LogEvent } from '../src/core/replay';
import { encodeGhost, ERASE, ranks, replay, verdict } from '../src/core/replay';
import type { TextKind } from '../src/core/texts';
import { isTrainerText, MAX_TEXT, TEXT_ID, TEXT_KINDS, textId } from '../src/core/texts';
import type { User } from './auth';
import { HttpError } from './http';
import type { CentileAnswer } from '../src/core/centile';
import { curveOf, OWN_MIN_SETS, OWN_RECENT, OWN_TYPISTS } from '../src/core/centile';

/** Longest log taken: a 60-word set with every key missed once over, and room to spare. */
const MAX_EVENTS = 6000;
const BOARD_ROWS = 50;
const TEXT_ROWS = 10;
const DAY = 86_400_000;

function checkLog(log: unknown): LogEvent[] {
  if (!Array.isArray(log) || log.length === 0 || log.length > MAX_EVENTS) throw new HttpError(400, 'bad-log');
  for (const event of log) {
    if (!Array.isArray(event) || event.length !== 3) throw new HttpError(400, 'bad-log');
    const [dt, code, flag] = event;
    if (typeof dt !== 'number' || !Number.isFinite(dt) || dt < 0 || dt > 600_000) throw new HttpError(400, 'bad-log');
    if (typeof code !== 'string' || code.length > 24 || !(code === ERASE || /^[A-Za-z0-9]*$/.test(code))) throw new HttpError(400, 'bad-log');
    if (flag !== 0 && flag !== 1) throw new HttpError(400, 'bad-log');
  }
  return log as LogEvent[];
}

/** Everything a set says about itself, checked. */
export function checkSubmit(body: Partial<RunSubmit>): RunSubmit {
  const { text, kind, lang, drill, layout, board, input, hardcore } = body;
  if (typeof text !== 'string' || text.length > MAX_TEXT) throw new HttpError(400, 'bad-text');
  if (!TEXT_KINDS.includes(kind as TextKind)) throw new HttpError(400, 'bad-kind');
  if (!isLang(lang)) throw new HttpError(400, 'bad-lang');
  if (!RANKED_DRILLS.includes(drill as RankedDrill)) throw new HttpError(400, 'bad-drill');
  if (!LAYOUT_IDS.includes(layout as LayoutId)) throw new HttpError(400, 'bad-layout');
  if (!BOARDS.includes(board as (typeof BOARDS)[number])) throw new HttpError(400, 'bad-board');
  if (input !== 'keys' && input !== 'touch') throw new HttpError(400, 'bad-input');
  if (!isTrainerText(lang, kind as TextKind, text)) throw new HttpError(422, 'not-a-trainer-text');
  return { text, kind: kind as TextKind, lang, drill: drill as RankedDrill, layout: layout as LayoutId, board: board!, input, hardcore: hardcore === true, log: checkLog(body.log) };
}

/** The text's row, made on first use. Returns its id. */
export async function saveText(db: D1Database, lang: Lang, kind: TextKind, text: string): Promise<string> {
  const id = await textId(lang, text);
  await db.prepare('INSERT INTO texts (id, lang, kind, body, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING').bind(id, lang, kind, text, Date.now()).run();
  return id;
}

/** Where `wpm` stands among the best of every other typist matching `where`. */
async function placing(db: D1Database, where: string, binds: unknown[], userId: string, wpm: number): Promise<Placing> {
  const row = await db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM (SELECT MAX(wpm) AS b FROM runs WHERE ${where} AND user_id != ? GROUP BY user_id) WHERE b > ?) AS ahead,
         (SELECT COUNT(DISTINCT user_id) FROM runs WHERE ${where} AND user_id != ?) AS others,
         (SELECT MAX(wpm) FROM runs WHERE ${where} AND user_id = ?) AS mine`,
    )
    .bind(...binds, userId, wpm, ...binds, userId, ...binds, userId)
    .first<{ ahead: number; others: number; mine: number | null }>();
  const mine = row?.mine ?? wpm;
  return { rank: (row?.ahead ?? 0) + 1, of: (row?.others ?? 0) + 1, best: wpm >= mine };
}

/**
 * Plays the set back, and saves it when it is a person typing the whole text. The numbers
 * saved are the replay's own. `race` marks a set typed in a race room.
 */
export async function recordRun(db: D1Database, user: User, submit: RunSubmit, race = false): Promise<RunAnswer> {
  const layout = getLayout(submit.layout, submit.board);
  const run = replay(layout, submit.text, submit.log, submit.hardcore);
  const judged = verdict(run);
  if (judged !== 'ok') throw new HttpError(422, judged);
  // Saved as ranked even before the typist has a name: the boards show only named typists, and the name can come later.
  const ranked = ranks(run);
  const id = await saveText(db, submit.lang, submit.kind, submit.text);
  const mode = modeOf(submit.drill);
  const wpm = Math.round(run.wpm * 100) / 100;
  const acc = Math.round(run.acc * 10000) / 10000;
  await db
    .prepare(
      `INSERT INTO runs (user_id, text_id, mode, drill, kind, layout, lang, input, hardcore, race, wpm, acc, chars, ms, ranked, kb_model, kb_switch, kb_size, ghost, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      user.id,
      id,
      mode,
      submit.drill,
      submit.kind,
      submit.layout,
      submit.lang,
      submit.input,
      submit.hardcore ? 1 : 0,
      race ? 1 : 0,
      wpm,
      acc,
      run.chars,
      Math.round(run.activeMs),
      ranked ? 1 : 0,
      user.kb_model,
      user.kb_switch,
      user.kb_size,
      encodeGhost(run.steps),
      Date.now(),
    )
    .run();
  const board = ranked ? await placing(db, 'ranked = 1 AND drill = ? AND input = ?', [submit.drill, submit.input], user.id, wpm) : null;
  const text = await placing(db, 'text_id = ? AND mode = ? AND input = ?', [id, mode, submit.input], user.id, wpm);
  return { textId: id, wpm, acc, ranked, board, text };
}

/** Reads a board's filters from the address, falling back to the defaults. */
export function boardQuery(params: URLSearchParams): BoardQuery {
  const drill = params.get('drill') as RankedDrill;
  const period = params.get('period') as BoardQuery['period'];
  const lang = params.get('lang');
  const layout = params.get('layout');
  return {
    drill: RANKED_DRILLS.includes(drill) ? drill : 'words',
    input: params.get('input') === 'touch' ? 'touch' : 'keys',
    period: PERIODS.includes(period) ? period : 'all',
    lang: isLang(lang) ? lang : 'all',
    layout: LAYOUT_IDS.includes(layout as LayoutId) ? (layout as LayoutId) : 'all',
  };
}

function filters(query: BoardQuery): { where: string; binds: unknown[] } {
  const parts = ['r.ranked = 1', 'r.drill = ?', 'r.input = ?'];
  const binds: unknown[] = [query.drill, query.input];
  if (query.lang !== 'all') {
    parts.push('r.lang = ?');
    binds.push(query.lang);
  }
  if (query.layout !== 'all') {
    parts.push('r.layout = ?');
    binds.push(query.layout);
  }
  if (query.period !== 'all') {
    parts.push('r.created_at >= ?');
    binds.push(Date.now() - (query.period === 'day' ? DAY : 7 * DAY));
  }
  return { where: parts.join(' AND '), binds };
}

/** Each typist's best set under the filters, fastest first. */
export async function playerBoard(db: D1Database, query: BoardQuery): Promise<PlayerRow[]> {
  const { where, binds } = filters(query);
  const { results } = await db
    .prepare(
      `SELECT u.handle AS handle, b.wpm AS wpm, b.acc AS acc, b.layout AS layout, b.lang AS lang, k.name AS keyboard, b.created_at AS at, b.text_id AS textId
       FROM (SELECT r.*, ROW_NUMBER() OVER (PARTITION BY r.user_id ORDER BY r.wpm DESC, r.created_at) AS n FROM runs r WHERE ${where}) b
       JOIN users u ON u.id = b.user_id
       LEFT JOIN keyboards k ON k.id = b.kb_model
       WHERE b.n = 1 AND u.handle IS NOT NULL
       ORDER BY b.wpm DESC LIMIT ${BOARD_ROWS}`,
    )
    .bind(...binds)
    .all<PlayerRow>();
  return results;
}

/** Keyboards ranked by the typists on them: the mean of each typist's best set, under the same filters as the players' board. */
export async function keyboardBoard(db: D1Database, query: BoardQuery, group: KeyboardGroup): Promise<KeyboardRow[]> {
  const { where, binds } = filters(query);
  const column = group === 'model' ? 'b.kb_model' : group === 'switch' ? 'b.kb_switch' : 'b.kb_size';
  const name = group === 'model' ? 'k.name' : column;
  const { results } = await db
    .prepare(
      `SELECT ${name} AS name, COUNT(*) AS players, AVG(b.wpm) AS mean, MAX(b.wpm) AS top
       FROM (SELECT r.*, ROW_NUMBER() OVER (PARTITION BY r.user_id, r.${column.slice(2)} ORDER BY r.wpm DESC) AS n FROM runs r WHERE ${where} AND r.${column.slice(2)} IS NOT NULL) b
       ${group === 'model' ? 'JOIN keyboards k ON k.id = b.kb_model' : ''}
       WHERE b.n = 1
       GROUP BY ${column} ORDER BY mean DESC LIMIT ${BOARD_ROWS}`,
    )
    .bind(...binds)
    .all<KeyboardRow>();
  return results.map((row) => ({ ...row, mean: Math.round(row.mean * 10) / 10 }));
}

export const isKeyboardGroup = (value: unknown): value is KeyboardGroup => KEYBOARD_GROUPS.includes(value as KeyboardGroup);

/** A text with the best run of each typist on it in one mode, ghosts included. */
export async function textInfo(db: D1Database, id: string, mode: 'line' | 'highway', input: InputKind, user: User | null): Promise<TextInfo> {
  if (!TEXT_ID.test(id)) throw new HttpError(400, 'bad-text-id');
  const text = await db.prepare('SELECT id, lang, kind, body FROM texts WHERE id = ?').bind(id).first<{ id: string; lang: Lang; kind: TextKind; body: string }>();
  if (!text) throw new HttpError(404, 'no-text');
  const best = `SELECT r.*, ROW_NUMBER() OVER (PARTITION BY r.user_id ORDER BY r.wpm DESC) AS n FROM runs r WHERE r.text_id = ? AND r.mode = ? AND r.input = ?`;
  const [runs, count, mine] = await db.batch<GhostRun & { players?: number }>([
    db
      .prepare(
        `SELECT u.handle AS handle, b.wpm AS wpm, b.acc AS acc, b.layout AS layout, b.created_at AS at, b.ghost AS ghost
         FROM (${best}) b JOIN users u ON u.id = b.user_id WHERE b.n = 1 AND u.handle IS NOT NULL ORDER BY b.wpm DESC LIMIT ${TEXT_ROWS}`,
      )
      .bind(id, mode, input),
    db.prepare('SELECT COUNT(DISTINCT user_id) AS players FROM runs WHERE text_id = ? AND mode = ? AND input = ?').bind(id, mode, input),
    db
      .prepare(
        `SELECT COALESCE(u.handle, '') AS handle, r.wpm AS wpm, r.acc AS acc, r.layout AS layout, r.created_at AS at, r.ghost AS ghost
         FROM runs r JOIN users u ON u.id = r.user_id WHERE r.text_id = ? AND r.mode = ? AND r.input = ? AND r.user_id = ? ORDER BY r.wpm DESC LIMIT 1`,
      )
      .bind(id, mode, input, user?.id ?? ''),
  ]);
  return {
    id: text.id,
    lang: text.lang,
    kind: text.kind,
    text: text.body,
    players: count.results[0]?.players ?? 0,
    runs: runs.results,
    mine: mine.results[0] ?? null,
  };
}

/** Texts with the most typists on them, for the boards' texts list. */
export async function popularTexts(db: D1Database, mode: 'line' | 'highway', input: InputKind, lang: Lang | 'all'): Promise<TextRow[]> {
  const langFilter = lang === 'all' ? '' : 'AND t.lang = ?';
  const { results } = await db
    .prepare(
      `SELECT t.id AS id, t.lang AS lang, t.kind AS kind, substr(t.body, 1, 60) AS start, COUNT(DISTINCT r.user_id) AS players, MAX(r.wpm) AS top,
         (SELECT u.handle FROM runs r2 JOIN users u ON u.id = r2.user_id WHERE r2.text_id = t.id AND r2.mode = ? AND r2.input = ? AND u.handle IS NOT NULL ORDER BY r2.wpm DESC LIMIT 1) AS topHandle
       FROM texts t JOIN runs r ON r.text_id = t.id
       WHERE r.mode = ? AND r.input = ? ${langFilter}
       GROUP BY t.id HAVING topHandle IS NOT NULL ORDER BY players DESC, top DESC LIMIT 30`,
    )
    .bind(mode, input, mode, input, ...(lang === 'all' ? [] : [lang]))
    .all<TextRow>();
  return results;
}

/**
 * The trainer's own curve for one drill, kind of text and input: each typist once, with the
 * average of their latest ranked sets of that kind. The curve is sent only once enough typists
 * have enough sets; until then the page holds a set against a study.
 */
export async function centileCurve(db: D1Database, drill: RankedDrill, kind: TextKind, input: InputKind): Promise<CentileAnswer> {
  const { results } = await db
    .prepare(
      `SELECT AVG(wpm) AS w FROM (
         SELECT user_id, wpm, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) AS n
         FROM runs WHERE drill = ? AND kind = ? AND input = ? AND ranked = 1
       ) WHERE n <= ? GROUP BY user_id HAVING COUNT(*) >= ?`,
    )
    .bind(drill, kind, input, OWN_RECENT, OWN_MIN_SETS)
    .all<{ w: number }>();
  const averages = results.map((row) => row.w);
  return { typists: averages.length, curve: averages.length >= OWN_TYPISTS ? curveOf(averages) : null };
}
