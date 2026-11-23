import type { Lang } from '../core/lang';
import type { Account, KeyboardInfo, RunAnswer, RunSubmit } from '../core/online';
import type { Store } from '../core/store';
import { api, ApiError } from './api';

/** Where the profile an account follows is remembered, on this device. */
const BOUND_KEY = 'petitdoigt:account';
/** A sync waits this long after a set, so a burst of sets makes one write. */
const SYNC_DELAY_MS = 4000;

interface Bound {
  email: string;
  profile: string;
  /** When the server last took this device's numbers: the base of the next write. */
  at: number | null;
}

function readBound(): Bound | null {
  try {
    const raw = localStorage.getItem(BOUND_KEY);
    return raw ? (JSON.parse(raw) as Bound) : null;
  } catch {
    return null;
  }
}

function writeBound(bound: Bound | null): void {
  try {
    if (bound) localStorage.setItem(BOUND_KEY, JSON.stringify(bound));
    else localStorage.removeItem(BOUND_KEY);
  } catch {
    // Storage blocked: the account still works for this visit.
  }
}

/**
 * The typist's account, when the page is served with its Worker. The account follows one
 * local profile, the one active when it signed in: another typist's profile on the same
 * device neither posts sets nor syncs under it.
 */
export class Online {
  /** False until /api answered, and for good on a host with no Worker. */
  available = false;
  /** True once the page has asked: until then a missing server is not known to be missing. */
  checked = false;
  account: Account | null = null;
  private store: Store;
  private listeners = new Set<() => void>();
  private bound = readBound();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private syncing: Promise<void> | null = null;
  /** A sign-in link's token, taken from the address before anything rewrites it. */
  private linkToken: string | null = null;

  constructor(store: Store) {
    this.store = store;
    const match = location.hash.match(/^#signin=([\w-]{20,100})$/);
    if (match) {
      this.linkToken = match[1];
      history.replaceState(null, '', `${location.pathname}${location.search}`);
    }
  }

  onChange(listener: () => void): void {
    this.listeners.add(listener);
  }

  private changed(): void {
    for (const listener of this.listeners) listener();
  }

  /** True while the active profile is the one the account follows. */
  get linked(): boolean {
    return this.account !== null && this.bound?.email === this.account.email && this.bound.profile === this.store.profileId;
  }

  /** The profile the account follows, when another one is active. */
  get otherProfile(): string | null {
    if (!this.account || !this.bound || this.linked) return null;
    return this.store.profiles.find((profile) => profile.id === this.bound!.profile)?.name ?? null;
  }

  /** Asks who is signed in, and spends a sign-in link that brought the typist here. Returns the account made by the link, if one was. */
  async load(): Promise<{ created: boolean } | null> {
    try {
      this.account = (await api.me()).account;
      this.available = true;
      this.checked = true;
    } catch {
      this.available = false;
      this.checked = true;
      this.changed();
      return null;
    }
    let outcome: { created: boolean } | null = null;
    if (this.linkToken) {
      const token = this.linkToken;
      this.linkToken = null;
      try {
        const done = await api.finishByToken(token);
        this.signedIn(done.account);
        outcome = { created: done.created };
      } catch (error) {
        this.changed();
        throw error;
      }
    } else if (this.account) {
      // Signed in elsewhere on this device, or a cookie with no profile bound yet: this profile takes it.
      if (!this.bound || this.bound.email !== this.account.email) this.bind();
      void this.sync();
    }
    this.changed();
    return outcome;
  }

  async startSignIn(email: string, lang: Lang): Promise<{ link: string; code: string } | null> {
    const answer = await api.startSignIn(email, lang);
    return answer.echo ?? null;
  }

  async finishByCode(email: string, code: string): Promise<{ created: boolean }> {
    const done = await api.finishByCode(email, code);
    this.signedIn(done.account);
    return { created: done.created };
  }

  private signedIn(account: Account): void {
    this.account = account;
    this.bind();
    this.changed();
    void this.sync();
  }

  /** The active profile becomes the one the account follows. */
  bind(): void {
    if (!this.account) return;
    const same = this.bound?.email === this.account.email && this.bound.profile === this.store.profileId;
    this.bound = { email: this.account.email, profile: this.store.profileId, at: same ? (this.bound?.at ?? null) : null };
    writeBound(this.bound);
    this.changed();
  }

  async update(patch: { handle?: string; keyboard?: Partial<KeyboardInfo> }): Promise<void> {
    this.account = (await api.update(patch)).account;
    this.changed();
  }

  async signOut(): Promise<void> {
    await api.signOut().catch(() => undefined);
    this.account = null;
    this.bound = null;
    writeBound(null);
    this.changed();
  }

  async deleteAccount(): Promise<void> {
    await api.deleteAccount();
    this.account = null;
    this.bound = null;
    writeBound(null);
    this.changed();
  }

  /** Sends a finished set. Null when it cannot rank: signed out, another profile, or tracking off. */
  async submit(run: RunSubmit): Promise<RunAnswer | null> {
    if (!this.linked || !this.store.tracking) return null;
    const answer = await api.submit(run);
    this.queueSync();
    return answer;
  }

  queueSync(): void {
    if (!this.linked) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.sync(), SYNC_DELAY_MS);
  }

  /** Merges what other devices saved, then saves the merged numbers. One at a time. */
  async sync(): Promise<void> {
    if (!this.linked || !this.store.tracking) return;
    this.syncing ??= this.runSync().finally(() => {
      this.syncing = null;
    });
    return this.syncing;
  }

  private async runSync(): Promise<void> {
    for (let attempt = 0; attempt < 2 && this.linked; attempt++) {
      try {
        const remote = await api.readProfile();
        if (remote.data && remote.at !== this.bound?.at) this.store.merge(remote.data);
        const { at } = await api.writeProfile(this.store.snapshot(), remote.at);
        if (this.bound) {
          this.bound.at = at;
          writeBound(this.bound);
        }
        return;
      } catch (error) {
        // Another device wrote between the read and the write: read again and merge that too.
        if (error instanceof ApiError && error.code === 'profile-moved') continue;
        return;
      }
    }
  }
}
