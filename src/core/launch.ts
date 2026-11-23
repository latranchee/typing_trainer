import type { LayoutId } from './layouts';
import { LAYOUT_IDS } from './layouts';
import type { Mode } from './online';
import { ROOM_CODE } from './online';
import type { Lang } from './store';
import { LANGS } from './store';
import { TEXT_ID } from './texts';

/**
 * What a link into the trainer may ask for: `?lang=de` and `?layout=dvorak`. The guides use
 * them so "try Dvorak" opens on Dvorak. The language only shapes a first visit (a typist's
 * saved interface language wins); the layout is applied every time, since following such a
 * link is a choice made on purpose.
 * Shared links add `?text=<id>` (with `&mode=highway` for the highway), a text to type again,
 * and `?race=<code>`, a room to join. Those two stay in the address while they are on.
 */
export interface Launch {
  lang?: Lang;
  layout?: LayoutId;
  text?: string;
  mode?: Mode;
  race?: string;
}

export function readLaunch(search: string): Launch {
  const params = new URLSearchParams(search);
  const lang = params.get('lang') ?? '';
  const layout = params.get('layout') ?? '';
  const text = params.get('text') ?? '';
  const race = (params.get('race') ?? '').toUpperCase();
  const launch: Launch = {};
  if ((LANGS as string[]).includes(lang)) launch.lang = lang as Lang;
  if ((LAYOUT_IDS as string[]).includes(layout)) launch.layout = layout as LayoutId;
  if (TEXT_ID.test(text)) {
    launch.text = text;
    launch.mode = params.get('mode') === 'highway' ? 'highway' : 'line';
  }
  if (ROOM_CODE.test(race)) launch.race = race;
  return launch;
}

/** The address without `lang` and `layout`, so a reload does not apply them again. Other parameters and the hash stay. */
export function withoutLaunch(search: string, hash: string): string {
  const params = new URLSearchParams(search);
  params.delete('lang');
  params.delete('layout');
  const rest = params.toString();
  return `${rest ? `?${rest}` : ''}${hash}`;
}

/** The address with a shared text or a room in it, or with neither. */
export function withShare(search: string, hash: string, share: { text: string; mode: Mode } | { race: string } | null): string {
  const params = new URLSearchParams(search);
  params.delete('text');
  params.delete('mode');
  params.delete('race');
  if (share && 'text' in share) {
    params.set('text', share.text);
    if (share.mode === 'highway') params.set('mode', 'highway');
  } else if (share) {
    params.set('race', share.race);
  }
  const rest = params.toString();
  return `${rest ? `?${rest}` : ''}${hash}`;
}
