import type { Lang } from '../core/lang';
import type {
  Account,
  BoardQuery,
  KeyboardGroup,
  KeyboardInfo,
  KeyboardRow,
  Mode,
  InputKind,
  PlayerRow,
  RankedDrill,
  RoomConfig,
  RunAnswer,
  RunSubmit,
  TextInfo,
  TextRow,
} from '../core/online';
import type { TextKind } from '../core/texts';
import type { CentileAnswer } from '../core/centile';

/**
 * The page's side of the Worker's /api. The online parts live at petitdoigt.ca only: a copy
 * served elsewhere (GitHub Pages, a file) finds no /api and stays the offline trainer.
 */

export class ApiError extends Error {
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

const BASE = new URL('./api/', document.baseURI);

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(new URL(path, BASE), {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'offline');
  }
  const type = response.headers.get('content-type') ?? '';
  // A host with no Worker answers /api with a page or a 404 of its own.
  if (!type.includes('application/json')) throw new ApiError(response.status, 'no-api');
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    const { error, ...extra } = data as { error?: string };
    throw new ApiError(response.status, error ?? 'server', extra);
  }
  return data;
}

const query = (params: Record<string, string>): string => new URLSearchParams(params).toString();

export const api = {
  me: () => call<{ account: Account | null }>('GET', 'me'),
  startSignIn: (email: string, lang: Lang) => call<{ ok: true; echo?: { link: string; code: string } }>('POST', 'auth/start', { email, lang }),
  finishByToken: (token: string) => call<{ account: Account; created: boolean }>('POST', 'auth/finish', { token }),
  finishByCode: (email: string, code: string) => call<{ account: Account; created: boolean }>('POST', 'auth/finish', { email, code }),
  signOut: () => call<{ ok: true }>('POST', 'auth/out', {}),
  update: (patch: { handle?: string; keyboard?: Partial<KeyboardInfo>; lang?: Lang }) => call<{ account: Account }>('PATCH', 'me', patch),
  deleteAccount: () => call<{ ok: true }>('DELETE', 'me', {}),
  keyboards: (q: string) => call<{ models: { name: string; n: number }[] }>('GET', `keyboards?${query({ q })}`),
  readProfile: () => call<{ data: unknown; at: number | null }>('GET', 'me/profile'),
  writeProfile: (data: unknown, base: number | null) => call<{ at: number }>('PUT', 'me/profile', { data, base }),

  submit: (run: RunSubmit) => call<RunAnswer>('POST', 'runs', run),
  players: (q: BoardQuery) => call<{ rows: PlayerRow[] }>('GET', `boards?${query({ view: 'players', ...q })}`),
  keyboardBoard: (q: BoardQuery, by: KeyboardGroup) => call<{ rows: KeyboardRow[] }>('GET', `boards?${query({ view: 'keyboards', by, ...q })}`),
  texts: (q: BoardQuery) => call<{ rows: TextRow[] }>('GET', `boards?${query({ view: 'texts', ...q })}`),
  text: (id: string, mode: Mode, input: InputKind) => call<TextInfo>('GET', `texts/${id}?${query({ mode, input })}`),
  centiles: (drill: RankedDrill, kind: TextKind, input: InputKind) => call<CentileAnswer>('GET', `centiles?${query({ drill, kind, input })}`),
  shareText: (lang: Lang, kind: TextKind, text: string) => call<{ id: string }>('POST', 'texts', { lang, kind, text }),

  createRoom: (config: RoomConfig) => call<{ code: string; config: RoomConfig }>('POST', 'rooms', config),
  room: (code: string) => call<{ config: RoomConfig; phase: string; racers: number }>('GET', `rooms/${code}`),
  roomSocket: (code: string): WebSocket => {
    const url = new URL(`rooms/${code}/ws`, BASE);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return new WebSocket(url);
  },
};

/** A link anyone can open: the trainer on this text, or into this room. */
export const textLink = (id: string, mode: Mode): string => {
  const url = new URL(document.baseURI);
  url.search = `?text=${id}${mode === 'highway' ? '&mode=highway' : ''}`;
  url.hash = '';
  return url.href;
};

export const roomLink = (code: string): string => {
  const url = new URL(document.baseURI);
  url.search = `?race=${code}`;
  url.hash = '';
  return url.href;
};
