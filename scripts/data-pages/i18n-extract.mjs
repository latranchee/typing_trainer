// Cuts the database's English prose into chunks for translation: notes, review summaries, brand and maker
// descriptions, and the free-text spec values (case, mount, spring, materials).
//   node scripts/data-pages/i18n-extract.mjs <out dir> [--words 1500]
// Each chunk is { "<key>": "<English text>" }. Keys:
//   kbn:<keyboard id>  swn:<switch id>  rv:<record id>|<review url>  ab:brand:<id>  ab:maker:<id>  val:<field>:<value>
// A translator writes the same keys with the translated text; scripts/data-pages/i18n-merge.mjs folds the
// chunks into content/data/i18n/<lang>.json, which build.mjs reads.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { brands, keyboards, makers, switches } from './db.mjs';

const [outArg] = process.argv.slice(2);
if (!outArg) throw new Error('usage: i18n-extract.mjs <out dir> [--words 1500]');
const OUT = resolve(outArg);
const WORDS = Number(process.argv.includes('--words') ? process.argv[process.argv.indexOf('--words') + 1] : 1500);

/** Every translatable string, grouped so a chunk holds one kind of text. */
export function translatable() {
  const groups = { about: {}, values: {}, reviews: {}, kbNotes: {}, swNotes: {} };
  for (const b of brands) if (b.about) groups.about[`ab:brand:${b.id}`] = b.about;
  for (const m of makers) if (m.about) groups.about[`ab:maker:${m.id}`] = m.about;
  const val = (field, v) => {
    if (typeof v === 'string' && /[a-z]{3}/i.test(v)) groups.values[`val:${field}:${v}`] = v;
  };
  for (const k of keyboards) {
    val('case', k.case_material);
    val('mount', k.mount);
    for (const r of k.reviews) if (r.verdict) groups.reviews[`rv:${k.id}|${r.url}`] = r.verdict;
    if (k.notes) groups.kbNotes[`kbn:${k.id}`] = k.notes;
  }
  for (const s of switches) {
    val('spring', s.spring);
    for (const part of ['top', 'bottom', 'stem']) val('material', s.materials?.[part]);
    for (const r of s.reviews ?? []) if (r.verdict) groups.reviews[`rv:${s.id}|${r.url}`] = r.verdict;
    if (s.notes) groups.swNotes[`swn:${s.id}`] = s.notes;
  }
  return groups;
}

const words = (s) => s.split(/\s+/).filter(Boolean).length;

if (process.argv[1]?.endsWith('i18n-extract.mjs')) {
  mkdirSync(OUT, { recursive: true });
  const groups = translatable();
  const chunks = [];
  for (const [kind, entries] of Object.entries(groups)) {
    let cur = {};
    let n = 0;
    for (const [k, v] of Object.entries(entries)) {
      if (n && n + words(v) > WORDS) {
        chunks.push({ kind, entries: cur, words: n });
        cur = {};
        n = 0;
      }
      cur[k] = v;
      n += words(v);
    }
    if (n) chunks.push({ kind, entries: cur, words: n });
  }
  chunks.forEach((c, i) => writeFileSync(join(OUT, `${String(i + 1).padStart(2, '0')}-${c.kind}.json`), `${JSON.stringify(c.entries, null, 1)}\n`));
  const total = chunks.reduce((n, c) => n + c.words, 0);
  console.log(`${chunks.length} chunks, ${total} words, ${chunks.reduce((n, c) => n + Object.keys(c.entries).length, 0)} strings -> ${OUT}`);
  for (const [i, c] of chunks.entries()) console.log(`  ${String(i + 1).padStart(2, '0')}-${c.kind}: ${Object.keys(c.entries).length} strings, ${c.words} words`);
}
