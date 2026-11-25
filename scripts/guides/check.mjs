// Checks guide files: node scripts/guides/check.mjs [file ...]
// With no file, checks every guide under content/guides. Exit code 1 when any file has a problem.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dbPath } from '../data-pages/db.mjs';
import { checkGuide } from './content.mjs';
import { GUIDE_LANGS } from './pages.mjs';

const root = join(import.meta.dirname, '..', '..', 'content', 'guides');
let files = process.argv.slice(2);
if (files.length === 0) {
  files = Object.keys(GUIDE_LANGS).flatMap((lang) => {
    const dir = join(root, lang);
    return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.html')).map((f) => join(dir, f)) : [];
  });
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
  } else {
    console.log(`ok   ${file}`);
  }
}
console.log(`${files.length - bad}/${files.length} files pass`);
process.exit(bad ? 1 : 0);
