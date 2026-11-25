// Keyboard finder: reads a sentence as filters and matches them against the keyboard database.
// Pure functions first (parse, evaluate), so Node can test them; the page wiring runs only in a browser.
// The sentence may mix English, French, German and Spanish: one rule set reads all four (people type "split"
// or "TKL" in every language). What the page shows (chips, result lines, messages) follows the page language.

const LANGS = ['en', 'fr', 'de', 'es'];
const NBSP = ' ';

// Words that carry no filter, in all four languages, written without accents (the sentence loses its accents
// before matching).
const STOP = new Set(
  [
    "i im i'm want wanted need needs looking look for a an the some any keyboard keyboards board boards with and or that has have having is it of in on to me my please something like would love find show get one switch switches mechanical mech keys key type typing which what good best new also plus but",
    "je j' veux voudrais cherche recherche besoin un une des le la les l' du de d' avec et ou qui pour mon ma mes clavier claviers mecanique mecaniques touche touches switchs bon bonne meilleur meilleure aussi mais en sur par disposition montage coque prix budget aimerais souhaite souhaiterais idealement",
    'ich will mochte suche brauche eine einen einem einer ein der die das den dem des mit und oder fur fuer tastatur tastaturen mechanische mechanischer mechanisch gute guter beste besten auch aber im auf gehause preis budget hatte',
    'quiero busco necesito unos unas el los las del con y o para mi teclado teclados mecanico mecanicos mecanica tecla teclas bueno buena mejor tambien pero por carcasa distribucion montaje precio presupuesto gustaria me',
  ]
    .join(' ')
    .split(' '),
);

/** Lower case, curly quotes straightened, accents dropped, one character for one: positions still point into the
 * sentence as typed. */
export function normalize(text) {
  return [...text.toLowerCase()].map((c) => (c === '’' || c === '‘' ? "'" : /\s/.test(c) ? ' ' : c.normalize('NFD').replace(/[̀-ͯ]/g, '') || c)).join('');
}

// ---------- words shown to the visitor ----------

const MONEY = {
  en: (a) => `$${a}`,
  fr: (a) => `${a}${NBSP}$${NBSP}US`,
  de: (a) => `${a}${NBSP}US-$`,
  es: (a) => `${a}${NBSP}US$`,
};
const LOCALE = { en: 'en-US', fr: 'fr-FR', de: 'de-DE', es: 'es-ES' };
export const money = (n, lang = 'en') =>
  MONEY[lang](Number(n).toLocaleString(LOCALE[lang], Number.isInteger(Number(n)) ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const pc = (lang, n) => (lang === 'en' ? `${n}%` : `${n}${NBSP}%`);
const plural = (n, one, many) => `${n.toLocaleString?.() ?? n} ${n === 1 ? one : many}`;

const SIZES = ['full', '96', 'tkl', '75', '65', '60', '50', '40', '30', 'numpad'];
const FW = { qmk: 'QMK', via: 'VIA', vial: 'Vial', zmk: 'ZMK', kmk: 'KMK' };

export const T = {
  en: {
    size: { full: 'full size', tkl: 'TKL', numpad: 'numpad' },
    footprint: { mx: 'MX-style', 'gateron-lp': 'Gateron low profile', 'buckling-spring': 'buckling spring', optical: 'optical', proprietary: 'proprietary', other: 'other' },
    f: {
      pmin: (v) => `over ${money(v, 'en')}`,
      pmax: (v) => `under ${money(v, 'en')}`,
      stagger: { column: 'columnar', ortholinear: 'ortholinear', row: 'row stagger' },
      split: { 'unibody-angled': 'angled one-piece', split: 'split' },
      ergo: 'ergonomic',
      tent: 'tenting',
      thumb: 'thumb cluster',
      wells: 'key wells',
      lp: 'low profile',
      compact: 'compact (75% or smaller)',
      wiredonly: 'wired only',
      wireless: 'wireless',
      magnetic: 'magnetic (Hall effect)',
      rt: 'rapid trigger',
      optical: 'optical',
      hotswap: 'hot-swap',
      soldered: 'soldered switches',
      swtype: { silent: 'silent switches', linear: 'linear switches', tactile: 'tactile switches', clicky: 'clicky switches' },
      foot: { choc: 'Choc switches', topre: 'Topre switches' },
      os: { mac: 'Mac support', linux: 'Linux support' },
      case: { alumin: 'aluminum case', wood: 'wood case' },
      mount: { gasket: 'gasket mount' },
      kind: { kit: 'kit', barebones: 'barebones', prebuilt: 'assembled' },
      swmaker: (n) => `${n} switches`,
    },
    spec: { keys: (n) => `${n} keys`, columnar: 'columnar', ortholinear: 'ortholinear', split: 'split', angled: 'angled one-piece', lp: 'low profile', wired: 'wired', noConn: 'connection not published', magnetic: 'magnetic', rt: 'rapid trigger', hotswap: 'hot-swap' },
    miss: {
      unknown: { pmax: 'price not published', pmin: 'price not published', fw: 'firmware not published', os: 'systems not published', case: 'case not published', mount: 'mount not published', hotswap: 'hot-swap not published', soldered: 'hot-swap not published', swmaker: 'switches not published', swtype: 'switch type not published', std: 'layout not published' },
      notPublished: (w) => `${w} not published`,
      over: (p, v) => `${p}, over ${money(v, 'en')}`,
      under: (p, v) => `${p}, under ${money(v, 'en')}`,
      onePiece: 'one piece',
      wired: 'wired only',
      noOption: (names) => `no ${names} option`,
      noVersion: (names) => `no ${names} version`,
      not: (names) => `not ${names}`,
      ergo: 'standard shape',
    },
    ui: {
      noPrice: 'no price',
      reviews: (n) => (n ? plural(n, 'review', 'reviews') : ''),
      discontinued: 'discontinued',
      remove: 'remove',
      setAsideTitle: 'set aside: grid and columnar boards have no ANSI or ISO stagger',
      notRead: 'not read:',
      asideNote: (labels) => `${labels} set aside: ANSI, ISO and JIS describe row-staggered boards, and grid and columnar boards do not follow them.`,
      kitsToo: 'keyboards, kits included',
      assembled: 'assembled keyboards',
      countAll: (pool, what, brands) => `<strong>${pool}</strong> ${what} from ${brands} brands`,
      countMatch: (n, pool, what, groups) => `<strong>${n}</strong> of ${pool} ${what} match ${groups === 1 ? 'this filter' : `all ${groups} filters`}`,
      plusKits: (n) => `, plus ${n} kit${n > 1 ? 's' : ''} and PCB${n > 1 ? 's' : ''}`,
      more: (n) => `show ${n} more`,
      nearTitle: (found, groups) => (found ? 'One filter short' : `No keyboard matches all ${groups}. These miss one`),
      empty: 'No keyboard comes within one filter of this. Remove a filter above to widen it.',
    },
  },
  fr: {
    size: { full: 'pleine taille', tkl: 'TKL', numpad: 'pavé numérique' },
    footprint: { mx: 'type MX', 'gateron-lp': 'Gateron profil bas', 'buckling-spring': 'buckling spring', optical: 'optique', proprietary: 'propriétaire', other: 'autre' },
    f: {
      pmin: (v) => `plus de ${money(v, 'fr')}`,
      pmax: (v) => `moins de ${money(v, 'fr')}`,
      stagger: { column: 'décalage en colonnes', ortholinear: 'ortholinéaire', row: 'décalage en rangées' },
      split: { 'unibody-angled': 'monobloc en angle', split: 'split' },
      ergo: 'ergonomique',
      tent: 'tenting',
      thumb: 'bloc de pouce',
      wells: 'cuvettes de touches',
      lp: 'profil bas',
      compact: 'compact (75 % ou moins)',
      wiredonly: 'filaire uniquement',
      wireless: 'sans fil',
      magnetic: 'magnétique (effet Hall)',
      rt: 'rapid trigger',
      optical: 'optique',
      hotswap: 'hot-swap',
      soldered: 'switchs soudés',
      swtype: { silent: 'switchs silencieux', linear: 'switchs linéaires', tactile: 'switchs tactiles', clicky: 'switchs clicky' },
      foot: { choc: 'switchs Choc', topre: 'switchs Topre' },
      os: { mac: 'compatible Mac', linux: 'compatible Linux' },
      case: { alumin: 'coque en aluminium', wood: 'coque en bois' },
      mount: { gasket: 'montage gasket' },
      kind: { kit: 'kit', barebones: 'barebone', prebuilt: 'monté' },
      swmaker: (n) => `switchs ${n}`,
    },
    spec: { keys: (n) => `${n} touches`, columnar: 'décalage en colonnes', ortholinear: 'ortholinéaire', split: 'split', angled: 'monobloc en angle', lp: 'profil bas', wired: 'filaire', noConn: 'connexion non indiquée', magnetic: 'magnétique', rt: 'rapid trigger', hotswap: 'hot-swap' },
    miss: {
      unknown: { pmax: 'prix non indiqué', pmin: 'prix non indiqué', fw: 'firmware non indiqué', os: 'systèmes non indiqués', case: 'coque non indiquée', mount: 'montage non indiqué', hotswap: 'hot-swap non indiqué', soldered: 'hot-swap non indiqué', swmaker: 'switchs non indiqués', swtype: 'type de switch non indiqué', std: 'disposition non indiquée' },
      notPublished: (w) => `non indiqué : ${w}`,
      over: (p, v) => `${p}, plus de ${money(v, 'fr')}`,
      under: (p, v) => `${p}, moins de ${money(v, 'fr')}`,
      onePiece: 'monobloc',
      wired: 'filaire uniquement',
      noOption: (names) => `pas d’option ${names}`,
      noVersion: (names) => `pas de version ${names}`,
      not: (names) => `pas ${names}`,
      ergo: 'forme standard',
    },
    ui: {
      noPrice: 'pas de prix',
      reviews: (n) => (n ? plural(n, 'test', 'tests') : ''),
      discontinued: 'arrêté',
      remove: 'retirer',
      setAsideTitle: 'mis de côté : les claviers en grille ou à décalage en colonnes n’ont pas de décalage ANSI ou ISO',
      notRead: 'non compris :',
      asideNote: (labels) => `${labels} mis de côté : ANSI, ISO et JIS décrivent des claviers à décalage en rangées, que les claviers en grille ou en colonnes ne suivent pas.`,
      kitsToo: 'claviers (kits compris)',
      assembled: 'claviers montés',
      countAll: (pool, what, brands) => `<strong>${pool}</strong> ${what} de ${brands} marques`,
      countMatch: (n, pool, what, groups) => `<strong>${n}</strong> sur ${pool} ${what} ${n > 1 ? 'correspondent' : 'correspond'} ${groups === 1 ? 'à ce filtre' : `aux ${groups} filtres`}`,
      plusKits: (n) => `, plus ${n} kit${n > 1 ? 's' : ''} et PCB`,
      more: (n) => `afficher ${n} de plus`,
      nearTitle: (found, groups) => (found ? 'À un filtre près' : `Aucun clavier ne remplit les ${groups} filtres. Ceux-ci en manquent un`),
      empty: 'Aucun clavier n’approche ces critères à un filtre près. Retirez un filtre ci-dessus pour élargir.',
    },
  },
  de: {
    size: { full: 'volle Größe', tkl: 'TKL', numpad: 'Nummernblock' },
    footprint: { mx: 'MX-kompatibel', 'gateron-lp': 'Gateron Low Profile', 'buckling-spring': 'Buckling Spring', optical: 'optisch', proprietary: 'proprietär', other: 'andere' },
    f: {
      pmin: (v) => `über ${money(v, 'de')}`,
      pmax: (v) => `unter ${money(v, 'de')}`,
      stagger: { column: 'spaltenversetzt', ortholinear: 'ortholinear', row: 'reihenversetzt' },
      split: { 'unibody-angled': 'gewinkelt, einteilig', split: 'split' },
      ergo: 'ergonomisch',
      tent: 'Tenting',
      thumb: 'Daumencluster',
      wells: 'Tastenmulden',
      lp: 'Low Profile',
      compact: 'kompakt (75 % oder kleiner)',
      wiredonly: 'nur kabelgebunden',
      wireless: 'kabellos',
      magnetic: 'magnetisch (Hall-Effekt)',
      rt: 'Rapid Trigger',
      optical: 'optisch',
      hotswap: 'Hot-Swap',
      soldered: 'verlötete Switches',
      swtype: { silent: 'leise Switches', linear: 'lineare Switches', tactile: 'taktile Switches', clicky: 'Clicky-Switches' },
      foot: { choc: 'Choc-Switches', topre: 'Topre-Switches' },
      os: { mac: 'für Mac', linux: 'für Linux' },
      case: { alumin: 'Aluminiumgehäuse', wood: 'Holzgehäuse' },
      mount: { gasket: 'Gasket-Mount' },
      kind: { kit: 'Bausatz', barebones: 'Barebone', prebuilt: 'fertig montiert' },
      swmaker: (n) => `${n}-Switches`,
    },
    spec: { keys: (n) => `${n} Tasten`, columnar: 'spaltenversetzt', ortholinear: 'ortholinear', split: 'split', angled: 'gewinkelt', lp: 'Low Profile', wired: 'kabelgebunden', noConn: 'Verbindung nicht angegeben', magnetic: 'magnetisch', rt: 'Rapid Trigger', hotswap: 'Hot-Swap' },
    miss: {
      unknown: { pmax: 'Preis nicht angegeben', pmin: 'Preis nicht angegeben', fw: 'Firmware nicht angegeben', os: 'Systeme nicht angegeben', case: 'Gehäuse nicht angegeben', mount: 'Montage nicht angegeben', hotswap: 'Hot-Swap nicht angegeben', soldered: 'Hot-Swap nicht angegeben', swmaker: 'Switches nicht angegeben', swtype: 'Switch-Typ nicht angegeben', std: 'Layout nicht angegeben' },
      notPublished: (w) => `${w} nicht angegeben`,
      over: (p, v) => `${p}, über ${money(v, 'de')}`,
      under: (p, v) => `${p}, unter ${money(v, 'de')}`,
      onePiece: 'einteilig',
      wired: 'nur kabelgebunden',
      noOption: (names) => `keine ${names}-Option`,
      noVersion: (names) => `keine ${names}-Version`,
      not: (names) => `nicht ${names}`,
      ergo: 'Standardform',
    },
    ui: {
      noPrice: 'kein Preis',
      reviews: (n) => (n ? plural(n, 'Test', 'Tests') : ''),
      discontinued: 'eingestellt',
      remove: 'entfernen',
      setAsideTitle: 'zurückgestellt: Gitter- und spaltenversetzte Tastaturen haben keinen ANSI- oder ISO-Versatz',
      notRead: 'nicht erkannt:',
      asideNote: (labels) => `${labels} zurückgestellt: ANSI, ISO und JIS beschreiben reihenversetzte Tastaturen, und Gitter- oder spaltenversetzte Tastaturen folgen ihnen nicht.`,
      kitsToo: 'Tastaturen (inklusive Bausätze)',
      assembled: 'fertige Tastaturen',
      countAll: (pool, what, brands) => `<strong>${pool}</strong> ${what} von ${brands} Marken`,
      countMatch: (n, pool, what, groups) => `<strong>${n}</strong> von ${pool} ${what.replace(/^fertige /, 'fertigen ')} passen zu ${groups === 1 ? 'diesem Filter' : `allen ${groups} Filtern`}`,
      plusKits: (n) => `, dazu ${n} ${n > 1 ? 'Bausätze und PCBs' : 'Bausatz oder PCB'}`,
      more: (n) => `${n} weitere zeigen`,
      nearTitle: (found, groups) => (found ? 'Ein Filter daneben' : `Keine Tastatur erfüllt alle ${groups}. Diesen fehlt einer`),
      empty: 'Keine Tastatur kommt bis auf einen Filter heran. Entferne oben einen Filter.',
    },
  },
  es: {
    size: { full: 'tamaño completo', tkl: 'TKL', numpad: 'teclado numérico' },
    footprint: { mx: 'tipo MX', 'gateron-lp': 'Gateron perfil bajo', 'buckling-spring': 'buckling spring', optical: 'óptico', proprietary: 'propietario', other: 'otro' },
    f: {
      pmin: (v) => `más de ${money(v, 'es')}`,
      pmax: (v) => `menos de ${money(v, 'es')}`,
      stagger: { column: 'escalonado por columnas', ortholinear: 'ortolineal', row: 'escalonado por filas' },
      split: { 'unibody-angled': 'de una pieza en ángulo', split: 'split' },
      ergo: 'ergonómico',
      tent: 'tenting',
      thumb: 'teclas para el pulgar',
      wells: 'teclas cóncavas',
      lp: 'perfil bajo',
      compact: 'compacto (75 % o menos)',
      wiredonly: 'solo con cable',
      wireless: 'inalámbrico',
      magnetic: 'magnético (efecto Hall)',
      rt: 'rapid trigger',
      optical: 'óptico',
      hotswap: 'hot-swap',
      soldered: 'switches soldados',
      swtype: { silent: 'switches silenciosos', linear: 'switches lineales', tactile: 'switches táctiles', clicky: 'switches clicky' },
      foot: { choc: 'switches Choc', topre: 'switches Topre' },
      os: { mac: 'compatible con Mac', linux: 'compatible con Linux' },
      case: { alumin: 'carcasa de aluminio', wood: 'carcasa de madera' },
      mount: { gasket: 'montaje gasket' },
      kind: { kit: 'kit', barebones: 'barebone', prebuilt: 'montado' },
      swmaker: (n) => `switches ${n}`,
    },
    spec: { keys: (n) => `${n} teclas`, columnar: 'escalonado por columnas', ortholinear: 'ortolineal', split: 'split', angled: 'en ángulo', lp: 'perfil bajo', wired: 'con cable', noConn: 'conexión no indicada', magnetic: 'magnético', rt: 'rapid trigger', hotswap: 'hot-swap' },
    miss: {
      unknown: { pmax: 'precio no indicado', pmin: 'precio no indicado', fw: 'firmware no indicado', os: 'sistemas no indicados', case: 'carcasa no indicada', mount: 'montaje no indicado', hotswap: 'hot-swap no indicado', soldered: 'hot-swap no indicado', swmaker: 'switches no indicados', swtype: 'tipo de switch no indicado', std: 'distribución no indicada' },
      notPublished: (w) => `no indicado: ${w}`,
      over: (p, v) => `${p}, más de ${money(v, 'es')}`,
      under: (p, v) => `${p}, menos de ${money(v, 'es')}`,
      onePiece: 'de una pieza',
      wired: 'solo con cable',
      noOption: (names) => `sin opción ${names}`,
      noVersion: (names) => `sin versión ${names}`,
      not: (names) => `no ${names}`,
      ergo: 'forma estándar',
    },
    ui: {
      noPrice: 'sin precio',
      reviews: (n) => (n ? plural(n, 'análisis', 'análisis') : ''),
      discontinued: 'descatalogado',
      remove: 'quitar',
      setAsideTitle: 'apartado: los teclados en cuadrícula o escalonados por columnas no tienen escalonado ANSI ni ISO',
      notRead: 'no entendido:',
      asideNote: (labels) => `${labels} apartado: ANSI, ISO y JIS describen teclados escalonados por filas, y los teclados en cuadrícula o por columnas no los siguen.`,
      kitsToo: 'teclados (kits incluidos)',
      assembled: 'teclados montados',
      countAll: (pool, what, brands) => `<strong>${pool}</strong> ${what} de ${brands} marcas`,
      countMatch: (n, pool, what, groups) => `<strong>${n}</strong> de ${pool} ${what} cumplen ${groups === 1 ? 'este filtro' : `los ${groups} filtros`}`,
      plusKits: (n) => `, más ${n} kit${n > 1 ? 's' : ''} y PCB`,
      more: (n) => `mostrar ${n} más`,
      nearTitle: (found, groups) => (found ? 'A un filtro de distancia' : `Ningún teclado cumple los ${groups}. A estos les falta uno`),
      empty: 'Ningún teclado se acerca a esto a falta de un filtro. Quita un filtro de arriba para ampliar.',
    },
  },
};

/** Size and footprint names in a language (build.mjs uses them too). */
export const labels = (lang = 'en') => {
  const t = T[lang];
  const SIZE_LABEL = Object.fromEntries(SIZES.map((s) => [s, t.size[s] ?? pc(lang, s)]));
  const FOOTPRINT = {
    mx: t.footprint.mx, 'choc-v1': 'Choc V1', 'choc-v2': 'Choc V2', 'gateron-lp': t.footprint['gateron-lp'], 'cherry-lp': 'Cherry MX Low Profile',
    'cherry-ulp': 'Cherry MX Ultra Low Profile', alps: 'Alps', topre: 'Topre', 'buckling-spring': t.footprint['buckling-spring'], optical: t.footprint.optical, proprietary: t.footprint.proprietary, other: t.footprint.other,
  };
  return { SIZE_LABEL, FOOTPRINT, FW };
};
export const LABELS = labels('en');

/** The chip text of a filter, in a language. */
export function labelOf(f, lang = 'en') {
  const t = T[lang].f;
  switch (f.key) {
    case 'pmin':
    case 'pmax':
      return t[f.key](f.value);
    case 'size':
      return labels(lang).SIZE_LABEL[f.value];
    case 'std':
      return f.value.toUpperCase();
    case 'conn':
      return f.value === 'bluetooth' ? 'Bluetooth' : '2.4 GHz'.replace('.', lang === 'en' ? '.' : ',');
    case 'fw':
      return FW[f.value];
    case 'swmaker':
      return t.swmaker(f.name);
    case 'brand':
      return f.name;
    case 'name':
      return `“${f.value.join(' ')}”`;
    default: {
      const v = t[f.key];
      return typeof v === 'string' ? v : (v?.[f.value] ?? String(f.value));
    }
  }
}

// ---------- reading the sentence ----------

/**
 * Each rule: a regex over the normalized sentence (lower case, no accents) and the filter it stands for.
 * A filter is { key, value }: filters of one key are OR-ed, keys are AND-ed.
 * Order matters: longer phrases first, so "column staggered" is read before "staggered".
 */
function rules(db) {
  const r = [];
  const add = (re, make) => r.push({ re, make });
  const k = (key, value = true) => () => ({ key, value });
  // Price, in US dollars whatever the sign typed.
  const money = String.raw`\$?\s?(\d[\d,]*)\s?(?:\$|usd|us\$|dollars?|dolares|bucks|cad|eur|euros?|€)?`;
  add(new RegExp(String.raw`\b(?:between|entre|zwischen)\s+${money}\s+(?:and|to|et|und|y|a|-)\s+${money}`), (m) => {
    const a = num(m[1]);
    const b = num(m[2]);
    return [{ key: 'pmin', value: Math.min(a, b) }, { key: 'pmax', value: Math.max(a, b) }];
  });
  add(
    new RegExp(String.raw`\b(?:under|below|less than|max(?:imum)?|up to|at most|no more than|cheaper than|moins de|sous|jusqu'a|au plus|pas plus de|unter|bis|hochstens|maximal|weniger als|billiger als|menos de|por debajo de|hasta|como maximo|maximo|no mas de|<)\s*${money}`),
    (m) => ({ key: 'pmax', value: num(m[1]) }),
  );
  add(new RegExp(String.raw`\b(?:over|above|more than|at least|min(?:imum)?|plus de|au moins|a partir de|uber|mindestens|mehr als|ab|mas de|al menos|minimo|desde|por encima de|>)\s*${money}`), (m) => ({ key: 'pmin', value: num(m[1]) }));
  add(/\$\s?(\d[\d,]*)\b|\b(\d[\d,]*)\s?(?:\$|usd|us\$|dollars?|dolares|euros?|eur|€)/, (m) => ({ key: 'pmax', value: num(m[1] ?? m[2]) }));
  // Shape.
  add(/\bcolumn[\s-]?stagger(?:ed)?\b|\bcolumnar\b|\b(?:decalage|decale|decales) en colonnes?\b|\bspaltenversetzt\w*|\bspaltenversatz\b|\bescalonad[oa]s? por columnas\b|\bcolonnes?\b|\bcolumnas?\b|\bcolumn\b/, k('stagger', 'column'));
  add(/\borth?o(?:lin(?:ear|eaire|eal|eare|earen|earer))?\b|\bgrid\b|\bgrille\b|\bgitter\b|\bcuadricula\b|\bmatri(?:x|ce|z)\b/, k('stagger', 'ortholinear'));
  add(/\brow[\s-]?stagger(?:ed)?\b|\bstaggered\b|\bstandard layout\b|\bdecalage en rangees\b|\breihenversetzt\w*|\bescalonad[oa]s? por filas\b/, k('stagger', 'row'));
  add(/\bunibody\b|\balice\b|\barisu\b|\bangled\b|\ben angle\b|\bgewinkelt\w*|\ben angulo\b/, k('split', 'unibody-angled'));
  add(/\bsplit\b|\bsepare[es]?\b|\bscinde[es]?\b|\ben deux (?:parties|moities)\b|\bgeteilt\w*|\bzweiteilig\w*|\bdividid[oa]s?\b|\bpartid[oa]s?\b|\bseparad[oa]s?\b/, k('split', 'split'));
  add(/\bergonomi\w*|\bergo\b/, k('ergo'));
  add(/\btent(?:ed|ing)?\b/, k('tent'));
  add(/\bthumb (?:cluster|keys?)s?\b|\b(?:touches?|blocs?|cluster) (?:de |du |pour (?:le |les )?)?pouces?\b|\bdaumen(?:tasten|cluster|block)?\b|\b(?:teclas?|grupo|bloque) (?:para (?:el |los )?|de (?:los )?)?pulgar(?:es)?\b/, k('thumb'));
  add(/\bkey ?wells?\b|\bconcav[eo]s?\b|\bcurved\b|\bcuvettes?\b|\bincurve\b|\b(?:tasten)?mulden?\b|\bkonkav\w*/, k('wells'));
  add(/\blow[\s-]?profile\b|\bslim\b|\bflat\b|\bprofil bas\b|\bplat\b|\bflach(?:e|er|en)?\b|\bperfil bajo\b|\bplano\b|\bdelgado\b/, k('lp'));
  // "ainsi" = a common slip for ANSI.
  add(/\bai?nsi\b|\bus[\s-]?layout\b|\b(?:disposition|distribucion|layout) (?:us|americaine?|americana)\b/, k('std', 'ansi'));
  add(/\biso\b|\buk layout\b|\beuropean layout\b|\bazerty\b|\bqwertz\b/, k('std', 'iso'));
  add(/\bjis\b|\bjapanese layout\b/, k('std', 'jis'));
  // Size.
  add(
    /\bfull[\s-]?size(?:d)?\b|\bfull\b|\b100\s?%|\b10[48][\s-]?(?:keys?|touches|tasten|teclas)\b|\bpleine taille\b|\btaille complete\b|\bvolle(?:n|r)? gro(?:ss|ß)e\b|\bvollformat\b|\btamano completo\b|\b(?:avec|mit|con) (?:pave numerique|nummernblock|ziffernblock|teclado numerico)\b/,
    k('size', 'full'),
  );
  add(/\b9[68]\s?%|\b1800\b/, k('size', '96'));
  add(/\btkl\b|\btenkeyless\b|\b80\s?%|\b87[\s-]?(?:keys?|touches|tasten|teclas)\b|\b(?:sans|ohne|sin) (?:pave numerique|nummernblock|ziffernblock|teclado numerico)\b/, k('size', 'tkl'));
  for (const s of ['75', '65', '60', '50', '40', '30']) add(new RegExp(String.raw`\b${s}\s?(?:%|percent|pourcent|pour cent|prozent|por ciento)`), k('size', s));
  add(/\bnum ?pad\b|\bmacro ?pad\b|\bpave numerique\b|\bnummernblock\b|\bziffernblock\b|\bteclado numerico\b/, k('size', 'numpad'));
  add(/\bcompact[eo]?\b|\bsmall\b|\bkompakt\w*|\bklein\w*|\bpetite?\b|\bpequen[oa]\b/, k('compact'));
  // Connection.
  add(/\bwired[\s-]?only\b|\bno wireless\b|\bfilaire\b|\bnur kabel\w*|\bkabelgebunden\b|\bsolo (?:con )?cable\b/, k('wiredonly'));
  add(/\bwireless\b|\bcordless\b|\btri[\s-]?mod[eo]\b|\bsans[\s-]fil\b|\bkabellos\w*|\bdrahtlos\w*|\binalambric[oa]s?\b|\bsin cables?\b/, k('wireless'));
  add(/\bbluetooth\b|\bbt\b/, k('conn', 'bluetooth'));
  add(/\b2[.,]4\s?(?:ghz|g)?\b|\bdongle\b|\breceiver\b|\brecepteur\b|\bempfanger\b|\breceptor\b/, k('conn', '2.4ghz'));
  // Switches and sensing.
  add(
    /\bhall[\s-]?(?:effect|effekt)\b|\b(?:effet|efecto) hall\b|\bmagneti(?:c|que|ques|sch(?:e|en|er)?|co|cos|ca|cas)\b|\bhe\b|\btmr\b|\banalog(?:ue|ique|ico)?\b|\badjustable actuation\b|\bactionnement reglable\b|\bactuacion ajustable\b/,
    k('magnetic'),
  );
  add(/\brapid[\s-]?trigger\b/, k('rt'));
  add(/\boptical\b|\boptiques?\b|\boptisch\w*|\boptic[oa]s?\b/, k('optical'));
  add(/\bsoldered\b|\bno hot[\s-]?swap\b|\bsoudes?\b|\bverlotet\b|\bsoldad[oa]s?\b|\b(?:sans|ohne|sin) hot[\s-]?swap\b/, k('soldered'));
  add(/\bhot[\s-]?swap(?:pable|able)?\b|\bremplacables? a chaud\b/, k('hotswap'));
  add(/\bsilent\b|\bquiet\b|\bsilencieu(?:x|se|ses)\b|\bleise\w*|\bgerauscharm\w*|\bsilencios[oa]s?\b/, k('swtype', 'silent'));
  add(/\blinear\w*|\blineaires?\b|\blineal(?:es)?\b/, k('swtype', 'linear'));
  add(/\btactiles?\b|\btaktil\w*|\btactil(?:es)?\b/, k('swtype', 'tactile'));
  add(/\bclicky\b|\bcliquetants?\b|\bklickend\w*/, k('swtype', 'clicky'));
  add(/\bchoc\b/, k('foot', 'choc'));
  add(/\btopre\b|\belectrocapacitive\b|\bec switch/, k('foot', 'topre'));
  // Firmware, software, systems.
  for (const f of Object.keys(FW)) add(new RegExp(String.raw`\b${f}\b`), k('fw', f));
  add(/\bmac(?:os|book)?\b|\bapple\b/, k('os', 'mac'));
  add(/\blinux\b/, k('os', 'linux'));
  // Build.
  add(/\balumin(?:i)?um\w*|\baluminio\b|\bmetal\b|\bmetall\b|\bcnc\b/, k('case', 'alumin'));
  add(/\bwood(?:en)?\b|\bbois\b|\bholz\w*|\bmadera\b/, k('case', 'wood'));
  add(/\bgasket\b/, k('mount', 'gasket'));
  add(/\bkit\b|\bdiy\b|\bsolder kit\b|\bbausatz\b/, k('kind', 'kit'));
  add(/\bbarebones?\b/, k('kind', 'barebones'));
  add(/\bprebuilt\b|\bassembled\b|\bready to use\b|\bmontes?\b|\bassembles?\b|\bfertig\w*|\bmontiert\b|\bvormontiert\b|\bensamblad[oa]s?\b|\bmontad[oa]s?\b/, k('kind', 'prebuilt'));
  // Brands and switch makers, longest names first. A name that is both reads as the switch maker when a
  // switch word sits next to it ("cherry switches", "switchs cherry"), else as the brand.
  const names = [
    ...db.makers.map((m) => ({ kind: 'swmaker', id: m.id, name: m.name })),
    ...db.brands.map((b) => ({ kind: 'brand', id: b.id, name: b.name })),
  ].sort((a, b) => b.name.length - a.name.length);
  const SW = String.raw`(?:switch(?:es|s)?|schalter)`;
  for (const n of names) {
    const word = normalize(n.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (word.length < 3) continue;
    if (n.kind === 'swmaker')
      add(new RegExp(String.raw`(?:\b${SW}\s+)?\b${word}\b(?:-?${SW}|\s+(?:${SW}|[a-z]+ ${SW}))?`), (m) =>
        new RegExp(SW).test(m[0]) || !db.brands.some((b) => b.id === n.id) ? { key: 'swmaker', value: n.id, name: n.name } : { key: 'brand', value: n.id, name: n.name },
      );
    else add(new RegExp(String.raw`\b${word}\b`), () => ({ key: 'brand', value: n.id, name: n.name }));
  }
  return r;
}

const num = (s) => Number(String(s).replace(/,/g, ''));
const escRe = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Matches a whole word in a name: "q1" in "keychron q1 max", not in "keychron q10 max". */
const wordStart = (w) => new RegExp(`(^|[^a-z0-9])${escRe(w)}($|[^a-z0-9])`);

/** Reads a sentence: the filters it holds (labelled in `lang`), where each came from, and the words left over. */
export function parse(text, db, lang = 'en') {
  const src = normalize(text);
  const taken = new Array(src.length).fill(false);
  const found = [];
  for (const { re, make } of rules(db)) {
    const g = new RegExp(re.source, 'g');
    for (const m of src.matchAll(g)) {
      const start = m.index;
      const end = start + m[0].length;
      if (taken.slice(start, end).some(Boolean) || !m[0].trim()) continue;
      const made = make(m);
      if (!made) continue;
      for (let i = start; i < end; i++) taken[i] = true;
      for (const f of [].concat(made)) found.push({ ...f, start, end, text: text.slice(start, end) });
    }
  }
  found.sort((a, b) => a.start - b.start);
  // Words nobody used.
  const rest = src
    .split('')
    .map((c, i) => (taken[i] ? ' ' : c))
    .join('')
    .split(/[^a-z0-9ß%$.-]+|'/)
    .map((w) => w.replace(/^[.'-]+|[.'-]+$/g, ''))
    .filter((w) => w.length > 1 && !STOP.has(w) && !/^\d+$/.test(w));
  // One filter per key and value.
  const seen = new Set();
  const filters = found.filter((f) => {
    const id = `${f.key}:${f.value}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  // Words left over that name a model ("q1 max") become a name filter, when some board's name holds them all.
  let unknown = [...new Set(rest)];
  if (unknown.length && db.keyboards?.length) {
    const res = unknown.map(wordStart);
    if (db.keyboards.some((k) => res.every((re) => re.test(normalize(`${k.b} ${k.m}`))))) {
      filters.push({ key: 'name', value: unknown, words: unknown });
      unknown = [];
    }
  }
  for (const f of filters) f.label = labelOf(f, lang);
  return { filters, unknown };
}

const ergoShape = (k) => k.split !== 'none' || k.stagger !== 'row' || k.tent === 'built-in' || k.wells === true;

/** true, false, or null when the brand does not publish the value. */
function test(k, f) {
  switch (f.key) {
    case 'std':
      return k.std.length ? k.std.includes(f.value) : k.stagger === 'row' ? null : false;
    case 'stagger':
      return k.stagger === f.value;
    case 'split':
      return k.split === f.value;
    case 'ergo':
      return ergoShape(k);
    case 'tent':
      return k.tent !== 'none';
    case 'thumb':
      return k.thumb;
    case 'wells':
      return k.wells;
    case 'lp':
      return k.lp;
    case 'size':
      return k.size === f.value;
    case 'compact':
      return ['75', '65', '60', '50', '40', '30'].includes(k.size) || (k.size === 'other' && k.keys != null && k.keys <= 84);
    case 'wireless':
      return k.conn.includes('bluetooth') || k.conn.includes('2.4ghz');
    case 'wiredonly':
      return !k.conn.includes('bluetooth') && !k.conn.includes('2.4ghz');
    case 'conn':
      return k.conn.includes(f.value);
    case 'magnetic':
      return k.adj || k.hs === 'magnetic' || k.swsense.includes('magnetic');
    case 'rt':
      return k.rt;
    case 'optical':
      return k.hs === 'optical' || k.foot === 'optical' || k.swsense.includes('optical');
    case 'hotswap':
      return k.hs == null ? null : k.hs !== 'none';
    case 'soldered':
      return k.hs == null ? null : k.hs === 'none';
    case 'swtype':
      if (f.value === 'silent') return k.sw.some((n) => /silent|quiet/i.test(n)) || k.swt.some((t) => t.startsWith('silent')) ? true : k.sw.length ? false : null;
      return k.swt.some((t) => t === f.value || t === `silent-${f.value}`) || k.sw.some((n) => new RegExp(f.value, 'i').test(n)) ? true : k.swt.length ? false : null;
    case 'swmaker':
      return k.swm.includes(f.value) ? true : k.sw.length ? false : null;
    case 'foot':
      return f.value === 'choc' ? k.foot === 'choc-v1' || k.foot === 'choc-v2' : k.foot === f.value;
    case 'fw':
      return k.fw.length ? k.fw.includes(f.value) : null;
    case 'os':
      return k.os.length ? k.os.includes(f.value) : null;
    case 'case':
      return k.case == null ? null : k.case.toLowerCase().includes(f.value);
    case 'mount':
      return k.mount == null ? null : k.mount.toLowerCase().includes(f.value);
    case 'kind':
      return f.value === 'kit' ? k.kind === 'kit' || k.kind === 'pcb' : k.kind === f.value;
    case 'brand':
      return k.brand === f.value;
    case 'name': {
      const name = normalize(`${k.b} ${k.m}`);
      return f.value.every((w) => wordStart(w).test(name));
    }
    case 'pmax':
      return k.price == null ? null : k.price <= f.value;
    case 'pmin':
      return k.price == null ? null : k.price >= f.value;
    default:
      return null;
  }
}

/** What a board lacks for one group of filters, in words. */
function missText(k, group, result, lang) {
  const t = T[lang];
  const f = group[0];
  const names = (fs) => fs.map((g) => g.label ?? labelOf(g, lang));
  const or = { en: 'or', fr: 'ou', de: 'oder', es: 'o' }[lang];
  if (result === null) return t.miss.unknown[f.key] ?? t.miss.notPublished(f.label ?? labelOf(f, lang));
  switch (f.key) {
    case 'pmax':
    case 'pmin':
      return f.key === 'pmax' ? t.miss.over(money(k.price, lang), f.value) : t.miss.under(money(k.price, lang), f.value);
    case 'stagger':
      return t.f.stagger[k.stagger];
    case 'split':
      return k.split === 'none' ? t.miss.onePiece : t.f.split[k.split];
    case 'ergo':
      return t.miss.ergo;
    case 'wireless':
      return t.miss.wired;
    case 'swmaker':
      return t.miss.noOption(group.map((g) => g.name).join(` ${or} `));
    case 'std':
      return t.miss.noVersion(names(group).join(` ${or} `));
    case 'size':
      return k.size === 'other' ? t.spec.keys(k.keys ?? '?') : (labels(lang).SIZE_LABEL[k.size] ?? k.size);
    case 'brand':
      return k.b;
    default:
      return t.miss.not(names(group).join(` ${or} `));
  }
}

/** Groups filters by key; a layout standard is set aside on grid and columnar searches, where it does not apply. */
export function groupsOf(filters) {
  const shape = filters.some((f) => f.key === 'stagger' && f.value !== 'row');
  const groups = new Map();
  const set = [];
  for (const f of filters) {
    if (f.key === 'std' && shape) {
      set.push(f);
      continue;
    }
    if (!groups.has(f.key)) groups.set(f.key, []);
    groups.get(f.key).push(f);
  }
  return { groups: [...groups.values()], setAside: set };
}

/** Every board scored against the groups: exact matches, then boards that miss one group. */
export function evaluate(keyboards, filters, lang = 'en') {
  const { groups, setAside } = groupsOf(filters);
  const exact = [];
  const near = [];
  for (const k of keyboards) {
    let misses = 0;
    let miss = null;
    for (const g of groups) {
      const results = g.map((f) => test(k, f));
      const r = results.some((x) => x === true) ? true : results.some((x) => x === null) ? null : false;
      if (r !== true) {
        misses++;
        miss = missText(k, g, r, lang);
        if (misses > 1) break;
      }
    }
    if (misses === 0) exact.push(k);
    else if (misses === 1) near.push({ k, miss });
  }
  return { exact, near, groups, setAside };
}

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A small drawing of the board's shape: three rows of keys, offset as the board offsets them. */
export const glyph = (k) => {
  const P = 4.4; // key pitch
  const S = 3.6; // key size
  const GAP = 2.8; // between the halves of a split board
  const split = k.split === 'split';
  // Four columns a hand: pinky, ring, middle, index; the right hand mirrors the left.
  const colY = [0.55, 0.15, 0, 0.25, 0.25, 0, 0.15, 0.55];
  const rowX = [0, 0.25, 0.75];
  const parts = [];
  let w = 0;
  let h = 0;
  const key = (x, y, width = S) => {
    parts.push(`<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${width.toFixed(2)}" height="${S}" rx="0.9"/>`);
    w = Math.max(w, x + width);
    h = Math.max(h, y + S);
  };
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 8; c++) {
      let x = c * P + (split && c >= 4 ? GAP : 0);
      let y = r * P;
      if (k.stagger === 'row') x += rowX[r] * P;
      if (k.stagger === 'column') y += colY[c] * P;
      key(x, y);
    }
  }
  if (k.thumb) {
    const y = 3 * P + (k.stagger === 'column' ? 0.55 * P : 0.1 * P);
    if (split) {
      key(3 * P + 0.5, y);
      key(4 * P + GAP - 0.5, y);
    } else key(3 * P, y, 2 * P - (P - S));
  }
  return `<svg class="glyph" viewBox="0 0 ${w.toFixed(2)} ${Math.max(h, 3 * P + 0.55 * P + S).toFixed(2)}" aria-hidden="true">${parts.join('')}</svg>`;
};

/**
 * A photo's URL at a width: Cloudflare Images (base holds "imagedelivery": <base><kind>/<id>/w<size>)
 * or local files (<base><kind>/<id>-<size>.webp).
 */
export const photoUrl = (base, kind, id, size) => (base.includes('imagedelivery') ? `${base}${kind}/${encodeURIComponent(id)}/w${size}` : `${base}${kind}/${encodeURIComponent(id)}-${size}.webp`);

/** The brand's photo when there is one, in a box of the photo's own edge color; else the shape drawing. */
export const thumb = (k, base) =>
  k.img
    ? `<span class="thumb${k.bg ? '' : ' cover'}"${k.bg ? ` style="--bg:${k.bg}"` : ''}><img src="${photoUrl(base, 'keyboard', k.id, 480)}" alt="" loading="lazy" decoding="async"></span>`
    : `<span class="thumb thumb-glyph">${glyph(k)}</span>`;

/** A board's short spec line; the parts a filter asked for are highlighted. */
export const specLine = (k, keys, lang = 'en') => {
  const t = T[lang].spec;
  const { SIZE_LABEL } = labels(lang);
  const bits = [];
  const hit = (key, text) => bits.push(keys.has(key) ? `<span class="hit">${esc(text)}</span>` : esc(text));
  if (k.size !== 'other') hit(keys.has('compact') ? 'compact' : 'size', SIZE_LABEL[k.size] ?? k.size);
  if (k.keys) bits.push(esc(t.keys(k.keys)));
  if (k.stagger !== 'row') hit('stagger', k.stagger === 'column' ? t.columnar : t.ortholinear);
  if (k.split !== 'none') hit('split', k.split === 'split' ? t.split : t.angled);
  if (k.lp) hit('lp', t.lp);
  const wireless = k.conn.filter((c) => c !== 'usb');
  if (wireless.length) hit(keys.has('conn') ? 'conn' : 'wireless', wireless.map((c) => (c === '2.4ghz' ? (lang === 'en' ? '2.4 GHz' : '2,4 GHz') : 'Bluetooth')).join(' + '));
  else bits.push(esc(k.conn.length ? t.wired : t.noConn));
  if (k.adj || k.hs === 'magnetic') hit('magnetic', t.magnetic);
  if (k.rt) hit('rt', t.rt);
  if (k.hs && k.hs !== 'none') hit('hotswap', t.hotswap);
  const makers = k.swmNames.slice(0, 3);
  if (makers.length) hit('swmaker', makers.join(', '));
  if (k.fw.length) hit('fw', k.fw.map((f) => FW[f] ?? f).join(', '));
  return bits.join('<span class="dot" aria-hidden="true"> · </span>');
};

// ---------- page ----------

if (typeof document !== 'undefined') {
  const lang = LANGS.includes(document.documentElement.lang) ? document.documentElement.lang : 'en';
  const ui = T[lang].ui;
  const loc = LOCALE[lang];
  const $ = (s) => document.querySelector(s);
  const input = $('#q');
  const chips = $('#chips');
  const out = $('#results');
  const count = $('#count');
  let IMG = '../../../img/';
  const sortBox = $('#sort');
  let db = null;
  let sort = 'price';
  let limit = 30;
  let kits = new URL(location.href).searchParams.get('kits') === '1';
  const n = (x) => x.toLocaleString(loc);
  // Where keyboard pages live, relative to this page (the record pages of the page's language, or English).
  const KB = out.dataset.kb ?? '../';

  const row = (k, keys, miss) => `<li><a class="result" href="${esc(KB + k.path)}">
      ${thumb(k, IMG)}
      <span class="r-main"><span class="r-name">${esc(k.b)} ${esc(k.m)}</span><span class="r-spec">${specLine(k, keys, lang)}</span>${miss ? `<span class="r-miss"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3.5 3.5l5 5M8.5 3.5l-5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>${esc(miss)}</span>` : ''}</span>
      <span class="r-side"><span class="r-price">${k.price != null ? money(k.price, lang) : `<span class="nil">${esc(ui.noPrice)}</span>`}</span><span class="r-rev">${esc(ui.reviews(k.rev))}</span></span>
    </a></li>`;

  const sorter = {
    price: (a, b) => (a.price ?? 1e9) - (b.price ?? 1e9) || a.name.localeCompare(b.name),
    reviews: (a, b) => b.rev - a.rev || (a.price ?? 1e9) - (b.price ?? 1e9),
    name: (a, b) => a.name.localeCompare(b.name),
  };

  function render() {
    const text = input.value;
    const { filters, unknown } = parse(text, db, lang);
    const { exact, near, groups, setAside } = evaluate(db.keyboards, filters, lang);
    const keys = new Set(filters.map((f) => f.key));

    chips.innerHTML =
      filters
        .map((f, i) => `<button type="button" class="chip${setAside.includes(f) ? ' chip-off' : ''}" data-i="${i}" title="${esc(setAside.includes(f) ? ui.setAsideTitle : ui.remove)}"><span>${esc(f.label)}</span><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3.5 3.5l5 5M8.5 3.5l-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>`)
        .join('') + (unknown.length ? `<span class="unknown">${esc(ui.notRead)} ${unknown.map((w) => `<em>${esc(w)}</em>`).join(', ')}</span>` : '');
    chips.querySelectorAll('.chip').forEach((b) =>
      b.addEventListener('click', () => {
        const f = filters[Number(b.dataset.i)];
        const left = f.words ? text.replace(new RegExp(`\\b(?:${f.words.map(escRe).join('|')})\\b`, 'gi'), '') : text.slice(0, f.start) + text.slice(f.end);
        input.value = left.replace(/\s*,\s*,/g, ',').replace(/\s{2,}/g, ' ').replace(/^[\s,]+|[\s,]+$/g, '');
        update();
        input.focus();
      }),
    );

    const note = setAside.length ? `<p class="aside-note">${esc(ui.asideNote(setAside.map((f) => f.label).join(', ')))}</p>` : '';
    // Assembled boards by default (barebones count: the board is built, switches go in by hand).
    // Kits and PCBs join when the switch is on or the sentence asks for a kind.
    const askedKind = keys.has('kind');
    const kitSwitch = $('#kits');
    kitSwitch.hidden = askedKind;
    const isKit = (k) => k.kind === 'kit' || k.kind === 'pcb';
    const shown = (k) => kits || askedKind || !isKit(k);
    const list = exact.filter(shown).sort(sorter[sort]);
    const hiddenKits = exact.length - list.length;
    const nearShown = near.filter(({ k }) => shown(k));
    const pool = db.keyboards.filter(shown).length;
    const what = kits || askedKind ? ui.kitsToo : ui.assembled;
    if (!groups.length) count.innerHTML = ui.countAll(n(pool), what, db.brands.length);
    else count.innerHTML = `${ui.countMatch(n(list.length), n(pool), what, groups.length)}${hiddenKits ? `<span class="count-more">${ui.plusKits(hiddenKits)}</span>` : ''}`;
    let html = note;
    if (list.length) html += `<ul class="results-list">${list.slice(0, limit).map((k) => row(k, keys)).join('')}</ul>`;
    if (list.length > limit) html += `<button type="button" class="cap-button more" id="more">${esc(ui.more(Math.min(30, list.length - limit)))}</button>`;
    if (groups.length >= 2 && list.length < 8 && nearShown.length) {
      const nearSorted = nearShown.sort((a, b) => sorter[sort](a.k, b.k)).slice(0, 24);
      html += `<h2 class="near-title">${esc(ui.nearTitle(list.length > 0, groups.length))}</h2><ul class="results-list near">${nearSorted.map(({ k, miss }) => row(k, keys, miss)).join('')}</ul>`;
    } else if (groups.length && !list.length) {
      html += `<p class="empty">${esc(ui.empty)}</p>`;
    }
    out.innerHTML = html;
    $('#more')?.addEventListener('click', () => {
      limit += 30;
      render();
    });
  }

  let timer = 0;
  function update() {
    limit = 30;
    const url = new URL(location.href);
    if (input.value.trim()) url.searchParams.set('q', input.value.trim());
    else url.searchParams.delete('q');
    if (kits) url.searchParams.set('kits', '1');
    else url.searchParams.delete('kits');
    history.replaceState(null, '', url);
    render();
  }
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(update, 90);
  });
  document.querySelectorAll('[data-example]').forEach((b) =>
    b.addEventListener('click', () => {
      input.value = b.dataset.example;
      update();
      input.focus();
    }),
  );
  const kitSwitch = $('#kits');
  kitSwitch.setAttribute('aria-checked', String(kits));
  kitSwitch.addEventListener('click', () => {
    kits = !kits;
    kitSwitch.setAttribute('aria-checked', String(kits));
    update();
  });
  sortBox.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-sort]');
    if (!b) return;
    sort = b.dataset.sort;
    sortBox.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    render();
  });

  // One data file for every language, next to this script.
  fetch(new URL('finder-data.json', import.meta.url))
    .then((r) => r.json())
    .then((data) => {
      db = data;
      if (data.photoBase) IMG = data.photoBase;
      for (const k of db.keyboards) k.name = `${k.b} ${k.m}`;
      const q = new URL(location.href).searchParams.get('q');
      if (q) input.value = q;
      render();
      document.body.classList.add('finder-ready');
    });
}
