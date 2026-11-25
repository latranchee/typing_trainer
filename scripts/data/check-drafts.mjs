// Checks draft guides before they join content/guides: node scripts/data/check-drafts.mjs [file ...]
// Same rules as scripts/guides/check.mjs, with the planned page ids added so drafts may link to each other.
// With no file, checks every draft under .research/drafts/guides/<lang>/.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dbPath } from '../data-pages/db.mjs';
import { checkGuide } from '../guides/content.mjs';
import { PAGE_IDS } from '../guides/pages.mjs';

export const NEW_IDS = [
  'keyboard-switches',
  'linear-vs-tactile-vs-clicky',
  'linear-switches',
  'tactile-switches',
  'clicky-switches',
  'quiet-switches',
  'red-vs-brown-vs-blue-switches',
  'hall-effect-switches',
  'optical-switches',
  'low-profile-switches',
  'topre-switches',
  'buckling-spring',
  'alps-switches',
  'switch-specs',
  'hot-swappable-keyboard',
  'lubing-switches',
  'best-switches-for-typing',
  'switch-manufacturers',
  'staggered-vs-ortholinear-vs-columnar',
  'ortholinear-keyboard',
  'columnar-keyboard',
  'split-keyboard',
  'ergonomic-keyboard',
  'keyboard-sizes',
  // Batch 2 (2026-11-25).
  'wireless-mechanical-keyboard',
  'keyboards-for-long-nails',
  'number-pad',
  '60-percent-keyboard',
  'mechanical-vs-membrane-keyboard',
];
for (const id of NEW_IDS) if (!PAGE_IDS.includes(id)) PAGE_IDS.push(id);

const root = join(import.meta.dirname, '..', '..', '.research', 'drafts', 'guides');
let files = process.argv.slice(2);
if (files.length === 0 && existsSync(root)) {
  files = readdirSync(root).flatMap((lang) => readdirSync(join(root, lang)).filter((f) => f.endsWith('.html')).map((f) => join(root, lang, f)));
}
let bad = 0;
for (const file of files) {
  const problems = checkGuide(file);
  // db: links must name a record that has a page (the guide checker sees only their shape).
  for (const m of readFileSync(file, 'utf8').matchAll(/href="db:([^"]+)"/g)) {
    try {
      dbPath(m[1]);
    } catch (e) {
      problems.push(e.message);
    }
  }
  if (problems.length) {
    bad++;
    console.log(`FAIL ${file}`);
    for (const p of problems) console.log(`  - ${p}`);
  } else console.log(`ok   ${file}`);
}
console.log(`${files.length - bad}/${files.length} drafts pass`);
process.exit(bad ? 1 : 0);
