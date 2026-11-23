// Checks the keyboard and switch data: node scripts/data/check.mjs [--quiet]
// Rules live in content/data/README.md. Exit code 1 when any file has an error.
// Warnings (unmatched switch names, missing sources) are printed but do not fail.

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

const root = join(import.meta.dirname, '..', '..', 'content', 'data');
const quiet = process.argv.includes('--quiet');

const E = {
  role: ['manufacturer', 'brand', 'both'],
  type: ['linear', 'tactile', 'clicky', 'silent-linear', 'silent-tactile'],
  sensing: ['contact', 'magnetic', 'optical', 'capacitive', 'inductive'],
  footprint: ['mx', 'choc-v1', 'choc-v2', 'gateron-lp', 'cherry-lp', 'cherry-ulp', 'alps', 'topre', 'buckling-spring', 'optical', 'proprietary', 'other'],
  keycap_mount: ['mx', 'choc', 'alps', 'topre', 'other'],
  profile: ['standard', 'low', 'ultra-low'],
  switchStatus: ['current', 'discontinued', 'limited'],
  kbStatus: ['current', 'discontinued'],
  kind: ['prebuilt', 'barebones', 'kit', 'pcb'],
  size: ['full', '96', 'tkl', '75', '65', '60', '50', '40', '30', 'numpad', 'other'],
  layout: ['ansi', 'iso', 'jis'],
  stagger: ['row', 'ortholinear', 'column'],
  split: ['none', 'unibody-angled', 'split'],
  tenting: ['none', 'built-in', 'accessory'],
  connectivity: ['usb', 'bluetooth', '2.4ghz'],
  hot_swap: ['none', '3-pin', '5-pin', 'choc', 'magnetic', 'optical', 'other'],
  firmware: ['qmk', 'via', 'vial', 'zmk', 'kmk', 'proprietary'],
  os: ['windows', 'mac', 'linux', 'ios', 'android'],
  focus: ['gaming', 'enthusiast', 'office', 'ergonomic', 'diy', 'premium', 'budget'],
  sourceKind: ['official', 'datasheet', 'retailer', 'review', 'measurement', 'reference'],
};

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const YEARISH = /^\d{4}(-\d{2})?$/;
const URL = /^https:\/\/\S+$/;

let errors = 0;
let warnings = 0;
const out = [];
const err = (where, msg) => { errors++; out.push(`ERROR ${where}: ${msg}`); };
const warn = (where, msg) => { warnings++; if (!quiet) out.push(`warn  ${where}: ${msg}`); };

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const oneOf = (where, name, v, list, nullable = false) => {
  if (nullable && v === null) return;
  if (!list.includes(v)) err(where, `${name} "${v}" must be one of ${list.join(' | ')}`);
};
const listOf = (where, name, v, list) => {
  if (!Array.isArray(v)) return err(where, `${name} must be a list`);
  for (const x of v) if (!list.includes(x)) err(where, `${name} holds "${x}"; allowed ${list.join(' | ')}`);
};
const bool = (where, name, v, nullable = false) => {
  if (nullable && v === null) return;
  if (typeof v !== 'boolean') err(where, `${name} must be true or false${nullable ? ' or null' : ''}`);
};
const numIn = (where, name, v, lo, hi) => {
  if (v === null) return;
  if (!isNum(v)) return err(where, `${name} must be a number or null`);
  if (v < lo || v > hi) err(where, `${name} = ${v} is outside ${lo}–${hi}`);
};
const strOrNull = (where, name, v) => {
  if (v !== null && (typeof v !== 'string' || !v.trim())) err(where, `${name} must be a non-empty string or null`);
};
const urlOrNull = (where, name, v) => {
  if (v !== null && !URL.test(v ?? '')) err(where, `${name} must be an https URL or null`);
};

function checkSources(where, sources, fieldsWithValues) {
  if (!Array.isArray(sources)) return err(where, 'sources must be a list');
  const backed = new Set();
  sources.forEach((s, i) => {
    const w = `${where} sources[${i}]`;
    if (typeof s?.title !== 'string' || !s.title.trim()) err(w, 'needs a title');
    if (!URL.test(s?.url ?? '')) err(w, 'needs an https url');
    oneOf(w, 'kind', s?.kind, E.sourceKind);
    if (!Array.isArray(s?.backs)) err(w, 'backs must be a list of field names');
    else s.backs.forEach((b) => backed.add(b));
    if (!DATE.test(s?.checked ?? '')) err(w, 'checked must be YYYY-MM-DD');
  });
  for (const f of fieldsWithValues) if (!backed.has(f)) warn(where, `${f} has a value but no source backs it`);
}

function checkReviews(where, reviews) {
  if (!Array.isArray(reviews)) return err(where, 'reviews must be a list');
  reviews.forEach((r, i) => {
    const w = `${where} reviews[${i}]`;
    if (typeof r?.outlet !== 'string' || !r.outlet.trim()) err(w, 'needs an outlet');
    if (!URL.test(r?.url ?? '')) err(w, 'needs an https url');
    if (r?.date !== null && r?.date !== undefined && !DATE.test(r.date) && !YEARISH.test(r.date)) err(w, 'date must be YYYY-MM-DD, YYYY-MM, YYYY or null');
    if (r?.verdict && r.verdict.split(/\s+/).length > 25) err(w, 'verdict is longer than 25 words');
  });
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8').replace(/^﻿/, ''));
  } catch (e) {
    err(basename(file), `not valid JSON: ${e.message}`);
    return null;
  }
}

const files = (dir) => (existsSync(join(root, dir)) ? readdirSync(join(root, dir)).filter((f) => f.endsWith('.json')).map((f) => join(root, dir, f)) : []);

// ---- switches ----
const switchIds = new Map();
const switchNames = new Map();
const makerIds = new Set();
const SWITCH_NUMERIC = ['actuation_force_gf', 'bottom_out_force_gf', 'tactile_force_gf', 'pre_travel_mm', 'total_travel_mm', 'rated_lifespan_million'];

for (const file of files('switches')) {
  const data = readJson(file);
  if (!data) continue;
  const fileId = basename(file, '.json');
  const m = data.maker;
  const mw = `switches/${fileId}.json maker`;
  if (!m) { err(mw, 'missing "maker"'); continue; }
  if (m.id !== fileId) err(mw, `id "${m.id}" must equal the file name "${fileId}"`);
  makerIds.add(m.id);
  if (typeof m.name !== 'string') err(mw, 'name missing');
  oneOf(mw, 'role', m.role, E.role);
  strOrNull(mw, 'country', m.country);
  numIn(mw, 'founded', m.founded ?? null, 1900, 2030);
  urlOrNull(mw, 'official_url', m.official_url ?? null);
  checkSources(mw, m.sources ?? [], []);
  if (!Array.isArray(data.switches)) { err(mw, 'switches must be a list'); continue; }

  data.switches.forEach((s, i) => {
    const w = `switches/${fileId}.json ${s?.id ?? `[${i}]`}`;
    if (!ID.test(s?.id ?? '')) return err(w, 'id must be lowercase words joined by hyphens');
    if (!s.id.startsWith(`${fileId}-`)) err(w, `id must start with "${fileId}-"`);
    if (switchIds.has(s.id)) err(w, `duplicate id (also in ${switchIds.get(s.id)})`);
    switchIds.set(s.id, fileId);
    if (typeof s.name !== 'string' || !s.name.trim()) err(w, 'name missing');
    else switchNames.set(s.name.toLowerCase(), s.id);
    for (const a of s.aka ?? []) switchNames.set(String(a).toLowerCase(), s.id);
    if (s.maker !== fileId) err(w, `maker "${s.maker}" must be "${fileId}"`);
    strOrNull(w, 'made_by', s.made_by ?? null);
    strOrNull(w, 'family', s.family ?? null);
    if (!Array.isArray(s.aka ?? [])) err(w, 'aka must be a list');
    oneOf(w, 'type', s.type, E.type);
    oneOf(w, 'sensing', s.sensing, E.sensing);
    oneOf(w, 'footprint', s.footprint, E.footprint);
    oneOf(w, 'keycap_mount', s.keycap_mount, E.keycap_mount);
    oneOf(w, 'profile', s.profile, E.profile);
    if (s.pins !== null && s.pins !== 3 && s.pins !== 5) err(w, 'pins must be 3, 5 or null');
    numIn(w, 'actuation_force_gf', s.actuation_force_gf ?? null, 5, 250);
    numIn(w, 'bottom_out_force_gf', s.bottom_out_force_gf ?? null, 5, 300);
    numIn(w, 'tactile_force_gf', s.tactile_force_gf ?? null, 5, 300);
    numIn(w, 'pre_travel_mm', s.pre_travel_mm ?? null, 0.05, 5);
    numIn(w, 'total_travel_mm', s.total_travel_mm ?? null, 0.5, 6);
    numIn(w, 'rated_lifespan_million', s.rated_lifespan_million ?? null, 1, 1000);
    if (s.pre_travel_mm && s.total_travel_mm && s.pre_travel_mm > s.total_travel_mm) err(w, 'pre_travel_mm is longer than total_travel_mm');
    if (s.actuation_range_mm !== null && s.actuation_range_mm !== undefined) {
      const r = s.actuation_range_mm;
      if (!Array.isArray(r) || r.length !== 2 || !r.every(isNum) || r[0] >= r[1]) err(w, 'actuation_range_mm must be [shortest, deepest] or null');
    }
    if (typeof s.materials !== 'object' || s.materials === null) err(w, 'materials must be an object {top, bottom, stem}');
    strOrNull(w, 'spring', s.spring ?? null);
    bool(w, 'factory_lubed', s.factory_lubed ?? null, true);
    bool(w, 'light_pipe', s.light_pipe ?? null, true);
    if (s.released !== null && s.released !== undefined && !YEARISH.test(s.released)) err(w, 'released must be YYYY, YYYY-MM or null');
    oneOf(w, 'status', s.status, E.switchStatus);
    urlOrNull(w, 'official_url', s.official_url ?? null);
    strOrNull(w, 'notes', s.notes ?? null);
    checkReviews(w, s.reviews ?? []);
    const valued = SWITCH_NUMERIC.filter((f) => s[f] !== null && s[f] !== undefined);
    if (s.actuation_range_mm) valued.push('actuation_range_mm');
    checkSources(w, s.sources ?? [], valued);
    if (!s.official_url && !(s.sources ?? []).length) warn(w, 'no official_url and no source');
  });
}

// ---- keyboards ----
const kbIds = new Map();
const unmatched = new Map();
const KB_NUMERIC = ['key_count', 'battery_mah', 'polling_rate_hz', 'price_usd'];

for (const file of files('keyboards')) {
  const data = readJson(file);
  if (!data) continue;
  const fileId = basename(file, '.json');
  const b = data.brand;
  const bw = `keyboards/${fileId}.json brand`;
  if (!b) { err(bw, 'missing "brand"'); continue; }
  if (b.id !== fileId) err(bw, `id "${b.id}" must equal the file name "${fileId}"`);
  if (typeof b.name !== 'string') err(bw, 'name missing');
  strOrNull(bw, 'country', b.country ?? null);
  numIn(bw, 'founded', b.founded ?? null, 1850, 2030);
  urlOrNull(bw, 'official_url', b.official_url ?? null);
  listOf(bw, 'focus', b.focus ?? [], E.focus);
  checkSources(bw, b.sources ?? [], []);
  if (!Array.isArray(data.keyboards)) { err(bw, 'keyboards must be a list'); continue; }

  data.keyboards.forEach((k, i) => {
    const w = `keyboards/${fileId}.json ${k?.id ?? `[${i}]`}`;
    if (!ID.test(k?.id ?? '')) return err(w, 'id must be lowercase words joined by hyphens');
    if (!k.id.startsWith(`${fileId}-`)) err(w, `id must start with "${fileId}-"`);
    if (kbIds.has(k.id)) err(w, `duplicate id (also in ${kbIds.get(k.id)})`);
    kbIds.set(k.id, fileId);
    if (k.brand !== fileId) err(w, `brand "${k.brand}" must be "${fileId}"`);
    if (typeof k.model !== 'string' || !k.model.trim()) err(w, 'model missing');
    oneOf(w, 'status', k.status, E.kbStatus);
    if (k.released !== null && k.released !== undefined && !YEARISH.test(k.released)) err(w, 'released must be YYYY, YYYY-MM or null');
    oneOf(w, 'kind', k.kind, E.kind);
    oneOf(w, 'size', k.size, E.size);
    numIn(w, 'key_count', k.key_count ?? null, 4, 200);
    listOf(w, 'layout_standards', k.layout_standards ?? [], E.layout);
    oneOf(w, 'stagger', k.stagger, E.stagger);
    oneOf(w, 'split', k.split, E.split);
    oneOf(w, 'tenting', k.tenting, E.tenting);
    bool(w, 'thumb_cluster', k.thumb_cluster);
    bool(w, 'key_wells', k.key_wells);
    bool(w, 'low_profile', k.low_profile);
    listOf(w, 'connectivity', k.connectivity ?? [], E.connectivity);
    if (!(k.connectivity ?? []).length) err(w, 'connectivity is empty');
    numIn(w, 'battery_mah', k.battery_mah ?? null, 50, 20000);
    numIn(w, 'polling_rate_hz', k.polling_rate_hz ?? null, 100, 16000);
    oneOf(w, 'switch_footprint', k.switch_footprint, E.footprint);
    oneOf(w, 'hot_swap', k.hot_swap, E.hot_swap);
    if (!Array.isArray(k.switches)) err(w, 'switches must be a list');
    else k.switches.forEach((s, j) => {
      if (typeof s?.name !== 'string') return err(w, `switches[${j}] needs a name`);
      if (s.id !== null && s.id !== undefined) {
        if (!switchIds.has(s.id)) err(w, `switches[${j}].id "${s.id}" is not in switches/`);
      } else {
        const guess = switchNames.get(s.name.toLowerCase());
        unmatched.set(s.name, (unmatched.get(s.name) ?? 0) + 1);
        if (guess) warn(w, `switches[${j}] "${s.name}" could be id "${guess}"`);
      }
    });
    bool(w, 'adjustable_actuation', k.adjustable_actuation);
    bool(w, 'rapid_trigger', k.rapid_trigger ?? null, true);
    strOrNull(w, 'case_material', k.case_material ?? null);
    strOrNull(w, 'mount', k.mount ?? null);
    listOf(w, 'firmware', k.firmware ?? [], E.firmware);
    strOrNull(w, 'software', k.software ?? null);
    listOf(w, 'os', k.os ?? [], E.os);
    numIn(w, 'price_usd', k.price_usd ?? null, 1, 10000);
    if (k.price_usd !== null && k.price_usd !== undefined) {
      if (!DATE.test(k.price_date ?? '')) err(w, 'price_usd needs price_date YYYY-MM-DD');
      if (!URL.test(k.price_url ?? '')) err(w, 'price_usd needs price_url');
    }
    urlOrNull(w, 'official_url', k.official_url ?? null);
    strOrNull(w, 'notes', k.notes ?? null);
    checkReviews(w, k.reviews ?? []);
    const valued = KB_NUMERIC.filter((f) => k[f] !== null && k[f] !== undefined && f !== 'price_usd');
    checkSources(w, k.sources ?? [], valued);
    if (k.stagger !== 'row' && (k.layout_standards ?? []).includes('iso')) warn(w, 'an ISO standard on a non-row-staggered board: check');
    if (k.split === 'split' && k.tenting === undefined) err(w, 'split board needs tenting');
  });
}

const nSw = switchIds.size;
const nKb = kbIds.size;
for (const line of out) console.log(line);
if (unmatched.size && !quiet) {
  console.log(`\nSwitch names on keyboards with no id yet (${unmatched.size}):`);
  for (const [name, n] of [...unmatched].sort((a, b) => b[1] - a[1])) console.log(`  ${n}× ${name}`);
}
console.log(`\n${makerIds.size} switch makers, ${nSw} switches · ${files('keyboards').length} keyboard brands, ${nKb} keyboards · ${errors} errors, ${warnings} warnings`);
process.exit(errors ? 1 : 0);
