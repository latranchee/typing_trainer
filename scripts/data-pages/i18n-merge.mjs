// Checks translated database chunks against the English ones and folds them into content/data/i18n/<lang>.json.
//   node scripts/data-pages/i18n-merge.mjs <src dir> <out dir> <lang> [--check] [chunk files...]
// --check only reports. Problems that stop a merge: a missing or extra key, an empty value, invalid JSON.
// Warnings: numbers that differ from the English, a long value left in English.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { srcHash } from './i18n.mjs';

const [srcArg, outArg, lang, ...rest] = process.argv.slice(2);
if (!srcArg || !outArg || !lang) throw new Error('usage: i18n-merge.mjs <src dir> <out dir> <lang> [--check] [chunk files...]');
const check = rest.includes('--check');
const only = rest.filter((x) => x !== '--check').map((x) => basename(x));
const SRC = resolve(srcArg);
const OUT = resolve(outArg);
const repo = join(import.meta.dirname, '..', '..');

/** The numbers in a text, separators removed and sorted: "1,000 and 2.5 mm" and "1 000 et 2,5 mm" agree. */
const numbers = (s) =>
  (s.match(/\d[\d.,   ]*\d|\d/g) ?? [])
    .map((n) => n.replace(/[.,   ]/g, ''))
    .sort()
    .join(' ');
const ENGLISH = /\b(the|and|with|which|its|does|not|from|this|that|are|has)\b/gi;

let errors = 0;
let warnings = 0;
const merged = {};
const english = {};
const files = readdirSync(SRC).filter((f) => f.endsWith('.json') && (!only.length || only.includes(f))).sort();
for (const f of files) {
  const src = JSON.parse(readFileSync(join(SRC, f), 'utf8'));
  const outFile = join(OUT, f);
  if (!existsSync(outFile)) {
    if (only.length) {
      console.log(`MISSING ${f}`);
      errors++;
    }
    continue;
  }
  let out;
  try {
    out = JSON.parse(readFileSync(outFile, 'utf8'));
  } catch (e) {
    console.log(`BAD JSON ${f}: ${e.message}`);
    errors++;
    continue;
  }
  const problems = [];
  for (const k of Object.keys(src)) {
    if (!(k in out)) problems.push(`missing key ${k}`);
    else if (typeof out[k] !== 'string' || !out[k].trim()) problems.push(`empty ${k}`);
  }
  for (const k of Object.keys(out)) if (!(k in src)) problems.push(`extra key ${k}`);
  const warns = [];
  for (const [k, en] of Object.entries(src)) {
    const t = out[k];
    if (typeof t !== 'string') continue;
    if (numbers(en) !== numbers(t)) warns.push(`numbers differ ${k}: [${numbers(en)}] vs [${numbers(t)}]`);
    const words = en.split(/\s+/).length;
    if (words >= 5 && t === en) warns.push(`left in English ${k}`);
    else if (words >= 8 && (t.match(ENGLISH) ?? []).length >= 3) warns.push(`reads English ${k}: ${t.slice(0, 80)}`);
  }
  errors += problems.length;
  warnings += warns.length;
  console.log(`${problems.length ? 'FAIL' : 'ok  '} ${f}: ${Object.keys(src).length} strings${problems.length ? `, ${problems.length} problems` : ''}${warns.length ? `, ${warns.length} warnings` : ''}`);
  for (const p of [...problems, ...warns]) console.log(`  - ${p}`);
  Object.assign(merged, out);
  Object.assign(english, src);
}

if (check) {
  console.log(`${errors} problems, ${warnings} warnings`);
  process.exit(errors ? 1 : 0);
}
if (errors) {
  console.log(`${errors} problems: nothing merged`);
  process.exit(1);
}
// Fold the flat keys into the shape build.mjs reads.
// `from` holds a hash of the English each translation was made from: the build ignores a translation whose English
// has changed since (values need none: the English value is the key).
const data = { notes: {}, reviews: {}, about: {}, values: {}, from: { notes: {}, reviews: {}, about: {} } };
for (const [k, v] of Object.entries(merged)) {
  const [kind, ...restKey] = k.split(':');
  const id = restKey.join(':');
  const table = kind === 'kbn' || kind === 'swn' ? 'notes' : kind === 'rv' ? 'reviews' : kind === 'ab' ? 'about' : null;
  if (table) {
    data[table][id] = v;
    data.from[table][id] = srcHash(english[k]);
  }
  else if (kind === 'val') data.values[id] = v;
}
const target = join(repo, 'content', 'data', 'i18n', `${lang}.json`);
mkdirSync(join(repo, 'content', 'data', 'i18n'), { recursive: true });
writeFileSync(target, `${JSON.stringify(data, null, 1)}\n`);
console.log(`merged ${Object.keys(merged).length} strings from ${files.length} chunks -> ${target} (${warnings} warnings)`);
