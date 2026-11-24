// Checks draft guides before they join content/guides: node scripts/data/check-drafts.mjs [file ...]
// Same rules as scripts/guides/check.mjs, with the planned page ids added so drafts may link to each other.
// With no file, checks every draft under .research/drafts/guides/<lang>/.

import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { checkGuide } from '../guides/content.mjs';
import { FIGURES, PAGE_IDS } from '../guides/pages.mjs';

// Planned figure, drafted in .research/drafts/figures/stagger-shapes.mjs.
if (!FIGURES.includes('stagger-shapes')) FIGURES.push('stagger-shapes');

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
  if (problems.length) {
    bad++;
    console.log(`FAIL ${file}`);
    for (const p of problems) console.log(`  - ${p}`);
  } else console.log(`ok   ${file}`);
}
console.log(`${files.length - bad}/${files.length} drafts pass`);
process.exit(bad ? 1 : 0);
