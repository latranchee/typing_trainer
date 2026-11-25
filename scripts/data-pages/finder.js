// Keyboard finder: reads a sentence as filters and matches them against the keyboard database.
// Pure functions first (parse, evaluate), so Node can test them; the page wiring runs only in a browser.

const STOP = new Set(
  'i im i\'m want wanted need needs looking look for a an the some any keyboard keyboards board boards with and or that has have having is it of in on to me my please something like would love find show get one switch switches mechanical mech keys key type typing which what good best new also plus but'.split(' '),
);

const SIZE_LABEL = { full: 'full size', 96: '96%', tkl: 'TKL', 75: '75%', 65: '65%', 60: '60%', 50: '50%', 40: '40%', 30: '30%', numpad: 'numpad' };
const FOOTPRINT = {
  mx: 'MX-style', 'choc-v1': 'Choc V1', 'choc-v2': 'Choc V2', 'gateron-lp': 'Gateron low profile', 'cherry-lp': 'Cherry MX Low Profile',
  'cherry-ulp': 'Cherry MX Ultra Low Profile', alps: 'Alps', topre: 'Topre', 'buckling-spring': 'buckling spring', optical: 'optical', proprietary: 'proprietary', other: 'other',
};
const FW = { qmk: 'QMK', via: 'VIA', vial: 'Vial', zmk: 'ZMK', kmk: 'KMK' };

/**
 * Each rule: a regex over the normalized sentence and a function giving the filter it stands for.
 * A filter is { key, value, label, miss }: filters of one key are OR-ed, keys are AND-ed.
 * Order matters: longer phrases first, so "column staggered" is read before "staggered".
 */
function rules(db) {
  const r = [];
  const add = (re, make) => r.push({ re, make });
  // Price.
  const money = String.raw`\$?\s?(\d[\d,]*)\s?(?:\$|usd|dollars?|bucks|cad)?`;
  add(new RegExp(String.raw`\bbetween\s+${money}\s+(?:and|to|-)\s+${money}`), (m) => {
    const a = num(m[1]);
    const b = num(m[2]);
    return [{ key: 'pmin', value: Math.min(a, b), label: `over $${Math.min(a, b)}` }, { key: 'pmax', value: Math.max(a, b), label: `under $${Math.max(a, b)}` }];
  });
  add(new RegExp(String.raw`\b(?:under|below|less than|max(?:imum)?|up to|at most|no more than|cheaper than|<)\s*${money}`), (m) => ({ key: 'pmax', value: num(m[1]), label: `under $${num(m[1])}` }));
  add(new RegExp(String.raw`\b(?:over|above|more than|at least|min(?:imum)?|>)\s*${money}`), (m) => ({ key: 'pmin', value: num(m[1]), label: `over $${num(m[1])}` }));
  add(/\$\s?(\d[\d,]*)\b|\b(\d[\d,]*)\s?(?:\$|usd|dollars?)/, (m) => ({ key: 'pmax', value: num(m[1] ?? m[2]), label: `under $${num(m[1] ?? m[2])}` }));
  // Shape.
  add(/\bcolumn[\s-]?stagger(?:ed)?\b|\bcolumnar\b|\bcolumn\b/, () => ({ key: 'stagger', value: 'column', label: 'columnar' }));
  add(/\bortho(?:linear)?\b|\bgrid\b|\bmatrix\b/, () => ({ key: 'stagger', value: 'ortholinear', label: 'ortholinear' }));
  add(/\brow[\s-]?stagger(?:ed)?\b|\bstaggered\b|\bstandard layout\b/, () => ({ key: 'stagger', value: 'row', label: 'row stagger' }));
  add(/\bunibody\b|\balice\b|\barisu\b|\bangled\b/, () => ({ key: 'split', value: 'unibody-angled', label: 'angled one-piece' }));
  add(/\bsplit\b/, () => ({ key: 'split', value: 'split', label: 'split' }));
  add(/\btent(?:ed|ing)?\b/, () => ({ key: 'tent', value: true, label: 'tenting' }));
  add(/\bthumb (?:cluster|keys?)s?\b/, () => ({ key: 'thumb', value: true, label: 'thumb cluster' }));
  add(/\bkey ?wells?\b|\bconcave\b|\bcurved\b/, () => ({ key: 'wells', value: true, label: 'key wells' }));
  add(/\blow[\s-]?profile\b|\bslim\b|\bflat\b/, () => ({ key: 'lp', value: true, label: 'low profile' }));
  // "ainsi" = a common slip for ANSI.
  add(/\bai?nsi\b|\bus layout\b/, () => ({ key: 'std', value: 'ansi', label: 'ANSI' }));
  add(/\biso\b|\buk layout\b|\beuropean layout\b/, () => ({ key: 'std', value: 'iso', label: 'ISO' }));
  add(/\bjis\b|\bjapanese layout\b/, () => ({ key: 'std', value: 'jis', label: 'JIS' }));
  // Size.
  add(/\bfull[\s-]?size(?:d)?\b|\bfull\b|\b100\s?%|\b10[48][\s-]?keys?\b/, () => ({ key: 'size', value: 'full', label: 'full size' }));
  add(/\b9[68]\s?%|\b1800\b/, () => ({ key: 'size', value: '96', label: '96%' }));
  add(/\btkl\b|\btenkeyless\b|\b80\s?%|\b87[\s-]?keys?\b/, () => ({ key: 'size', value: 'tkl', label: 'TKL' }));
  for (const s of ['75', '65', '60', '50', '40', '30']) add(new RegExp(String.raw`\b${s}\s?(?:%|percent)`), () => ({ key: 'size', value: s, label: `${s}%` }));
  add(/\bnum ?pad\b|\bmacro ?pad\b/, () => ({ key: 'size', value: 'numpad', label: 'numpad' }));
  add(/\bcompact\b|\bsmall\b/, () => ({ key: 'compact', value: true, label: 'compact (75% or smaller)' }));
  // Connection.
  add(/\bwired[\s-]?only\b|\bno wireless\b/, () => ({ key: 'wiredonly', value: true, label: 'wired only' }));
  add(/\bwireless\b|\bcordless\b|\btri[\s-]?mode\b/, () => ({ key: 'wireless', value: true, label: 'wireless' }));
  add(/\bbluetooth\b|\bbt\b/, () => ({ key: 'conn', value: 'bluetooth', label: 'Bluetooth' }));
  add(/\b2\.4\s?(?:ghz|g)?\b|\bdongle\b|\breceiver\b/, () => ({ key: 'conn', value: '2.4ghz', label: '2.4 GHz' }));
  // Switches and sensing.
  add(/\bhall[\s-]?effect\b|\bmagnetic\b|\bhe\b|\btmr\b|\banalog(?:ue)?\b|\badjustable actuation\b/, () => ({ key: 'magnetic', value: true, label: 'magnetic (Hall effect)' }));
  add(/\brapid[\s-]?trigger\b/, () => ({ key: 'rt', value: true, label: 'rapid trigger' }));
  add(/\boptical\b/, () => ({ key: 'optical', value: true, label: 'optical' }));
  add(/\bhot[\s-]?swap(?:pable|able)?\b/, () => ({ key: 'hotswap', value: true, label: 'hot-swap' }));
  add(/\bsoldered\b|\bno hot[\s-]?swap\b/, () => ({ key: 'soldered', value: true, label: 'soldered switches' }));
  add(/\bsilent\b|\bquiet\b/, () => ({ key: 'swtype', value: 'silent', label: 'silent switches' }));
  for (const t of ['linear', 'tactile', 'clicky']) add(new RegExp(String.raw`\b${t}\b`), () => ({ key: 'swtype', value: t, label: `${t} switches` }));
  add(/\bchoc\b/, () => ({ key: 'foot', value: 'choc', label: 'Choc switches' }));
  add(/\btopre\b|\belectrocapacitive\b|\bec switch/, () => ({ key: 'foot', value: 'topre', label: 'Topre switches' }));
  // Firmware, software, systems.
  for (const [k, v] of Object.entries(FW)) add(new RegExp(String.raw`\b${k}\b`), () => ({ key: 'fw', value: k, label: v }));
  add(/\bmac(?:os|book)?\b|\bapple\b/, () => ({ key: 'os', value: 'mac', label: 'Mac support' }));
  add(/\blinux\b/, () => ({ key: 'os', value: 'linux', label: 'Linux support' }));
  // Build.
  add(/\balumin(?:i)?um\b|\bmetal\b|\bcnc\b/, () => ({ key: 'case', value: 'alumin', label: 'aluminum case' }));
  add(/\bwood(?:en)?\b/, () => ({ key: 'case', value: 'wood', label: 'wood case' }));
  add(/\bgasket\b/, () => ({ key: 'mount', value: 'gasket', label: 'gasket mount' }));
  add(/\bkit\b|\bdiy\b|\bsolder kit\b/, () => ({ key: 'kind', value: 'kit', label: 'kit' }));
  add(/\bbarebones?\b/, () => ({ key: 'kind', value: 'barebones', label: 'barebones' }));
  add(/\bprebuilt\b|\bassembled\b|\bready to use\b/, () => ({ key: 'kind', value: 'prebuilt', label: 'assembled' }));
  // Brands and switch makers, longest names first. A name that is both reads as the switch maker when
  // "switch" follows it ("cherry switches"), else as the brand.
  const names = [
    ...db.makers.map((m) => ({ kind: 'swmaker', id: m.id, name: m.name })),
    ...db.brands.map((b) => ({ kind: 'brand', id: b.id, name: b.name })),
  ].sort((a, b) => b.name.length - a.name.length);
  for (const n of names) {
    const word = n.name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (word.length < 3) continue;
    if (n.kind === 'swmaker') add(new RegExp(String.raw`\b${word}\b(?:\s+(?:switches|switch|[a-z]+ switch(?:es)?))?`), (m) => (/(switch|switches)$/.test(m[0]) || !db.brands.some((b) => b.id === n.id) ? { key: 'swmaker', value: n.id, label: `${n.name} switches` } : { key: 'brand', value: n.id, label: n.name }));
    else add(new RegExp(String.raw`\b${word}\b`), () => ({ key: 'brand', value: n.id, label: n.name }));
  }
  return r;
}

const num = (s) => Number(String(s).replace(/,/g, ''));
const escRe = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Matches a whole word in a name: "q1" in "keychron q1 max", not in "keychron q10 max". */
const wordStart = (w) => new RegExp(`(^|[^a-z0-9])${escRe(w)}($|[^a-z0-9])`);

export function normalize(text) {
  return text.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ');
}

/** Reads a sentence: the filters it holds, where each came from, and the words left over. */
export function parse(text, db) {
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
    .split(/[^a-z0-9%$.'-]+/)
    .map((w) => w.replace(/^[.'-]+|[.'-]+$/g, ''))
    .filter((w) => w && !STOP.has(w) && !/^\d+$/.test(w));
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
    if (db.keyboards.some((k) => res.every((re) => re.test(`${k.b} ${k.m}`.toLowerCase())))) {
      filters.push({ key: 'name', value: unknown, label: `“${unknown.join(' ')}”`, words: unknown });
      unknown = [];
    }
  }
  return { filters, unknown };
}

/** true, false, or null when the brand does not publish the value. */
function test(k, f) {
  switch (f.key) {
    case 'std':
      return k.std.length ? k.std.includes(f.value) : k.stagger === 'row' ? null : false;
    case 'stagger':
      return k.stagger === f.value;
    case 'split':
      return k.split === f.value;
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
      const name = `${k.b} ${k.m}`.toLowerCase();
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
function missText(k, group, result) {
  const f = group[0];
  if (result === null) {
    const what = { pmax: 'price', pmin: 'price', fw: 'firmware', os: 'systems', case: 'case', mount: 'mount', hotswap: 'hot-swap', soldered: 'hot-swap', swmaker: 'switches', swtype: 'switch type', std: 'layout' }[f.key] ?? f.label;
    return `${what} not published`;
  }
  switch (f.key) {
    case 'pmax':
    case 'pmin': {
      const p = `$${k.price.toLocaleString('en-US', Number.isInteger(k.price) ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      return f.key === 'pmax' ? `${p}, over $${f.value}` : `${p}, under $${f.value}`;
    }
    case 'stagger':
      return { row: 'row stagger', ortholinear: 'ortholinear', column: 'columnar' }[k.stagger];
    case 'split':
      return k.split === 'none' ? 'one piece' : k.split === 'split' ? 'split' : 'angled one-piece';
    case 'wireless':
      return 'wired only';
    case 'swmaker':
      return `no ${group.map((g) => g.label.replace(/ switches$/, '')).join(' or ')} option`;
    case 'std':
      return `no ${group.map((g) => g.label).join(' or ')} version`;
    case 'size':
      return k.size === 'other' ? `${k.keys ?? '?'} keys` : SIZE_LABEL[k.size] ?? k.size;
    case 'brand':
      return k.b;
    default:
      return `not ${group.map((g) => g.label).join(' or ')}`;
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
export function evaluate(keyboards, filters) {
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
        miss = missText(k, g, r);
        if (misses > 1) break;
      }
    }
    if (misses === 0) exact.push(k);
    else if (misses === 1) near.push({ k, miss });
  }
  return { exact, near, groups, setAside };
}

export const LABELS = { SIZE_LABEL, FOOTPRINT, FW };

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

export const specLine = (k, keys) => {
  const bits = [];
  const hit = (key, text) => bits.push(keys.has(key) ? `<span class="hit">${esc(text)}</span>` : esc(text));
  if (k.size !== 'other') hit(keys.has('compact') ? 'compact' : 'size', SIZE_LABEL[k.size] ?? k.size);
  if (k.keys) bits.push(`${k.keys} keys`);
  if (k.stagger !== 'row') hit('stagger', k.stagger === 'column' ? 'columnar' : 'ortholinear');
  if (k.split !== 'none') hit('split', k.split === 'split' ? 'split' : 'angled one-piece');
  if (k.lp) hit('lp', 'low profile');
  const wireless = k.conn.filter((c) => c !== 'usb');
  if (wireless.length) hit(keys.has('conn') ? 'conn' : 'wireless', wireless.map((c) => (c === '2.4ghz' ? '2.4 GHz' : 'Bluetooth')).join(' + '));
  else bits.push(k.conn.length ? 'wired' : 'connection not published');
  if (k.adj || k.hs === 'magnetic') hit('magnetic', 'magnetic');
  if (k.rt) hit('rt', 'rapid trigger');
  if (k.hs && k.hs !== 'none') hit('hotswap', 'hot-swap');
  const makers = k.swmNames.slice(0, 3);
  if (makers.length) hit('swmaker', makers.join(', '));
  if (k.fw.length) hit('fw', k.fw.map((f) => FW[f] ?? f).join(', '));
  return bits.join('<span class="dot" aria-hidden="true"> · </span>');
};


// ---------- page ----------

if (typeof document !== 'undefined') {
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

  const row = (k, keys, miss) => `<li><a class="result" href="${esc(k.href)}">
      ${thumb(k, IMG)}
      <span class="r-main"><span class="r-name">${esc(k.b)} ${esc(k.m)}</span><span class="r-spec">${specLine(k, keys)}</span>${miss ? `<span class="r-miss"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3.5 3.5l5 5M8.5 3.5l-5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>${esc(miss)}</span>` : ''}</span>
      <span class="r-side"><span class="r-price">${k.price != null ? `$${k.price.toLocaleString('en-US', Number.isInteger(k.price) ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '<span class="nil">no price</span>'}</span><span class="r-rev">${k.rev ? `${k.rev} review${k.rev > 1 ? 's' : ''}` : ''}</span></span>
    </a></li>`;

  const sorter = {
    price: (a, b) => (a.price ?? 1e9) - (b.price ?? 1e9) || a.name.localeCompare(b.name),
    reviews: (a, b) => b.rev - a.rev || (a.price ?? 1e9) - (b.price ?? 1e9),
    name: (a, b) => a.name.localeCompare(b.name),
  };

  function render() {
    const text = input.value;
    const { filters, unknown } = parse(text, db);
    const { exact, near, groups, setAside } = evaluate(db.keyboards, filters);
    const keys = new Set(filters.map((f) => f.key));

    chips.innerHTML =
      filters
        .map((f, i) => `<button type="button" class="chip${setAside.includes(f) ? ' chip-off' : ''}" data-i="${i}" title="${setAside.includes(f) ? 'set aside: grid and columnar boards have no ANSI or ISO stagger' : 'remove'}"><span>${esc(f.label)}</span><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3.5 3.5l5 5M8.5 3.5l-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>`)
        .join('') + (unknown.length ? `<span class="unknown">not read: ${unknown.map((w) => `<em>${esc(w)}</em>`).join(', ')}</span>` : '');
    chips.querySelectorAll('.chip').forEach((b) =>
      b.addEventListener('click', () => {
        const f = filters[Number(b.dataset.i)];
        const left = f.words ? text.replace(new RegExp(`\\b(?:${f.words.map(escRe).join('|')})\\b`, 'gi'), '') : text.slice(0, f.start) + text.slice(f.end);
        input.value = left.replace(/\s*,\s*,/g, ',').replace(/\s{2,}/g, ' ').replace(/^[\s,]+|[\s,]+$/g, '');
        update();
        input.focus();
      }),
    );

    const note = setAside.length ? `<p class="aside-note">${setAside.map((f) => f.label).join(' and ')} set aside: ANSI, ISO and JIS describe row-staggered boards, and grid and columnar boards do not follow them.</p>` : '';
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
    const what = kits || askedKind ? 'keyboards, kits included' : 'assembled keyboards';
    if (!groups.length) {
      count.innerHTML = `<strong>${pool.toLocaleString('en-US')}</strong> ${what} from ${db.brands.length} brands`;
    } else {
      count.innerHTML = `<strong>${list.length.toLocaleString('en-US')}</strong> of ${pool.toLocaleString('en-US')} ${what} match ${groups.length === 1 ? 'this filter' : `all ${groups.length} filters`}${hiddenKits ? `<span class="count-more">, plus ${hiddenKits} kit${hiddenKits > 1 ? 's' : ''} and PCB${hiddenKits > 1 ? 's' : ''}</span>` : ''}`;
    }
    let html = note;
    if (list.length) html += `<ul class="results-list">${list.slice(0, limit).map((k) => row(k, keys)).join('')}</ul>`;
    if (list.length > limit) html += `<button type="button" class="cap-button more" id="more">show ${Math.min(30, list.length - limit)} more</button>`;
    if (groups.length >= 2 && list.length < 8 && nearShown.length) {
      const nearSorted = nearShown.sort((a, b) => sorter[sort](a.k, b.k)).slice(0, 24);
      html += `<h2 class="near-title">${list.length ? 'One filter short' : `No keyboard matches all ${groups.length}. These miss one`}</h2><ul class="results-list near">${nearSorted.map(({ k, miss }) => row(k, keys, miss)).join('')}</ul>`;
    } else if (groups.length && !list.length) {
      html += `<p class="empty">No keyboard comes within one filter of this. Remove a filter above to widen it.</p>`;
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

  fetch('finder-data.json')
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
