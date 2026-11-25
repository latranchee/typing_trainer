// Builds the guides into dist/: one page per guide and language, an index per language,
// the stylesheet and fonts, sitemap.xml and robots.txt. Runs after `vite build`.
//   node scripts/guides/build.mjs [--out dist]
// Every guide file must pass the checker; a failing file stops the build. --lenient skips
// failing files instead (for previews while content is still being written).

import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { checkGuide, measure, parseGuide } from './content.mjs';
import { STAGGER_NAMES, boardShapes, fingerChart, staggerShapes } from './figures.mjs';
import { dbPath } from '../data-pages/db.mjs';
import { GUIDE_LANGS, PAGE_IDS } from './pages.mjs';
import { APP_LANGS, GROUPS, STRINGS } from './strings.mjs';

const SITE = 'https://petitdoigt.ca';
const BRAND = 'petitdoigt';
const REPO_URL = 'https://github.com/latranchee/typing_trainer';
const repo = join(import.meta.dirname, '..', '..');
const outArg = process.argv.indexOf('--out');
const OUT = resolve(repo, outArg > 0 ? process.argv[outArg + 1] : 'dist');
const CONTENT = join(repo, 'content', 'guides');
const LENIENT = process.argv.includes('--lenient');
const ASSETS = 'guides-assets';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const write = (path, text) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
};

// ---------- load ----------

/** guides[lang][id] = { meta, body } for every file that exists. */
const guides = {};
let failed = 0;
for (const lang of Object.keys(GUIDE_LANGS)) {
  guides[lang] = {};
  const dir = join(CONTENT, lang);
  if (!existsSync(dir)) continue;
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.html'))) {
    const path = join(dir, file);
    const problems = checkGuide(path);
    if (problems.length) {
      failed++;
      console.error(`FAIL ${lang}/${file}\n  - ${problems.join('\n  - ')}`);
      continue;
    }
    const { meta, body } = parseGuide(path);
    guides[lang][meta.id] = { meta, body };
  }
}
if (failed && !LENIENT) {
  console.error(`${failed} guide file(s) fail the checker; nothing built.`);
  process.exit(1);
}
const langsWith = (id) => Object.keys(GUIDE_LANGS).filter((lang) => guides[lang][id]);
const langsWithAny = Object.keys(GUIDE_LANGS).filter((lang) => Object.keys(guides[lang]).length > 0);

// ---------- urls ----------

const pagePath = (lang, id) => `/${lang}/${guides[lang][id].meta.slug}/`;
const indexPath = (lang) => `/${lang}/`;
const abs = (path) => `${SITE}${path}`;
/** From a page `depth` folders below the root, the relative way back to it. */
const up = (depth) => '../'.repeat(depth);

function appHref(lang, drill, layout, depth) {
  const params = new URLSearchParams();
  if (APP_LANGS.includes(lang)) params.set('lang', lang);
  if (layout) params.set('layout', layout);
  const query = params.toString();
  return `${up(depth)}${query ? `?${query}` : ''}#${drill}`;
}

/** A guide's address in this language, or the English one when it was not translated. */
function guideHref(lang, id, depth) {
  const target = guides[lang][id] ? lang : 'en';
  if (!guides[target][id]) return null;
  return `${up(depth)}${pagePath(target, id).slice(1)}`;
}

// ---------- pieces ----------

const ARROW = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9.5M8.5 3.5 13 8l-4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CHEVRON = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const GLOBE = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M1.75 8h12.5M8 1.75c1.8 1.7 2.7 3.8 2.7 6.25S9.8 12.55 8 14.25C6.2 12.55 5.3 10.45 5.3 8S6.2 3.45 8 1.75Z" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>';
/** The mark: four finger bars, the pinky lit. Same drawing as the favicon. */
const MARK = '<svg viewBox="6 6 22 18" aria-hidden="true"><rect x="6" y="10" width="4" height="14" rx="2" fill="#8a8f9b"/><rect x="12" y="6" width="4" height="18" rx="2" fill="#8a8f9b"/><rect x="18" y="8" width="4" height="16" rx="2" fill="#8a8f9b"/><rect x="24" y="14" width="4" height="10" rx="2" fill="#fb8ab1"/></svg>';

/** Home-row keys of a layout for the try band, left hand then right hand. */
const HOME_KEYS = {
  us: 'asdfjkl;', 'ca-fr': 'asdfjkl;', es: 'asdfjklñ', latam: 'asdfjklñ', azerty: 'qsdfjklm', qwertz: 'asdfjklö', 'qwertz-ch': 'asdfjklö',
  dvorak: 'aoeuhtns', colemak: 'arstneio', 'colemak-dh': 'arstneio', workman: 'ashtneoi',
};
const DEFAULT_LAYOUT = { en: 'us', fr: 'ca-fr', de: 'qwertz', es: 'es', pt: 'us', it: 'us', pl: 'us', id: 'us', ja: 'us', zh: 'us' };
const KEY_FINGERS = ['p', 'r', 'm', 'i', 'i', 'm', 'r', 'p'];

function tryBand(lang, label, drill, layout, depth) {
  const s = STRINGS[lang];
  const keys = [...HOME_KEYS[layout ?? DEFAULT_LAYOUT[lang]]];
  const caps = keys
    .map((k, i) => `${i === 4 ? '<span class="gap"></span>' : ''}<span class="${KEY_FINGERS[i]}${i === 3 || i === 4 ? ' bump' : ''}">${esc(k)}</span>`)
    .join('');
  return `<aside class="try" aria-label="${esc(label)}">
  <div class="try-keys" aria-hidden="true">${caps}</div>
  <p class="try-text">${esc(s.tryText)}</p>
  <div class="try-row"><a class="cap-button" href="${esc(appHref(lang, drill, layout, depth))}">${esc(label)}${ARROW}</a><p class="try-note">${esc(s.tryNote)}</p></div>
</aside>`;
}

function header(lang, depth, alternates, current) {
  const s = STRINGS[lang];
  const items = alternates
    .map(({ lang: l, href }) => `<li><a href="${esc(href)}" hreflang="${GUIDE_LANGS[l].hreflang}" lang="${GUIDE_LANGS[l].hreflang}"${l === lang ? ' aria-current="true"' : ''}>${esc(GUIDE_LANGS[l].name)}</a></li>`)
    .join('');
  return `<a class="skip" href="#content">${esc(s.skip)}</a>
<header class="site-head">
  <a class="brand" href="${up(depth)}">${MARK}<span>${BRAND}</span></a>
  <nav class="site-nav" aria-label="${esc(BRAND)}">
    <a class="nav-link" href="${up(depth)}${lang}/"${current === 'index' ? ' aria-current="page"' : ''}>${esc(s.guides)}</a>
    ${lang === 'en' ? `<a class="nav-link" href="${up(depth)}en/keyboards/">keyboards</a>
    <a class="nav-link" href="${up(depth)}en/switches/">switches</a>` : ''}
    <a class="cap-button" href="${esc(appHref(lang, 'words', null, depth))}">${esc(s.start)}${ARROW}</a>
    <details class="lang">
      <summary aria-label="${esc(s.language)}">${GLOBE}<span class="lang-name">${esc(GUIDE_LANGS[lang].name)}</span><span class="lang-code">${lang}</span>${CHEVRON}</summary>
      <ul>${items}</ul>
    </details>
  </nav>
</header>`;
}

function footer(lang, depth) {
  const s = STRINGS[lang];
  const langs = langsWithAny.map((l) => `<a href="${up(depth)}${l}/" hreflang="${GUIDE_LANGS[l].hreflang}" lang="${GUIDE_LANGS[l].hreflang}">${esc(GUIDE_LANGS[l].name)}</a>`).join('');
  return `<footer class="site-foot">
  <p>${esc(s.footer)}</p>
  <nav class="foot-links" aria-label="${esc(s.language)}">${langs}<a href="${REPO_URL}">${esc(s.code)}</a></nav>
</footer>`;
}

function head({ lang, title, description, canonical, alternates, depth, type, jsonLd }) {
  const links = alternates.map(({ lang: l, url }) => `<link rel="alternate" hreflang="${GUIDE_LANGS[l].hreflang}" href="${esc(url)}">`);
  const en = alternates.find((a) => a.lang === 'en');
  if (en) links.push(`<link rel="alternate" hreflang="x-default" href="${esc(en.url)}">`);
  return `<!doctype html>
<html lang="${GUIDE_LANGS[lang].hreflang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
${links.join('\n')}
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="${BRAND}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:locale" content="${GUIDE_LANGS[lang].hreflang.replace('-', '_')}">
<meta name="twitter:card" content="summary">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#212227">
<link rel="icon" type="image/svg+xml" href="${up(depth)}favicon.svg">
<link rel="preload" href="${up(depth)}${ASSETS}/allo-variable.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${up(depth)}${ASSETS}/guides.css">
<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>
</head>`;
}

/** Ids for headings: letters and digits of any script, joined by hyphens. */
function anchorId(text, used) {
  let id = text.replace(/<[^>]+>/g, '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 60) || 'section';
  let n = 2;
  const base = id;
  while (used.has(id)) id = `${base}-${n++}`;
  used.add(id);
  return id;
}

function renderBody(lang, body, depth) {
  const used = new Set();
  const toc = [];
  let html = body.replace(/<h2>([\s\S]*?)<\/h2>/g, (_, inner) => {
    const id = anchorId(inner, used);
    toc.push({ id, text: inner.replace(/<[^>]+>/g, '') });
    return `<h2 id="${id}">${inner}</h2>`;
  });
  html = html.replace(/<a href="guide:([a-z0-9-]+)">/g, (m, id) => {
    const href = guideHref(lang, id, depth);
    return href ? `<a href="${esc(href)}">` : '<a>';
  });
  html = html.replace(/<a href="app:([a-z]+)(?:\?layout=([a-z-]+))?">/g, (_, drill, layout) => `<a href="${esc(appHref(lang, drill, layout, depth))}">`);
  // The keyboard and switch database (English only): db:<page> -> a relative link; a missing record stops the build.
  html = html.replace(/<a href="db:([a-z0-9/-]+)">/g, (_, target) => `<a href="${esc(up(depth) + dbPath(target))}">`);
  html = html.replace(/<a href="(https:\/\/[^"]+)">/g, (_, url) => `<a href="${url}" rel="noopener">`);
  html = html.replace(/<table>([\s\S]*?)<\/table>/g, (m) => `<div class="table-wrap">${m}</div>`);
  html = html.replace(/<figure data-figure="finger-chart" data-layout="([a-z-]+)">\s*(<figcaption>[\s\S]*?<\/figcaption>)\s*<\/figure>/g, (_, layout, caption) => {
    const label = caption.replace(/<[^>]+>/g, '').trim();
    return `<figure class="figure figure-chart">${fingerChart(layout, STRINGS[lang].fingers, label)}${caption}</figure>`;
  });
  html = html.replace(/<figure data-figure="board-shapes">\s*(<figcaption>[\s\S]*?<\/figcaption>)\s*<\/figure>/g, (_, caption) => `<figure class="figure figure-boards">${boardShapes()}${caption}</figure>`);
  html = html.replace(/<figure data-figure="stagger-shapes">\s*(<figcaption>[\s\S]*?<\/figcaption>)\s*<\/figure>/g, (_, caption) => `<figure class="figure figure-stagger">${staggerShapes(STAGGER_NAMES[lang] ?? STAGGER_NAMES.en, STRINGS[lang].fingers)}${caption}</figure>`);
  return { html, toc };
}

const formatDate = (lang, iso) => new Intl.DateTimeFormat(GUIDE_LANGS[lang].hreflang, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));

/** A small script: the table of contents follows the reader. The page reads fine without it. */
const TOC_SCRIPT = `<script>(()=>{const l=[...document.querySelectorAll('.toc a')];if(!l.length||!('IntersectionObserver'in window))return;const m=new Map(l.map(a=>[a.hash.slice(1),a]));let c=null;const o=new IntersectionObserver(es=>{for(const e of es){if(e.isIntersecting){const a=m.get(e.target.id);if(a&&a!==c){c?.removeAttribute('aria-current');a.setAttribute('aria-current','true');c=a}}}},{rootMargin:'0px 0px -70% 0px'});m.forEach((a,id)=>{const h=document.getElementById(id);h&&o.observe(h)})})();</script>`;

// ---------- guide page ----------

function guidePage(lang, id) {
  const { meta, body } = guides[lang][id];
  const s = STRINGS[lang];
  const depth = 2;
  const canonical = abs(pagePath(lang, id));
  const alternates = langsWith(id).map((l) => ({ lang: l, url: abs(pagePath(l, id)), href: `${up(depth)}${pagePath(l, id).slice(1)}` }));
  const { html, toc } = renderBody(lang, body, depth);
  const cjk = GUIDE_LANGS[lang].cjk;
  const minutes = Math.max(2, Math.round(measure(body, cjk) / (cjk ? 500 : 220)));
  const title = `${meta.title} · ${BRAND}`;

  // Related: the guides the body links to first, then the rest of its group.
  const linked = [...body.matchAll(/guide:([a-z0-9-]+)/g)].map((m) => m[1]);
  const group = Object.values(GROUPS).find((ids) => ids.includes(id)) ?? [];
  const related = [...new Set([...linked, ...group, ...PAGE_IDS])].filter((other) => other !== id && guides[lang][other]).slice(0, 4);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        '@id': `${canonical}#article`,
        headline: meta.h1,
        description: meta.description,
        inLanguage: GUIDE_LANGS[lang].hreflang,
        datePublished: meta.published ?? meta.updated,
        dateModified: meta.updated,
        mainEntityOfPage: canonical,
        author: { '@type': 'Organization', name: BRAND, url: `${SITE}/` },
        publisher: { '@type': 'Organization', name: BRAND, url: `${SITE}/`, logo: { '@type': 'ImageObject', url: `${SITE}/favicon.svg` } },
        ...(meta.sources.length ? { citation: meta.sources.map((src) => src.url) } : {}),
      },
      {
        '@type': 'FAQPage',
        '@id': `${canonical}#faq`,
        inLanguage: GUIDE_LANGS[lang].hreflang,
        mainEntity: meta.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: BRAND, item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: s.indexH1, item: abs(indexPath(lang)) },
          { '@type': 'ListItem', position: 3, name: meta.h1, item: canonical },
        ],
      },
    ],
  };

  const tocList = toc.map((t) => `<li><a href="#${t.id}">${esc(t.text)}</a></li>`).join('');
  const faq = meta.faq.map((f) => `<div class="faq-item"><h3>${esc(f.q)}</h3><p>${esc(f.a)}</p></div>`).join('');
  const sources = meta.sources.length
    ? `<section class="block sources" aria-labelledby="sources"><h2 id="sources">${esc(s.sources)}</h2><ol>${meta.sources.map((src) => `<li><a href="${esc(src.url)}" rel="noopener">${esc(src.title)}</a></li>`).join('')}</ol></section>`
    : '';
  const relatedList = related
    .map((other) => {
      const m = guides[lang][other].meta;
      return `<li><a href="${esc(guideHref(lang, other, depth))}"><span class="link-title">${esc(m.h1)}</span><span class="link-desc">${esc(m.description)}</span></a></li>`;
    })
    .join('');

  return `${head({ lang, title, description: meta.description, canonical, alternates, depth, type: 'article', jsonLd })}
<body>
${header(lang, depth, alternates, 'guide')}
<main id="content">
  <div class="page">
    <article class="article">
      <nav class="crumbs" aria-label="breadcrumb"><a href="../">${esc(s.indexH1)}</a></nav>
      <h1>${esc(meta.h1)}</h1>
      <p class="lede">${esc(meta.summary)}</p>
      <p class="meta"><span>${esc(s.updated)} <time datetime="${meta.updated}">${esc(formatDate(lang, meta.updated))}</time></span><span>${esc(s.minRead(minutes))}</span><a href="${esc(appHref(lang, meta.try.drill, meta.try.layout, depth))}">${esc(meta.try.label)}${ARROW}</a></p>
      ${toc.length > 2 ? `<details class="toc-inline"><summary>${esc(s.onThisPage)}</summary><ol>${tocList}</ol></details>` : ''}
      <div class="prose">
${html}
      </div>
      ${tryBand(lang, meta.try.label, meta.try.drill, meta.try.layout, depth)}
      <section class="block faq" aria-labelledby="faq"><h2 id="faq">${esc(s.faq)}</h2>${faq}</section>
      ${sources}
    </article>
    <nav class="toc" aria-label="${esc(s.onThisPage)}"><p class="toc-title">${esc(s.onThisPage)}</p><ol>${tocList}</ol></nav>
  </div>
  ${relatedList ? `<section class="related" aria-labelledby="related"><div class="related-inner block"><h2 id="related">${esc(s.related)}</h2><ul class="link-list">${relatedList}</ul></div></section>` : ''}
</main>
${footer(lang, depth)}
${TOC_SCRIPT}
</body>
</html>
`;
}

// ---------- index page ----------

function indexPage(lang) {
  const s = STRINGS[lang];
  const depth = 1;
  const canonical = abs(indexPath(lang));
  const alternates = langsWithAny.map((l) => ({ lang: l, url: abs(indexPath(l)), href: `${up(depth)}${l}/` }));
  const groups = Object.entries(GROUPS)
    .map(([key, ids]) => {
      const items = ids
        .filter((id) => guides[lang][id])
        .map((id) => {
          const m = guides[lang][id].meta;
          return `<li><a href="${esc(m.slug)}/"><span class="link-title">${esc(m.h1)}</span><span class="link-desc">${esc(m.description)}</span></a></li>`;
        })
        .join('');
      return items ? `<section class="block" aria-labelledby="g-${key}"><h2 id="g-${key}">${esc(s.groups[key])}</h2><ul class="link-list">${items}</ul></section>` : '';
    })
    .join('\n');
  const listed = PAGE_IDS.filter((id) => guides[lang][id]);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: s.indexH1,
    description: s.indexDescription,
    url: canonical,
    inLanguage: GUIDE_LANGS[lang].hreflang,
    isPartOf: { '@type': 'WebSite', name: BRAND, url: `${SITE}/` },
    mainEntity: { '@type': 'ItemList', itemListElement: listed.map((id, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(pagePath(lang, id)), name: guides[lang][id].meta.h1 })) },
  };
  return `${head({ lang, title: `${s.indexTitle} · ${BRAND}`, description: s.indexDescription, canonical, alternates, depth, type: 'website', jsonLd })}
<body>
${header(lang, depth, alternates, 'index')}
<main id="content">
  <div class="page index-page">
    <div>
      <h1>${esc(s.indexH1)}</h1>
      <p class="lede">${esc(s.indexIntro)}</p>
      ${groups}
      ${lang === 'en' ? `<section class="block" aria-labelledby="g-database"><h2 id="g-database">Keyboard and switch database</h2><ul class="link-list"><li><a href="keyboards/finder/"><span class="link-title">Keyboard finder</span><span class="link-desc">Describe the keyboard you want in a sentence and get the boards that match: split, wireless, switch brand, size, price.</span></a></li><li><a href="keyboards/"><span class="link-title">Keyboards</span><span class="link-desc">Every model with its specs, switch options, price and reviews, from the brands' own pages.</span></a></li><li><a href="switches/"><span class="link-title">Switches</span><span class="link-desc">Force, travel and materials of each switch, from the makers' own spec sheets.</span></a></li></ul></section>` : ''}
      ${tryBand(lang, s.start, 'words', null, depth)}
    </div>
  </div>
</main>
${footer(lang, depth)}
</body>
</html>
`;
}

// ---------- write ----------

let pages = 0;
for (const lang of langsWithAny) {
  for (const id of Object.keys(guides[lang])) {
    write(join(OUT, lang, guides[lang][id].meta.slug, 'index.html'), guidePage(lang, id));
    pages++;
  }
  write(join(OUT, lang, 'index.html'), indexPage(lang));
}

mkdirSync(join(OUT, ASSETS), { recursive: true });
copyFileSync(join(import.meta.dirname, 'guides.css'), join(OUT, ASSETS, 'guides.css'));
// Allo by Josh Puckett (SIL OFL 1.1): one variable file covers every Latin script the guides use.
copyFileSync(join(repo, 'node_modules', 'allo-font', 'fonts', 'webfonts', 'AlloVariable.woff2'), join(OUT, ASSETS, 'allo-variable.woff2'));

// Sitemap: the trainer, each index, each guide with its translations.
const urlEntry = (loc, alternates, lastmod) =>
  `  <url>\n    <loc>${esc(loc)}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}\n${alternates.map((a) => `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${esc(a.url)}"/>`).join('\n')}\n  </url>`;
const entries = [urlEntry(`${SITE}/`, [], null)];
const indexAlts = langsWithAny.map((l) => ({ hreflang: GUIDE_LANGS[l].hreflang, url: abs(indexPath(l)) }));
for (const lang of langsWithAny) entries.push(urlEntry(abs(indexPath(lang)), indexAlts, null));
for (const id of PAGE_IDS) {
  const langs = langsWith(id);
  const alts = langs.map((l) => ({ hreflang: GUIDE_LANGS[l].hreflang, url: abs(pagePath(l, id)) }));
  if (langs.includes('en')) alts.push({ hreflang: 'x-default', url: abs(pagePath('en', id)) });
  for (const lang of langs) entries.push(urlEntry(abs(pagePath(lang, id)), alts, guides[lang][id].meta.updated));
}
write(
  join(OUT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join('\n')}\n</urlset>\n`,
);
write(join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);

console.log(`guides: ${pages} pages in ${langsWithAny.length} languages, ${langsWithAny.length} indexes, sitemap with ${entries.length} urls`);
