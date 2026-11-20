// Reads one guide file and says what is wrong with it. No dependencies.
//
// A guide file is a meta block, then the article body as an HTML fragment:
//
//   <!--meta
//   { ...JSON... }
//   -->
//   <h2>...</h2>
//   <p>...</p>

import { readFileSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import { APP_LAYOUTS, CHART_LAYOUTS, DRILLS, FIGURES, GUIDE_LANGS, PAGE_IDS } from './pages.mjs';

const ALLOWED_TAGS = new Set([
  'h2', 'h3', 'p', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'caption',
  'strong', 'em', 'a', 'kbd', 'code', 'figure', 'figcaption', 'blockquote', 'br',
]);
const ALLOWED_ATTRS = { a: ['href'], figure: ['data-figure', 'data-layout'], th: ['scope'], td: [], table: [] };

/** Characters for CJK languages, words for the others. */
export function measure(text, cjk) {
  const plain = text.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;|&#\d+;/g, ' ');
  if (cjk) return [...plain.replace(/\s+/g, '')].length;
  return plain.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

export function parseGuide(file) {
  const raw = readFileSync(file, 'utf8').replace(/^﻿/, '');
  const match = raw.match(/^<!--meta\s*\n([\s\S]*?)\n-->\s*\n([\s\S]*)$/);
  if (!match) return { error: 'the file must start with <!--meta, a JSON object, then --> on its own line, then the body' };
  let meta;
  try {
    meta = JSON.parse(match[1]);
  } catch (e) {
    return { error: `meta is not valid JSON: ${e.message}` };
  }
  return { meta, body: match[2].trim() };
}

const LIMITS = {
  latin: { title: [30, 62], description: [110, 160], h1: [15, 90], summary: [35, 80], body: [900, 2600], faqA: [10, 90] },
  cjk: { title: [12, 34], description: [45, 95], h1: [8, 45], summary: [70, 190], body: [1800, 6000], faqA: [25, 180] },
};

/** Every problem with one guide file, as sentences. Empty when the file is fine. */
export function checkGuide(file, { requireCounterparts = false } = {}) {
  const problems = [];
  const lang = basename(dirname(file));
  const id = basename(file).replace(/\.html$/, '');
  if (!GUIDE_LANGS[lang]) return [`folder "${lang}" is not a guide language (${Object.keys(GUIDE_LANGS).join(', ')})`];
  if (!PAGE_IDS.includes(id)) return [`"${id}" is not a page id (${PAGE_IDS.join(', ')})`];
  const parsed = parseGuide(file);
  if (parsed.error) return [parsed.error];
  const { meta, body } = parsed;
  const cjk = GUIDE_LANGS[lang].cjk;
  const lim = cjk ? LIMITS.cjk : LIMITS.latin;
  const unit = cjk ? 'characters' : 'words';
  const len = (s) => (cjk ? [...s].length : s.length);

  for (const key of ['id', 'lang', 'slug', 'title', 'description', 'h1', 'keyword', 'summary', 'faq', 'sources', 'updated', 'try']) {
    if (meta[key] === undefined) problems.push(`meta.${key} is missing`);
  }
  if (problems.length) return problems;
  if (meta.id !== id) problems.push(`meta.id "${meta.id}" must equal the file name "${id}"`);
  if (meta.lang !== lang) problems.push(`meta.lang "${meta.lang}" must equal the folder "${lang}"`);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(meta.slug) || meta.slug.length > 60) problems.push(`meta.slug "${meta.slug}" must be lowercase ASCII words joined by hyphens, at most 60 characters`);
  if (lang === 'en' && meta.slug !== id) problems.push(`the English slug must equal the id "${id}"`);

  const range = (name, value, [lo, hi], measured) => {
    if (measured < lo || measured > hi) problems.push(`${name} is ${measured} long; keep it within ${lo}–${hi}`);
  };
  // Titles and descriptions are measured in characters (what a search result shows); CJK counts each character.
  range('meta.title (characters)', meta.title, lim.title, len(meta.title));
  range('meta.description (characters)', meta.description, lim.description, len(meta.description));
  range('meta.h1 (characters)', meta.h1, lim.h1, len(meta.h1));
  range(`meta.summary (${unit})`, meta.summary, lim.summary, measure(meta.summary, cjk));
  if (/petitdoigt/i.test(meta.title) && len(meta.title) > lim.title[1] - 13) problems.push('the title has no room for the brand: the builder adds " · petitdoigt" itself, leave it out');
  if (/[<>]/.test(meta.title + meta.description + meta.h1 + meta.summary)) problems.push('title, description, h1 and summary are plain text: no HTML');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.updated)) problems.push('meta.updated must be YYYY-MM-DD');

  if (!Array.isArray(meta.faq) || meta.faq.length < 3 || meta.faq.length > 6) problems.push('meta.faq must hold 3 to 6 {q, a} entries');
  else meta.faq.forEach((f, i) => {
    if (typeof f.q !== 'string' || typeof f.a !== 'string') problems.push(`meta.faq[${i}] needs string q and a`);
    else range(`meta.faq[${i}].a (${unit})`, f.a, lim.faqA, measure(f.a, cjk));
  });
  if (!Array.isArray(meta.sources)) problems.push('meta.sources must be a list (empty is fine when the page states no outside fact)');
  else meta.sources.forEach((s, i) => {
    if (typeof s.title !== 'string' || !/^https:\/\/\S+$/.test(s.url ?? '')) problems.push(`meta.sources[${i}] needs a title and an https url`);
  });
  const tryLink = meta.try;
  if (typeof tryLink !== 'object' || typeof tryLink.label !== 'string' || !DRILLS.includes(tryLink.drill)) problems.push(`meta.try must be {label, drill (${DRILLS.join('|')}), layout?}`);
  else if (tryLink.layout !== undefined && !APP_LAYOUTS.includes(tryLink.layout)) problems.push(`meta.try.layout "${tryLink.layout}" is not a trainer layout (${APP_LAYOUTS.join(', ')})`);

  // Body: allowed tags and attributes only.
  for (const m of body.matchAll(/<\/?([a-zA-Z0-9]+)([^>]*)>/g)) {
    const tag = m[1].toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) {
      problems.push(`<${tag}> is not allowed in the body (allowed: ${[...ALLOWED_TAGS].join(' ')})`);
      continue;
    }
    for (const a of m[2].matchAll(/([a-zA-Z-]+)\s*=\s*"([^"]*)"/g)) {
      const allowed = ALLOWED_ATTRS[tag] ?? [];
      if (!allowed.includes(a[1])) problems.push(`attribute ${a[1]} on <${tag}> is not allowed`);
    }
    if (/style=|class=|id=/.test(m[2])) problems.push(`<${tag}> carries style/class/id: not allowed`);
  }
  if (/<h1/i.test(body)) problems.push('no <h1> in the body: the builder writes it from meta.h1');
  if (!/^<h2|^<p/.test(body)) problems.push('the body starts with <p> or <h2>');
  const h2 = [...body.matchAll(/<h2>/g)].length;
  if (h2 < 4) problems.push(`the body has ${h2} <h2>; give it at least 4 sections`);

  // Links.
  const guideLinks = new Set();
  for (const m of body.matchAll(/<a\s+href="([^"]*)"/g)) {
    const href = m[1];
    if (href.startsWith('guide:')) {
      const target = href.slice(6);
      if (!PAGE_IDS.includes(target)) problems.push(`link ${href}: no such page id`);
      else if (target === id) problems.push(`link ${href}: a page does not link to itself`);
      else guideLinks.add(target);
    } else if (href.startsWith('app:')) {
      const [drill, query] = href.slice(4).split('?');
      if (!DRILLS.includes(drill)) problems.push(`link ${href}: drill must be one of ${DRILLS.join(', ')}`);
      if (query) {
        const layout = new URLSearchParams(query).get('layout');
        if (!layout || !APP_LAYOUTS.includes(layout) || [...new URLSearchParams(query).keys()].some((k) => k !== 'layout')) problems.push(`link ${href}: the only query is layout=<${APP_LAYOUTS.join('|')}>`);
      }
    } else if (!/^https:\/\//.test(href)) {
      problems.push(`link ${href}: use guide:<id>, app:<drill>[?layout=<id>] or a full https URL`);
    }
  }
  if (guideLinks.size < 3) problems.push(`the body links to ${guideLinks.size} other guides with guide:<id>; link at least 3`);

  // Figures.
  for (const m of body.matchAll(/<figure([^>]*)>([\s\S]*?)<\/figure>/g)) {
    const kind = m[1].match(/data-figure="([^"]*)"/)?.[1];
    if (!FIGURES.includes(kind)) problems.push(`<figure> needs data-figure one of ${FIGURES.join(', ')}`);
    if (kind === 'finger-chart' && !CHART_LAYOUTS.includes(m[1].match(/data-layout="([^"]*)"/)?.[1])) problems.push(`finger-chart needs data-layout one of ${CHART_LAYOUTS.join(', ')}`);
    if (!/<figcaption>[\s\S]+<\/figcaption>/.test(m[2]) || m[2].replace(/<figcaption>[\s\S]*<\/figcaption>/, '').trim()) problems.push('a <figure> holds only a <figcaption>: the builder draws the picture');
  }

  range(`the body (${unit})`, body, lim.body, measure(body, cjk));

  if (requireCounterparts && lang !== 'en') {
    // Nothing yet: kept for a build-time check that every translation has its English master.
  }
  return problems;
}
