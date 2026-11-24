// Links the switch names on keyboards to switch records: node scripts/data/link.mjs [--write] [--skip brand,brand]
// A name links when it matches one switch record, and only one, by:
//   1. content/data/switch-aliases.json (name as written on the keyboard → switch id), then
//   2. the record's name or aka, with or without the maker's name in front,
//      compared as a set of words (case, order, "switch", "mechanical", "RGB" and punctuation ignored).
// Without --write it prints what it would link and what stays unlinked.

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

const root = join(import.meta.dirname, '..', '..', 'content', 'data');
const write = process.argv.includes('--write');
const skipArg = process.argv.indexOf('--skip');
const skip = new Set(skipArg > 0 ? process.argv[skipArg + 1].split(',') : []);

const DROP = new Set(['switch', 'switches', 'mechanical', 'rgb', 'key', 'keyswitch', 'keyswitches', 'the', 'with']);
export function wordsOf(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[®™]/g, '')
    .replace(/[^a-z0-9.]+/g, ' ')
    .split(' ')
    .filter((w) => w && !DROP.has(w));
}
const keyOf = (name) => [...new Set(wordsOf(name))].sort().join(' ');

const read = (dir) => readdirSync(join(root, dir)).filter((f) => f.endsWith('.json')).map((f) => ({ file: join(root, dir, f), data: JSON.parse(readFileSync(join(root, dir, f), 'utf8')) }));

const index = new Map(); // key -> Set(id)
const add = (name, id) => {
  if (!name) return;
  const k = keyOf(name);
  if (!k) return;
  if (!index.has(k)) index.set(k, new Set());
  index.get(k).add(id);
};
const ids = new Set();
for (const { data } of read('switches')) {
  const makerName = data.maker.name;
  for (const s of data.switches) {
    ids.add(s.id);
    for (const n of [s.name, ...(s.aka ?? [])]) {
      add(n, s.id);
      add(`${makerName} ${n}`, s.id);
    }
  }
}

const aliasFile = join(root, 'switch-aliases.json');
const aliases = existsSync(aliasFile) ? JSON.parse(readFileSync(aliasFile, 'utf8')) : {};
for (const [name, id] of Object.entries(aliases)) {
  if (id !== null && !ids.has(id)) console.log(`alias "${name}" → "${id}": no such switch`);
}
const aliasByKey = new Map(Object.entries(aliases).map(([n, id]) => [keyOf(n), id]));

const linked = new Map();
const ambiguous = new Map();
const unlinked = new Map();
let changedFiles = 0;

for (const { file, data } of read('keyboards')) {
  const brand = basename(file, '.json');
  if (skip.has(brand)) continue;
  let changed = false;
  for (const k of data.keyboards) {
    for (const s of k.switches ?? []) {
      if (s.id) continue;
      const key = keyOf(s.name);
      // An alias set to null keeps a name unlinked on purpose (a generic or look-alike name).
      if (aliasByKey.has(key) && aliasByKey.get(key) === null) {
        unlinked.set(s.name, (unlinked.get(s.name) ?? 0) + 1);
        continue;
      }
      let id = aliasByKey.get(key) ?? null;
      if (!id) {
        const hits = index.get(key);
        if (hits?.size === 1) id = [...hits][0];
        else if (hits?.size > 1) {
          ambiguous.set(s.name, [...hits]);
          continue;
        }
      }
      if (id) {
        linked.set(s.name, id);
        if (write) { s.id = id; changed = true; }
      } else {
        unlinked.set(s.name, (unlinked.get(s.name) ?? 0) + 1);
      }
    }
  }
  if (write && changed) {
    writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
    changedFiles++;
  }
}

console.log(`Linked ${linked.size} names${write ? ` (written to ${changedFiles} files)` : ' (dry run)'}:`);
for (const [n, id] of [...linked].sort()) console.log(`  ${n} → ${id}`);
console.log(`\nAmbiguous (${ambiguous.size}):`);
for (const [n, hits] of ambiguous) console.log(`  ${n} → ${hits.join(' | ')}`);
console.log(`\nUnlinked (${unlinked.size}):`);
for (const [n, c] of [...unlinked].sort((a, b) => b[1] - a[1])) console.log(`  ${c}× ${n}`);
