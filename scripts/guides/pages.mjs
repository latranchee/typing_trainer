// The guides: which pages exist, in which languages, and what each language calls itself.
// Shared by the checker and the builder. Content lives in content/guides/<lang>/<id>.html.

/** Page ids, in the order the guide index lists them. */
export const PAGE_IDS = [
  'typing-speed',
  'how-to-type-faster',
  'touch-typing',
  'words-per-minute',
  'finger-placement',
  'type-without-looking',
  'typing-accuracy',
  'typing-exercises',
  'keyboard-layouts',
  'dvorak',
  'colemak',
  'colemak-vs-dvorak',
  'azerty-vs-qwerty',
  'qwertz-vs-qwerty',
  'iso-vs-ansi',
  'keyboard-switches',
  'linear-vs-tactile-vs-clicky',
  'linear-switches',
  'tactile-switches',
  'clicky-switches',
  'red-vs-brown-vs-blue-switches',
  'quiet-switches',
  'best-switches-for-typing',
  'hall-effect-switches',
  'optical-switches',
  'low-profile-switches',
  'topre-switches',
  'buckling-spring',
  'alps-switches',
  'switch-specs',
  'hot-swappable-keyboard',
  'lubing-switches',
  'switch-manufacturers',
  'staggered-vs-ortholinear-vs-columnar',
  'ortholinear-keyboard',
  'columnar-keyboard',
  'split-keyboard',
  'ergonomic-keyboard',
  'keyboard-sizes',
  '60-percent-keyboard',
  'wireless-mechanical-keyboard',
  'mechanical-vs-membrane-keyboard',
  'keyboards-for-long-nails',
  'number-pad',
];

/** Guide languages. `cjk` languages are measured in characters, the others in words. */
export const GUIDE_LANGS = {
  en: { name: 'English', hreflang: 'en', cjk: false },
  es: { name: 'Español', hreflang: 'es', cjk: false },
  fr: { name: 'Français', hreflang: 'fr', cjk: false },
  de: { name: 'Deutsch', hreflang: 'de', cjk: false },
  pt: { name: 'Português', hreflang: 'pt', cjk: false },
  it: { name: 'Italiano', hreflang: 'it', cjk: false },
  pl: { name: 'Polski', hreflang: 'pl', cjk: false },
  id: { name: 'Bahasa Indonesia', hreflang: 'id', cjk: false },
  ja: { name: '日本語', hreflang: 'ja', cjk: true },
  zh: { name: '简体中文', hreflang: 'zh-Hans', cjk: true },
};

/** Drills a guide may link to with `app:<drill>`. */
export const DRILLS = ['highway', 'words', 'pairs', 'anchors', 'stats'];

/** Layouts the trainer has, for `app:<drill>?layout=<id>` links. */
export const APP_LAYOUTS = ['ca-fr', 'us', 'azerty', 'qwertz', 'qwertz-ch', 'es', 'latam', 'dvorak', 'colemak', 'colemak-dh', 'workman'];

/** Keyboards the builder can draw as a finger chart: `<figure data-figure="finger-chart" data-layout="...">`. */
export const CHART_LAYOUTS = ['qwerty', 'azerty', 'qwertz', 'dvorak', 'colemak', 'colemak-dh', 'workman'];

/** Other figures the builder draws. */
export const FIGURES = ['finger-chart', 'board-shapes', 'stagger-shapes'];
