import type { RaceRoom } from './room';

export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  ROOMS: DurableObjectNamespace<RaceRoom>;
  EMAIL: SendEmail;
  /** The public address, with no trailing slash: the sign-in links point there. */
  SITE: string;
  MAIL_FROM: string;
  /** "1" in local development only (.dev.vars): the sign-in answer carries the link and the code instead of sending them. */
  ECHO_LINKS?: string;
}
