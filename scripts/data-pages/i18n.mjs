// Languages of the keyboard and switch database: address segments, list names, number and date formats, and
// the translated record text (content/data/i18n/<lang>.json, written by i18n-merge.mjs).
// English is the source: its text lives in the records themselves.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const DB_LANGS = ['en', 'fr', 'de', 'es'];
/** Languages that get a page per keyboard and switch. The others link to the English record pages; the
 * category pages (hubs, lists, brands, makers, comparisons, finder) exist in every DB_LANGS language. */
export const RECORD_LANGS = ['en', 'fr', 'de', 'es'];
/** The language of the record page a page in `lang` links to. */
export const recLang = (lang) => (RECORD_LANGS.includes(lang) ? lang : 'en');

/** The folder words of each language's database addresses. The finder sits one level under the keyboards
 * folder in every language, so a keyboard's address relative to it (../<brand>/<model>/) is the same. */
export const SEG = {
  en: { keyboards: 'keyboards', switches: 'switches', finder: 'finder', compare: 'compare' },
  fr: { keyboards: 'claviers', switches: 'switchs', finder: 'recherche', compare: 'comparatif' },
  de: { keyboards: 'tastaturen', switches: 'switches', finder: 'finder', compare: 'vergleich' },
  es: { keyboards: 'teclados', switches: 'switches', finder: 'buscador', compare: 'comparativa' },
};

const LOCALE = { en: 'en-US', fr: 'fr-FR', de: 'de-DE', es: 'es-ES' };
export const OG_LOCALE = { en: 'en_US', fr: 'fr_FR', de: 'de_DE', es: 'es_ES' };
const NBSP = ' ';

/** Number, price, date, percent and list formats of one language. */
export function formats(lang) {
  const loc = LOCALE[lang];
  const nf = new Intl.NumberFormat(loc, { maximumFractionDigits: 2 });
  // Spanish groups 4-digit numbers only from 10 000 (RAE); Intl does the same with es-ES.
  const num = (n) => nf.format(n);
  const amount = (n) => {
    const v = Number(n);
    return new Intl.NumberFormat(loc, Number.isInteger(v) ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
  };
  const money = { en: (n) => `$${amount(n)}`, fr: (n) => `${amount(n)}${NBSP}$${NBSP}US`, de: (n) => `${amount(n)}${NBSP}US-$`, es: (n) => `${amount(n)}${NBSP}US$` }[lang];
  const dateFmt = new Intl.DateTimeFormat(loc, { dateStyle: 'medium', timeZone: 'UTC' });
  const monthFmt = new Intl.DateTimeFormat(loc, { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const date = (iso) => (iso ? dateFmt.format(new Date(`${iso}T00:00:00Z`)) : '');
  /** "2023-09" -> "September 2023"; a bare year or anything else stays. */
  const released = (v) => (/^\d{4}-\d{2}$/.test(v) ? monthFmt.format(new Date(`${v}-01T00:00:00Z`)) : v);
  const and = { en: 'and', fr: 'et', de: 'und', es: 'y' }[lang];
  const or = { en: 'or', fr: 'ou', de: 'oder', es: 'o' }[lang];
  const join = (word) => (a) => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} ${word} ${a.at(-1)}`);
  /** 42 -> "42%" / "42 %". */
  const perc = (n) => `${n}${lang === 'en' ? '' : NBSP}%`;
  const pct = (n, of) => (of ? perc(Math.round((n / of) * 100)) : '–');
  const regions = new Intl.DisplayNames([loc], { type: 'region' });
  return { lang, num, money, date, released, list: join(and), orList: join(or), pct, perc, region: (cc) => (cc ? regions.of(cc) : null) };
}

// ---------- translated record text ----------

const repo = join(import.meta.dirname, '..', '..');
const overlays = {};
/** The translation of a record's prose, falling back to the English when a string is missing (counted). */
export function recordText(lang) {
  if (!overlays[lang]) {
    const file = join(repo, 'content', 'data', 'i18n', `${lang}.json`);
    overlays[lang] = lang !== 'en' && existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { notes: {}, reviews: {}, about: {}, values: {} };
    overlays[lang].missing = 0;
  }
  const o = overlays[lang];
  const pick = (table, key, en) => {
    if (en == null || en === '') return en;
    if (lang === 'en') return en;
    const t = o[table][key];
    if (t == null) o.missing++;
    return t ?? en;
  };
  return {
    note: (r) => pick('notes', r.id, r.notes),
    verdict: (r, review) => pick('reviews', `${r.id}|${review.url}`, review.verdict),
    about: (kind, x) => pick('about', `${kind}:${x.id}`, x.about),
    value: (field, v) => (typeof v === 'string' && /[a-z]{3}/i.test(v) ? pick('values', `${field}:${v}`, v) : v),
    missing: () => o.missing,
  };
}

// ---------- preset lists in each language ----------
// slug = the list's address under <lang>/<keyboards>/; name = its title; what = the noun phrase of its
// first sentence; q = the finder sentence that gives the same boards.

export const LIST_TEXT = {
  'ergonomic-keyboards': {
    fr: { slug: 'claviers-ergonomiques', name: 'Claviers ergonomiques', what: 'claviers split, à décalage en colonnes, ortholinéaires, en angle, avec tenting ou cuvettes de touches', q: 'ergonomique' },
    de: { slug: 'ergonomische-tastaturen', name: 'Ergonomische Tastaturen', what: 'geteilte, spaltenversetzte, ortholineare oder gewinkelte Tastaturen und solche mit Tenting oder Tastenmulden', q: 'ergonomisch' },
    es: { slug: 'teclados-ergonomicos', name: 'Teclados ergonómicos', what: 'teclados split, escalonados por columnas, ortolineales, en ángulo, con tenting o teclas cóncavas', q: 'ergonómico' },
  },
  'split-keyboards': {
    fr: { slug: 'claviers-split', name: 'Claviers split', what: 'claviers en deux moitiés', q: 'split' },
    de: { slug: 'split-tastaturen', name: 'Split-Tastaturen', what: 'Tastaturen aus zwei Hälften', q: 'split' },
    es: { slug: 'teclados-split', name: 'Teclados split', what: 'teclados en dos mitades', q: 'split' },
  },
  'columnar-keyboards': {
    fr: { slug: 'claviers-decalage-colonnes', name: 'Claviers à décalage en colonnes', what: 'claviers à décalage en colonnes, où les touches de chaque doigt forment une colonne droite', q: 'décalage en colonnes' },
    de: { slug: 'spaltenversetzte-tastaturen', name: 'Spaltenversetzte Tastaturen', what: 'spaltenversetzte Tastaturen, bei denen die Tasten jedes Fingers in einer geraden Spalte liegen', q: 'spaltenversetzt' },
    es: { slug: 'teclados-escalonados-por-columnas', name: 'Teclados escalonados por columnas', what: 'teclados escalonados por columnas, donde las teclas de cada dedo forman una columna recta', q: 'escalonado por columnas' },
  },
  'wireless-mechanical-keyboards': {
    fr: { slug: 'claviers-mecaniques-sans-fil', name: 'Claviers mécaniques sans fil', what: 'claviers mécaniques qui se connectent en Bluetooth ou par un dongle 2,4 GHz', q: 'sans fil' },
    de: { slug: 'kabellose-mechanische-tastaturen', name: 'Kabellose mechanische Tastaturen', what: 'mechanische Tastaturen mit Bluetooth oder 2,4-GHz-Dongle', q: 'kabellos' },
    es: { slug: 'teclados-mecanicos-inalambricos', name: 'Teclados mecánicos inalámbricos', what: 'teclados mecánicos que se conectan por Bluetooth o con un dongle de 2,4 GHz', q: 'inalámbrico' },
  },
  'hall-effect-keyboards': {
    fr: { slug: 'claviers-magnetiques', name: 'Claviers magnétiques (effet Hall)', what: 'claviers à switchs magnétiques (effet Hall), dont vous réglez le point d’actionnement', q: 'magnétique' },
    de: { slug: 'hall-effekt-tastaturen', name: 'Hall-Effekt-Tastaturen', what: 'Tastaturen mit magnetischen Switches (Hall-Effekt), deren Auslösepunkt du einstellst', q: 'hall effekt' },
    es: { slug: 'teclados-efecto-hall', name: 'Teclados de efecto Hall', what: 'teclados con switches magnéticos (efecto Hall), en los que ajustas el punto de actuación', q: 'efecto hall' },
  },
  'low-profile-keyboards': {
    fr: { slug: 'claviers-low-profile', name: 'Claviers low profile', what: 'claviers à switchs et keycaps profil bas', q: 'profil bas' },
    de: { slug: 'low-profile-tastaturen', name: 'Low-Profile-Tastaturen', what: 'Tastaturen mit flachen Switches und Keycaps', q: 'low profile' },
    es: { slug: 'teclados-perfil-bajo', name: 'Teclados de perfil bajo', what: 'teclados con switches y keycaps de perfil bajo', q: 'perfil bajo' },
  },
  'hot-swappable-keyboards': {
    fr: { slug: 'claviers-hot-swap', name: 'Claviers hot-swap', what: 'claviers dont les switchs se retirent sans soudure', q: 'hot swap' },
    de: { slug: 'hot-swap-tastaturen', name: 'Hot-Swap-Tastaturen', what: 'Tastaturen, deren Switches sich ohne Löten tauschen lassen', q: 'hot swap' },
    es: { slug: 'teclados-hot-swap', name: 'Teclados hot-swap', what: 'teclados cuyos switches se cambian sin soldar', q: 'hot swap' },
  },
  'quiet-keyboards': {
    fr: { slug: 'claviers-silencieux', name: 'Claviers silencieux', what: 'claviers vendus avec une option de switch linéaire ou tactile silencieux', q: 'silencieux' },
    de: { slug: 'leise-tastaturen', name: 'Leise Tastaturen', what: 'Tastaturen, die mit einem leisen linearen oder taktilen Switch erhältlich sind', q: 'leise' },
    es: { slug: 'teclados-silenciosos', name: 'Teclados silenciosos', what: 'teclados que se venden con un switch lineal o táctil silencioso', q: 'silencioso' },
  },
  '60-percent-keyboards': {
    fr: { slug: 'claviers-60-pourcent', name: 'Claviers 60 %', what: 'claviers 60 % : le bloc principal, sans rangée de fonctions, flèches ni pavé numérique', q: '60%' },
    de: { slug: '60-prozent-tastaturen', name: '60-%-Tastaturen', what: '60-%-Tastaturen: der Hauptblock ohne F-Tasten, Pfeiltasten und Nummernblock', q: '60%' },
    es: { slug: 'teclados-60-por-ciento', name: 'Teclados 60 %', what: 'teclados 60 %: el bloque principal sin fila de funciones, flechas ni teclado numérico', q: '60%' },
  },
  '65-percent-keyboards': {
    fr: { slug: 'claviers-65-pourcent', name: 'Claviers 65 %', what: 'claviers 65 % : un 60 % avec flèches et une colonne de touches de navigation', q: '65%' },
    de: { slug: '65-prozent-tastaturen', name: '65-%-Tastaturen', what: '65-%-Tastaturen: eine 60-%-Tastatur mit Pfeiltasten und einer Spalte Navigationstasten', q: '65%' },
    es: { slug: 'teclados-65-por-ciento', name: 'Teclados 65 %', what: 'teclados 65 %: un 60 % con flechas y una columna de teclas de navegación', q: '65%' },
  },
  '75-percent-keyboards': {
    fr: { slug: 'claviers-75-pourcent', name: 'Claviers 75 %', what: 'claviers 75 % : rangée de fonctions et flèches serrées, sans pavé numérique', q: '75%' },
    de: { slug: '75-prozent-tastaturen', name: '75-%-Tastaturen', what: '75-%-Tastaturen: F-Tasten und Pfeiltasten eng gepackt, ohne Nummernblock', q: '75%' },
    es: { slug: 'teclados-75-por-ciento', name: 'Teclados 75 %', what: 'teclados 75 %: fila de funciones y flechas muy juntas, sin teclado numérico', q: '75%' },
  },
  'tkl-keyboards': {
    fr: { slug: 'claviers-tkl', name: 'Claviers TKL (sans pavé numérique)', what: 'claviers TKL : une disposition complète moins le pavé numérique', q: 'tkl' },
    de: { slug: 'tkl-tastaturen', name: 'TKL-Tastaturen (Tenkeyless)', what: 'TKL-Tastaturen: ein volles Layout ohne Nummernblock', q: 'tkl' },
    es: { slug: 'teclados-tkl', name: 'Teclados TKL (tenkeyless)', what: 'teclados TKL: una distribución completa sin teclado numérico', q: 'tkl' },
  },
  'full-size-keyboards': {
    fr: { slug: 'claviers-pleine-taille', name: 'Claviers pleine taille', what: 'claviers pleine taille et 96 %, avec pavé numérique', q: 'pleine taille' },
    de: { slug: 'full-size-tastaturen', name: 'Tastaturen in voller Größe', what: 'Tastaturen in voller Größe und 96-%-Tastaturen, mit Nummernblock', q: 'volle größe' },
    es: { slug: 'teclados-tamano-completo', name: 'Teclados de tamaño completo', what: 'teclados de tamaño completo y 96 %, con teclado numérico', q: 'tamaño completo' },
  },
  'mac-keyboards': {
    fr: { slug: 'claviers-mecaniques-mac', name: 'Claviers mécaniques pour Mac', what: 'claviers mécaniques dont la marque indique la compatibilité macOS', q: 'pour mac' },
    de: { slug: 'mechanische-tastaturen-fuer-mac', name: 'Mechanische Tastaturen für Mac', what: 'mechanische Tastaturen, deren Marke macOS-Unterstützung angibt', q: 'für mac' },
    es: { slug: 'teclados-mecanicos-para-mac', name: 'Teclados mecánicos para Mac', what: 'teclados mecánicos cuya marca indica compatibilidad con macOS', q: 'para mac' },
  },
  'keyboards-under-100': {
    fr: { slug: 'claviers-moins-de-100-dollars', name: 'Claviers à moins de 100 $ US', what: 'claviers vendus moins de 100 $ US sur la boutique de leur marque', q: 'moins de 100 $' },
    de: { slug: 'tastaturen-unter-100-dollar', name: 'Tastaturen unter 100 US-$', what: 'Tastaturen, die im Shop ihrer Marke unter 100 US-$ kosten', q: 'unter 100 $' },
    es: { slug: 'teclados-menos-de-100-dolares', name: 'Teclados por menos de 100 US$', what: 'teclados que cuestan menos de 100 US$ en la tienda de su marca', q: 'menos de 100 $' },
  },
  'mechanical-keyboards-under-50': {
    fr: { slug: 'claviers-mecaniques-moins-de-50-dollars', name: 'Claviers mécaniques à moins de 50 $ US', what: 'claviers mécaniques vendus moins de 50 $ US sur la boutique de leur marque', q: 'moins de 50 $' },
    de: { slug: 'mechanische-tastaturen-unter-50-dollar', name: 'Mechanische Tastaturen unter 50 US-$', what: 'mechanische Tastaturen, die im Shop ihrer Marke unter 50 US-$ kosten', q: 'unter 50 $' },
    es: { slug: 'teclados-mecanicos-menos-de-50-dolares', name: 'Teclados mecánicos por menos de 50 US$', what: 'teclados mecánicos que cuestan menos de 50 US$ en la tienda de su marca', q: 'menos de 50 $' },
  },
  'rapid-trigger-keyboards': {
    fr: { slug: 'claviers-rapid-trigger', name: 'Claviers rapid trigger', what: 'claviers avec rapid trigger, qui réarme une touche dès qu’elle commence à remonter', q: 'rapid trigger' },
    de: { slug: 'rapid-trigger-tastaturen', name: 'Rapid-Trigger-Tastaturen', what: 'Tastaturen mit Rapid Trigger, das eine Taste zurücksetzt, sobald sie sich hebt', q: 'rapid trigger' },
    es: { slug: 'teclados-rapid-trigger', name: 'Teclados con rapid trigger', what: 'teclados con rapid trigger, que rearma una tecla en cuanto empieza a subir', q: 'rapid trigger' },
  },
  'aluminum-keyboards': {
    fr: { slug: 'claviers-aluminium', name: 'Claviers en aluminium', what: 'claviers à coque en aluminium ou en métal', q: 'aluminium' },
    de: { slug: 'aluminium-tastaturen', name: 'Aluminium-Tastaturen', what: 'Tastaturen mit Gehäuse aus Aluminium oder Metall', q: 'aluminium' },
    es: { slug: 'teclados-aluminio', name: 'Teclados de aluminio', what: 'teclados con carcasa de aluminio o metal', q: 'aluminio' },
  },
  'gasket-mount-keyboards': {
    fr: { slug: 'claviers-gasket-mount', name: 'Claviers gasket mount', what: 'claviers à montage gasket, où la plaque repose sur des joints souples au lieu de vis', q: 'gasket' },
    de: { slug: 'gasket-mount-tastaturen', name: 'Gasket-Mount-Tastaturen', what: 'Tastaturen mit Gasket-Mount, bei denen die Platte auf weichen Dichtungen statt auf Schrauben sitzt', q: 'gasket' },
    es: { slug: 'teclados-gasket-mount', name: 'Teclados gasket mount', what: 'teclados con montaje gasket, donde la placa descansa sobre juntas blandas en lugar de tornillos', q: 'gasket' },
  },
  'qmk-via-keyboards': {
    fr: { slug: 'claviers-qmk-via', name: 'Claviers QMK et VIA', what: 'claviers qui tournent sous QMK ou se reprogramment dans VIA ou Vial', q: 'qmk' },
    de: { slug: 'qmk-via-tastaturen', name: 'QMK- und VIA-Tastaturen', what: 'Tastaturen mit QMK-Firmware oder Belegung über VIA oder Vial', q: 'qmk' },
    es: { slug: 'teclados-qmk-via', name: 'Teclados QMK y VIA', what: 'teclados con firmware QMK o que se reprograman con VIA o Vial', q: 'qmk' },
  },
};
