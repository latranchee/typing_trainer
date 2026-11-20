import type { LayoutId } from './layouts';
import { LAYOUT_IDS } from './layouts';
import type { Lang } from './store';
import { LANGS } from './store';

/**
 * What a link into the trainer may ask for: `?lang=de` and `?layout=dvorak`. The guides use
 * them so "try Dvorak" opens on Dvorak. The language only shapes a first visit (a typist's
 * saved interface language wins); the layout is applied every time, since following such a
 * link is a choice made on purpose.
 */
export interface Launch {
  lang?: Lang;
  layout?: LayoutId;
}

export function readLaunch(search: string): Launch {
  const params = new URLSearchParams(search);
  const lang = params.get('lang') ?? '';
  const layout = params.get('layout') ?? '';
  const launch: Launch = {};
  if ((LANGS as string[]).includes(lang)) launch.lang = lang as Lang;
  if ((LAYOUT_IDS as string[]).includes(layout)) launch.layout = layout as LayoutId;
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
