// The words of the database pages in each language. build.mjs calls strings(lang) once per language and
// passes the result to every page function. English is the reference; the other three follow it sentence for
// sentence. Values that hold a name are functions; the caller escapes what it inserts into HTML.

import { labels, money as finderMoney } from './finder.js';
import { formats } from './i18n.mjs';

const N = ' ';
const s = (n, one, many) => (n === 1 ? one : many);
const lcFirst = (t) => t.replace(/^\p{Lu}(?=\p{Ll})/u, (c) => c.toLowerCase());
const ucFirst = (t) => t.replace(/^\p{Ll}/u, (c) => c.toUpperCase());
/** French "de" before a name: d’Akko, de Gateron. */
const deFr = (name) => (/^[aeiouyàâéèêîôû]/i.test(name) ? `d’${name}` : `de ${name}`);
/** German compounds with a name: "Cooler Master" + "Tastaturen" -> "Cooler-Master-Tastaturen". */
const deCompound = (name, noun) => `${name.replace(/ /g, '-')}-${noun}`;

// ---------- English ----------

function en(f) {
  const article = (w) => (/^[aeiou8]/i.test(w) || /^(?:11|18)/.test(w) ? 'An' : 'A');
  const { FOOTPRINT } = labels('en');
  const CONN = { usb: 'USB', bluetooth: 'Bluetooth', '2.4ghz': '2.4 GHz' };
  const TYPE = { linear: 'linear', tactile: 'tactile', clicky: 'clicky', 'silent-linear': 'silent linear', 'silent-tactile': 'silent tactile' };
  function kbAdj(k, wireless) {
    const adj = [];
    if (k.split === 'split') adj.push('split');
    if (k.split === 'unibody-angled') adj.push('angled one-piece');
    if (k.stagger === 'column') adj.push('column-staggered');
    if (k.stagger === 'ortholinear') adj.push('ortholinear');
    if (k.low_profile) adj.push('low-profile');
    if (k.size === 'full') adj.push('full-size');
    else if (k.size === 'tkl') adj.push('tenkeyless');
    else if (k.size !== 'other' && k.size !== 'numpad') adj.push(`${k.size}%`);
    if (wireless && k.connectivity.some((c) => c !== 'usb')) adj.push('wireless');
    return adj;
  }
  const kbNoun = (k) => (k.size === 'numpad' ? 'numpad' : 'keyboard');
  const swKind = (sw) => {
    const prof = sw.profile === 'low' ? 'low-profile ' : sw.profile === 'ultra-low' ? 'ultra-low-profile ' : '';
    const sense = sw.sensing === 'magnetic' ? 'magnetic ' : sw.sensing === 'optical' ? 'optical ' : '';
    return `${prof}${sense}${TYPE[sw.type]} switch`;
  };
  return {
    nav: { keyboards: 'keyboards', switches: 'switches' },
    foot: (date) => `petitdoigt is a free typing trainer that teaches which finger hits each key. Keyboard and switch specs come from the makers' own pages, checked ${date}. Photos belong to the brands credited under each one.`,
    footLinks: { guides: 'typing guides', keyboards: 'keyboards', finder: 'keyboard finder', switches: 'switches', source: 'source code' },
    skip: 'skip to content',
    sectionsAria: 'sections',
    crumbAria: 'breadcrumb',
    // spec sheet
    nil: 'not published',
    yes: 'yes',
    no: 'no',
    srcAria: (i) => `source ${i}`,
    emptyGroup: (labelsList) => `Not published: ${f.list(labelsList.map((l) => l.toLowerCase()))}.`,
    sources: 'Sources',
    srcKind: { official: 'official', datasheet: 'datasheet', retailer: 'retailer', review: 'review', measurement: 'measurement', reference: 'reference' },
    checked: (d) => `checked ${d}`,
    reviews: 'Reviews',
    readReview: 'read the review',
    reviewsFine: "Each line sums up the review in our words; the score is the outlet's own.",
    noReview: (name) => `No published review of the ${name} turned up when this page was checked.`,
    photo: 'Photo: ',
    photoLine: (line) => `Photo of the ${line} line: `,
    // keyboard page
    hotswap: { none: 'no: switches are soldered', yes: 'yes (socket type not stated)', '3-pin': 'yes, 3-pin sockets', '5-pin': 'yes, 5-pin sockets (take 3 and 5 pins)', choc: 'yes, Choc sockets', magnetic: 'yes, magnetic switches lift out', optical: 'yes, optical sockets', other: 'yes, other sockets' },
    kind: { prebuilt: 'assembled, with switches and keycaps', barebones: 'barebones: no switches or keycaps', kit: 'kit: you assemble it', pcb: 'open design: a PCB or vendor builds' },
    stagger: { row: 'row stagger (classic)', ortholinear: 'ortholinear (grid)', column: 'column stagger (columnar)' },
    split: { none: 'one piece', 'unibody-angled': 'angled one-piece (Alice style)', split: 'split: two halves' },
    tent: { none: 'none', 'built-in': 'built in', accessory: 'with an accessory' },
    conn: CONN,
    sizeOther: (n) => `${n} keys (no standard size)`,
    sizeKeys: (size, n) => `${size}, ${n} keys`,
    kb: {
      shape: 'Shape', size: 'Size', stagger: 'Stagger', split: 'Split', layouts: 'Layouts', tenting: 'Tenting', thumb: 'Thumb cluster', wells: 'Key wells', lp: 'Low profile',
      switches: 'Switches', fits: 'Fits', hotswap: 'Hot-swap', soldWith: 'Sold with', adjustable: 'Adjustable actuation', rt: 'Rapid trigger',
      connection: 'Connection', connects: 'Connects by', battery: 'Battery', polling: 'Polling rate',
      build: 'Build and software', comesAs: 'Comes as', case: 'Case', mount: 'Mount', firmware: 'Firmware', software: 'Software', systems: 'Systems',
      priceStatus: 'Price and status', price: 'Price', status: 'Status', released: 'Released', aka: 'Also sold as',
    },
    ownFirmware: 'the brand’s own',
    priceOn: (store, date) => `on ${store}, ${date}`,
    store: (brand) => `${brand}'s store`,
    status: { current: 'sold now', discontinued: 'discontinued', limited: 'limited run' },
    makerPage: (name) => `${name}'s page`,
    makerSite: (name) => `${name}'s site`,
    nReviews: (n) => `${n} review${s(n, '', 's')}`,
    nSources: (n, date) => `${n} source${s(n, '', 's')}, checked ${date}`,
    finderLink: 'keyboard finder',
    sameShape: 'Boards of the same shape',
    kbDescTail: ' Switch options, sources and reviews.',
    kbTitle: [': specs, switches, price and reviews', ': specs, price and reviews', ': specs and price', ' specs', ''],
    specsName: (name) => `${name} specs`,
    category: 'Computer keyboard',
    kbLede(k, brand) {
      const adj = kbAdj(k, false);
      const noun = kbNoun(k);
      const head = adj.length ? `${article(adj[0])} ${adj.join(', ')} ${noun}` : `${article(noun)} ${noun}`;
      const extras = [];
      if (k.key_count) extras.push(`${k.key_count} keys`);
      if (k.thumb_cluster) extras.push(k.split === 'split' ? 'a thumb cluster on each half' : 'a thumb cluster');
      if (k.tenting === 'built-in') extras.push('built-in tenting');
      if (k.key_wells) extras.push('curved key wells');
      const out = [`${head}${extras.length ? ` with ${f.list(extras)}` : ''}.`];
      const sw = [];
      const foot = FOOTPRINT[k.switch_footprint];
      if (foot && k.switch_footprint !== 'other' && k.switch_footprint !== 'proprietary') sw.push(`It takes ${foot} switches`);
      if (k.hot_swap === 'none') sw.push(sw.length ? 'soldered to the board' : 'Its switches are soldered to the board');
      else if (k.hot_swap) sw.push(sw.length ? 'in hot-swap sockets' : 'Its switches sit in hot-swap sockets');
      if (sw.length) out.push(`${sw.join(', ')}.`);
      if (k.adjustable_actuation) out.push(`You set the actuation point${k.rapid_trigger ? ', and rapid trigger is built in' : ''}.`);
      const wireless = k.connectivity.filter((c) => c !== 'usb').map((c) => CONN[c]);
      if (wireless.length) out.push(`It connects over ${f.list(['USB', ...wireless].filter((x) => x !== 'USB' || k.connectivity.includes('usb')))}.`);
      if (k.price_usd != null) out.push(`${brand.name} lists it at ${f.money(k.price_usd)} (${f.date(k.price_date)}).`);
      return out.join(' ');
    },
    kbAlt(name, k) {
      const adj = kbAdj(k, true);
      const shape = adj.length ? `${adj.join(', ')} ${kbNoun(k)}` : kbNoun(k);
      return `${name}, ${article(shape).toLowerCase()} ${shape}`;
    },
    specLead: (name, lede) => `${name} specs: ${lede.replace(/^(A|An) /, (m) => m.toLowerCase())}`,
    // switch page
    type: TYPE,
    sense: { contact: 'metal contact', magnetic: 'magnetic (Hall effect)', optical: 'optical', capacitive: 'capacitive', inductive: 'inductive' },
    capMount: { mx: 'MX cross', choc: 'Choc', alps: 'Alps', topre: 'Topre', other: 'other' },
    profile: { standard: 'standard height', low: 'low profile', 'ultra-low': 'ultra-low profile' },
    sw: {
      feel: 'Feel', type: 'Type', sensing: 'Sensing', force: 'Actuation force', bump: 'Bump peak', bottom: 'Bottom-out force',
      travel: 'Travel', range: 'Actuation range', pre: 'Pre-travel', total: 'Total travel',
      fit: 'Fit', footprint: 'Footprint', capMount: 'Keycap mount', height: 'Height', pins: 'Pins',
      build: 'Build', top: 'Top housing', bottomH: 'Bottom housing', stem: 'Stem', spring: 'Spring', lubed: 'Factory lubed', lightPipe: 'Light pipe',
      makerStatus: 'Maker and status', soldBy: 'Sold by', madeBy: 'Made by', rated: 'Rated for', status: 'Status', released: 'Released', aka: 'Also sold as',
    },
    mmRange: (a, b) => `${f.num(a)} to ${f.num(b)} mm`,
    pins: (n) => `${n}-pin`,
    presses: (n) => `${f.num(n)} million presses`,
    pressesRange: (a, b) => `${f.num(a)} to ${f.num(b)} million presses`,
    gfRange: (a, b) => `${f.num(a)} to ${f.num(b)} gf`,
    swAlt: (name, sw) => {
      const kind = swKind(sw);
      return `${name}, ${article(kind).toLowerCase()} ${kind}`;
    },
    swLede(sw, maker) {
      const kind = swKind(sw);
      const first = `${article(kind)} ${kind} from ${maker.name}${sw.family && !sw.name.toLowerCase().includes(sw.family.toLowerCase()) ? `, in its ${sw.family} line` : ''}.`;
      const parts = [];
      if (sw.actuation_range_mm) parts.push(`you set its actuation point between ${f.num(sw.actuation_range_mm[0])} and ${f.num(sw.actuation_range_mm[1])} mm`);
      else if (sw.actuation_force_gf && sw.pre_travel_mm) parts.push(`it actuates at ${f.num(sw.actuation_force_gf)} gf after ${f.num(sw.pre_travel_mm)} mm`);
      else if (sw.actuation_force_gf) parts.push(`it actuates at ${f.num(sw.actuation_force_gf)} gf`);
      if (sw.tactile_force_gf) parts.push(`its bump peaks at ${f.num(sw.tactile_force_gf)} gf`);
      if (sw.bottom_out_force_gf) parts.push(`it bottoms out at ${f.num(sw.bottom_out_force_gf)} gf`);
      if (sw.total_travel_mm) parts.push(`it travels ${f.num(sw.total_travel_mm)} mm in all`);
      const second = parts.length ? `${maker.name} says ${f.list(parts)}.` : '';
      const third = sw.rated_lifespan_million ? `It is rated for ${f.num(sw.rated_lifespan_million)} million presses.` : '';
      return [first, second, third].filter(Boolean).join(' ');
    },
    travel: {
      range: (a, b) => `actuation set anywhere from ${f.num(a)} to ${f.num(b)} mm`,
      at: (mm) => `actuates at ${f.num(mm)} mm`,
      aria: (pre, total) => `Key travel: ${pre == null ? '?' : f.num(pre)} mm to actuate, ${f.num(total)} mm in all`,
      rest: 'key at rest',
      bottom: (mm) => `bottom at ${f.num(mm)} mm`,
      caption: "Key travel to scale, from the maker's figures. Ticks every 0.5 mm.",
    },
    force: {
      aria: (n, gf) => `Actuation force of ${n} switches in 5 gf steps; ${f.num(gf)} gf highlighted`,
      caption: (n, gf, lighter, heavier) => `Actuation force of the ${f.num(n)} switches in the petitdoigt switch database that publish one, in steps of 5 gf (the end bars hold everything lighter or heavier). At ${f.num(gf)} gf, ${f.perc(lighter)} of them are lighter and ${f.perc(heavier)} heavier.`,
      title: 'How heavy it is next to other switches',
    },
    soundsLink: 'type with recorded switch sounds',
    boardsWith: 'Keyboards sold with it',
    noBoards: (name) => `No keyboard in the petitdoigt keyboard database lists the ${name} as a factory option.`,
    moreInLine: (family) => `More in the ${family} line`,
    swTitle: [': force, travel and full specs', ': force, travel and specs', ' specs', ''],
    swDescTail: ' Type, fit, build, sources and the keyboards sold with it.',
    // finder
    examples: [
      'ansi, ortholinear, split, wireless keyboard with gateron switches under $500',
      'split columnar with thumb cluster under $300',
      'hall effect 75% with rapid trigger',
      'low profile wireless for mac',
      'ortholinear qmk',
      'tkl with cherry switches, hot-swap',
    ],
    finder: {
      crumb: 'Finder',
      h1: 'Find a keyboard by describing it',
      lede: (n, b) => `Write the keyboard you want in your own words. The finder turns them into filters and searches ${f.num(n)} keyboards from ${b} brands, with specs taken from each brand's own pages.`,
      label: 'Describe the keyboard you want',
      placeholder: 'split wireless keyboard with Gateron switches under $500',
      try: 'try',
      kits: 'kits and PCBs',
      sortAria: 'sort by',
      sort: { price: 'price', reviews: 'reviews', name: 'name' },
      fine: "A blank in a brand's specs stays blank: a board whose brand does not publish a value never matches a filter on it, and shows up under the closest matches with the value marked as not published. Prices are the brand's own, in US dollars.",
      lists: 'Ready-made lists',
      description: (n) => `Search ${n} keyboards by describing them: split, ortholinear, wireless, Hall effect, switch brand, size and price, from each brand's own specs.`,
      appName: 'petitdoigt keyboard finder',
      name: 'Keyboard finder',
      title: 'Keyboard finder: describe the keyboard you want',
    },
    // hubs
    keyboards: 'Keyboards',
    kbHub: {
      lede: (n, b) => `${f.num(n)} keyboards from ${b} brands, each with its specs, the switches it ships with, its price and the reviews that tested it. Every value comes from the brand's own page or a named source.`,
      cta: 'Describe the keyboard you want',
      lists: 'By shape, size and feature',
      brands: 'Brands',
      compared: 'Brands compared',
      description: (n, b) => `${n} keyboards from ${b} brands with specs from the brands' own pages, the switches they ship with, prices and reviews. Split, ergonomic, wireless and more.`,
      title: 'Keyboards: specs, switches, prices and reviews',
    },
    switchesH: 'Switches',
    swHub: {
      h1: 'Keyboard switches',
      lede: (n, m) => `${f.num(n)} switches from ${m} makers, with force, travel, materials and the keyboards that ship with each, from the makers' own spec sheets.`,
      cta: 'How switches work',
      makers: 'Makers',
      compared: 'Makers compared',
      role: { manufacturer: 'factory', brand: 'brand', both: 'factory and brand' },
      description: (n, m) => `${n} keyboard switches from ${m} makers with actuation force, travel, materials and the keyboards that ship with each, from the makers' own spec sheets.`,
      title: 'Keyboard switches: specs from every maker',
    },
    guides: 'Guides',
    moreCompare: 'More comparisons',
    guideNames: {
      'staggered-vs-ortholinear-vs-columnar': 'Staggered, ortholinear or columnar', 'split-keyboard': 'Split keyboards', 'ergonomic-keyboard': 'Ergonomic keyboards', 'keyboard-sizes': 'Keyboard sizes', 'hot-swappable-keyboard': 'Hot-swappable keyboards',
      'linear-vs-tactile-vs-clicky': 'Linear, tactile or clicky', 'red-vs-brown-vs-blue-switches': 'Red, brown or blue', 'quiet-switches': 'Quiet switches', 'hall-effect-switches': 'Hall effect switches', 'switch-specs': 'Reading switch specs', 'switch-manufacturers': 'Who makes switches',
    },
    // brand and maker pages
    brandTitle: (b) => `${b} keyboards`,
    makerTitle: (m) => `${m} switches`,
    nKeyboards: (n) => `${f.num(n)} keyboard${s(n, '', 's')}`,
    nSwitches: (n) => `${f.num(n)} switch${s(n, '', 'es')}`,
    founded: (y) => `founded ${y}`,
    brandDesc: (n, b, about) => `${n} ${b} keyboard${s(n, '', 's')} with specs from ${b}'s own pages, switch options, prices and reviews. ${about}`,
    brandTitleSuffix: [': every model with specs and prices', ': specs and prices', ''],
    makerCaption: (m) => `${m} switches with type, force and travel`,
    makerCols: ['Switch', 'Type', 'Actuation', 'Pre-travel', 'Travel', 'Line'],
    makerDesc: (n, m, about) => `${n} ${m} keyboard switches with actuation force, pre-travel, total travel and type, from ${m}'s own spec sheets. ${about}`,
    makerTitleSuffix: [': force, travel and specs of every model', ': specs of every model', ''],
    // list pages
    listLede({ n, what, brands, kits, prices, wireless, hotswap }) {
      const facts = [`${n} ${what} from ${brands} brand${s(brands, '', 's')} are in the petitdoigt keyboard database${kits ? `, ${kits} of them kits or PCBs you assemble` : ''}.`];
      if (prices) facts.push(`Brand prices run from ${prices.lo} to ${prices.hi}, with half of them under ${prices.med}.`);
      const tail = [wireless != null ? `${wireless} connect wirelessly` : '', hotswap != null ? `${hotswap} take hot-swap switches` : ''].filter(Boolean);
      return { first: facts[0], lede: `${facts.join(' ')}${tail.length ? ` Of these, ${tail.join(' and ')}.` : ''}` };
    },
    listDesc: (name, first, outlets) => `Looking for the best ${lcFirst(name.replace(/keyboards\b/, 'keyboard'))}? ${first} See what ${f.list(outlets)} found in their reviews.`,
    reviewsSay: 'What the reviews say',
    reviewedIntro: (r, outlets, more) =>
      `${r === 1 ? 'One board on this list was' : `${r} boards on this list were`} reviewed by ${f.list(more ? [...outlets, `${more} more outlet${s(more, '', 's')}`] : outlets)}. ${r > 8 ? 'The 8 with the most reviews' : 'Each one'}, with each review summed up in our words:`,
    narrow: 'narrow it down in the finder',
    readGuide: 'read the guide',
    specsChecked: (d) => `specs checked ${d}`,
    all: (n) => `All ${n}`,
    listFine: (limit, n, a) => `This page shows ${limit} of the ${n}, reviewed boards first. ${a(`The finder lists all ${n}`)} and sorts them by price, reviews or name.`,
    moreLists: 'More lists',
    listTitle: (n, reviewed) => (reviewed ? [`: ${n} compared, with what reviewers found`, `: ${n} compared, with reviews`, `: ${n} models compared`, ''] : [`: ${n} models with specs and prices`, `: ${n} models compared`, '']),
    // comparisons
    compare: 'Compare',
    brandCmp: {
      lede(A, B) {
        return [
          `${A.name} has ${A.n} keyboard${s(A.n, '', 's')} in the petitdoigt keyboard database and ${B.name} has ${B.n}.`,
          A.lo && B.lo ? `${A.name}'s run from ${A.lo} to ${A.hi}, half of them under ${A.med}; ${B.name}'s run from ${B.lo} to ${B.hi}, half under ${B.med}.` : '',
          `${A.wireless} of ${A.name}'s boards and ${B.wireless} of ${B.name}'s connect wirelessly, and ${A.hotswap} against ${B.hotswap} take hot-swap switches.`,
        ].filter(Boolean).join(' ');
      },
      range: (lo, hi) => `${lo} to ${hi}`,
      noPrices: 'no prices published',
      rows: { n: 'Keyboards in the database', range: 'Price range', median: 'Median price', sizes: 'Sizes', wireless: 'Wireless', hotswap: 'Hot-swap', lp: 'Low profile', adjustable: 'Adjustable actuation', rt: 'Rapid trigger', qmk: 'QMK, VIA or Vial', aluminum: 'Aluminum case', makers: 'Switch makers', reviews: 'Reviews in the database', country: 'Based in', founded: 'Founded' },
      nNow: (n, c) => `${n} (${c} sold now)`,
      share: (n, of, p) => `${n} of ${of} (${p})`,
      reviewsOn: (r, b) => `${r} on ${b} board${s(b, '', 's')}`,
      caption: (t) => `${t}, side by side`,
      sizeCaption: 'Models by size and the cheapest of each',
      size: 'Size',
      sizeCell: (n, link, price) => `${n} model${s(n, '', 's')}${link ? `, from ${link} at ${price}` : ''}`,
      none: 'none',
      h1: (t) => `${t}: lineups, prices and specs side by side`,
      every: (b) => `every ${b} keyboard`,
      side: 'Side by side',
      fine: 'Counts cover the keyboards each brand lists on its own site, current and discontinued, as the petitdoigt keyboard database holds them. A value a brand does not publish counts as absent.',
      bySize: 'By size',
      most: (b) => `${b}: the most reviewed`,
      two: 'The two brands',
      ldName: (t) => `${t}: keyboards compared`,
      titleSuffix: [': keyboards, prices and specs compared', ': keyboards compared', ' keyboards', ''],
    },
    makerCmp: {
      title: (a, b) => `${a} vs ${b} switches`,
      lede(A, B) {
        return [
          `The petitdoigt switch database holds ${A.n} ${A.name} switches and ${B.n} from ${B.name}.`,
          A.med && B.med ? `Half of ${A.name}'s actuate under ${A.med} gf and half of ${B.name}'s under ${B.med} gf, by the makers' own figures.` : '',
          `${A.boards} keyboards in the database ship with a ${A.name} switch option and ${B.boards} with a ${B.name} one.`,
        ].filter(Boolean).join(' ');
      },
      rows: { n: 'Switches in the database', magnetic: 'Magnetic (Hall effect)', optical: 'Optical', lp: 'Low profile', force: 'Actuation force', medForce: 'Median actuation force', medTravel: 'Median total travel', lubed: 'Factory lubed', life: 'Rated lifespan', boards: 'Keyboards sold with them' },
      typeCaption: 'Median actuation force by switch type',
      type: 'Type',
      typeCell: (n, med) => `${n} switch${s(n, '', 'es')}${med != null ? `, median ${f.num(med)} gf` : ''}`,
      noLines: 'no named lines',
      h1: (t) => `${t}: force, types and lines side by side`,
      finderQ: (m) => `${m} switches`,
      boardsWith: (m) => `keyboards with ${m} switches`,
      fine: "Forces and travel are the makers' published figures, not measurements. A switch whose maker publishes no figure is left out of the medians.",
      byType: 'By type',
      lines: 'Their lines',
      every: (m) => `every ${m} switch`,
      two: 'The two makers',
      whoMakes: 'who makes keyboard switches',
      rbb: 'red, brown or blue',
      ldName: (t) => `${t} compared`,
      titleSuffix: [': force, types and lines compared', ' compared', ''],
    },
  };
}

// ---------- French ----------

function fr(f) {
  const { FOOTPRINT } = labels('fr');
  const FOOT = { ...FOOTPRINT, mx: 'de type MX', optical: 'optiques', 'buckling-spring': 'buckling spring' };
  const CONN = { usb: 'USB', bluetooth: 'Bluetooth', '2.4ghz': '2,4 GHz' };
  const TYPE = { linear: 'linéaire', tactile: 'tactile', clicky: 'clicky', 'silent-linear': 'linéaire silencieux', 'silent-tactile': 'tactile silencieux' };
  /** "clavier 75 % split, ortholinéaire et profil bas" */
  function kbHead(k, wireless) {
    const noun = k.size === 'numpad' ? 'pavé numérique' : 'clavier';
    const size = k.size === 'full' ? 'pleine taille' : k.size === 'tkl' ? 'TKL' : k.size !== 'other' && k.size !== 'numpad' ? `${k.size}${N}%` : '';
    const adj = [];
    if (k.split === 'split') adj.push('split');
    if (k.split === 'unibody-angled') adj.push('monobloc en angle');
    if (k.stagger === 'column') adj.push('à décalage en colonnes');
    if (k.stagger === 'ortholinear') adj.push('ortholinéaire');
    if (k.low_profile) adj.push('profil bas');
    if (wireless && k.connectivity.some((c) => c !== 'usb')) adj.push('sans fil');
    return [noun, size, f.list(adj)].filter(Boolean).join(' ');
  }
  const swKind = (sw) => {
    const sense = sw.sensing === 'magnetic' ? ' magnétique' : sw.sensing === 'optical' ? ' optique' : '';
    const prof = sw.profile === 'low' ? ' profil bas' : sw.profile === 'ultra-low' ? ' profil ultra-bas' : '';
    return `switch ${TYPE[sw.type]}${sense}${prof}`;
  };
  const million = (n) => `${f.num(n)} million${n >= 2 ? 's' : ''}`;
  return {
    nav: { keyboards: 'claviers', switches: 'switchs' },
    foot: (date) => `petitdoigt est un entraîneur de frappe gratuit qui apprend quel doigt frappe chaque touche. Les caractéristiques des claviers et des switchs viennent des pages des fabricants, vérifiées le ${date}. Les photos appartiennent aux marques créditées sous chacune.`,
    footLinks: { guides: 'guides de frappe', keyboards: 'claviers', finder: 'recherche de clavier', switches: 'switchs', source: 'code source' },
    skip: 'aller au contenu',
    sectionsAria: 'sections',
    crumbAria: 'fil d’Ariane',
    nil: 'non indiqué',
    yes: 'oui',
    no: 'non',
    srcAria: (i) => `source ${i}`,
    emptyGroup: (labelsList) => `Non indiqué${N}: ${f.list(labelsList.map((l) => l.toLowerCase()))}.`,
    sources: 'Sources',
    srcKind: { official: 'officielle', datasheet: 'fiche technique', retailer: 'revendeur', review: 'test', measurement: 'mesure', reference: 'référence' },
    checked: (d) => `vérifiée le ${d}`,
    reviews: 'Tests',
    readReview: 'lire le test (en anglais)',
    reviewsFine: `Chaque ligne résume le test avec nos mots${N}; la note est celle du média. Les tests sont en anglais.`,
    noReview: (name) => `Aucun test publié du ${name} n’a été trouvé lors de la vérification de cette page.`,
    photo: `Photo${N}: `,
    photoLine: (line) => `Photo de la gamme ${line}${N}: `,
    hotswap: { none: 'non : switchs soudés', yes: 'oui (type de socket non indiqué)', '3-pin': 'oui, sockets 3 broches', '5-pin': 'oui, sockets 5 broches (acceptent 3 et 5 broches)', choc: 'oui, sockets Choc', magnetic: 'oui, les switchs magnétiques se retirent', optical: 'oui, sockets optiques', other: 'oui, autres sockets' },
    kind: { prebuilt: 'monté, avec switchs et keycaps', barebones: 'barebone : sans switchs ni keycaps', kit: 'kit : vous l’assemblez', pcb: 'projet ouvert : un PCB ou des montages de revendeurs' },
    stagger: { row: 'décalage en rangées (classique)', ortholinear: 'ortholinéaire (grille)', column: 'décalage en colonnes' },
    split: { none: 'monobloc', 'unibody-angled': 'monobloc en angle (style Alice)', split: 'split : deux moitiés' },
    tent: { none: 'aucun', 'built-in': 'intégré', accessory: 'avec un accessoire' },
    conn: CONN,
    sizeOther: (n) => `${n} touches (pas de taille standard)`,
    sizeKeys: (size, n) => `${size}, ${n} touches`,
    kb: {
      shape: 'Forme', size: 'Taille', stagger: 'Décalage', split: 'Split', layouts: 'Dispositions', tenting: 'Tenting', thumb: 'Bloc de pouce', wells: 'Cuvettes de touches', lp: 'Profil bas',
      switches: 'Switchs', fits: 'Accepte', hotswap: 'Hot-swap', soldWith: 'Vendu avec', adjustable: 'Actionnement réglable', rt: 'Rapid trigger',
      connection: 'Connexion', connects: 'Se connecte en', battery: 'Batterie', polling: 'Taux d’interrogation',
      build: 'Fabrication et logiciel', comesAs: 'Livré', case: 'Coque', mount: 'Montage', firmware: 'Firmware', software: 'Logiciel', systems: 'Systèmes',
      priceStatus: 'Prix et statut', price: 'Prix', status: 'Statut', released: 'Sortie', aka: 'Aussi vendu sous le nom',
    },
    ownFirmware: 'propre à la marque',
    priceOn: (store, date) => `sur ${store}, ${date}`,
    store: (brand) => `la boutique ${brand}`,
    status: { current: 'en vente', discontinued: 'arrêté', limited: 'série limitée' },
    makerPage: (name) => `page ${deFr(name)}`,
    makerSite: (name) => `site ${deFr(name)}`,
    nReviews: (n) => `${n} test${s(n, '', 's')}`,
    nSources: (n, date) => `${n} source${s(n, '', 's')}, vérifiée${s(n, '', 's')} le ${date}`,
    finderLink: 'recherche de clavier',
    sameShape: 'Claviers de même forme',
    kbDescTail: ' Options de switchs, sources et tests.',
    kbTitle: [`${N}: caractéristiques, switchs, prix et tests`, `${N}: caractéristiques, prix et tests`, `${N}: caractéristiques et prix`, `${N}: caractéristiques`, ''],
    specsName: (name) => `Caractéristiques du ${name}`,
    category: 'Clavier d’ordinateur',
    kbLede(k, brand) {
      const extras = [];
      if (k.key_count) extras.push(`${k.key_count} touches`);
      if (k.thumb_cluster) extras.push(k.split === 'split' ? 'un bloc de pouce sur chaque moitié' : 'un bloc de pouce');
      if (k.tenting === 'built-in') extras.push('un tenting intégré');
      if (k.key_wells) extras.push('des cuvettes de touches incurvées');
      const out = [`Un ${kbHead(k, false)}${extras.length ? `, avec ${f.list(extras)}` : ''}.`];
      const foot = FOOT[k.switch_footprint];
      const takes = foot && k.switch_footprint !== 'other' && k.switch_footprint !== 'proprietary';
      if (takes && k.hot_swap === 'none') out.push(`Il accepte les switchs ${foot}, soudés à la carte.`);
      else if (takes && k.hot_swap) out.push(`Il accepte les switchs ${foot}, montés sur des sockets hot-swap.`);
      else if (takes) out.push(`Il accepte les switchs ${foot}.`);
      else if (k.hot_swap === 'none') out.push('Ses switchs sont soudés à la carte.');
      else if (k.hot_swap) out.push('Ses switchs se montent sur des sockets hot-swap.');
      if (k.adjustable_actuation) out.push(`Vous réglez le point d’actionnement${k.rapid_trigger ? ', et le rapid trigger est intégré' : ''}.`);
      const wireless = k.connectivity.filter((c) => c !== 'usb').map((c) => CONN[c]);
      if (wireless.length) out.push(`Il se connecte en ${f.list(['USB', ...wireless].filter((x) => x !== 'USB' || k.connectivity.includes('usb')))}.`);
      if (k.price_usd != null) out.push(`${brand.name} l’affiche à ${f.money(k.price_usd)} (${f.date(k.price_date)}).`);
      return out.join(' ');
    },
    kbAlt: (name, k) => `${name}, un ${kbHead(k, true)}`,
    specLead: (name, lede) => `Caractéristiques du ${name}${N}: ${lcFirst(lede)}`,
    type: TYPE,
    sense: { contact: 'contact métallique', magnetic: 'magnétique (effet Hall)', optical: 'optique', capacitive: 'capacitif', inductive: 'inductif' },
    capMount: { mx: 'croix MX', choc: 'Choc', alps: 'Alps', topre: 'Topre', other: 'autre' },
    profile: { standard: 'hauteur standard', low: 'profil bas', 'ultra-low': 'profil ultra-bas' },
    sw: {
      feel: 'Ressenti', type: 'Type', sensing: 'Détection', force: 'Force d’actionnement', bump: 'Pic de la bosse', bottom: 'Force en fin de course',
      travel: 'Course', range: 'Plage d’actionnement', pre: 'Pré-course', total: 'Course totale',
      fit: 'Compatibilité', footprint: 'Empreinte', capMount: 'Fixation des keycaps', height: 'Hauteur', pins: 'Broches',
      build: 'Fabrication', top: 'Boîtier supérieur', bottomH: 'Boîtier inférieur', stem: 'Tige', spring: 'Ressort', lubed: 'Lubrifié en usine', lightPipe: 'Guide de lumière',
      makerStatus: 'Fabricant et statut', soldBy: 'Vendu par', madeBy: 'Fabriqué par', rated: 'Durée de vie', status: 'Statut', released: 'Sortie', aka: 'Aussi vendu sous le nom',
    },
    mmRange: (a, b) => `${f.num(a)} à ${f.num(b)}${N}mm`,
    pins: (n) => `${n} broches`,
    presses: (n) => `${million(n)} de frappes`,
    pressesRange: (a, b) => `${f.num(a)} à ${million(b)} de frappes`,
    gfRange: (a, b) => `${f.num(a)} à ${f.num(b)}${N}gf`,
    swAlt: (name, sw) => `${name}, un ${swKind(sw)}`,
    swLede(sw, maker) {
      const first = `Un ${swKind(sw)} ${deFr(maker.name)}${sw.family && !sw.name.toLowerCase().includes(sw.family.toLowerCase()) ? `, dans sa gamme ${sw.family}` : ''}.`;
      const parts = [];
      if (sw.actuation_range_mm) parts.push(`vous réglez son point d’actionnement entre ${f.num(sw.actuation_range_mm[0])} et ${f.num(sw.actuation_range_mm[1])}${N}mm`);
      else if (sw.actuation_force_gf && sw.pre_travel_mm) parts.push(`il s’actionne à ${f.num(sw.actuation_force_gf)}${N}gf après ${f.num(sw.pre_travel_mm)}${N}mm`);
      else if (sw.actuation_force_gf) parts.push(`il s’actionne à ${f.num(sw.actuation_force_gf)}${N}gf`);
      if (sw.tactile_force_gf) parts.push(`sa bosse culmine à ${f.num(sw.tactile_force_gf)}${N}gf`);
      if (sw.bottom_out_force_gf) parts.push(`il arrive en fin de course à ${f.num(sw.bottom_out_force_gf)}${N}gf`);
      if (sw.total_travel_mm) parts.push(`sa course totale est de ${f.num(sw.total_travel_mm)}${N}mm`);
      const second = parts.length ? `Selon ${maker.name}, ${f.list(parts)}.` : '';
      const third = sw.rated_lifespan_million ? `Il est donné pour ${million(sw.rated_lifespan_million)} de frappes.` : '';
      return [first, second, third].filter(Boolean).join(' ');
    },
    travel: {
      range: (a, b) => `actionnement réglable de ${f.num(a)} à ${f.num(b)}${N}mm`,
      at: (mm) => `s’actionne à ${f.num(mm)}${N}mm`,
      aria: (pre, total) => `Course de la touche${N}: ${pre == null ? '?' : f.num(pre)}${N}mm pour l’actionner, ${f.num(total)}${N}mm au total`,
      rest: 'touche au repos',
      bottom: (mm) => `fin de course à ${f.num(mm)}${N}mm`,
      caption: 'Course de la touche à l’échelle, d’après les chiffres du fabricant. Une graduation tous les 0,5 mm.',
    },
    force: {
      aria: (n, gf) => `Force d’actionnement de ${n} switchs par pas de 5 gf${N}; ${f.num(gf)}${N}gf en surbrillance`,
      caption: (n, gf, lighter, heavier) => `Force d’actionnement des ${f.num(n)} switchs de la base de données petitdoigt qui en publient une, par pas de 5 gf (les barres des extrémités regroupent tout ce qui est plus léger ou plus lourd). À ${f.num(gf)}${N}gf, ${f.perc(lighter)} d’entre eux sont plus légers et ${f.perc(heavier)} plus lourds.`,
      title: 'Son poids face aux autres switchs',
    },
    soundsLink: 'tapez avec des sons de switchs enregistrés',
    boardsWith: 'Claviers vendus avec ce switch',
    noBoards: (name) => `Aucun clavier de la base de données petitdoigt ne propose le ${name} d’origine.`,
    moreInLine: (family) => `Autres switchs de la gamme ${family}`,
    swTitle: [`${N}: force, course et fiche technique`, `${N}: force, course et caractéristiques`, `${N}: caractéristiques`, ''],
    swDescTail: ' Type, compatibilité, fabrication, sources et claviers vendus avec.',
    examples: [
      'clavier split ortholinéaire sans fil avec switchs gateron à moins de 500 $',
      'split à décalage en colonnes avec bloc de pouce, moins de 300 $',
      'effet hall 75 % avec rapid trigger',
      'profil bas sans fil pour mac',
      'ortholinéaire qmk',
      'tkl avec switchs cherry, hot swap',
    ],
    finder: {
      crumb: 'Recherche',
      h1: 'Trouvez un clavier en le décrivant',
      lede: (n, b) => `Décrivez le clavier que vous cherchez avec vos propres mots, en français ou en anglais. La recherche les transforme en filtres et parcourt ${f.num(n)} claviers de ${b} marques, avec des caractéristiques tirées des pages de chaque marque.`,
      label: 'Décrivez le clavier que vous cherchez',
      placeholder: 'clavier split sans fil avec switchs Gateron à moins de 500 $',
      try: 'essayez',
      kits: 'kits et PCB',
      sortAria: 'trier par',
      sort: { price: 'prix', reviews: 'tests', name: 'nom' },
      fine: `Une valeur que la marque ne publie pas reste vide${N}: un clavier dont la marque ne publie pas une valeur ne correspond jamais à un filtre sur cette valeur, et apparaît parmi les résultats les plus proches avec la mention «${N}non indiqué${N}». Les prix sont ceux de la marque, en dollars américains.`,
      lists: 'Listes toutes prêtes',
      description: (n) => `Cherchez parmi ${n} claviers en les décrivant${N}: split, ortholinéaire, sans fil, effet Hall, marque de switchs, taille et prix, d’après les caractéristiques de chaque marque.`,
      appName: 'recherche de claviers petitdoigt',
      name: 'Recherche de clavier',
      title: `Trouver un clavier${N}: décrivez celui que vous voulez`,
    },
    keyboards: 'Claviers',
    kbHub: {
      lede: (n, b) => `${f.num(n)} claviers de ${b} marques, chacun avec ses caractéristiques, les switchs avec lesquels il est vendu, son prix et les tests qui l’ont évalué. Chaque valeur vient de la page de la marque ou d’une source citée.`,
      cta: 'Décrivez le clavier que vous voulez',
      lists: 'Par forme, taille et fonction',
      brands: 'Marques',
      compared: 'Marques comparées',
      description: (n, b) => `${n} claviers de ${b} marques, avec les caractéristiques des pages des marques, les switchs livrés, les prix et les tests. Split, ergonomiques, sans fil et plus.`,
      title: `Claviers${N}: caractéristiques, switchs, prix et tests`,
    },
    switchesH: 'Switchs',
    swHub: {
      h1: 'Switchs de clavier',
      lede: (n, m) => `${f.num(n)} switchs de ${m} fabricants, avec force, course, matériaux et les claviers vendus avec chacun, d’après les fiches techniques des fabricants.`,
      cta: 'Comment fonctionnent les switchs',
      makers: 'Fabricants',
      compared: 'Fabricants comparés',
      role: { manufacturer: 'usine', brand: 'marque', both: 'usine et marque' },
      description: (n, m) => `${n} switchs de clavier de ${m} fabricants, avec force d’actionnement, course, matériaux et les claviers vendus avec chacun, d’après les fiches techniques des fabricants.`,
      title: `Switchs de clavier${N}: les caractéristiques de chaque fabricant`,
    },
    guides: 'Guides',
    moreCompare: 'Autres comparatifs',
    guideNames: {
      'staggered-vs-ortholinear-vs-columnar': 'Décalé, ortholinéaire ou en colonnes', 'split-keyboard': 'Claviers split', 'ergonomic-keyboard': 'Claviers ergonomiques', 'keyboard-sizes': 'Tailles de clavier', 'hot-swappable-keyboard': 'Claviers hot-swap',
      'linear-vs-tactile-vs-clicky': 'Linéaire, tactile ou clicky', 'red-vs-brown-vs-blue-switches': 'Rouge, marron ou bleu', 'quiet-switches': 'Switchs silencieux', 'hall-effect-switches': 'Switchs à effet Hall', 'switch-specs': 'Lire la fiche d’un switch', 'switch-manufacturers': 'Qui fabrique les switchs',
    },
    brandTitle: (b) => `Claviers ${b}`,
    makerTitle: (m) => `Switchs ${m}`,
    nKeyboards: (n) => `${f.num(n)} clavier${s(n, '', 's')}`,
    nSwitches: (n) => `${f.num(n)} switch${s(n, '', 's')}`,
    founded: (y) => `fondée en ${y}`,
    brandDesc: (n, b, about) => `${n} clavier${s(n, '', 's')} ${b} avec les caractéristiques des pages ${deFr(b)}, options de switchs, prix et tests. ${about}`,
    brandTitleSuffix: [`${N}: tous les modèles, caractéristiques et prix`, `${N}: caractéristiques et prix`, ''],
    makerCaption: (m) => `Switchs ${m}${N}: type, force et course`,
    makerCols: ['Switch', 'Type', 'Actionnement', 'Pré-course', 'Course', 'Gamme'],
    makerDesc: (n, m, about) => `${n} switchs ${m} avec force d’actionnement, pré-course, course totale et type, d’après les fiches techniques ${deFr(m)}. ${about}`,
    makerTitleSuffix: [`${N}: force, course et caractéristiques de chaque modèle`, `${N}: caractéristiques de chaque modèle`, ''],
    listLede({ n, what, brands, kits, prices, wireless, hotswap }) {
      const first = `La base de données petitdoigt compte ${n} ${what}, ${brands === 1 ? 'd’une seule marque' : `de ${brands} marques`}${kits ? `, dont ${kits} kits ou PCB à monter` : ''}.`;
      const facts = [first];
      if (prices) facts.push(`Les prix des marques vont de ${prices.lo} à ${prices.hi}, et la moitié coûtent moins de ${prices.med}.`);
      const tail = [wireless != null ? `${wireless} se connectent sans fil` : '', hotswap != null ? `${hotswap} acceptent des switchs hot-swap` : ''].filter(Boolean);
      return { first, lede: `${facts.join(' ')}${tail.length ? ` Parmi eux, ${tail.join(' et ')}.` : ''}` };
    },
    listDesc: (name, first, outlets) => `Les meilleurs ${lcFirst(name)}${N}? ${first} Ce qu’en disent ${f.list(outlets)} dans leurs tests.`,
    reviewsSay: 'Ce qu’en disent les tests',
    reviewedIntro: (r, outlets, more) =>
      `${r === 1 ? 'Un clavier de cette liste a été testé' : `${r} claviers de cette liste ont été testés`} par ${f.list(more ? [...outlets, `${more} autre${s(more, '', 's')} média${s(more, '', 's')}`] : outlets)}. ${r > 8 ? 'Les 8 les plus testés' : 'Chacun'}, avec chaque test résumé avec nos mots${N}:`,
    narrow: 'affiner dans la recherche',
    readGuide: 'lire le guide',
    specsChecked: (d) => `caractéristiques vérifiées le ${d}`,
    all: (n) => `Les ${n} claviers`,
    listFine: (limit, n, a) => `Cette page en montre ${limit} sur ${n}, les claviers testés d’abord. ${a(`La recherche liste les ${n}`)} et les trie par prix, tests ou nom.`,
    moreLists: 'Autres listes',
    listTitle: (n, reviewed) => (reviewed ? [`${N}: ${n} comparés, avec l’avis des testeurs`, `${N}: ${n} comparés, avec les tests`, `${N}: ${n} modèles comparés`, ''] : [`${N}: ${n} modèles, caractéristiques et prix`, `${N}: ${n} modèles comparés`, '']),
    compare: 'Comparatif',
    brandCmp: {
      lede(A, B) {
        return [
          `La base de données petitdoigt compte ${A.n} clavier${s(A.n, '', 's')} ${A.name} et ${B.n} ${B.name}.`,
          A.lo && B.lo ? `Ceux ${deFr(A.name)} vont de ${A.lo} à ${A.hi}, la moitié sous ${A.med}${N}; ceux ${deFr(B.name)} vont de ${B.lo} à ${B.hi}, la moitié sous ${B.med}.` : '',
          `${A.wireless} des claviers ${A.name} et ${B.wireless} de ceux ${deFr(B.name)} se connectent sans fil, et ${A.hotswap} contre ${B.hotswap} acceptent des switchs hot-swap.`,
        ].filter(Boolean).join(' ');
      },
      range: (lo, hi) => `${lo} à ${hi}`,
      noPrices: 'aucun prix publié',
      rows: { n: 'Claviers dans la base', range: 'Fourchette de prix', median: 'Prix médian', sizes: 'Tailles', wireless: 'Sans fil', hotswap: 'Hot-swap', lp: 'Profil bas', adjustable: 'Actionnement réglable', rt: 'Rapid trigger', qmk: 'QMK, VIA ou Vial', aluminum: 'Coque en aluminium', makers: 'Fabricants de switchs', reviews: 'Tests dans la base', country: 'Pays', founded: 'Fondée en' },
      nNow: (n, c) => `${n} (${c} en vente)`,
      share: (n, of, p) => `${n} sur ${of} (${p})`,
      reviewsOn: (r, b) => `${r} test${s(r, '', 's')} portant sur ${b} clavier${s(b, '', 's')}`,
      caption: (t) => `${t}, côte à côte`,
      sizeCaption: 'Modèles par taille et le moins cher de chacune',
      size: 'Taille',
      sizeCell: (n, link, price) => `${n} modèle${s(n, '', 's')}${link ? `, à partir du ${link} à ${price}` : ''}`,
      none: 'aucun',
      h1: (t) => `${t}${N}: gammes, prix et caractéristiques côte à côte`,
      every: (b) => `tous les claviers ${b}`,
      side: 'Côte à côte',
      fine: 'Les chiffres portent sur les claviers que chaque marque présente sur son site, actuels et arrêtés, tels que la base de données petitdoigt les recense. Une valeur que la marque ne publie pas compte comme absente.',
      bySize: 'Par taille',
      most: (b) => `${b}${N}: les plus testés`,
      two: 'Les deux marques',
      ldName: (t) => `${t}${N}: claviers comparés`,
      titleSuffix: [`${N}: claviers, prix et caractéristiques comparés`, `${N}: claviers comparés`, ''],
    },
    makerCmp: {
      title: (a, b) => `Switchs ${a} vs ${b}`,
      lede(A, B) {
        return [
          `La base de données petitdoigt compte ${A.n} switchs ${A.name} et ${B.n} ${B.name}.`,
          A.med && B.med ? `D’après les chiffres des fabricants, la moitié des switchs ${A.name} s’actionnent sous ${A.med}${N}gf et la moitié des ${B.name} sous ${B.med}${N}gf.` : '',
          `Dans la base, ${A.boards} claviers sont proposés avec une option de switch ${A.name} et ${B.boards} avec une option ${B.name}.`,
        ].filter(Boolean).join(' ');
      },
      rows: { n: 'Switchs dans la base', magnetic: 'Magnétiques (effet Hall)', optical: 'Optiques', lp: 'Profil bas', force: 'Force d’actionnement', medForce: 'Force d’actionnement médiane', medTravel: 'Course totale médiane', lubed: 'Lubrifiés en usine', life: 'Durée de vie annoncée', boards: 'Claviers vendus avec' },
      typeCaption: 'Force d’actionnement médiane par type de switch',
      type: 'Type',
      typeCell: (n, med) => `${n} switch${s(n, '', 's')}${med != null ? `, médiane ${f.num(med)}${N}gf` : ''}`,
      noLines: 'aucune gamme nommée',
      h1: (t) => `${t}${N}: force, types et gammes côte à côte`,
      finderQ: (m) => `switchs ${m}`,
      boardsWith: (m) => `claviers avec switchs ${m}`,
      fine: 'Les forces et les courses sont les chiffres publiés par les fabricants, pas des mesures. Un switch sans chiffre publié est exclu des médianes.',
      byType: 'Par type',
      lines: 'Leurs gammes',
      every: (m) => `tous les switchs ${m}`,
      two: 'Les deux fabricants',
      whoMakes: 'qui fabrique les switchs',
      rbb: 'rouge, marron ou bleu',
      ldName: (t) => `${t} comparés`,
      titleSuffix: [`${N}: force, types et gammes comparés`, ' comparés', ''],
    },
  };
}

// ---------- German ----------

function de(f) {
  const CONN = { usb: 'USB', bluetooth: 'Bluetooth', '2.4ghz': '2,4 GHz' };
  const TYPE = { linear: 'linear', tactile: 'taktil', clicky: 'clicky', 'silent-linear': 'leise linear', 'silent-tactile': 'leise taktil' };
  const FOOT = {
    mx: 'MX-kompatible Switches', 'choc-v1': 'Choc-V1-Switches', 'choc-v2': 'Choc-V2-Switches', 'gateron-lp': 'Gateron-Low-Profile-Switches', 'cherry-lp': 'Cherry-MX-Low-Profile-Switches',
    'cherry-ulp': 'Cherry-MX-Ultra-Low-Profile-Switches', alps: 'Alps-Switches', topre: 'Topre-Switches', 'buckling-spring': 'Buckling-Spring-Switches', optical: 'optische Switches',
  };
  /** { fem, text }: "spaltenversetzte, kabellose 40-%-Low-Profile-Split-Tastatur" */
  function kbHead(k, wireless) {
    const fem = k.size !== 'numpad';
    const e = fem ? 'e' : 'er';
    const adj = [];
    if (k.split === 'unibody-angled') adj.push(`gewinkelt${e} einteilig${e}`);
    if (k.stagger === 'column') adj.push(`spaltenversetzt${e}`);
    if (k.stagger === 'ortholinear') adj.push(`ortholinear${e}`);
    if (wireless && k.connectivity.some((c) => c !== 'usb')) adj.push(`kabellos${e}`);
    const pre = [];
    if (k.size === 'full') pre.push('Full-Size');
    else if (k.size === 'tkl') pre.push('TKL');
    else if (k.size !== 'other' && k.size !== 'numpad') pre.push(`${k.size}-%`);
    if (k.low_profile) pre.push('Low-Profile');
    if (k.split === 'split') pre.push('Split');
    const noun = [...pre, fem ? 'Tastatur' : 'Nummernblock'].join('-');
    return { fem, text: [adj.join(', '), noun].filter(Boolean).join(' ') };
  }
  /** "magnetischer linearer Low-Profile-Switch" (masculine, after "ein") */
  const swKind = (sw) => {
    const typeAdj = { linear: 'linearer', tactile: 'taktiler', clicky: '', 'silent-linear': 'leiser linearer', 'silent-tactile': 'leiser taktiler' }[sw.type];
    const sense = sw.sensing === 'magnetic' ? 'magnetischer' : sw.sensing === 'optical' ? 'optischer' : '';
    const pre = [sw.profile === 'low' ? 'Low-Profile' : sw.profile === 'ultra-low' ? 'Ultra-Low-Profile' : '', sw.type === 'clicky' ? 'Clicky' : ''].filter(Boolean);
    return [sense, typeAdj, [...pre, 'Switch'].join('-')].filter(Boolean).join(' ');
  };
  const cap = ucFirst;
  return {
    nav: { keyboards: 'tastaturen', switches: 'switches' },
    foot: (date) => `petitdoigt ist ein kostenloser Tipptrainer, der zeigt, welcher Finger welche Taste drückt. Die Daten zu Tastaturen und Switches stammen von den Seiten der Hersteller, geprüft am ${date}. Die Fotos gehören den Marken, die darunter genannt sind.`,
    footLinks: { guides: 'Tipp-Ratgeber', keyboards: 'Tastaturen', finder: 'Tastatur-Finder', switches: 'Switches', source: 'Quellcode' },
    skip: 'zum Inhalt',
    sectionsAria: 'Bereiche',
    crumbAria: 'Brotkrumen',
    nil: 'nicht angegeben',
    yes: 'ja',
    no: 'nein',
    srcAria: (i) => `Quelle ${i}`,
    emptyGroup: (labelsList) => `Nicht angegeben: ${f.list(labelsList)}.`,
    sources: 'Quellen',
    srcKind: { official: 'offiziell', datasheet: 'Datenblatt', retailer: 'Händler', review: 'Test', measurement: 'Messung', reference: 'Referenz' },
    checked: (d) => `geprüft am ${d}`,
    reviews: 'Tests',
    readReview: 'zum Test (auf Englisch)',
    reviewsFine: 'Jede Zeile fasst den Test in unseren Worten zusammen; die Wertung stammt vom Medium. Die Tests sind auf Englisch.',
    noReview: (name) => `Für ${name} fand sich beim Prüfen dieser Seite kein veröffentlichter Test.`,
    photo: 'Foto: ',
    photoLine: (line) => `Foto der Serie ${line}: `,
    hotswap: { none: 'nein: Switches sind verlötet', yes: 'ja (Sockeltyp nicht angegeben)', '3-pin': 'ja, 3-Pin-Sockel', '5-pin': 'ja, 5-Pin-Sockel (für 3 und 5 Pins)', choc: 'ja, Choc-Sockel', magnetic: 'ja, magnetische Switches lassen sich herausziehen', optical: 'ja, optische Sockel', other: 'ja, andere Sockel' },
    kind: { prebuilt: 'fertig montiert, mit Switches und Keycaps', barebones: 'Barebone: ohne Switches und Keycaps', kit: 'Bausatz: du baust sie selbst zusammen', pcb: 'offenes Design: eine Platine oder Händler-Aufbauten' },
    stagger: { row: 'reihenversetzt (klassisch)', ortholinear: 'ortholinear (Gitter)', column: 'spaltenversetzt (Column-Stagger)' },
    split: { none: 'einteilig', 'unibody-angled': 'gewinkelt, einteilig (Alice-Stil)', split: 'split: zwei Hälften' },
    tent: { none: 'keins', 'built-in': 'eingebaut', accessory: 'mit Zubehör' },
    conn: CONN,
    sizeOther: (n) => `${n} Tasten (keine Standardgröße)`,
    sizeKeys: (size, n) => `${size}, ${n} Tasten`,
    kb: {
      shape: 'Form', size: 'Größe', stagger: 'Versatz', split: 'Split', layouts: 'Layouts', tenting: 'Tenting', thumb: 'Daumencluster', wells: 'Tastenmulden', lp: 'Low Profile',
      switches: 'Switches', fits: 'Passend für', hotswap: 'Hot-Swap', soldWith: 'Erhältlich mit', adjustable: 'Einstellbare Auslösung', rt: 'Rapid Trigger',
      connection: 'Verbindung', connects: 'Verbindung über', battery: 'Akku', polling: 'Polling-Rate',
      build: 'Aufbau und Software', comesAs: 'Lieferform', case: 'Gehäuse', mount: 'Montage', firmware: 'Firmware', software: 'Software', systems: 'Systeme',
      priceStatus: 'Preis und Status', price: 'Preis', status: 'Status', released: 'Erschienen', aka: 'Auch verkauft als',
    },
    ownFirmware: 'herstellereigen',
    priceOn: (store, date) => `im ${store}, ${date}`,
    store: (brand) => `Shop von ${brand}`,
    status: { current: 'erhältlich', discontinued: 'eingestellt', limited: 'limitierte Auflage' },
    makerPage: (name) => `Seite von ${name}`,
    makerSite: (name) => `Website von ${name}`,
    nReviews: (n) => `${n} Test${s(n, '', 's')}`,
    nSources: (n, date) => `${n} Quelle${s(n, '', 'n')}, geprüft am ${date}`,
    finderLink: 'Tastatur-Finder',
    sameShape: 'Tastaturen in derselben Form',
    kbDescTail: ' Switch-Optionen, Quellen und Tests.',
    kbTitle: [': technische Daten, Switches, Preis und Tests', ': Daten, Preis und Tests', ': Daten und Preis', ': technische Daten', ''],
    specsName: (name) => `${name}: technische Daten`,
    category: 'Computertastatur',
    kbLede(k, brand) {
      const head = kbHead(k, false);
      const extras = [];
      if (k.key_count) extras.push(`${k.key_count} Tasten`);
      if (k.thumb_cluster) extras.push(k.split === 'split' ? 'einem Daumencluster auf jeder Hälfte' : 'einem Daumencluster');
      if (k.tenting === 'built-in') extras.push('eingebautem Tenting');
      if (k.key_wells) extras.push('gewölbten Tastenmulden');
      const out = [`${head.fem ? 'Eine' : 'Ein'} ${head.text}${extras.length ? ` mit ${f.list(extras)}` : ''}.`];
      const P = head.fem ? 'Sie' : 'Er';
      const poss = head.fem ? 'Ihre' : 'Seine';
      const foot = k.switch_footprint !== 'other' && k.switch_footprint !== 'proprietary' ? FOOT[k.switch_footprint] : null;
      if (foot && k.hot_swap === 'none') out.push(`${P} nimmt ${foot} auf, die fest auf die Platine gelötet sind.`);
      else if (foot && k.hot_swap) out.push(`${P} nimmt ${foot} in Hot-Swap-Sockeln auf.`);
      else if (foot) out.push(`${P} nimmt ${foot} auf.`);
      else if (k.hot_swap === 'none') out.push(`${poss} Switches sind fest auf die Platine gelötet.`);
      else if (k.hot_swap) out.push(`${poss} Switches sitzen in Hot-Swap-Sockeln.`);
      if (k.adjustable_actuation) out.push(`Du stellst den Auslösepunkt selbst ein${k.rapid_trigger ? ', und Rapid Trigger ist eingebaut' : ''}.`);
      const wireless = k.connectivity.filter((c) => c !== 'usb').map((c) => CONN[c]);
      if (wireless.length) out.push(`${P} verbindet sich über ${f.list(['USB', ...wireless].filter((x) => x !== 'USB' || k.connectivity.includes('usb')))}.`);
      if (k.price_usd != null) out.push(`${brand.name} listet ${head.fem ? 'sie' : 'ihn'} für ${f.money(k.price_usd)} (${f.date(k.price_date)}).`);
      return out.join(' ');
    },
    kbAlt: (name, k) => {
      const h = kbHead(k, true);
      return `${name}, ${h.fem ? 'eine' : 'ein'} ${h.text}`;
    },
    specLead: (name, lede) => `${name}: technische Daten. ${lede}`,
    type: TYPE,
    sense: { contact: 'Metallkontakt', magnetic: 'magnetisch (Hall-Effekt)', optical: 'optisch', capacitive: 'kapazitiv', inductive: 'induktiv' },
    capMount: { mx: 'MX-Kreuz', choc: 'Choc', alps: 'Alps', topre: 'Topre', other: 'andere' },
    profile: { standard: 'Standardhöhe', low: 'Low Profile', 'ultra-low': 'Ultra Low Profile' },
    sw: {
      feel: 'Gefühl', type: 'Typ', sensing: 'Erkennung', force: 'Auslösekraft', bump: 'Druckpunkt (Spitze)', bottom: 'Kraft am Anschlag',
      travel: 'Weg', range: 'Auslösebereich', pre: 'Vorlauf', total: 'Gesamtweg',
      fit: 'Passform', footprint: 'Footprint', capMount: 'Keycap-Aufnahme', height: 'Höhe', pins: 'Pins',
      build: 'Aufbau', top: 'Gehäuse oben', bottomH: 'Gehäuse unten', stem: 'Stem', spring: 'Feder', lubed: 'Werkseitig geschmiert', lightPipe: 'Lichtleiter',
      makerStatus: 'Hersteller und Status', soldBy: 'Verkauft von', madeBy: 'Hergestellt von', rated: 'Ausgelegt für', status: 'Status', released: 'Erschienen', aka: 'Auch verkauft als',
    },
    mmRange: (a, b) => `${f.num(a)} bis ${f.num(b)} mm`,
    pins: (n) => `${n}-Pin`,
    presses: (n) => `${f.num(n)} Millionen Anschläge`,
    pressesRange: (a, b) => `${f.num(a)} bis ${f.num(b)} Millionen Anschläge`,
    gfRange: (a, b) => `${f.num(a)} bis ${f.num(b)} gf`,
    swAlt: (name, sw) => `${name}, ein ${swKind(sw)}`,
    swLede(sw, maker) {
      const first = `Ein ${swKind(sw)} von ${maker.name}${sw.family && !sw.name.toLowerCase().includes(sw.family.toLowerCase()) ? `, aus der Serie ${sw.family}` : ''}.`;
      const parts = [];
      if (sw.actuation_range_mm) parts.push(`du stellst den Auslösepunkt zwischen ${f.num(sw.actuation_range_mm[0])} und ${f.num(sw.actuation_range_mm[1])} mm ein`);
      else if (sw.actuation_force_gf && sw.pre_travel_mm) parts.push(`er löst bei ${f.num(sw.actuation_force_gf)} gf nach ${f.num(sw.pre_travel_mm)} mm aus`);
      else if (sw.actuation_force_gf) parts.push(`er löst bei ${f.num(sw.actuation_force_gf)} gf aus`);
      if (sw.tactile_force_gf) parts.push(`sein Druckpunkt liegt bei ${f.num(sw.tactile_force_gf)} gf`);
      if (sw.bottom_out_force_gf) parts.push(`am Anschlag braucht er ${f.num(sw.bottom_out_force_gf)} gf`);
      if (sw.total_travel_mm) parts.push(`sein Gesamtweg beträgt ${f.num(sw.total_travel_mm)} mm`);
      const second = parts.length ? `${maker.name} gibt an: ${cap(f.list(parts))}.` : '';
      const third = sw.rated_lifespan_million ? `Er ist für ${f.num(sw.rated_lifespan_million)} Millionen Anschläge ausgelegt.` : '';
      return [first, second, third].filter(Boolean).join(' ');
    },
    travel: {
      range: (a, b) => `Auslösepunkt einstellbar von ${f.num(a)} bis ${f.num(b)} mm`,
      at: (mm) => `löst bei ${f.num(mm)} mm aus`,
      aria: (pre, total) => `Tastenweg: ${pre == null ? '?' : f.num(pre)} mm bis zur Auslösung, ${f.num(total)} mm insgesamt`,
      rest: 'Taste in Ruhe',
      bottom: (mm) => `Anschlag bei ${f.num(mm)} mm`,
      caption: 'Tastenweg maßstabsgetreu, nach den Angaben des Herstellers. Eine Markierung alle 0,5 mm.',
    },
    force: {
      aria: (n, gf) => `Auslösekraft von ${n} Switches in 5-gf-Schritten; ${f.num(gf)} gf hervorgehoben`,
      caption: (n, gf, lighter, heavier) => `Auslösekraft der ${f.num(n)} Switches in der petitdoigt-Switch-Datenbank, die eine angeben, in 5-gf-Schritten (die äußeren Balken fassen alles Leichtere und Schwerere zusammen). Bei ${f.num(gf)} gf sind ${f.perc(lighter)} davon leichter und ${f.perc(heavier)} schwerer.`,
      title: 'Wie schwer er im Vergleich zu anderen Switches ist',
    },
    soundsLink: 'mit aufgenommenen Switch-Klängen tippen',
    boardsWith: 'Tastaturen mit diesem Switch',
    noBoards: (name) => `Keine Tastatur in der petitdoigt-Tastaturdatenbank bietet den ${name} ab Werk an.`,
    moreInLine: (family) => `Mehr aus der Serie ${family}`,
    swTitle: [': Auslösekraft, Weg und alle Daten', ': Kraft, Weg und Daten', ': technische Daten', ''],
    swDescTail: ' Typ, Passform, Aufbau, Quellen und die Tastaturen, die ihn verwenden.',
    examples: [
      'geteilte ortholineare kabellose Tastatur mit Gateron-Switches unter 500 $',
      'spaltenversetzt, split, mit Daumencluster unter 300 $',
      'Hall-Effekt 75 % mit Rapid Trigger',
      'Low Profile kabellos für Mac',
      'ortholinear QMK',
      'TKL mit Cherry-Switches, Hot-Swap',
    ],
    finder: {
      crumb: 'Finder',
      h1: 'Finde eine Tastatur, indem du sie beschreibst',
      lede: (n, b) => `Beschreibe die gewünschte Tastatur in deinen eigenen Worten, auf Deutsch oder Englisch. Der Finder macht daraus Filter und durchsucht ${f.num(n)} Tastaturen von ${b} Marken, mit Daten von den Seiten der Marken selbst.`,
      label: 'Beschreibe die Tastatur, die du suchst',
      placeholder: 'kabellose Split-Tastatur mit Gateron-Switches unter 500 $',
      try: 'probiere',
      kits: 'Bausätze und PCBs',
      sortAria: 'sortieren nach',
      sort: { price: 'Preis', reviews: 'Tests', name: 'Name' },
      fine: 'Was eine Marke nicht angibt, bleibt leer: Eine Tastatur, deren Marke einen Wert nicht angibt, passt nie zu einem Filter auf diesen Wert und erscheint unter den nächsten Treffern mit dem Vermerk „nicht angegeben“. Die Preise sind die der Marke, in US-Dollar.',
      lists: 'Fertige Listen',
      description: (n) => `Durchsuche ${n} Tastaturen, indem du sie beschreibst: split, ortholinear, kabellos, Hall-Effekt, Switch-Marke, Größe und Preis, nach den Daten der Marken.`,
      appName: 'petitdoigt Tastatur-Finder',
      name: 'Tastatur-Finder',
      title: 'Tastatur-Finder: beschreibe deine Wunschtastatur',
    },
    keyboards: 'Tastaturen',
    kbHub: {
      lede: (n, b) => `${f.num(n)} Tastaturen von ${b} Marken, jede mit ihren Daten, den Switches, mit denen sie geliefert wird, ihrem Preis und den Tests, die sie geprüft haben. Jeder Wert stammt von der Seite der Marke oder aus einer genannten Quelle.`,
      cta: 'Beschreibe deine Wunschtastatur',
      lists: 'Nach Form, Größe und Ausstattung',
      brands: 'Marken',
      compared: 'Marken im Vergleich',
      description: (n, b) => `${n} Tastaturen von ${b} Marken mit Daten von den Seiten der Marken, den mitgelieferten Switches, Preisen und Tests. Split, ergonomisch, kabellos und mehr.`,
      title: 'Tastaturen: Daten, Switches, Preise und Tests',
    },
    switchesH: 'Switches',
    swHub: {
      h1: 'Tastatur-Switches',
      lede: (n, m) => `${f.num(n)} Switches von ${m} Herstellern, mit Kraft, Weg, Materialien und den Tastaturen, die jeweils damit geliefert werden, aus den Datenblättern der Hersteller.`,
      cta: 'So funktionieren Switches',
      makers: 'Hersteller',
      compared: 'Hersteller im Vergleich',
      role: { manufacturer: 'Fabrik', brand: 'Marke', both: 'Fabrik und Marke' },
      description: (n, m) => `${n} Tastatur-Switches von ${m} Herstellern mit Auslösekraft, Weg, Materialien und den Tastaturen, die damit geliefert werden, aus den Datenblättern der Hersteller.`,
      title: 'Tastatur-Switches: Daten aller Hersteller',
    },
    guides: 'Ratgeber',
    moreCompare: 'Weitere Vergleiche',
    guideNames: {
      'staggered-vs-ortholinear-vs-columnar': 'Reihenversetzt, ortholinear oder spaltenversetzt', 'split-keyboard': 'Split-Tastaturen', 'ergonomic-keyboard': 'Ergonomische Tastaturen', 'keyboard-sizes': 'Tastaturgrößen', 'hot-swappable-keyboard': 'Hot-Swap-Tastaturen',
      'linear-vs-tactile-vs-clicky': 'Linear, taktil oder clicky', 'red-vs-brown-vs-blue-switches': 'Rot, Braun oder Blau', 'quiet-switches': 'Leise Switches', 'hall-effect-switches': 'Hall-Effekt-Switches', 'switch-specs': 'Switch-Daten lesen', 'switch-manufacturers': 'Wer Switches herstellt',
    },
    brandTitle: (b) => deCompound(b, 'Tastaturen'),
    makerTitle: (m) => deCompound(m, 'Switches'),
    nKeyboards: (n) => `${f.num(n)} Tastatur${s(n, '', 'en')}`,
    nSwitches: (n) => `${f.num(n)} Switch${s(n, '', 'es')}`,
    founded: (y) => `gegründet ${y}`,
    brandDesc: (n, b, about) => `${n} ${deCompound(b, n === 1 ? 'Tastatur' : 'Tastaturen')} mit Daten von den Seiten von ${b}, Switch-Optionen, Preisen und Tests. ${about}`,
    brandTitleSuffix: [': alle Modelle mit Daten und Preisen', ': Daten und Preise', ''],
    makerCaption: (m) => `${deCompound(m, 'Switches')} mit Typ, Kraft und Weg`,
    makerCols: ['Switch', 'Typ', 'Auslösung', 'Vorlauf', 'Weg', 'Serie'],
    makerDesc: (n, m, about) => `${n} ${deCompound(m, 'Switches')} mit Auslösekraft, Vorlauf, Gesamtweg und Typ, aus den Datenblättern von ${m}. ${about}`,
    makerTitleSuffix: [': Kraft, Weg und Daten jedes Modells', ': Daten jedes Modells', ''],
    listLede({ n, what, brands, kits, prices, wireless, hotswap }) {
      const first = `Die petitdoigt-Tastaturdatenbank enthält ${n} ${what} von ${brands === 1 ? 'einer Marke' : `${brands} Marken`}${kits ? `, davon ${kits} Bausätze oder PCBs zum Selbstbauen` : ''}.`;
      const facts = [first];
      if (prices) facts.push(`Die Preise der Marken reichen von ${prices.lo} bis ${prices.hi}, die Hälfte liegt unter ${prices.med}.`);
      const tail = [wireless != null ? `${wireless} verbinden sich kabellos` : '', hotswap != null ? `${hotswap} nehmen Hot-Swap-Switches auf` : ''].filter(Boolean);
      return { first, lede: `${facts.join(' ')}${tail.length ? ` Davon ${tail.join(', und ')}.`.replace(/^ Davon (\S+) /, ' $1 davon ') : ''}` };
    },
    listDesc: (name, first, outlets) => `${name} im Vergleich: ${first} Mit den Testergebnissen von ${f.list(outlets)}.`,
    reviewsSay: 'Was die Tests sagen',
    reviewedIntro: (r, outlets, more) =>
      `${r === 1 ? 'Eine Tastatur auf dieser Liste wurde' : `${r} Tastaturen auf dieser Liste wurden`} von ${f.list(more ? [...outlets, `${more} ${more === 1 ? 'weiteren Medium' : 'weiteren Medien'}`] : outlets)} getestet. ${r > 8 ? 'Die 8 mit den meisten Tests' : 'Jede davon'}, jeder Test in unseren Worten zusammengefasst:`,
    narrow: 'im Finder eingrenzen',
    readGuide: 'zum Ratgeber',
    specsChecked: (d) => `Daten geprüft am ${d}`,
    all: (n) => `Alle ${n}`,
    listFine: (limit, n, a) => `Diese Seite zeigt ${limit} von ${n}, getestete Tastaturen zuerst. ${a(`Der Finder listet alle ${n}`)} und sortiert sie nach Preis, Tests oder Name.`,
    moreLists: 'Weitere Listen',
    listTitle: (n, reviewed) => (reviewed ? [`: ${n} im Vergleich, mit Testergebnissen`, `: ${n} im Vergleich, mit Tests`, `: ${n} Modelle im Vergleich`, ''] : [`: ${n} Modelle mit Daten und Preisen`, `: ${n} Modelle im Vergleich`, '']),
    compare: 'Vergleich',
    brandCmp: {
      lede(A, B) {
        return [
          `Die petitdoigt-Tastaturdatenbank enthält ${A.n} Tastatur${s(A.n, '', 'en')} von ${A.name} und ${B.n} von ${B.name}.`,
          A.lo && B.lo ? `Die von ${A.name} kosten ${A.lo} bis ${A.hi}, die Hälfte unter ${A.med}; die von ${B.name} ${B.lo} bis ${B.hi}, die Hälfte unter ${B.med}.` : '',
          `${A.wireless} der Tastaturen von ${A.name} und ${B.wireless} der von ${B.name} verbinden sich kabellos, und ${A.hotswap} gegenüber ${B.hotswap} nehmen Hot-Swap-Switches auf.`,
        ].filter(Boolean).join(' ');
      },
      range: (lo, hi) => `${lo} bis ${hi}`,
      noPrices: 'keine Preise angegeben',
      rows: { n: 'Tastaturen in der Datenbank', range: 'Preisspanne', median: 'Medianpreis', sizes: 'Größen', wireless: 'Kabellos', hotswap: 'Hot-Swap', lp: 'Low Profile', adjustable: 'Einstellbare Auslösung', rt: 'Rapid Trigger', qmk: 'QMK, VIA oder Vial', aluminum: 'Aluminiumgehäuse', makers: 'Switch-Hersteller', reviews: 'Tests in der Datenbank', country: 'Sitz', founded: 'Gegründet' },
      nNow: (n, c) => `${n} (${c} erhältlich)`,
      share: (n, of, p) => `${n} von ${of} (${p})`,
      reviewsOn: (r, b) => `${r} Test${s(r, '', 's')} zu ${b} Tastatur${s(b, '', 'en')}`,
      caption: (t) => `${t} im direkten Vergleich`,
      sizeCaption: 'Modelle nach Größe und das günstigste jeder Größe',
      size: 'Größe',
      sizeCell: (n, link, price) => `${n} Modell${s(n, '', 'e')}${link ? `, ab ${link} für ${price}` : ''}`,
      none: 'keine',
      h1: (t) => `${t}: Modelle, Preise und Daten im Vergleich`,
      every: (b) => `alle ${deCompound(b, 'Tastaturen')}`,
      side: 'Im direkten Vergleich',
      fine: 'Die Zahlen umfassen die Tastaturen, die jede Marke auf ihrer eigenen Website führt, aktuelle und eingestellte, so wie die petitdoigt-Tastaturdatenbank sie erfasst. Ein Wert, den eine Marke nicht angibt, zählt als nicht vorhanden.',
      bySize: 'Nach Größe',
      most: (b) => `${b}: die meistgetesteten`,
      two: 'Die beiden Marken',
      ldName: (t) => `${t}: Tastaturen im Vergleich`,
      titleSuffix: [': Tastaturen, Preise und Daten im Vergleich', ': Tastaturen im Vergleich', ''],
    },
    makerCmp: {
      title: (a, b) => `${a.replace(/ /g, '-')}- vs. ${deCompound(b, 'Switches')}`,
      lede(A, B) {
        return [
          `Die petitdoigt-Switch-Datenbank enthält ${A.n} Switches von ${A.name} und ${B.n} von ${B.name}.`,
          A.med && B.med ? `Laut den Angaben der Hersteller löst die Hälfte der ${deCompound(A.name, 'Switches')} unter ${A.med} gf aus und die Hälfte der ${deCompound(B.name, 'Switches')} unter ${B.med} gf.` : '',
          `${A.boards} Tastaturen in der Datenbank gibt es mit einem ${deCompound(A.name, 'Switch')} und ${B.boards} mit einem ${deCompound(B.name, 'Switch')}.`,
        ].filter(Boolean).join(' ');
      },
      rows: { n: 'Switches in der Datenbank', magnetic: 'Magnetisch (Hall-Effekt)', optical: 'Optisch', lp: 'Low Profile', force: 'Auslösekraft', medForce: 'Median der Auslösekraft', medTravel: 'Median des Gesamtwegs', lubed: 'Werkseitig geschmiert', life: 'Lebensdauer', boards: 'Tastaturen damit' },
      typeCaption: 'Median der Auslösekraft nach Switch-Typ',
      type: 'Typ',
      typeCell: (n, med) => `${n} Switch${s(n, '', 'es')}${med != null ? `, Median ${f.num(med)} gf` : ''}`,
      noLines: 'keine benannten Serien',
      h1: (t) => `${t}: Kraft, Typen und Serien im Vergleich`,
      finderQ: (m) => deCompound(m, 'Switches'),
      boardsWith: (m) => `Tastaturen mit ${deCompound(m, 'Switches')}`,
      fine: 'Kräfte und Wege sind die veröffentlichten Angaben der Hersteller, keine Messungen. Ein Switch ohne veröffentlichten Wert fließt nicht in die Mediane ein.',
      byType: 'Nach Typ',
      lines: 'Ihre Serien',
      every: (m) => `alle ${deCompound(m, 'Switches')}`,
      two: 'Die beiden Hersteller',
      whoMakes: 'wer Switches herstellt',
      rbb: 'Rot, Braun oder Blau',
      ldName: (t) => `${t} im Vergleich`,
      titleSuffix: [': Kraft, Typen und Serien im Vergleich', ' im Vergleich', ''],
    },
  };
}

// ---------- Spanish ----------

function es(f) {
  const { FOOTPRINT } = labels('es');
  const FOOT = { ...FOOTPRINT, optical: 'ópticos' };
  const CONN = { usb: 'USB', bluetooth: 'Bluetooth', '2.4ghz': '2,4 GHz' };
  const TYPE = { linear: 'lineal', tactile: 'táctil', clicky: 'clicky', 'silent-linear': 'lineal silencioso', 'silent-tactile': 'táctil silencioso' };
  /** "teclado 75 % split, ortolineal y de perfil bajo" */
  function kbHead(k, wireless) {
    const noun = k.size === 'numpad' ? 'teclado numérico' : 'teclado';
    const size = k.size === 'full' ? 'de tamaño completo' : k.size === 'tkl' ? 'TKL' : k.size !== 'other' && k.size !== 'numpad' ? `${k.size}${N}%` : '';
    const adj = [];
    if (k.split === 'split') adj.push('split');
    if (k.split === 'unibody-angled') adj.push('de una pieza en ángulo');
    if (k.stagger === 'column') adj.push('escalonado por columnas');
    if (k.stagger === 'ortholinear') adj.push('ortolineal');
    if (k.low_profile) adj.push('de perfil bajo');
    if (wireless && k.connectivity.some((c) => c !== 'usb')) adj.push('inalámbrico');
    return [noun, size, f.list(adj)].filter(Boolean).join(' ');
  }
  const swKind = (sw) => {
    const sense = sw.sensing === 'magnetic' ? ' magnético' : sw.sensing === 'optical' ? ' óptico' : '';
    const prof = sw.profile === 'low' ? ' de perfil bajo' : sw.profile === 'ultra-low' ? ' de perfil ultrabajo' : '';
    return `switch ${TYPE[sw.type]}${sense}${prof}`;
  };
  const million = (n) => `${f.num(n)} ${n === 1 ? 'millón' : 'millones'}`;
  return {
    nav: { keyboards: 'teclados', switches: 'switches' },
    foot: (date) => `petitdoigt es un entrenador de mecanografía gratuito que enseña qué dedo pulsa cada tecla. Las especificaciones de teclados y switches vienen de las webs de los fabricantes, consultadas el ${date}. Las fotos pertenecen a las marcas citadas bajo cada una.`,
    footLinks: { guides: 'guías de mecanografía', keyboards: 'teclados', finder: 'buscador de teclados', switches: 'switches', source: 'código fuente' },
    skip: 'ir al contenido',
    sectionsAria: 'secciones',
    crumbAria: 'ruta de navegación',
    nil: 'no indicado',
    yes: 'sí',
    no: 'no',
    srcAria: (i) => `fuente ${i}`,
    emptyGroup: (labelsList) => `No indicado: ${f.list(labelsList.map((l) => l.toLowerCase()))}.`,
    sources: 'Fuentes',
    srcKind: { official: 'oficial', datasheet: 'ficha técnica', retailer: 'tienda', review: 'análisis', measurement: 'medición', reference: 'referencia' },
    checked: (d) => `consultada el ${d}`,
    reviews: 'Análisis',
    readReview: 'leer el análisis (en inglés)',
    reviewsFine: 'Cada línea resume el análisis con nuestras palabras; la nota es la del medio. Los análisis están en inglés.',
    noReview: (name) => `No encontramos ningún análisis publicado del ${name} al revisar esta página.`,
    photo: 'Foto: ',
    photoLine: (line) => `Foto de la línea ${line}: `,
    hotswap: { none: 'no: switches soldados', yes: 'sí (tipo de zócalo no indicado)', '3-pin': 'sí, zócalos de 3 pines', '5-pin': 'sí, zócalos de 5 pines (admiten 3 y 5 pines)', choc: 'sí, zócalos Choc', magnetic: 'sí, los switches magnéticos se extraen', optical: 'sí, zócalos ópticos', other: 'sí, otros zócalos' },
    kind: { prebuilt: 'montado, con switches y keycaps', barebones: 'barebone: sin switches ni keycaps', kit: 'kit: lo montas tú', pcb: 'diseño abierto: una PCB o montajes de tiendas' },
    stagger: { row: 'escalonado por filas (clásico)', ortholinear: 'ortolineal (cuadrícula)', column: 'escalonado por columnas' },
    split: { none: 'de una pieza', 'unibody-angled': 'de una pieza en ángulo (estilo Alice)', split: 'split: dos mitades' },
    tent: { none: 'ninguno', 'built-in': 'integrado', accessory: 'con un accesorio' },
    conn: CONN,
    sizeOther: (n) => `${n} teclas (sin tamaño estándar)`,
    sizeKeys: (size, n) => `${size}, ${n} teclas`,
    kb: {
      shape: 'Forma', size: 'Tamaño', stagger: 'Escalonado', split: 'Split', layouts: 'Distribuciones', tenting: 'Tenting', thumb: 'Teclas para el pulgar', wells: 'Teclas cóncavas', lp: 'Perfil bajo',
      switches: 'Switches', fits: 'Admite', hotswap: 'Hot-swap', soldWith: 'Se vende con', adjustable: 'Actuación ajustable', rt: 'Rapid trigger',
      connection: 'Conexión', connects: 'Se conecta por', battery: 'Batería', polling: 'Tasa de sondeo',
      build: 'Construcción y software', comesAs: 'Se vende', case: 'Carcasa', mount: 'Montaje', firmware: 'Firmware', software: 'Software', systems: 'Sistemas',
      priceStatus: 'Precio y estado', price: 'Precio', status: 'Estado', released: 'Lanzamiento', aka: 'También se vende como',
    },
    ownFirmware: 'propio de la marca',
    priceOn: (store, date) => `en ${store}, ${date}`,
    store: (brand) => `la tienda de ${brand}`,
    status: { current: 'a la venta', discontinued: 'descatalogado', limited: 'edición limitada' },
    makerPage: (name) => `página de ${name}`,
    makerSite: (name) => `web de ${name}`,
    nReviews: (n) => `${n} análisis`,
    nSources: (n, date) => `${n} fuente${s(n, '', 's')}, consultada${s(n, '', 's')} el ${date}`,
    finderLink: 'buscador de teclados',
    sameShape: 'Teclados con la misma forma',
    kbDescTail: ' Opciones de switches, fuentes y análisis.',
    kbTitle: [': especificaciones, switches, precio y análisis', ': especificaciones, precio y análisis', ': especificaciones y precio', ': especificaciones', ''],
    specsName: (name) => `Especificaciones del ${name}`,
    category: 'Teclado de ordenador',
    kbLede(k, brand) {
      const extras = [];
      if (k.key_count) extras.push(`${k.key_count} teclas`);
      if (k.thumb_cluster) extras.push(k.split === 'split' ? 'un grupo de teclas para el pulgar en cada mitad' : 'un grupo de teclas para el pulgar');
      if (k.tenting === 'built-in') extras.push('tenting integrado');
      if (k.key_wells) extras.push('teclas cóncavas');
      const out = [`Un ${kbHead(k, false)}${extras.length ? `, con ${f.list(extras)}` : ''}.`];
      const foot = FOOT[k.switch_footprint];
      const takes = foot && k.switch_footprint !== 'other' && k.switch_footprint !== 'proprietary';
      if (takes && k.hot_swap === 'none') out.push(`Admite switches ${foot}, soldados a la placa.`);
      else if (takes && k.hot_swap) out.push(`Admite switches ${foot}, en zócalos hot-swap.`);
      else if (takes) out.push(`Admite switches ${foot}.`);
      else if (k.hot_swap === 'none') out.push('Sus switches van soldados a la placa.');
      else if (k.hot_swap) out.push('Sus switches van en zócalos hot-swap.');
      if (k.adjustable_actuation) out.push(`Puedes ajustar el punto de actuación${k.rapid_trigger ? ', y el rapid trigger viene integrado' : ''}.`);
      const wireless = k.connectivity.filter((c) => c !== 'usb').map((c) => CONN[c]);
      if (wireless.length) out.push(`Se conecta por ${f.list(['USB', ...wireless].filter((x) => x !== 'USB' || k.connectivity.includes('usb')))}.`);
      if (k.price_usd != null) out.push(`${brand.name} lo vende a ${f.money(k.price_usd)} (${f.date(k.price_date)}).`);
      return out.join(' ');
    },
    kbAlt: (name, k) => `${name}, un ${kbHead(k, true)}`,
    specLead: (name, lede) => `Especificaciones del ${name}: ${lcFirst(lede)}`,
    type: TYPE,
    sense: { contact: 'contacto metálico', magnetic: 'magnético (efecto Hall)', optical: 'óptico', capacitive: 'capacitivo', inductive: 'inductivo' },
    capMount: { mx: 'cruz MX', choc: 'Choc', alps: 'Alps', topre: 'Topre', other: 'otro' },
    profile: { standard: 'altura estándar', low: 'perfil bajo', 'ultra-low': 'perfil ultrabajo' },
    sw: {
      feel: 'Tacto', type: 'Tipo', sensing: 'Detección', force: 'Fuerza de actuación', bump: 'Pico del relieve táctil', bottom: 'Fuerza al fondo',
      travel: 'Recorrido', range: 'Rango de actuación', pre: 'Pre-recorrido', total: 'Recorrido total',
      fit: 'Compatibilidad', footprint: 'Huella', capMount: 'Anclaje de keycaps', height: 'Altura', pins: 'Pines',
      build: 'Construcción', top: 'Carcasa superior', bottomH: 'Carcasa inferior', stem: 'Vástago', spring: 'Muelle', lubed: 'Lubricado de fábrica', lightPipe: 'Guía de luz',
      makerStatus: 'Fabricante y estado', soldBy: 'Vendido por', madeBy: 'Fabricado por', rated: 'Vida útil', status: 'Estado', released: 'Lanzamiento', aka: 'También se vende como',
    },
    mmRange: (a, b) => `${f.num(a)} a ${f.num(b)} mm`,
    pins: (n) => `${n} pines`,
    presses: (n) => `${million(n)} de pulsaciones`,
    pressesRange: (a, b) => `${f.num(a)} a ${million(b)} de pulsaciones`,
    gfRange: (a, b) => `${f.num(a)} a ${f.num(b)} gf`,
    swAlt: (name, sw) => `${name}, un ${swKind(sw)}`,
    swLede(sw, maker) {
      const first = `Un ${swKind(sw)} de ${maker.name}${sw.family && !sw.name.toLowerCase().includes(sw.family.toLowerCase()) ? `, de su línea ${sw.family}` : ''}.`;
      const parts = [];
      if (sw.actuation_range_mm) parts.push(`puedes ajustar su punto de actuación entre ${f.num(sw.actuation_range_mm[0])} y ${f.num(sw.actuation_range_mm[1])} mm`);
      else if (sw.actuation_force_gf && sw.pre_travel_mm) parts.push(`actúa a ${f.num(sw.actuation_force_gf)} gf tras ${f.num(sw.pre_travel_mm)} mm`);
      else if (sw.actuation_force_gf) parts.push(`actúa a ${f.num(sw.actuation_force_gf)} gf`);
      if (sw.tactile_force_gf) parts.push(`su relieve táctil llega a ${f.num(sw.tactile_force_gf)} gf`);
      if (sw.bottom_out_force_gf) parts.push(`llega al fondo con ${f.num(sw.bottom_out_force_gf)} gf`);
      if (sw.total_travel_mm) parts.push(`su recorrido total es de ${f.num(sw.total_travel_mm)} mm`);
      const second = parts.length ? `Según ${maker.name}, ${f.list(parts)}.` : '';
      const third = sw.rated_lifespan_million ? `Está garantizado para ${million(sw.rated_lifespan_million)} de pulsaciones.` : '';
      return [first, second, third].filter(Boolean).join(' ');
    },
    travel: {
      range: (a, b) => `actuación ajustable de ${f.num(a)} a ${f.num(b)} mm`,
      at: (mm) => `actúa a ${f.num(mm)} mm`,
      aria: (pre, total) => `Recorrido de la tecla: ${pre == null ? '?' : f.num(pre)} mm hasta la actuación, ${f.num(total)} mm en total`,
      rest: 'tecla en reposo',
      bottom: (mm) => `fondo a ${f.num(mm)} mm`,
      caption: 'Recorrido de la tecla a escala, según las cifras del fabricante. Una marca cada 0,5 mm.',
    },
    force: {
      aria: (n, gf) => `Fuerza de actuación de ${n} switches en pasos de 5 gf; ${f.num(gf)} gf resaltado`,
      caption: (n, gf, lighter, heavier) => `Fuerza de actuación de los ${f.num(n)} switches de la base de datos de petitdoigt que publican una, en pasos de 5 gf (las barras de los extremos agrupan todo lo más ligero o más pesado). Con ${f.num(gf)} gf, el ${f.perc(lighter)} es más ligero y el ${f.perc(heavier)} más pesado.`,
      title: 'Cuánto pesa frente a otros switches',
    },
    soundsLink: 'escribe con sonidos de switches grabados',
    boardsWith: 'Teclados que lo incluyen',
    noBoards: (name) => `Ningún teclado de la base de datos de petitdoigt ofrece el ${name} de fábrica.`,
    moreInLine: (family) => `Más de la línea ${family}`,
    swTitle: [': fuerza, recorrido y especificaciones', ': fuerza y recorrido', ': especificaciones', ''],
    swDescTail: ' Tipo, compatibilidad, construcción, fuentes y los teclados que lo incluyen.',
    examples: [
      'teclado split ortolineal inalámbrico con switches gateron por menos de 500 $',
      'split escalonado por columnas con teclas para el pulgar, menos de 300 $',
      'efecto hall 75 % con rapid trigger',
      'perfil bajo inalámbrico para mac',
      'ortolineal qmk',
      'tkl con switches cherry, hot swap',
    ],
    finder: {
      crumb: 'Buscador',
      h1: 'Encuentra un teclado describiéndolo',
      lede: (n, b) => `Describe con tus palabras el teclado que buscas, en español o en inglés. El buscador las convierte en filtros y busca entre ${f.num(n)} teclados de ${b} marcas, con especificaciones tomadas de la web de cada marca.`,
      label: 'Describe el teclado que buscas',
      placeholder: 'teclado split inalámbrico con switches Gateron por menos de 500 $',
      try: 'prueba',
      kits: 'kits y PCB',
      sortAria: 'ordenar por',
      sort: { price: 'precio', reviews: 'análisis', name: 'nombre' },
      fine: 'Un dato que la marca no publica sigue vacío: un teclado cuya marca no indica un valor nunca cumple un filtro sobre ese valor, y aparece entre los resultados más cercanos con la indicación «no indicado». Los precios son los de la marca, en dólares estadounidenses.',
      lists: 'Listas ya hechas',
      description: (n) => `Busca entre ${n} teclados describiéndolos: split, ortolineal, inalámbrico, efecto Hall, marca de switches, tamaño y precio, según las especificaciones de cada marca.`,
      appName: 'buscador de teclados de petitdoigt',
      name: 'Buscador de teclados',
      title: 'Buscador de teclados: describe el que quieres',
    },
    keyboards: 'Teclados',
    kbHub: {
      lede: (n, b) => `${f.num(n)} teclados de ${b} marcas, cada uno con sus especificaciones, los switches con los que se vende, su precio y los análisis que lo probaron. Cada dato viene de la web de la marca o de una fuente citada.`,
      cta: 'Describe el teclado que quieres',
      lists: 'Por forma, tamaño y función',
      brands: 'Marcas',
      compared: 'Marcas comparadas',
      description: (n, b) => `${n} teclados de ${b} marcas con especificaciones de la web de cada marca, los switches incluidos, precios y análisis. Split, ergonómicos, inalámbricos y más.`,
      title: 'Teclados: especificaciones, switches, precios y análisis',
    },
    switchesH: 'Switches',
    swHub: {
      h1: 'Switches de teclado',
      lede: (n, m) => `${f.num(n)} switches de ${m} fabricantes, con fuerza, recorrido, materiales y los teclados que los incluyen, según las fichas técnicas de cada fabricante.`,
      cta: 'Cómo funcionan los switches',
      makers: 'Fabricantes',
      compared: 'Fabricantes comparados',
      role: { manufacturer: 'fábrica', brand: 'marca', both: 'fábrica y marca' },
      description: (n, m) => `${n} switches de teclado de ${m} fabricantes con fuerza de actuación, recorrido, materiales y los teclados que los incluyen, según las fichas técnicas de cada fabricante.`,
      title: 'Switches de teclado: especificaciones de cada fabricante',
    },
    guides: 'Guías',
    moreCompare: 'Más comparativas',
    guideNames: {
      'staggered-vs-ortholinear-vs-columnar': 'Escalonado, ortolineal o por columnas', 'split-keyboard': 'Teclados split', 'ergonomic-keyboard': 'Teclados ergonómicos', 'keyboard-sizes': 'Tamaños de teclado', 'hot-swappable-keyboard': 'Teclados hot-swap',
      'linear-vs-tactile-vs-clicky': 'Lineal, táctil o clicky', 'red-vs-brown-vs-blue-switches': 'Rojo, marrón o azul', 'quiet-switches': 'Switches silenciosos', 'hall-effect-switches': 'Switches de efecto Hall', 'switch-specs': 'Cómo leer la ficha de un switch', 'switch-manufacturers': 'Quién fabrica los switches',
    },
    brandTitle: (b) => `Teclados ${b}`,
    makerTitle: (m) => `Switches ${m}`,
    nKeyboards: (n) => `${f.num(n)} teclado${s(n, '', 's')}`,
    nSwitches: (n) => `${f.num(n)} switch${s(n, '', 'es')}`,
    founded: (y) => `fundada en ${y}`,
    brandDesc: (n, b, about) => `${n} teclado${s(n, '', 's')} ${b} con especificaciones de la web de ${b}, opciones de switches, precios y análisis. ${about}`,
    brandTitleSuffix: [': todos los modelos con especificaciones y precios', ': especificaciones y precios', ''],
    makerCaption: (m) => `Switches ${m} con tipo, fuerza y recorrido`,
    makerCols: ['Switch', 'Tipo', 'Actuación', 'Pre-recorrido', 'Recorrido', 'Línea'],
    makerDesc: (n, m, about) => `${n} switches ${m} con fuerza de actuación, pre-recorrido, recorrido total y tipo, según las fichas técnicas de ${m}. ${about}`,
    makerTitleSuffix: [': fuerza, recorrido y especificaciones de cada modelo', ': especificaciones de cada modelo', ''],
    listLede({ n, what, brands, kits, prices, wireless, hotswap }) {
      const first = `La base de datos de petitdoigt reúne ${n} ${what} de ${brands === 1 ? 'una sola marca' : `${brands} marcas`}${kits ? `, ${kits} de ellos kits o PCB para montar` : ''}.`;
      const facts = [first];
      if (prices) facts.push(`Los precios de las marcas van de ${prices.lo} a ${prices.hi}, y la mitad cuesta menos de ${prices.med}.`);
      const tail = [wireless != null ? `${wireless} se conectan sin cables` : '', hotswap != null ? `${hotswap} admiten switches hot-swap` : ''].filter(Boolean);
      return { first, lede: `${facts.join(' ')}${tail.length ? ` De ellos, ${tail.join(' y ')}.` : ''}` };
    },
    listDesc: (name, first, outlets) => `¿Buscas los mejores ${lcFirst(name)}? ${first} Mira lo que encontraron ${f.list(outlets)} en sus análisis.`,
    reviewsSay: 'Qué dicen los análisis',
    reviewedIntro: (r, outlets, more) =>
      `${r === 1 ? 'Un teclado de esta lista fue analizado' : `${r} teclados de esta lista fueron analizados`} por ${f.list(more ? [...outlets, `${more} medio${s(more, '', 's')} más`] : outlets)}. ${r > 8 ? 'Los 8 con más análisis' : 'Cada uno'}, con cada análisis resumido con nuestras palabras:`,
    narrow: 'acotar en el buscador',
    readGuide: 'leer la guía',
    specsChecked: (d) => `datos consultados el ${d}`,
    all: (n) => `Los ${n}`,
    listFine: (limit, n, a) => `Esta página muestra ${limit} de ${n}, primero los analizados. ${a(`El buscador muestra los ${n}`)} y los ordena por precio, análisis o nombre.`,
    moreLists: 'Más listas',
    listTitle: (n, reviewed) => (reviewed ? [`: ${n} comparados, con lo que dicen los análisis`, `: ${n} comparados, con análisis`, `: ${n} modelos comparados`, ''] : [`: ${n} modelos con especificaciones y precios`, `: ${n} modelos comparados`, '']),
    compare: 'Comparativa',
    brandCmp: {
      lede(A, B) {
        return [
          `La base de datos de petitdoigt reúne ${A.n} teclado${s(A.n, '', 's')} de ${A.name} y ${B.n} de ${B.name}.`,
          A.lo && B.lo ? `Los de ${A.name} van de ${A.lo} a ${A.hi}, la mitad por debajo de ${A.med}; los de ${B.name}, de ${B.lo} a ${B.hi}, la mitad por debajo de ${B.med}.` : '',
          `El ${A.wireless} de los teclados de ${A.name} y el ${B.wireless} de los de ${B.name} son inalámbricos, y el ${A.hotswap} frente al ${B.hotswap} admiten switches hot-swap.`,
        ].filter(Boolean).join(' ');
      },
      range: (lo, hi) => `${lo} a ${hi}`,
      noPrices: 'sin precios publicados',
      rows: { n: 'Teclados en la base de datos', range: 'Rango de precios', median: 'Precio mediano', sizes: 'Tamaños', wireless: 'Inalámbricos', hotswap: 'Hot-swap', lp: 'Perfil bajo', adjustable: 'Actuación ajustable', rt: 'Rapid trigger', qmk: 'QMK, VIA o Vial', aluminum: 'Carcasa de aluminio', makers: 'Fabricantes de switches', reviews: 'Análisis en la base de datos', country: 'Sede', founded: 'Fundación' },
      nNow: (n, c) => `${n} (${c} a la venta)`,
      share: (n, of, p) => `${n} de ${of} (${p})`,
      reviewsOn: (r, b) => `${r} análisis sobre ${b} teclado${s(b, '', 's')}`,
      caption: (t) => `${t}, cara a cara`,
      sizeCaption: 'Modelos por tamaño y el más barato de cada uno',
      size: 'Tamaño',
      sizeCell: (n, link, price) => `${n} modelo${s(n, '', 's')}${link ? `, desde el ${link} a ${price}` : ''}`,
      none: 'ninguno',
      h1: (t) => `${t}: gamas, precios y especificaciones cara a cara`,
      every: (b) => `todos los teclados ${b}`,
      side: 'Cara a cara',
      fine: 'Las cifras cubren los teclados que cada marca muestra en su web, actuales y descatalogados, tal como los recoge la base de datos de petitdoigt. Un dato que la marca no publica cuenta como ausente.',
      bySize: 'Por tamaño',
      most: (b) => `${b}: los más analizados`,
      two: 'Las dos marcas',
      ldName: (t) => `${t}: teclados comparados`,
      titleSuffix: [': teclados, precios y especificaciones comparados', ': teclados comparados', ''],
    },
    makerCmp: {
      title: (a, b) => `Switches ${a} vs ${b}`,
      lede(A, B) {
        return [
          `La base de datos de petitdoigt reúne ${A.n} switches de ${A.name} y ${B.n} de ${B.name}.`,
          A.med && B.med ? `Según las cifras de los fabricantes, la mitad de los de ${A.name} actúan por debajo de ${A.med} gf y la mitad de los de ${B.name}, por debajo de ${B.med} gf.` : '',
          `En la base de datos, ${A.boards} teclados se venden con una opción de switch ${A.name} y ${B.boards} con una de ${B.name}.`,
        ].filter(Boolean).join(' ');
      },
      rows: { n: 'Switches en la base de datos', magnetic: 'Magnéticos (efecto Hall)', optical: 'Ópticos', lp: 'Perfil bajo', force: 'Fuerza de actuación', medForce: 'Fuerza de actuación mediana', medTravel: 'Recorrido total mediano', lubed: 'Lubricados de fábrica', life: 'Vida útil', boards: 'Teclados que los incluyen' },
      typeCaption: 'Fuerza de actuación mediana por tipo de switch',
      type: 'Tipo',
      typeCell: (n, med) => `${n} switch${s(n, '', 'es')}${med != null ? `, mediana ${f.num(med)} gf` : ''}`,
      noLines: 'ninguna línea con nombre',
      h1: (t) => `${t}: fuerza, tipos y líneas cara a cara`,
      finderQ: (m) => `switches ${m}`,
      boardsWith: (m) => `teclados con switches ${m}`,
      fine: 'Las fuerzas y los recorridos son las cifras publicadas por los fabricantes, no mediciones. Un switch sin cifra publicada queda fuera de las medianas.',
      byType: 'Por tipo',
      lines: 'Sus líneas',
      every: (m) => `todos los switches ${m}`,
      two: 'Los dos fabricantes',
      whoMakes: 'quién fabrica los switches',
      rbb: 'rojo, marrón o azul',
      ldName: (t) => `${t} comparados`,
      titleSuffix: [': fuerza, tipos y líneas comparados', ' comparados', ''],
    },
  };
}

const MAKE = { en, fr, de, es };
/** The words of the database pages in one language, with that language's number, price and date formats. */
export function strings(lang) {
  const f = formats(lang);
  return { ...MAKE[lang](f), f, lang };
}
export { finderMoney };
