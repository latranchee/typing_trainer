// Builds the keyboard and switch database pages into dist/, in English, French, German and Spanish: the keyboard
// finder, a page per keyboard, brand, switch and switch maker, the preset lists (split keyboards, 60% keyboards...),
// the comparisons, the two hubs, and their sitemap entries (appended to the sitemap the guides build wrote).
// Runs after scripts/guides/build.mjs.
//   node scripts/data-pages/build.mjs [--out dist] [--photo-base <url>]
// Words: strings.mjs. Addresses and formats: i18n.mjs. Translated record text: content/data/i18n/<lang>.json.
// Photos: brand photos with the background removed, served by Cloudflare Images on the site's own domain
// (/cdn-cgi/imagedelivery/...); content/data/photos.json says which records have one.

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { T as FINDER_T, esc, glyph, labels, photoUrl, specLine, thumb } from './finder.js';
import {
  LISTS, brandById, brandFiles, brandPath, brands, checkedOf, comparePath, finderDb, finderPath, hubPath, kbPath, keyboardById, keyboards, listPath,
  listText, makerById, makerFiles, makerPath, makers, photos, swPath, switchById, switchHasPage, switches,
} from './db.mjs';
import { DB_LANGS, OG_LOCALE, RECORD_LANGS, recLang, recordText } from './i18n.mjs';
import { strings } from './strings.mjs';
import { parseGuide } from '../guides/content.mjs';
import { STRINGS as GUIDE_STRINGS } from '../guides/strings.mjs';

const SITE = 'https://petitdoigt.ca';
const repo = join(import.meta.dirname, '..', '..');
const arg = (name) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : null);
const OUT = resolve(repo, arg('--out') ?? 'dist');
/** Cloudflare Images on the site's own domain; a local preview passes the imagedelivery.net address instead. */
const PHOTO_PATH = '/cdn-cgi/imagedelivery/ol_zAKtUVN9EF_zwuf9Wxw/petitdoigt/';
const PHOTOS = arg('--photo-base') ?? PHOTO_PATH;

const up = (depth) => '../'.repeat(depth);
/** A description for search results: whole words, at most 158 characters. */
const clip = (s, n = 158) => (s.length <= n ? s : `${s.slice(0, n - 1).replace(/\s+\S*$/, '').replace(/[,;:]$/, '')}…`);
const abs = (path) => `${SITE}/${path}`;
/** The longest of the suffixes that keeps "<name><suffix> · petitdoigt" within 62 characters (what a search result shows). */
const fitTitle = (name, suffixes) => `${name}${suffixes.find((x) => (name + x).length <= 49) ?? suffixes.at(-1)}`;
const ucFirst = (t) => t.replace(/^\p{Ll}/u, (c) => c.toUpperCase());
const allDates = [...keyboards, ...switches].map(checkedOf).filter(Boolean).sort();
const CHECKED = allDates.at(-1);
const hasPhoto = (id) => !!photos[id];
const photoAbs = (kind, id) => `${SITE}${PHOTO_PATH}${kind}/${encodeURIComponent(id)}/w1200`;

/** The language context every page function takes: words, formats, translated record text, labels. */
function context(lang) {
  const t = strings(lang);
  return { lang, t, f: t.f, rec: recordText(lang), lab: labels(lang), ui: FINDER_T[lang].ui, rl: recLang(lang), colon: lang === 'fr' ? '\u00a0:' : ':' };
}
/** Where a keyboard or switch page is, seen from a page in L's language. */
const kbHref = (L, k) => kbPath(k, L.rl);
const swHref = (L, s) => swPath(s, L.rl);
const hreflangAttr = (L, lang) => (lang !== L.lang ? ` hreflang="${lang}"` : '');

// ---------- guides ----------

/** GUIDES[lang][id] = the guide's slug in that language. */
const GUIDES = {};
for (const lang of DB_LANGS) {
  GUIDES[lang] = {};
  const dir = join(repo, 'content', 'guides', lang);
  if (!existsSync(dir)) continue;
  for (const file of readdirSync(dir).filter((x) => x.endsWith('.html'))) {
    const { meta } = parseGuide(join(dir, file));
    if (meta) GUIDES[lang][meta.id] = meta.slug;
  }
}
/** A guide in the page's language, or the English one while it is not translated; null when neither exists. */
const guideLink = (lang, id) => (GUIDES[lang][id] ? { path: `${lang}/${GUIDES[lang][id]}/`, lang } : GUIDES.en[id] ? { path: `en/${GUIDES.en[id]}/`, lang: 'en' } : null);
const guideA = (L, u, id, text, cls = '') => {
  const g = guideLink(L.lang, id);
  return g ? `<a${cls ? ` class="${cls}"` : ''} href="${u}${g.path}"${hreflangAttr(L, g.lang)}>${text}</a>` : '';
};
function guideSection(L, u, ids) {
  const chips = ids.map((id) => guideA(L, u, id, esc(L.t.guideNames[id]))).filter(Boolean).map((a) => `<li>${a}</li>`).join('');
  return chips ? `<section class="block" aria-labelledby="guides"><h2 id="guides">${esc(L.t.guides)}</h2><ul class="chip-links">${chips}</ul></section>` : '';
}

// ---------- finder data ----------

const finderData = finderDb(PHOTOS);
const finderById = new Map(finderData.keyboards.map((k) => [k.id, k]));

// ---------- page shell ----------

const ARROW = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9.5M8.5 3.5 13 8l-4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const OUT_ARROW = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5h6.5V10M12.5 3.5 4 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const MARK = '<svg viewBox="6 6 22 18" aria-hidden="true"><rect x="6" y="10" width="4" height="14" rx="2" fill="#8a8f9b"/><rect x="12" y="6" width="4" height="18" rx="2" fill="#8a8f9b"/><rect x="18" y="8" width="4" height="16" rx="2" fill="#8a8f9b"/><rect x="24" y="14" width="4" height="10" rx="2" fill="#fb8ab1"/></svg>';
const PUBLISHER = { '@type': 'Organization', name: 'petitdoigt', url: `${SITE}/`, logo: { '@type': 'ImageObject', url: `${SITE}/favicon.svg` } };

/** Breadcrumb trail [[name, path|null], ...] as JSON-LD; the site root comes first. */
const breadcrumbLd = (items) => ({
  '@type': 'BreadcrumbList',
  itemListElement: [['petitdoigt', ''], ...items].map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, ...(path != null ? { item: abs(path) } : {}) })),
});

/** The page in every language it exists in: { en: path, fr: path, ... }. */
const allLangs = (pathOf, langs = DB_LANGS) => Object.fromEntries(langs.map((l) => [l, pathOf(l)]));

function shell(L, { depth, title, description, path, alt, section, body, scripts = '', image = null, imageAlt = '', jsonLd = [], type = 'website' }) {
  const { t, lang } = L;
  const u = up(depth);
  const canonical = abs(path);
  const g = GUIDE_STRINGS[lang];
  const nav = (key, href, label) => `<a class="nav-link" href="${u}${href}"${section === key ? ' aria-current="page"' : ''}>${esc(label)}</a>`;
  const ld = { '@context': 'https://schema.org', '@graph': jsonLd };
  const alternates = [...Object.entries(alt).map(([l, p]) => `<link rel="alternate" hreflang="${l}" href="${abs(p)}">`), `<link rel="alternate" hreflang="x-default" href="${abs(alt.en)}">`].join('\n');
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · petitdoigt</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
${alternates}
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="petitdoigt">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:locale" content="${OG_LOCALE[lang]}">
${image ? `<meta property="og:image" content="${esc(image)}">\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="900">\n<meta property="og:image:alt" content="${esc(imageAlt)}">\n<meta name="twitter:card" content="summary_large_image">` : '<meta name="twitter:card" content="summary">'}
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#212227">
<link rel="icon" type="image/svg+xml" href="${u}favicon.svg">
<link rel="preload" href="${u}guides-assets/allo-variable.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${u}guides-assets/guides.css">
<link rel="stylesheet" href="${u}guides-assets/data.css">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
</head>
<body>
<a class="skip" href="#content">${esc(t.skip)}</a>
<header class="site-head">
  <a class="brand" href="${u}">${MARK}<span>petitdoigt</span></a>
  <nav class="site-nav" aria-label="petitdoigt">
    ${nav('guides', `${lang}/`, g.guides)}
    ${nav('keyboards', hubPath('keyboards', lang), t.nav.keyboards)}
    ${nav('switches', hubPath('switches', lang), t.nav.switches)}
    <a class="cap-button" href="${u}?lang=${lang}#words">${esc(g.start)}${ARROW}</a>
  </nav>
</header>
<main id="content">
${body}
</main>
<footer class="site-foot">
  <p>${esc(t.foot(L.f.date(CHECKED)))}</p>
  <nav class="foot-links" aria-label="${esc(t.sectionsAria)}"><a href="${u}${lang}/">${esc(t.footLinks.guides)}</a><a href="${u}${hubPath('keyboards', lang)}">${esc(t.footLinks.keyboards)}</a><a href="${u}${finderPath(lang)}">${esc(t.footLinks.finder)}</a><a href="${u}${hubPath('switches', lang)}">${esc(t.footLinks.switches)}</a><a href="https://github.com/latranchee/typing_trainer">${esc(t.footLinks.source)}</a></nav>
</footer>
${scripts}
</body>
</html>
`;
}

const sitemap = [];
function write(path, html, { lastmod = null, image = null } = {}) {
  const file = join(OUT, path, 'index.html');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
  sitemap.push({ loc: abs(path), lastmod, image });
}

const crumbs = (L, depth, items) =>
  `<nav class="crumbs" aria-label="${esc(L.t.crumbAria)}">${items.map(([label, href]) => (href ? `<a href="${up(depth)}${href}">${esc(label)}</a>` : `<span class="here">${esc(label)}</span>`)).join('<span aria-hidden="true">/</span>')}</nav>`;

// ---------- spec sheet with source numbers ----------

const nilOf = (L) => `<span class="nil">${esc(L.t.nil)}</span>`;
const yesNo = (L, v) => (v === true ? L.t.yes : v === false ? L.t.no : nilOf(L));

function sheet(L, record, groups) {
  const NIL = nilOf(L);
  const sources = record.sources ?? [];
  const refs = (fields) => {
    const n = sources.map((s, i) => (s.backs?.some((b) => fields.includes(b)) ? i + 1 : 0)).filter(Boolean);
    return n.length ? `<span class="refs">${n.map((i) => `<a href="#src-${i}" aria-label="${esc(L.t.srcAria(i))}">${i}</a>`).join('')}</span>` : '';
  };
  return groups
    .map(([title, rows]) => {
      const live = rows.filter((r) => r);
      const id = `g-${title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\W+/g, '-')}`;
      // A group with nothing published collapses to one line naming what is missing.
      if (live.every(([, value]) => value === NIL)) {
        return `<section class="sheet-group" aria-labelledby="${id}"><h2 id="${id}">${esc(title)}</h2><p class="empty-line">${esc(L.t.emptyGroup(live.map(([label]) => label)))}</p></section>`;
      }
      return `<section class="sheet-group" aria-labelledby="${id}"><h2 id="${id}">${esc(title)}</h2><dl class="sheet">${live
        .map(([label, value, fields]) => `<div class="sheet-row"><dt>${esc(label)}</dt><dd><span class="v">${value}</span>${refs(fields)}</dd></div>`)
        .join('')}</dl></section>`;
    })
    .join('');
}

function sourcesBlock(L, record) {
  const s = record.sources ?? [];
  if (!s.length) return '';
  return `<section class="sources data-sources" aria-labelledby="sources"><h2 id="sources">${esc(L.t.sources)}</h2><ol>${s
    .map((x, i) => `<li id="src-${i + 1}"><a href="${esc(x.url)}" rel="noopener">${esc(x.title)}</a> <span class="kind kind-${esc(x.kind)}">${esc(L.t.srcKind[x.kind] ?? x.kind)}</span><span class="checked">${esc(L.t.checked(L.f.date(x.checked)))}</span></li>`)
    .join('')}</ol></section>`;
}

const reviewItem = (L, record, x) =>
  `<li><a class="review" href="${esc(x.url)}" rel="noopener"${hreflangAttr(L, 'en')}><span class="rv-head"><span class="rv-outlet">${esc(x.outlet)}</span>${x.score ? `<span class="rv-score">${esc(x.score)}</span>` : ''}<span class="rv-date">${x.date ? L.f.date(x.date) : ''}</span></span><span class="rv-verdict">${esc(L.rec.verdict(record, x))}</span><span class="rv-go">${esc(L.t.readReview)}${OUT_ARROW}</span></a></li>`;

function reviewsBlock(L, record, name) {
  const r = record.reviews ?? [];
  return `<section class="block" aria-labelledby="reviews"><h2 id="reviews">${esc(L.t.reviews)}</h2>${r.length ? `<ul class="reviews">${r.map((x) => reviewItem(L, record, x)).join('')}</ul><p class="fine">${esc(L.t.reviewsFine)}</p>` : `<p class="empty-line">${esc(L.t.noReview(name))}</p>`}</section>`;
}

/** A switch's name linked to its page when it has one. */
const swLink = (L, u, s, label = s.name) => (switchHasPage(s) ? `<a href="${u}${swHref(L, s)}">${esc(label)}</a>` : esc(label));

/** The brand's own photo, background removed, credited and linked to the page it came from. */
function photoFigure(L, id, alt, line = '') {
  const p = photos[id];
  if (!p) return '';
  const host = new URL(p.page).host.replace(/^www\./, '');
  return `<figure class="photo" style="--bg:var(--photo-tile)">
        <div class="photo-frame"><img src="${photoUrl(PHOTOS, p.kind, id, 1200)}" srcset="${photoUrl(PHOTOS, p.kind, id, 480)} 480w, ${photoUrl(PHOTOS, p.kind, id, 1200)} 1200w" sizes="(max-width: 52rem) 100vw, 48rem" width="1600" height="1200" alt="${esc(alt)}" decoding="async" fetchpriority="high"></div>
        <figcaption>${esc(p.line > 1 && line ? L.t.photoLine(line) : L.t.photo)}<a href="${esc(p.page)}" rel="noopener">${esc(p.credit)}, ${esc(host)}</a></figcaption>
      </figure>`;
}

const resultRow = (L, u, x, { withRev = true, showBrand = true } = {}) =>
  `<li><a class="result" href="${u}${kbHref(L, keyboardById.get(x.id))}">${thumb(x, PHOTOS)}<span class="r-main"><span class="r-name">${showBrand ? `${esc(x.b)} ` : ''}${esc(x.m)}${x.status !== 'current' ? ` <span class="tag">${esc(L.ui.discontinued)}</span>` : ''}</span><span class="r-spec">${specLine(x, new Set(), L.lang)}</span></span><span class="r-side"><span class="r-price">${x.price != null ? L.f.money(x.price) : `<span class="nil">${esc(L.ui.noPrice)}</span>`}</span>${withRev ? `<span class="r-rev">${esc(L.ui.reviews(x.rev))}</span>` : ''}</span></a></li>`;

// ---------- keyboard page ----------

function keyboardPage(L, k) {
  const { t, f, lab, lang } = L;
  const NIL = nilOf(L);
  const brand = brandById.get(k.brand);
  const name = `${brand.name} ${k.model}`;
  const depth = 4;
  const u = up(depth);
  const swList = k.switches.length ? `<ul class="sw-list">${k.switches.map((o) => `<li>${o.id && switchById.has(o.id) ? swLink(L, u, switchById.get(o.id), o.name) : esc(o.name)}</li>`).join('')}</ul>` : NIL;
  const size = k.size === 'other' ? (k.key_count ? t.sizeOther(k.key_count) : NIL) : k.key_count ? t.sizeKeys(lab.SIZE_LABEL[k.size], k.key_count) : lab.SIZE_LABEL[k.size];
  const store = esc(t.store(brand.name));
  const kb = t.kb;
  const groups = [
    [kb.shape, [
      [kb.size, size, ['size', 'key_count']],
      [kb.stagger, t.stagger[k.stagger], ['stagger']],
      [kb.split, t.split[k.split], ['split']],
      k.stagger === 'row' ? [kb.layouts, k.layout_standards.length ? k.layout_standards.map((x) => x.toUpperCase()).join(', ') : NIL, ['layout_standards']] : null,
      [kb.tenting, t.tent[k.tenting] ?? NIL, ['tenting']],
      [kb.thumb, yesNo(L, k.thumb_cluster), ['thumb_cluster']],
      [kb.wells, yesNo(L, k.key_wells), ['key_wells']],
      [kb.lp, yesNo(L, k.low_profile), ['low_profile']],
    ]],
    [kb.switches, [
      [kb.fits, lab.FOOTPRINT[k.switch_footprint] ?? NIL, ['switch_footprint']],
      [kb.hotswap, k.hot_swap ? t.hotswap[k.hot_swap] : NIL, ['hot_swap']],
      [kb.soldWith, swList, ['switches']],
      [kb.adjustable, yesNo(L, k.adjustable_actuation), ['adjustable_actuation']],
      k.adjustable_actuation || k.rapid_trigger ? [kb.rt, yesNo(L, k.rapid_trigger), ['rapid_trigger']] : null,
    ]],
    [kb.connection, [
      [kb.connects, k.connectivity.length ? k.connectivity.map((c) => t.conn[c]).join(', ') : NIL, ['connectivity']],
      k.connectivity.some((c) => c !== 'usb') ? [kb.battery, k.battery_mah ? `${f.num(k.battery_mah)} mAh` : NIL, ['battery_mah']] : null,
      [kb.polling, k.polling_rate_hz ? `${f.num(k.polling_rate_hz)} Hz` : NIL, ['polling_rate_hz']],
    ]],
    [kb.build, [
      [kb.comesAs, t.kind[k.kind], ['kind']],
      [kb.case, k.case_material ? esc(L.rec.value('case', k.case_material)) : NIL, ['case_material']],
      [kb.mount, k.mount ? esc(L.rec.value('mount', k.mount)) : NIL, ['mount']],
      [kb.firmware, k.firmware.length ? k.firmware.map((x) => lab.FW[x] ?? (x === 'proprietary' ? t.ownFirmware : x)).join(', ') : NIL, ['firmware']],
      [kb.software, k.software ? esc(k.software) : NIL, ['software']],
      [kb.systems, k.os.length ? k.os.map((o) => ({ windows: 'Windows', mac: 'macOS', linux: 'Linux', ios: 'iOS', android: 'Android' })[o]).join(', ') : NIL, ['os']],
    ]],
    [kb.priceStatus, [
      [kb.price, k.price_usd != null ? `${f.money(k.price_usd)} <span class="sub">${t.priceOn(k.price_url ? `<a href="${esc(k.price_url)}" rel="noopener">${store}</a>` : store, f.date(k.price_date))}</span>` : NIL, ['price_usd']],
      [kb.status, k.status === 'current' ? t.status.current : t.status.discontinued, ['status']],
      [kb.released, k.released ? esc(f.released(k.released)) : NIL, ['released']],
      k.aka.length ? [kb.aka, esc(k.aka.join(', ')), ['aka']] : null,
    ]],
  ];
  // Similar boards: same shape, nearest price.
  const fk = finderById.get(k.id);
  const similar = finderData.keyboards
    .filter((x) => x.id !== k.id && x.stagger === k.stagger && x.split === k.split && (k.stagger !== 'row' || x.size === k.size))
    .sort((a, b) => Math.abs((a.price ?? 1e5) - (k.price_usd ?? 0)) - Math.abs((b.price ?? 1e5) - (k.price_usd ?? 0)))
    .slice(0, 6);
  const alt = t.kbAlt(name, k);
  const lede = t.kbLede(k, brand);
  const note = L.rec.note(k);
  const lists = LISTS.filter((l) => l.items.includes(k)).slice(0, 4);
  const hub = hubPath('keyboards', lang);
  const body = `<div class="page data-page">
    <article class="article">
      ${crumbs(L, depth, [[t.keyboards, hub], [brand.name, brandPath(brand.id, lang)]])}
      <div class="title-row">${glyph(fk).replace('class="glyph"', 'class="glyph glyph-lg"')}<h1>${esc(name)}</h1></div>
      <p class="lede">${esc(lede)}</p>
      ${photoFigure(L, k.id, alt)}
      <p class="meta">${k.official_url ? `<a href="${esc(k.official_url)}" rel="noopener">${esc(t.makerPage(brand.name))}${OUT_ARROW}</a>` : ''}<span>${esc(t.nReviews(k.reviews.length))}</span><span>${esc(t.nSources(k.sources.length, f.date(checkedOf(k) ?? CHECKED)))}</span><a href="${u}${finderPath(lang)}">${esc(t.finderLink)}${ARROW}</a></p>
      ${note ? `<p class="note-line">${esc(note)}</p>` : ''}
      ${sheet(L, k, groups)}
      ${reviewsBlock(L, k, name)}
      ${similar.length ? `<section class="block" aria-labelledby="similar"><h2 id="similar">${esc(t.sameShape)}</h2><ul class="results-list">${similar.map((x) => resultRow(L, u, x)).join('')}</ul></section>` : ''}
      ${lists.length ? `<p class="meta">${lists.map((l) => `<a href="${u}${listPath(l.id, lang)}">${esc(listText(l.id, lang).name)}${ARROW}</a>`).join('')}</p>` : ''}
      ${sourcesBlock(L, k)}
    </article>
  </div>`;
  const path = kbPath(k, lang);
  const description = clip(`${t.specLead(name, lede)}${t.kbDescTail}`);
  const image = hasPhoto(k.id) ? photoAbs('keyboard', k.id) : null;
  // A Product item only with a price and a photo: Google reports a Product without offers or an image as an error.
  const asProduct = k.price_usd != null && image;
  const jsonLd = [
    breadcrumbLd([[t.keyboards, hub], [brand.name, brandPath(brand.id, lang)], [k.model, path]]),
    !asProduct
      ? { '@type': 'WebPage', '@id': abs(path), name: t.specsName(name), url: abs(path), inLanguage: lang, about: { '@type': 'Thing', name, description: lede }, ...(image ? { primaryImageOfPage: { '@type': 'ImageObject', url: image } } : {}), publisher: PUBLISHER }
      : {
          '@type': 'Product',
          '@id': `${abs(path)}#product`,
          name,
          brand: { '@type': 'Brand', name: brand.name },
          category: t.category,
          description: lede,
          url: abs(path),
          image,
          offers: { '@type': 'Offer', price: k.price_usd, priceCurrency: 'USD', url: k.price_url ?? k.official_url ?? abs(path), availability: k.status === 'current' ? 'https://schema.org/InStock' : 'https://schema.org/Discontinued', seller: { '@type': 'Organization', name: brand.name } },
        },
  ];
  return {
    html: shell(L, { depth, title: fitTitle(name, t.kbTitle), description, path, alt: allLangs((l) => kbPath(k, l), RECORD_LANGS), section: 'keyboards', body, image, imageAlt: alt, jsonLd, type: 'product' }),
    image,
  };
}

// ---------- switch page ----------

const swName = (s) => {
  const maker = makerById.get(s.maker);
  return s.name.toLowerCase().startsWith(maker.name.toLowerCase()) ? s.name : `${maker.name} ${s.name}`;
};

/** A ruler of the switch's travel, to scale: where it actuates and where it bottoms out. Bars drawn in CSS, words in HTML. */
function travelFigure(L, s) {
  const { t, f } = L;
  const total = s.total_travel_mm;
  if (!total) return '';
  const span = Math.max(total, s.actuation_range_mm?.[1] ?? 0);
  const pct = (mm) => +((mm / span) * 100).toFixed(2);
  const place = (p) => (p <= 55 ? `left:${p}%` : `right:${+(100 - p).toFixed(2)}%`);
  let fill = '';
  let label = '';
  if (s.actuation_range_mm) {
    const [a, b] = s.actuation_range_mm;
    fill = `<span class="travel-range" style="left:${pct(a)}%;width:${+(pct(b) - pct(a)).toFixed(2)}%"></span>`;
    label = `<span class="travel-label" style="${place(pct(a))}">${esc(t.travel.range(a, b))}</span>`;
  } else if (s.pre_travel_mm) {
    fill = `<span class="travel-pre" style="width:${pct(s.pre_travel_mm)}%"></span><span class="travel-mark" style="left:${pct(s.pre_travel_mm)}%"></span>`;
    label = `<span class="travel-label" style="${place(pct(s.pre_travel_mm))}">${esc(t.travel.at(s.pre_travel_mm))}${s.actuation_force_gf ? ` · ${f.num(s.actuation_force_gf)} gf` : ''}</span>`;
  }
  return `<figure class="figure data-figure travel" aria-label="${esc(t.travel.aria(s.pre_travel_mm, total))}">
    <div class="travel-labels">${label}</div>
    <div class="travel-track" style="--n:${Math.round(span / 0.5)}">${fill}<span class="travel-end"></span></div>
    <div class="travel-ends"><span>${esc(t.travel.rest)}</span><span>${esc(t.travel.bottom(total))}${s.bottom_out_force_gf ? ` · ${f.num(s.bottom_out_force_gf)} gf` : ''}</span></div>
    <figcaption>${esc(t.travel.caption)}</figcaption>
  </figure>`;
}

const forces = switches.map((x) => x.actuation_force_gf).filter((v) => typeof v === 'number');
/** Where the switch's actuation force falls among every switch in the database that publishes one. */
function forceFigure(L, s) {
  const gf = s.actuation_force_gf;
  if (!gf) return '';
  const lo = 20;
  const hi = 100;
  const step = 5;
  const bins = [];
  for (let b = lo; b < hi; b += step) bins.push(forces.filter((v) => (b === lo ? v < b + step : b + step >= hi ? v >= b : v >= b && v < b + step)).length);
  const max = Math.max(...bins);
  const mine = Math.min(Math.max(Math.floor((gf - lo) / step), 0), bins.length - 1);
  const pct = (n) => Math.round((n / forces.length) * 100);
  const lighter = pct(forces.filter((v) => v < gf).length);
  const heavier = pct(forces.filter((v) => v > gf).length);
  return `<figure class="figure data-figure force">
    <div class="hist" role="img" aria-label="${esc(L.t.force.aria(forces.length, gf))}">${bins.map((n, i) => `<span${i === mine ? ' class="on"' : ''} style="height:${Math.max(2, Math.round((n / max) * 100))}%"></span>`).join('')}</div>
    <div class="hist-axis" aria-hidden="true"><span>20</span><span>40</span><span>60</span><span>80</span><span>100 gf</span></div>
    <figcaption>${esc(L.t.force.caption(forces.length, gf, lighter, heavier))}</figcaption>
  </figure>`;
}

const boardsBySwitch = new Map();
for (const k of keyboards) for (const o of k.switches) if (o.id) (boardsBySwitch.get(o.id) ?? boardsBySwitch.set(o.id, []).get(o.id)).push(finderById.get(k.id));

function switchPage(L, s) {
  const { t, f, lab, lang } = L;
  const NIL = nilOf(L);
  const maker = makerById.get(s.maker);
  const name = swName(s);
  const depth = 4;
  const u = up(depth);
  const sw = t.sw;
  const madeBy = s.made_by && makerById.get(s.made_by) ? `<a href="${u}${makerPath(s.made_by, lang)}">${esc(makerById.get(s.made_by).name)}</a>` : null;
  const gfv = (v) => (v ? `${f.num(v)} gf` : NIL);
  const mmv = (v) => (v ? `${f.num(v)} mm` : NIL);
  const material = (v) => (v ? esc(L.rec.value('material', v)) : NIL);
  const groups = [
    [sw.feel, [
      [sw.type, t.type[s.type], ['type']],
      [sw.sensing, t.sense[s.sensing], ['sensing']],
      [sw.force, gfv(s.actuation_force_gf), ['actuation_force_gf']],
      s.type.includes('tactile') || s.type === 'clicky' ? [sw.bump, gfv(s.tactile_force_gf), ['tactile_force_gf']] : null,
      [sw.bottom, gfv(s.bottom_out_force_gf), ['bottom_out_force_gf']],
    ]],
    [sw.travel, [
      s.actuation_range_mm ? [sw.range, t.mmRange(...s.actuation_range_mm), ['actuation_range_mm']] : [sw.pre, mmv(s.pre_travel_mm), ['pre_travel_mm']],
      [sw.total, mmv(s.total_travel_mm), ['total_travel_mm']],
    ]],
    [sw.fit, [
      [sw.footprint, lab.FOOTPRINT[s.footprint] ?? s.footprint, ['footprint']],
      [sw.capMount, t.capMount[s.keycap_mount] ?? NIL, ['keycap_mount']],
      [sw.height, t.profile[s.profile] ?? NIL, ['profile']],
      s.footprint === 'mx' ? [sw.pins, s.pins ? t.pins(s.pins) : NIL, ['pins']] : null,
    ]],
    [sw.build, [
      [sw.top, material(s.materials?.top), ['materials']],
      [sw.bottomH, material(s.materials?.bottom), ['materials']],
      [sw.stem, material(s.materials?.stem), ['materials']],
      [sw.spring, s.spring ? esc(L.rec.value('spring', s.spring)) : NIL, ['spring']],
      [sw.lubed, yesNo(L, s.factory_lubed), ['factory_lubed']],
      [sw.lightPipe, yesNo(L, s.light_pipe), ['light_pipe']],
    ]],
    [sw.makerStatus, [
      [sw.soldBy, `<a href="${u}${makerPath(maker.id, lang)}">${esc(maker.name)}</a>`, ['maker']],
      madeBy ? [sw.madeBy, madeBy, ['made_by']] : null,
      [sw.rated, s.rated_lifespan_million ? t.presses(s.rated_lifespan_million) : NIL, ['rated_lifespan_million']],
      [sw.status, t.status[s.status] ?? t.status.discontinued, ['status']],
      [sw.released, s.released ? esc(f.released(s.released)) : NIL, ['released']],
      s.aka.length ? [sw.aka, esc(s.aka.join(', ')), ['aka']] : null,
    ]],
  ];
  const boards = boardsBySwitch.get(s.id) ?? [];
  const family = s.family ? switches.filter((x) => x.maker === s.maker && x.family === s.family && x.id !== s.id && switchHasPage(x)).slice(0, 12) : [];
  const alt = t.swAlt(name, s);
  const lede = t.swLede(s, maker);
  const note = L.rec.note(s);
  const hub = hubPath('switches', lang);
  const body = `<div class="page data-page">
    <article class="article">
      ${crumbs(L, depth, [[t.switchesH, hub], [maker.name, makerPath(maker.id, lang)]])}
      <h1>${esc(name)}</h1>
      <p class="lede">${esc(lede)}</p>
      ${photoFigure(L, s.id, alt, s.family ? `${maker.name} ${s.family}` : '')}
      <p class="meta">${s.official_url ? `<a href="${esc(s.official_url)}" rel="noopener">${esc(t.makerPage(maker.name))}${OUT_ARROW}</a>` : ''}<span>${esc(t.nSources(s.sources.length, f.date(checkedOf(s) ?? CHECKED)))}</span><a href="${u}?lang=${lang}#words">${esc(t.soundsLink)}${ARROW}</a></p>
      ${note ? `<p class="note-line">${esc(note)}</p>` : ''}
      ${travelFigure(L, s)}
      ${sheet(L, s, groups)}
      ${s.actuation_force_gf ? `<section class="block" aria-labelledby="force"><h2 id="force">${esc(t.force.title)}</h2>${forceFigure(L, s)}</section>` : ''}
      <section class="block" aria-labelledby="boards"><h2 id="boards">${esc(t.boardsWith)}</h2>${boards.length ? `<ul class="results-list">${boards.map((x) => resultRow(L, u, x, { withRev: false })).join('')}</ul>` : `<p class="empty-line">${esc(t.noBoards(name))}</p>`}</section>
      ${family.length ? `<section class="block" aria-labelledby="family"><h2 id="family">${esc(t.moreInLine(s.family))}</h2><ul class="chip-links">${family.map((x) => `<li><a href="${u}${swHref(L, x)}">${esc(x.name)}<span>${esc(t.type[x.type])}${x.actuation_force_gf ? ` · ${f.num(x.actuation_force_gf)} gf` : ''}</span></a></li>`).join('')}</ul></section>` : ''}
      ${reviewsBlock(L, s, name)}
      ${sourcesBlock(L, s)}
    </article>
  </div>`;
  const path = swPath(s, lang);
  const image = hasPhoto(s.id) ? photoAbs('switch', s.id) : null;
  const jsonLd = [
    breadcrumbLd([[t.switchesH, hub], [maker.name, makerPath(maker.id, lang)], [s.name, path]]),
    { '@type': 'WebPage', '@id': abs(path), name: t.specsName(name), url: abs(path), inLanguage: lang, about: { '@type': 'Thing', name, description: lede }, ...(image ? { primaryImageOfPage: { '@type': 'ImageObject', url: image } } : {}), publisher: PUBLISHER },
  ];
  const lead = t.specLead(name, lede);
  return {
    html: shell(L, { depth, title: fitTitle(name, t.swTitle), description: clip(lead.length < 110 ? `${lead}${t.swDescTail}` : lead), path, alt: allLangs((l) => swPath(s, l), RECORD_LANGS), section: 'switches', body, image, imageAlt: alt, jsonLd }),
    image,
  };
}

// ---------- finder ----------

function finderPage(L) {
  const { t, f, lang } = L;
  const tf = t.finder;
  const depth = 3;
  const u = up(depth);
  const hub = hubPath('keyboards', lang);
  // Keyboard pages, relative to the finder: this language's when they exist, else the English ones.
  const kbBase = L.rl === lang ? '../' : `${u}${hubPath('keyboards', L.rl)}`;
  const body = `<div class="finder-page">
    ${crumbs(L, depth, [[t.keyboards, hub], [tf.crumb, null]])}
    <h1>${esc(tf.h1)}</h1>
    <p class="lede">${esc(tf.lede(finderData.keyboards.length, brands.length))}</p>
    <div class="query">
      <label class="sr-only" for="q">${esc(tf.label)}</label>
      <svg class="query-icon" viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.75" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M13 13l4.25 4.25" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
      <input id="q" type="search" autocomplete="off" spellcheck="false" placeholder="${esc(tf.placeholder)}" enterkeyhint="search">
    </div>
    <div class="chips" id="chips" aria-live="polite"></div>
    <div class="examples"><span class="examples-label">${esc(tf.try)}</span>${t.examples.map((e) => `<button type="button" class="example" data-example="${esc(e)}">${esc(e)}</button>`).join('')}</div>
    <div class="results-head">
      <p class="count" id="count" aria-live="polite">&nbsp;</p>
      <div class="results-tools"><button type="button" class="switch-line" id="kits" role="switch" aria-checked="false"><span class="switch" aria-hidden="true"><i></i></span>${esc(tf.kits)}</button>
      <div class="segmented" id="sort" role="group" aria-label="${esc(tf.sortAria)}"><button type="button" data-sort="price" aria-pressed="true">${esc(tf.sort.price)}</button><button type="button" data-sort="reviews" aria-pressed="false">${esc(tf.sort.reviews)}</button><button type="button" data-sort="name" aria-pressed="false">${esc(tf.sort.name)}</button></div></div>
    </div>
    <div id="results" class="results" data-kb="${esc(kbBase)}"></div>
    <p class="fine finder-fine">${esc(tf.fine)}</p>
    <section class="block" aria-labelledby="lists"><h2 id="lists">${esc(tf.lists)}</h2><ul class="chip-links">${LISTS.map((l) => `<li><a href="${u}${listPath(l.id, lang)}">${esc(listText(l.id, lang).name)}<span>${f.num(l.items.length)}</span></a></li>`).join('')}</ul></section>
  </div>`;
  const description = tf.description(finderData.keyboards.length);
  const path = finderPath(lang);
  const jsonLd = [
    breadcrumbLd([[t.keyboards, hub], [tf.name, path]]),
    { '@type': 'WebApplication', name: tf.appName, url: abs(path), inLanguage: lang, applicationCategory: 'UtilitiesApplication', operatingSystem: 'Any (web browser)', offers: { '@type': 'Offer', price: 0, priceCurrency: 'USD' }, description, publisher: PUBLISHER },
  ];
  return shell(L, { depth, title: tf.title, description, path, alt: allLangs(finderPath), section: 'keyboards', body, scripts: `<script type="module" src="${u}guides-assets/finder.js"></script>`, jsonLd });
}

// ---------- hubs, brands, makers, lists ----------

const itemListLd = (L, path, name, items) => ({
  '@type': 'CollectionPage',
  '@id': abs(path),
  name,
  url: abs(path),
  inLanguage: L.lang,
  publisher: PUBLISHER,
  mainEntity: { '@type': 'ItemList', numberOfItems: items.length, itemListElement: items.slice(0, 100).map(([n, p], i) => ({ '@type': 'ListItem', position: i + 1, name: n, url: abs(p) })) },
});

function keyboardsHub(L) {
  const { t, f, lang } = L;
  const depth = 2;
  const u = up(depth);
  const path = hubPath('keyboards', lang);
  const counts = new Map();
  for (const k of keyboards) counts.set(k.brand, (counts.get(k.brand) ?? 0) + 1);
  const sorted = [...brands].sort((a, b) => a.name.localeCompare(b.name));
  const body = `<div class="hub-page">
    <h1>${esc(t.keyboards)}</h1>
    <p class="lede">${esc(t.kbHub.lede(keyboards.length, brands.length))}</p>
    <p><a class="cap-button cap-lg" href="${u}${finderPath(lang)}">${esc(t.kbHub.cta)}${ARROW}</a></p>
    <section class="block" aria-labelledby="lists"><h2 id="lists">${esc(t.kbHub.lists)}</h2><ul class="chip-links">${LISTS.map((l) => `<li><a href="${u}${listPath(l.id, lang)}">${esc(listText(l.id, lang).name)}<span>${f.num(l.items.length)}</span></a></li>`).join('')}</ul></section>
    <section class="block" aria-labelledby="brands"><h2 id="brands">${esc(t.kbHub.brands)}</h2><ul class="brand-grid">${sorted.map((b) => `<li><a href="${u}${brandPath(b.id, lang)}"><span class="bn">${esc(b.name)}</span><span class="bc">${counts.get(b.id) ?? 0}</span></a></li>`).join('')}</ul></section>
    ${compareChips(L, u, null, t.kbHub.compared)}
    ${guideSection(L, u, ['staggered-vs-ortholinear-vs-columnar', 'split-keyboard', 'ergonomic-keyboard', 'keyboard-sizes', 'hot-swappable-keyboard'])}
  </div>`;
  const jsonLd = [breadcrumbLd([[t.keyboards, path]]), itemListLd(L, path, t.keyboards, sorted.map((b) => [t.brandTitle(b.name), brandPath(b.id, lang)]))];
  return shell(L, { depth, title: t.kbHub.title, description: clip(t.kbHub.description(keyboards.length, brands.length)), path, alt: allLangs((l) => hubPath('keyboards', l)), section: 'keyboards', body, jsonLd });
}

function brandPage(L, file) {
  const { t, f, lang } = L;
  const b = file.brand;
  const depth = 3;
  const u = up(depth);
  const path = brandPath(b.id, lang);
  const hub = hubPath('keyboards', lang);
  const about = L.rec.about('brand', b) ?? '';
  const ks = file.keyboards.map((k) => finderById.get(k.id)).sort((a, c) => (a.status === c.status ? (a.price ?? 1e9) - (c.price ?? 1e9) : a.status === 'current' ? -1 : 1));
  const body = `<div class="page data-page"><article class="article">
    ${crumbs(L, depth, [[t.keyboards, hub], [b.name, null]])}
    <h1>${esc(t.brandTitle(b.name))}</h1>
    <p class="lede">${esc(about)}</p>
    <p class="meta">${b.official_url ? `<a href="${esc(b.official_url)}" rel="noopener">${esc(t.makerSite(b.name))}${OUT_ARROW}</a>` : ''}<span>${esc(t.nKeyboards(ks.length))}</span>${b.country ? `<span>${esc(f.region(b.country))}</span>` : ''}${b.founded ? `<span>${esc(t.founded(b.founded))}</span>` : ''}</p>
    <ul class="results-list">${ks.map((x) => resultRow(L, u, x, { showBrand: false })).join('')}</ul>
  </article></div>`;
  const firstPhoto = ks.find((x) => hasPhoto(x.id));
  const image = firstPhoto ? photoAbs('keyboard', firstPhoto.id) : null;
  const jsonLd = [breadcrumbLd([[t.keyboards, hub], [b.name, path]]), itemListLd(L, path, t.brandTitle(b.name), ks.map((x) => [`${b.name} ${x.m}`, kbHref(L, keyboardById.get(x.id))]))];
  return shell(L, {
    depth,
    title: fitTitle(t.brandTitle(b.name), t.brandTitleSuffix),
    description: clip(t.brandDesc(ks.length, b.name, about).trim()),
    path,
    alt: allLangs((l) => brandPath(b.id, l)),
    section: 'keyboards',
    body,
    image,
    imageAlt: firstPhoto ? `${b.name} ${firstPhoto.m}` : '',
    jsonLd,
  });
}

function listPage(L, l) {
  const { t, f, lang } = L;
  const lt = listText(l.id, lang);
  const depth = 3;
  const u = up(depth);
  const path = listPath(l.id, lang);
  const hub = hubPath('keyboards', lang);
  const all = l.items.map((k) => finderById.get(k.id));
  const assembled = all.filter((x) => x.kind !== 'kit' && x.kind !== 'pcb');
  const kits = all.length - assembled.length;
  const priced = all.filter((x) => x.price != null).map((x) => x.price).sort((a, b) => a - b);
  const LIMIT = 120;
  // Reviewed boards first, then by price: the page shows the best-documented ones; the finder holds the rest.
  const shown = [...all].sort((a, b) => (b.rev > 0) - (a.rev > 0) || (a.status === 'current' ? 0 : 1) - (b.status === 'current' ? 0 : 1) || (a.price ?? 1e9) - (b.price ?? 1e9)).slice(0, LIMIT);
  const { first, lede } = t.listLede({
    n: f.num(all.length),
    what: lt.what,
    brands: new Set(all.map((x) => x.brand)).size,
    kits,
    prices: priced.length ? { lo: f.money(priced[0]), hi: f.money(priced.at(-1)), med: f.money(priced[Math.floor(priced.length / 2)]) } : null,
    wireless: l.id !== 'wireless-mechanical-keyboards' ? all.filter((x) => x.conn.some((c) => c !== 'usb')).length : null,
    hotswap: l.id !== 'hot-swappable-keyboards' ? all.filter((x) => x.hs && x.hs !== 'none').length : null,
  });
  const finderHref = `${u}${finderPath(lang)}?q=${encodeURIComponent(lt.q)}`;
  // The boards outlets reviewed, most reviews first: what searchers asking for "the best" one want to read.
  const reviewed = l.items.filter((k) => k.reviews.length).sort((a, b) => b.reviews.length - a.reviews.length || (a.price_usd ?? 1e9) - (b.price_usd ?? 1e9));
  const outlets = [...new Set(reviewed.flatMap((k) => k.reviews.map((r) => r.outlet)))];
  const reviewBlock = reviewed.length
    ? `<section class="block" aria-labelledby="reviewed"><h2 id="reviewed">${esc(t.reviewsSay)}</h2><p>${esc(t.reviewedIntro(reviewed.length, outlets.slice(0, 4), Math.max(0, outlets.length - 4)))}</p>${reviewed
        .slice(0, 8)
        .map((k) => {
          const name = `${brandById.get(k.brand).name} ${k.model}`;
          return `<h3 class="rv-board"><a href="${u}${kbHref(L, k)}">${esc(name)}</a>${k.price_usd != null ? ` <span class="sub">${f.money(k.price_usd)}</span>` : ''}</h3><ul class="reviews">${k.reviews.map((x) => reviewItem(L, k, x)).join('')}</ul>`;
        })
        .join('')}</section>`
    : '';
  const body = `<div class="page data-page"><article class="article">
    ${crumbs(L, depth, [[t.keyboards, hub], [lt.name, null]])}
    <h1>${esc(lt.name)}</h1>
    <p class="lede">${esc(lede)}</p>
    <p class="meta"><a href="${finderHref}">${esc(t.narrow)}${ARROW}</a>${guideA(L, u, l.guide, `${esc(t.readGuide)}${ARROW}`)}<span>${esc(t.specsChecked(f.date(CHECKED)))}</span></p>
    ${reviewBlock}
    ${reviewed.length ? `<h2 id="all">${esc(t.all(f.num(all.length)))}</h2>` : ''}
    <ul class="results-list">${shown.map((x) => resultRow(L, u, x)).join('')}</ul>
    ${all.length > LIMIT ? `<p class="fine">${t.listFine(LIMIT, f.num(all.length), (text) => `<a href="${finderHref}">${esc(text)}</a>`)}</p>` : ''}
    <section class="block" aria-labelledby="more"><h2 id="more">${esc(t.moreLists)}</h2><ul class="chip-links">${LISTS.filter((x) => x !== l).map((x) => `<li><a href="${u}${listPath(x.id, lang)}">${esc(listText(x.id, lang).name)}<span>${f.num(x.items.length)}</span></a></li>`).join('')}</ul></section>
  </article></div>`;
  const firstPhoto = shown.find((x) => hasPhoto(x.id));
  const image = firstPhoto ? photoAbs('keyboard', firstPhoto.id) : null;
  const jsonLd = [breadcrumbLd([[t.keyboards, hub], [lt.name, path]]), itemListLd(L, path, lt.name, shown.map((x) => [`${x.b} ${x.m}`, kbHref(L, keyboardById.get(x.id))]))];
  return shell(L, {
    depth,
    title: fitTitle(lt.name, t.listTitle(f.num(all.length), reviewed.length > 0)),
    description: clip(reviewed.length ? t.listDesc(lt.name, first, outlets.slice(0, 2)) : lede),
    path,
    alt: allLangs((x) => listPath(l.id, x)),
    section: 'keyboards',
    body,
    image,
    imageAlt: firstPhoto ? `${firstPhoto.b} ${firstPhoto.m}` : '',
    jsonLd,
  });
}

// ---------- comparisons ----------

/** Brand and switch-maker pairs people search for ("nuphy vs keychron"), in the order they search them. */
const BRAND_PAIRS = [['nuphy', 'keychron'], ['epomaker', 'keychron'], ['ducky', 'keychron'], ['hhkb', 'realforce']];
const MAKER_PAIRS = [['cherry', 'gateron'], ['gateron', 'kailh']];
for (const [a, b] of BRAND_PAIRS) if (!brandById.has(a) || !brandById.has(b)) throw new Error(`compare: no brand ${a} or ${b}`);
for (const [a, b] of MAKER_PAIRS) if (!makerById.has(a) || !makerById.has(b)) throw new Error(`compare: no maker ${a} or ${b}`);

/** Sizes from the largest board to the smallest. */
const SIZE_ORDER = ['full', '96', 'tkl', '75', '65', '60', '50', '40', '30', 'numpad', 'other'];
const median = (xs) => (xs.length ? xs[Math.floor((xs.length - 1) / 2)] : null);
const SWITCH_TYPES = ['linear', 'tactile', 'clicky', 'silent-linear', 'silent-tactile'];

function brandStats(id) {
  const ks = keyboards.filter((k) => k.brand === id);
  const fr = ks.map((k) => finderById.get(k.id));
  const prices = ks.map((k) => k.price_usd).filter((p) => p != null).sort((a, b) => a - b);
  const makerCount = new Map();
  for (const x of fr) for (const m of x.swmNames) makerCount.set(m, (makerCount.get(m) ?? 0) + 1);
  return {
    b: brandById.get(id),
    ks,
    n: ks.length,
    current: ks.filter((k) => k.status === 'current').length,
    prices,
    wireless: ks.filter((k) => k.connectivity.some((c) => c !== 'usb')).length,
    hotswap: ks.filter((k) => k.hot_swap && k.hot_swap !== 'none').length,
    lowProfile: ks.filter((k) => k.low_profile).length,
    adjustable: ks.filter((k) => k.adjustable_actuation).length,
    rapid: ks.filter((k) => k.rapid_trigger).length,
    qmk: ks.filter((k) => k.firmware.some((f) => f === 'qmk' || f === 'via' || f === 'vial')).length,
    aluminum: ks.filter((k) => /alumin|^metal$/i.test(k.case_material ?? '') && !/plastic|abs|polymer/i.test(k.case_material)).length,
    sizes: new Map(SIZE_ORDER.filter((x) => labels('en').SIZE_LABEL[x]).map((s) => [s, ks.filter((k) => k.size === s)]).filter(([, v]) => v.length)),
    makers: [...makerCount].sort((x, y) => y[1] - x[1]),
    reviews: ks.reduce((n, k) => n + k.reviews.length, 0),
    reviewed: ks.filter((k) => k.reviews.length),
  };
}

const cheapest = (ks) => ks.filter((k) => k.price_usd != null).sort((a, b) => a.price_usd - b.price_usd)[0] ?? null;
const BRAND_STATS = new Map([...new Set(BRAND_PAIRS.flat())].map((id) => [id, brandStats(id)]));

function brandComparePage(L, pair) {
  const { t, f, lab, lang } = L;
  const c = t.brandCmp;
  const NIL = nilOf(L);
  const depth = 4;
  const u = up(depth);
  const [A, B] = pair.map((id) => BRAND_STATS.get(id));
  const path = comparePath('keyboards', pair, lang);
  const hub = hubPath('keyboards', lang);
  const title = `${A.b.name} vs ${B.b.name}`;
  const facts = (s) => ({
    name: s.b.name,
    n: s.n,
    lo: s.prices.length ? f.money(s.prices[0]) : null,
    hi: s.prices.length ? f.money(s.prices.at(-1)) : null,
    med: s.prices.length ? f.money(median(s.prices)) : null,
    wireless: f.pct(s.wireless, s.n),
    hotswap: f.pct(s.hotswap, s.n),
  });
  const lede = c.lede(facts(A), facts(B));
  const range = (s) => (s.prices.length ? c.range(f.money(s.prices[0]), f.money(s.prices.at(-1))) : c.noPrices);
  const share = (n, of) => c.share(n, of, f.pct(n, of));
  const row = (label, fn) => `<tr><th scope="row">${esc(label)}</th><td>${fn(A)}</td><td>${fn(B)}</td></tr>`;
  const r = c.rows;
  const table = `<div class="prose"><div class="table-wrap"><table><caption class="sr-only">${esc(c.caption(title))}</caption><thead><tr><th scope="col"></th><th scope="col">${esc(A.b.name)}</th><th scope="col">${esc(B.b.name)}</th></tr></thead><tbody>
    ${row(r.n, (s) => esc(c.nNow(s.n, s.current)))}
    ${row(r.range, (s) => esc(range(s)))}
    ${row(r.median, (s) => (s.prices.length ? f.money(median(s.prices)) : NIL))}
    ${row(r.sizes, (s) => esc([...s.sizes.keys()].map((k) => lab.SIZE_LABEL[k]).join(', ')))}
    ${row(r.wireless, (s) => esc(share(s.wireless, s.n)))}
    ${row(r.hotswap, (s) => esc(share(s.hotswap, s.n)))}
    ${row(r.lp, (s) => esc(share(s.lowProfile, s.n)))}
    ${row(r.adjustable, (s) => esc(share(s.adjustable, s.n)))}
    ${row(r.rt, (s) => esc(share(s.rapid, s.n)))}
    ${row(r.qmk, (s) => esc(share(s.qmk, s.n)))}
    ${row(r.aluminum, (s) => esc(share(s.aluminum, s.n)))}
    ${row(r.makers, (s) => esc(s.makers.slice(0, 4).map(([m]) => m).join(', ') || t.nil))}
    ${row(r.reviews, (s) => esc(c.reviewsOn(s.reviews, s.reviewed.length)))}
    ${A.b.country || B.b.country ? row(r.country, (s) => esc(f.region(s.b.country) ?? t.nil)) : ''}
    ${A.b.founded || B.b.founded ? row(r.founded, (s) => (s.b.founded ? String(s.b.founded) : NIL)) : ''}
  </tbody></table></div></div>`;
  const sizes = [...new Set([...A.sizes.keys(), ...B.sizes.keys()])].sort((x, y) => SIZE_ORDER.indexOf(x) - SIZE_ORDER.indexOf(y));
  const cell = (s, size) => {
    const ks = s.sizes.get(size) ?? [];
    if (!ks.length) return `<span class="nil">${esc(c.none)}</span>`;
    const ch = cheapest(ks);
    return c.sizeCell(ks.length, ch ? `<a href="${u}${kbHref(L, ch)}">${esc(ch.model)}</a>` : '', ch ? f.money(ch.price_usd) : '');
  };
  const sizeTable = `<div class="prose"><div class="table-wrap"><table><caption class="sr-only">${esc(c.sizeCaption)}</caption><thead><tr><th scope="col">${esc(c.size)}</th><th scope="col">${esc(A.b.name)}</th><th scope="col">${esc(B.b.name)}</th></tr></thead><tbody>${sizes.map((size) => `<tr><th scope="row">${esc(lab.SIZE_LABEL[size])}</th><td>${cell(A, size)}</td><td>${cell(B, size)}</td></tr>`).join('')}</tbody></table></div></div>`;
  const top = (s) => [...s.ks].sort((x, y) => y.reviews.length - x.reviews.length || (x.price_usd ?? 1e9) - (y.price_usd ?? 1e9)).slice(0, 4).map((k) => finderById.get(k.id));
  const body = `<div class="page data-page"><article class="article">
    ${crumbs(L, depth, [[t.keyboards, hub], [t.compare, null]])}
    <h1>${esc(c.h1(title))}</h1>
    <p class="lede">${esc(lede)}</p>
    <p class="meta">${[A, B].map((s) => `<a href="${u}${brandPath(s.b.id, lang)}">${esc(c.every(s.b.name))}${ARROW}</a>`).join('')}<span>${esc(t.specsChecked(f.date(CHECKED)))}</span></p>
    <section class="block" aria-labelledby="side"><h2 id="side">${esc(c.side)}</h2>${table}<p class="fine">${esc(c.fine)}</p></section>
    <section class="block" aria-labelledby="sizes"><h2 id="sizes">${esc(c.bySize)}</h2>${sizeTable}</section>
    ${[A, B].map((s) => `<section class="block" aria-labelledby="top-${s.b.id}"><h2 id="top-${s.b.id}">${esc(c.most(s.b.name))}</h2><ul class="results-list">${top(s).map((x) => resultRow(L, u, x, { showBrand: false })).join('')}</ul></section>`).join('')}
    <section class="block" aria-labelledby="about"><h2 id="about">${esc(c.two)}</h2>${[A, B].map((s) => `<p><strong>${esc(s.b.name)}.</strong> ${esc(L.rec.about('brand', s.b) ?? '')} ${s.b.official_url ? `<a href="${esc(s.b.official_url)}" rel="noopener">${esc(t.makerSite(s.b.name))}</a>` : ''}</p>`).join('')}</section>
    ${compareChips(L, u, path)}
  </article></div>`;
  const jsonLd = [
    breadcrumbLd([[t.keyboards, hub], [title, path]]),
    { '@type': 'WebPage', '@id': abs(path), name: c.ldName(title), url: abs(path), inLanguage: lang, about: [A, B].map((s) => ({ '@type': 'Brand', name: s.b.name, ...(s.b.official_url ? { url: s.b.official_url } : {}) })), publisher: PUBLISHER },
  ];
  return shell(L, { depth, title: fitTitle(title, c.titleSuffix), description: clip(lede), path, alt: allLangs((l) => comparePath('keyboards', pair, l)), section: 'keyboards', body, jsonLd });
}

function makerStats(id) {
  const ss = switches.filter((s) => s.maker === id);
  const num = (field) => ss.map((s) => s[field]).filter((v) => typeof v === 'number').sort((a, b) => a - b);
  const families = new Map();
  for (const s of ss) if (s.family) families.set(s.family, (families.get(s.family) ?? 0) + 1);
  return {
    m: makerById.get(id),
    ss,
    n: ss.length,
    byType: new Map(SWITCH_TYPES.map((t) => [t, ss.filter((s) => s.type === t)])),
    magnetic: ss.filter((s) => s.sensing === 'magnetic').length,
    optical: ss.filter((s) => s.sensing === 'optical').length,
    lowProfile: ss.filter((s) => s.profile === 'low' || s.profile === 'ultra-low').length,
    lubed: ss.filter((s) => s.factory_lubed === true).length,
    forces: num('actuation_force_gf'),
    travel: num('total_travel_mm'),
    life: num('rated_lifespan_million'),
    families: [...families].sort((x, y) => y[1] - x[1]),
    boards: finderData.keyboards.filter((x) => x.swm.includes(id)).length,
  };
}
const MAKER_STATS = new Map([...new Set(MAKER_PAIRS.flat())].map((id) => [id, makerStats(id)]));

function makerComparePage(L, pair) {
  const { t, f, lang, colon } = L;
  const c = t.makerCmp;
  const NIL = nilOf(L);
  const depth = 4;
  const u = up(depth);
  const [A, B] = pair.map((id) => MAKER_STATS.get(id));
  const path = comparePath('switches', pair, lang);
  const hub = hubPath('switches', lang);
  const title = c.title(A.m.name, B.m.name);
  const facts = (s) => ({ name: s.m.name, n: s.n, med: s.forces.length ? f.num(median(s.forces)) : null, boards: s.boards });
  const lede = c.lede(facts(A), facts(B));
  const row = (label, fn) => `<tr><th scope="row">${esc(label)}</th><td>${fn(A)}</td><td>${fn(B)}</td></tr>`;
  const r = c.rows;
  const br = t.brandCmp;
  const table = `<div class="prose"><div class="table-wrap"><table><caption class="sr-only">${esc(br.caption(title))}</caption><thead><tr><th scope="col"></th><th scope="col">${esc(A.m.name)}</th><th scope="col">${esc(B.m.name)}</th></tr></thead><tbody>
    ${row(r.n, (s) => f.num(s.n))}
    ${A.m.country || B.m.country ? row(br.rows.country, (s) => esc(f.region(s.m.country) ?? t.nil)) : ''}
    ${A.m.founded || B.m.founded ? row(br.rows.founded, (s) => (s.m.founded ? String(s.m.founded) : NIL)) : ''}
    ${SWITCH_TYPES.map((ty) => row(ucFirst(t.type[ty]), (s) => String(s.byType.get(ty).length))).join('')}
    ${row(r.magnetic, (s) => String(s.magnetic))}
    ${row(r.optical, (s) => String(s.optical))}
    ${row(r.lp, (s) => String(s.lowProfile))}
    ${row(r.force, (s) => (s.forces.length ? esc(t.gfRange(s.forces[0], s.forces.at(-1))) : NIL))}
    ${row(r.medForce, (s) => (s.forces.length ? `${f.num(median(s.forces))} gf` : NIL))}
    ${row(r.medTravel, (s) => (s.travel.length ? `${f.num(median(s.travel))} mm` : NIL))}
    ${row(r.lubed, (s) => esc(br.share(s.lubed, s.n, f.pct(s.lubed, s.n))))}
    ${row(r.life, (s) => (s.life.length ? esc(t.pressesRange(s.life[0], s.life.at(-1))) : NIL))}
    ${row(r.boards, (s) => f.num(s.boards))}
  </tbody></table></div></div>`;
  const typeTable = `<div class="prose"><div class="table-wrap"><table><caption class="sr-only">${esc(c.typeCaption)}</caption><thead><tr><th scope="col">${esc(c.type)}</th><th scope="col">${esc(A.m.name)}</th><th scope="col">${esc(B.m.name)}</th></tr></thead><tbody>${SWITCH_TYPES.filter((ty) => A.byType.get(ty).length || B.byType.get(ty).length)
    .map((ty) => {
      const cell = (s) => {
        const xs = s.byType.get(ty);
        const fs = xs.map((x) => x.actuation_force_gf).filter((v) => typeof v === 'number').sort((a, b) => a - b);
        return xs.length ? esc(c.typeCell(xs.length, fs.length ? median(fs) : null)) : `<span class="nil">${esc(br.none)}</span>`;
      };
      return `<tr><th scope="row">${esc(t.type[ty])}</th><td>${cell(A)}</td><td>${cell(B)}</td></tr>`;
    })
    .join('')}</tbody></table></div></div>`;
  const lines = (s) => `<p><strong>${esc(s.m.name)}</strong>${colon} ${esc(s.families.slice(0, 10).map(([fam, n]) => `${fam} (${n})`).join(', ') || c.noLines)}.</p>`;
  const finderQ = (s) => `${u}${finderPath(lang)}?q=${encodeURIComponent(c.finderQ(s.m.name))}`;
  const guides = [guideA(L, u, 'switch-manufacturers', `${esc(c.whoMakes)}${ARROW}`), guideA(L, u, 'red-vs-brown-vs-blue-switches', `${esc(c.rbb)}${ARROW}`)].filter(Boolean).join('');
  const body = `<div class="page data-page"><article class="article">
    ${crumbs(L, depth, [[t.switchesH, hub], [t.compare, null]])}
    <h1>${esc(c.h1(title))}</h1>
    <p class="lede">${esc(lede)}</p>
    <p class="meta">${[A, B].map((s) => `<a href="${finderQ(s)}">${esc(c.boardsWith(s.m.name))}${ARROW}</a>`).join('')}<span>${esc(t.specsChecked(f.date(CHECKED)))}</span></p>
    <section class="block" aria-labelledby="side"><h2 id="side">${esc(br.side)}</h2>${table}<p class="fine">${esc(c.fine)}</p></section>
    <section class="block" aria-labelledby="types"><h2 id="types">${esc(c.byType)}</h2>${typeTable}</section>
    <section class="block" aria-labelledby="lines"><h2 id="lines">${esc(c.lines)}</h2>${lines(A)}${lines(B)}<p class="meta">${[A, B].map((s) => `<a href="${u}${makerPath(s.m.id, lang)}">${esc(c.every(s.m.name))}${ARROW}</a>`).join('')}</p></section>
    <section class="block" aria-labelledby="about"><h2 id="about">${esc(c.two)}</h2>${[A, B].map((s) => `<p><strong>${esc(s.m.name)}.</strong> ${esc(L.rec.about('maker', s.m) ?? '')} ${s.m.official_url ? `<a href="${esc(s.m.official_url)}" rel="noopener">${esc(t.makerSite(s.m.name))}</a>` : ''}</p>`).join('')}</section>
    ${guides ? `<p class="meta">${guides}</p>` : ''}
    ${compareChips(L, u, path)}
  </article></div>`;
  const jsonLd = [
    breadcrumbLd([[t.switchesH, hub], [title, path]]),
    { '@type': 'WebPage', '@id': abs(path), name: c.ldName(title), url: abs(path), inLanguage: lang, about: [A, B].map((s) => ({ '@type': 'Organization', name: s.m.name, ...(s.m.official_url ? { url: s.m.official_url } : {}) })), publisher: PUBLISHER },
  ];
  return shell(L, { depth, title: fitTitle(title, c.titleSuffix), description: clip(lede), path, alt: allLangs((l) => comparePath('switches', pair, l)), section: 'switches', body, jsonLd });
}

/** Every comparison, as chips (the current one left out). */
function compareChips(L, u, current, heading = L.t.moreCompare) {
  const items = [
    ...BRAND_PAIRS.map((p) => [`${brandById.get(p[0]).name} vs ${brandById.get(p[1]).name}`, comparePath('keyboards', p, L.lang)]),
    ...MAKER_PAIRS.map((p) => [L.t.makerCmp.title(makerById.get(p[0]).name, makerById.get(p[1]).name), comparePath('switches', p, L.lang)]),
  ].filter(([, p]) => p !== current);
  return `<section class="block" aria-labelledby="compare"><h2 id="compare">${esc(heading)}</h2><ul class="chip-links">${items.map(([n, p]) => `<li><a href="${u}${p}">${esc(n)}</a></li>`).join('')}</ul></section>`;
}

function switchesHub(L) {
  const { t, f, lang } = L;
  const depth = 2;
  const u = up(depth);
  const path = hubPath('switches', lang);
  const sorted = [...makerFiles].sort((a, b) => b.switches.length - a.switches.length);
  const cta = guideA(L, u, 'keyboard-switches', `${esc(t.swHub.cta)}${ARROW}`, 'cap-button cap-lg');
  const body = `<div class="hub-page">
    <h1>${esc(t.swHub.h1)}</h1>
    <p class="lede">${esc(t.swHub.lede(switches.length, makers.length))}</p>
    ${cta ? `<p>${cta}</p>` : ''}
    <section class="block" aria-labelledby="makers"><h2 id="makers">${esc(t.swHub.makers)}</h2><ul class="brand-grid">${sorted.map((x) => `<li><a href="${u}${makerPath(x.maker.id, lang)}"><span class="bn">${esc(x.maker.name)}<em>${esc(t.swHub.role[x.maker.role] ?? '')}</em></span><span class="bc">${f.num(x.switches.length)}</span></a></li>`).join('')}</ul></section>
    ${compareChips(L, u, null, t.swHub.compared)}
    ${guideSection(L, u, ['linear-vs-tactile-vs-clicky', 'red-vs-brown-vs-blue-switches', 'quiet-switches', 'hall-effect-switches', 'switch-specs', 'switch-manufacturers'])}
  </div>`;
  const jsonLd = [breadcrumbLd([[t.switchesH, path]]), itemListLd(L, path, t.swHub.h1, sorted.map((x) => [t.makerTitle(x.maker.name), makerPath(x.maker.id, lang)]))];
  return shell(L, { depth, title: t.swHub.title, description: clip(t.swHub.description(switches.length, makers.length)), path, alt: allLangs((l) => hubPath('switches', l)), section: 'switches', body, jsonLd });
}

function makerPage(L, file) {
  const { t, f, lang } = L;
  const m = file.maker;
  const depth = 3;
  const u = up(depth);
  const path = makerPath(m.id, lang);
  const hub = hubPath('switches', lang);
  const about = L.rec.about('maker', m) ?? '';
  const ss = [...file.switches].sort((a, b) => (a.family ?? '').localeCompare(b.family ?? '') || a.name.localeCompare(b.name));
  const DOT = '<span class="nil">·</span>';
  const cols = t.makerCols;
  const body = `<div class="page data-page wide"><article class="article">
    ${crumbs(L, depth, [[t.switchesH, hub], [m.name, null]])}
    <h1>${esc(t.makerTitle(m.name))}</h1>
    <p class="lede">${esc(about)}</p>
    <p class="meta">${m.official_url ? `<a href="${esc(m.official_url)}" rel="noopener">${esc(t.makerSite(m.name))}${OUT_ARROW}</a>` : ''}<span>${esc(t.nSwitches(ss.length))}</span>${m.country ? `<span>${esc(f.region(m.country))}</span>` : ''}</p>
    <div class="prose"><div class="table-wrap"><table><caption class="sr-only">${esc(t.makerCaption(m.name))}</caption><thead><tr><th scope="col">${esc(cols[0])}</th><th scope="col">${esc(cols[1])}</th><th scope="col" class="num">${esc(cols[2])}</th><th scope="col" class="num">${esc(cols[3])}</th><th scope="col" class="num">${esc(cols[4])}</th><th scope="col">${esc(cols[5])}</th></tr></thead><tbody>${ss
      .map((s) => `<tr><td>${swLink(L, u, s)}</td><td>${esc(t.type[s.type])}</td><td class="num">${s.actuation_force_gf ? `${f.num(s.actuation_force_gf)} gf` : DOT}</td><td class="num">${s.actuation_range_mm ? `${f.num(s.actuation_range_mm[0])}–${f.num(s.actuation_range_mm[1])} mm` : s.pre_travel_mm ? `${f.num(s.pre_travel_mm)} mm` : DOT}</td><td class="num">${s.total_travel_mm ? `${f.num(s.total_travel_mm)} mm` : DOT}</td><td>${esc(s.family ?? '')}</td></tr>`)
      .join('')}</tbody></table></div></div>
  </article></div>`;
  const firstPhoto = ss.find((s) => hasPhoto(s.id) && switchHasPage(s));
  const image = firstPhoto ? photoAbs('switch', firstPhoto.id) : null;
  const jsonLd = [breadcrumbLd([[t.switchesH, hub], [m.name, path]]), itemListLd(L, path, t.makerTitle(m.name), ss.filter(switchHasPage).map((s) => [swName(s), swHref(L, s)]))];
  return shell(L, {
    depth,
    title: fitTitle(t.makerTitle(m.name), t.makerTitleSuffix),
    description: clip(t.makerDesc(ss.length, m.name, about).trim()),
    path,
    alt: allLangs((l) => makerPath(m.id, l)),
    section: 'switches',
    body,
    image,
    imageAlt: firstPhoto ? swName(firstPhoto) : '',
    jsonLd,
  });
}

// ---------- write ----------

if (!existsSync(join(OUT, 'guides-assets', 'guides.css'))) throw new Error(`${OUT} has no guides-assets: run scripts/guides/build.mjs first`);
// One finder script and one data file for every language.
writeFileSync(join(OUT, 'guides-assets', 'finder-data.json'), JSON.stringify(finderData));
copyFileSync(join(import.meta.dirname, 'finder.js'), join(OUT, 'guides-assets', 'finder.js'));
copyFileSync(join(import.meta.dirname, 'data.css'), join(OUT, 'guides-assets', 'data.css'));

const lastOf = (records) => records.map(checkedOf).filter(Boolean).sort().at(-1) ?? CHECKED;
const switchPages = switches.filter(switchHasPage);
const missing = {};
for (const lang of DB_LANGS) {
  const L = context(lang);
  write(hubPath('keyboards', lang), keyboardsHub(L), { lastmod: CHECKED });
  write(finderPath(lang), finderPage(L), { lastmod: CHECKED });
  write(hubPath('switches', lang), switchesHub(L), { lastmod: CHECKED });
  for (const l of LISTS) write(listPath(l.id, lang), listPage(L, l), { lastmod: CHECKED });
  for (const pair of BRAND_PAIRS) write(comparePath('keyboards', pair, lang), brandComparePage(L, pair), { lastmod: CHECKED });
  for (const pair of MAKER_PAIRS) write(comparePath('switches', pair, lang), makerComparePage(L, pair), { lastmod: CHECKED });
  for (const x of brandFiles) write(brandPath(x.brand.id, lang), brandPage(L, x), { lastmod: lastOf(x.keyboards) });
  for (const x of makerFiles) write(makerPath(x.maker.id, lang), makerPage(L, x), { lastmod: lastOf(x.switches) });
  if (RECORD_LANGS.includes(lang)) {
    for (const k of keyboards) {
      const p = keyboardPage(L, k);
      write(kbPath(k, lang), p.html, { lastmod: checkedOf(k), image: p.image });
    }
    for (const s of switchPages) {
      const p = switchPage(L, s);
      write(swPath(s, lang), p.html, { lastmod: checkedOf(s), image: p.image });
    }
  }
  if (lang !== 'en') missing[lang] = `${L.rec.missing()} missing, ${L.rec.stale()} outdated`;
}

// Sitemap: append these pages to the one the guides build wrote, with their photo (image sitemap).
const SITEMAP = join(OUT, 'sitemap.xml');
if (!existsSync(SITEMAP)) throw new Error('dist/sitemap.xml is missing: run scripts/guides/build.mjs first');
const MARK_START = '  <!-- database pages -->';
// A second run replaces what the first one appended.
let xml = readFileSync(SITEMAP, 'utf8').replace(new RegExp(`${MARK_START}[\\s\\S]*(?=</urlset>)`), '');
if (!xml.includes('xmlns:image=')) xml = xml.replace('<urlset ', '<urlset xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" ');
const entries = sitemap.map(
  (e) => `  <url>\n    <loc>${esc(e.loc)}</loc>${e.lastmod ? `\n    <lastmod>${e.lastmod}</lastmod>` : ''}${e.image ? `\n    <image:image><image:loc>${esc(e.image)}</image:loc></image:image>` : ''}\n  </url>`,
);
xml = xml.replace('</urlset>', `${MARK_START}\n${entries.join('\n')}\n</urlset>`);
writeFileSync(SITEMAP, xml);

console.log(
  `data pages (${DB_LANGS.join(', ')}; record pages in ${RECORD_LANGS.join(', ')}): finder (${finderData.keyboards.length} keyboards, ${(JSON.stringify(finderData).length / 1024).toFixed(0)} KB), ${keyboards.length} keyboards, ${switchPages.length} of ${switches.length} switches, ${brandFiles.length} brands, ${makerFiles.length} makers, ${LISTS.length} lists, ${Object.keys(photos).length} photos; sitemap +${sitemap.length} urls; record text still in English: ${Object.entries(missing).map(([l, n]) => `${l} ${n}`).join(', ')}`,
);
