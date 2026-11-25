// The keyboard and switch database as the site builders see it: records, their page paths, and the preset
// lists. Shared by scripts/data-pages/build.mjs (the database pages) and scripts/guides/build.mjs (db: links).

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(import.meta.dirname, '..', '..');
const DATA = join(repo, 'content', 'data');
const read = (dir) =>
  readdirSync(join(DATA, dir))
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(DATA, dir, f), 'utf8')));

export const makerFiles = read('switches');
export const brandFiles = read('keyboards');
export const makers = makerFiles.map((f) => f.maker);
export const brands = brandFiles.map((f) => f.brand);
export const makerById = new Map(makers.map((m) => [m.id, m]));
export const brandById = new Map(brands.map((b) => [b.id, b]));
export const switches = makerFiles.flatMap((f) => f.switches);
export const switchById = new Map(switches.map((s) => [s.id, s]));
export const keyboards = brandFiles.flatMap((f) => f.keyboards);
export const keyboardById = new Map(keyboards.map((k) => [k.id, k]));
/** Records with a brand photo on Cloudflare Images: id -> { kind, credit, page, line? } (written by the photo pipeline). */
export const photos = existsSync(join(DATA, 'photos.json')) ? JSON.parse(readFileSync(join(DATA, 'photos.json'), 'utf8')) : {};

const slugOf = (id, prefix) => (id.startsWith(`${prefix}-`) ? id.slice(prefix.length + 1) : id);
/** Site paths, without the leading slash, ending in a slash. */
export const kbPath = (k) => `en/keyboards/${k.brand}/${slugOf(k.id, k.brand)}/`;
export const swPath = (s) => `en/switches/${s.maker}/${slugOf(s.id, s.maker)}/`;
export const brandPath = (id) => `en/keyboards/${id}/`;
export const makerPath = (id) => `en/switches/${id}/`;
export const listPath = (id) => `en/keyboards/${id}/`;

/** A switch gets its own page when the maker's page is known or it publishes at least three figures; thin records
 * stay as rows on the maker page. */
const FIGURE_FIELDS = ['actuation_force_gf', 'pre_travel_mm', 'total_travel_mm', 'bottom_out_force_gf', 'tactile_force_gf', 'actuation_range_mm'];
export const switchHasPage = (s) => !!s.official_url || FIGURE_FIELDS.filter((f) => s[f] != null).length >= 3;

/** The newest `checked` date among a record's sources. */
export const checkedOf = (r) => (r.sources ?? []).map((s) => s.checked).filter(Boolean).sort().at(-1) ?? null;

// ---------- preset lists ----------

const linkedSwitches = (k) => k.switches.map((o) => (o.id ? switchById.get(o.id) : null)).filter(Boolean);
const wireless = (k) => k.connectivity.some((c) => c !== 'usb');
// "Mechanical" here = the board names a switch footprint (laptop-style and unstated ones are "other").
const mechanical = (k) => k.switch_footprint && k.switch_footprint !== 'other';
const magnetic = (k) => k.adjustable_actuation === true || k.hot_swap === 'magnetic' || linkedSwitches(k).some((s) => s.sensing === 'magnetic');
const ergonomic = (k) => k.split !== 'none' || k.stagger !== 'row' || k.tenting === 'built-in' || k.key_wells === true;

/**
 * Preset lists: a page each at /en/keyboards/<id>/, with the matching boards and a link into the finder.
 * `guide` = the guide that explains the topic; `q` = the finder sentence for the same search.
 */
export const LISTS = [
  { id: 'ergonomic-keyboards', name: 'Ergonomic keyboards', test: ergonomic, q: 'ergonomic', guide: 'ergonomic-keyboard', what: 'split, column-staggered, ortholinear, angled, tented or key-well keyboards' },
  { id: 'split-keyboards', name: 'Split keyboards', test: (k) => k.split === 'split', q: 'split', guide: 'split-keyboard', what: 'keyboards that come in two halves' },
  { id: 'columnar-keyboards', name: 'Column-staggered keyboards', test: (k) => k.stagger === 'column', q: 'columnar', guide: 'columnar-keyboard', what: 'keyboards with column stagger, where each finger’s keys run in a straight column' },
  { id: 'wireless-mechanical-keyboards', name: 'Wireless mechanical keyboards', test: (k) => wireless(k) && mechanical(k), q: 'wireless', guide: 'wireless-mechanical-keyboard', what: 'mechanical keyboards that connect over Bluetooth or a 2.4 GHz dongle' },
  { id: 'hall-effect-keyboards', name: 'Hall effect keyboards', test: magnetic, q: 'hall effect', guide: 'hall-effect-switches', what: 'keyboards with magnetic (Hall effect) switches, where you set the actuation point' },
  { id: 'low-profile-keyboards', name: 'Low-profile keyboards', test: (k) => k.low_profile === true, q: 'low profile', guide: 'low-profile-switches', what: 'keyboards with low-profile switches and keycaps' },
  { id: 'hot-swappable-keyboards', name: 'Hot-swappable keyboards', test: (k) => !!k.hot_swap && k.hot_swap !== 'none', q: 'hot swap', guide: 'hot-swappable-keyboard', what: 'keyboards whose switches pull out without soldering' },
  { id: 'quiet-keyboards', name: 'Quiet keyboards', test: (k) => linkedSwitches(k).some((s) => s.type.startsWith('silent')), q: 'silent', guide: 'quiet-switches', what: 'keyboards sold with a silent linear or silent tactile switch option' },
  { id: '60-percent-keyboards', name: '60% keyboards', test: (k) => k.size === '60', q: '60%', guide: '60-percent-keyboard', what: '60% keyboards: the main block without function row, arrows or numpad' },
  { id: '65-percent-keyboards', name: '65% keyboards', test: (k) => k.size === '65', q: '65%', guide: 'keyboard-sizes', what: '65% keyboards: a 60% with arrows and a column of navigation keys' },
  { id: '75-percent-keyboards', name: '75% keyboards', test: (k) => k.size === '75', q: '75%', guide: 'keyboard-sizes', what: '75% keyboards: function row and arrows packed tight, no numpad' },
  { id: 'tkl-keyboards', name: 'Tenkeyless (TKL) keyboards', test: (k) => k.size === 'tkl', q: 'tkl', guide: 'keyboard-sizes', what: 'tenkeyless keyboards: a full layout minus the numpad' },
  { id: 'full-size-keyboards', name: 'Full-size keyboards', test: (k) => k.size === 'full' || k.size === '96', q: 'full size', guide: 'keyboard-sizes', what: 'full-size and 96% keyboards, with a numpad' },
  { id: 'mac-keyboards', name: 'Mechanical keyboards for Mac', test: (k) => k.os.includes('mac') && mechanical(k), q: 'for mac', guide: 'keyboard-sizes', what: 'mechanical keyboards whose brand states macOS support' },
  { id: 'keyboards-under-100', name: 'Keyboards under $100', test: (k) => k.price_usd != null && k.price_usd < 100, q: 'under $100', guide: 'keyboard-switches', what: 'keyboards listed under $100 on their brand’s own store' },
];
for (const l of LISTS) {
  if (brandById.has(l.id)) throw new Error(`list id ${l.id} collides with a brand id`);
  l.items = keyboards.filter(l.test);
}
export const listById = new Map(LISTS.map((l) => [l.id, l]));

// ---------- switch makers of each keyboard option ----------

const makerNames = makers.map((m) => ({ id: m.id, re: new RegExp(`\\b${m.name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`) })).sort((a, b) => b.re.source.length - a.re.source.length);
function optionMaker(opt) {
  if (opt.id && switchById.has(opt.id)) return switchById.get(opt.id).maker;
  const n = opt.name.toLowerCase();
  return makerNames.find((m) => m.re.test(n))?.id ?? null;
}

// ---------- finder data ----------

export function finderRecord(k) {
  const linked = k.switches.map((o) => (o.id ? switchById.get(o.id) : null)).filter(Boolean);
  const swm = [...new Set(k.switches.map(optionMaker).filter(Boolean))];
  return {
    id: k.id,
    brand: k.brand,
    b: brandById.get(k.brand)?.name ?? k.brand,
    m: k.model,
    href: `../${kbPath(k).slice('en/keyboards/'.length)}`,
    price: k.price_usd,
    size: k.size,
    keys: k.key_count,
    std: k.layout_standards,
    stagger: k.stagger,
    split: k.split,
    tent: k.tenting,
    thumb: k.thumb_cluster,
    wells: k.key_wells,
    lp: k.low_profile,
    conn: k.connectivity,
    foot: k.switch_footprint,
    hs: k.hot_swap,
    sw: k.switches.map((o) => o.name),
    swm,
    swmNames: swm.map((id) => makerById.get(id)?.name ?? id),
    swt: [...new Set(linked.map((s) => s.type))],
    swsense: [...new Set(linked.map((s) => s.sensing))],
    adj: k.adjustable_actuation,
    rt: k.rapid_trigger,
    fw: k.firmware,
    os: k.os,
    kind: k.kind,
    case: k.case_material,
    mount: k.mount,
    rev: k.reviews.length,
    status: k.status,
    ...(photos[k.id] ? { img: 1, bg: 'var(--photo-tile)' } : {}),
  };
}
/** What the finder page loads (finder-data.json): every keyboard, trimmed to the fields the finder reads. */
export const finderDb = (photoBase) => ({
  checked: keyboards.map(checkedOf).filter(Boolean).sort().at(-1) ?? null,
  photoBase,
  brands: brands.map((b) => ({ id: b.id, name: b.name })),
  makers: makers.map((m) => ({ id: m.id, name: m.name })),
  keyboards: keyboards.map(finderRecord),
});

// ---------- db: links in guides ----------

/** The site path (no leading slash) of a db: link target, or throws when the record does not exist. */
export function dbPath(target) {
  if (target === 'keyboards') return 'en/keyboards/';
  if (target === 'switches') return 'en/switches/';
  if (target === 'finder') return 'en/keyboards/finder/';
  const [kind, id] = target.split('/');
  if (kind === 'keyboard' && keyboardById.has(id)) return kbPath(keyboardById.get(id));
  if (kind === 'switch' && switchById.has(id) && switchHasPage(switchById.get(id))) return swPath(switchById.get(id));
  if (kind === 'brand' && brandById.has(id)) return brandPath(id);
  if (kind === 'maker' && makerById.has(id)) return makerPath(id);
  if (kind === 'list' && listById.has(id)) return listPath(id);
  throw new Error(`db:${target}: no such ${kind}`);
}
