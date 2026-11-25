// Builds the keyboard and switch database pages into dist/: the keyboard finder, a page per keyboard, brand,
// switch and switch maker, the preset lists (split keyboards, 60% keyboards...), the two hubs, and their
// sitemap entries (appended to the sitemap the guides build wrote). Runs after scripts/guides/build.mjs.
//   node scripts/data-pages/build.mjs [--out dist] [--photo-base <url>]
// English only for now. Photos: brand photos with the background removed, served by Cloudflare Images on the
// site's own domain (/cdn-cgi/imagedelivery/...); content/data/photos.json says which records have one.

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { esc, glyph, photoUrl, specLine, thumb, LABELS } from './finder.js';
import {
  LISTS, brandById, brandFiles, brands, checkedOf, kbPath, keyboardById, keyboards, listPath, makerById, makerFiles, makers,
  finderDb, photos, swPath, switchById, switchHasPage, switches,
} from './db.mjs';

const SITE = 'https://petitdoigt.ca';
const repo = join(import.meta.dirname, '..', '..');
const arg = (name) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : null);
const OUT = resolve(repo, arg('--out') ?? 'dist');
/** Cloudflare Images on the site's own domain; a local preview passes the imagedelivery.net address instead. */
const PHOTO_PATH = '/cdn-cgi/imagedelivery/ol_zAKtUVN9EF_zwuf9Wxw/petitdoigt/';
const PHOTOS = arg('--photo-base') ?? PHOTO_PATH;
const { SIZE_LABEL, FOOTPRINT, FW } = LABELS;

const up = (depth) => '../'.repeat(depth);
const fmtDate = (iso) => (iso ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`)) : '');
const money = (n) => `$${Number(n).toLocaleString('en-US', Number.isInteger(Number(n)) ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const list = (a) => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a.at(-1)}`);
const article = (w) => (/^[aeiou8]/i.test(w) || /^(?:11|18)/.test(w) ? 'An' : 'A');
/** A description for search results: whole words, at most 158 characters. */
const clip = (s, n = 158) => (s.length <= n ? s : `${s.slice(0, n - 1).replace(/\s+\S*$/, '').replace(/[,;:]$/, '')}…`);
const abs = (path) => `${SITE}/${path}`;
/** The longest of the suffixes that keeps "<name><suffix> · petitdoigt" within 62 characters (what a search result shows). */
const fitTitle = (name, suffixes) => `${name}${suffixes.find((x) => (name + x).length <= 49) ?? suffixes.at(-1)}`;
/** "MoErgo Glove80 specs: a split…": the lede, lower-cased after the colon. */
const specLead = (name, lede) => `${name} specs: ${lede.replace(/^(A|An) /, (m) => m.toLowerCase())}`;
const allDates = [...keyboards, ...switches].map(checkedOf).filter(Boolean).sort();
const CHECKED = allDates.at(-1);
const hasPhoto = (id) => !!photos[id];
/** English guides that exist: a link to a guide not written yet drops out. */
const GUIDE_DIR = join(repo, 'content', 'guides', 'en');
const hasGuide = (id) => existsSync(join(GUIDE_DIR, `${id}.html`));
const guideChips = (u, pairs) => pairs.filter(([id]) => hasGuide(id)).map(([id, n]) => `<li><a href="${u}en/${id}/">${esc(n)}</a></li>`).join('');
const guideSection = (u, pairs) => ((c) => (c ? `<section class="block" aria-labelledby="guides"><h2 id="guides">Guides</h2><ul class="chip-links">${c}</ul></section>` : ''))(guideChips(u, pairs));
const photoAbs = (kind, id) => `${SITE}${PHOTO_PATH}${kind}/${encodeURIComponent(id)}/w1200`;

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

function shell({ depth, title, description, path, section, body, scripts = '', image = null, imageAlt = '', jsonLd = [], type = 'website' }) {
  const u = up(depth);
  const canonical = abs(path);
  const nav = (key, href, label) => `<a class="nav-link" href="${u}${href}"${section === key ? ' aria-current="page"' : ''}>${label}</a>`;
  const ld = { '@context': 'https://schema.org', '@graph': jsonLd };
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · petitdoigt</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
<link rel="alternate" hreflang="en" href="${canonical}">
<link rel="alternate" hreflang="x-default" href="${canonical}">
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="petitdoigt">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:locale" content="en">
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
<a class="skip" href="#content">skip to content</a>
<header class="site-head">
  <a class="brand" href="${u}">${MARK}<span>petitdoigt</span></a>
  <nav class="site-nav" aria-label="petitdoigt">
    ${nav('guides', 'en/', 'guides')}
    ${nav('keyboards', 'en/keyboards/', 'keyboards')}
    ${nav('switches', 'en/switches/', 'switches')}
    <a class="cap-button" href="${u}?lang=en#words">start practicing${ARROW}</a>
  </nav>
</header>
<main id="content">
${body}
</main>
<footer class="site-foot">
  <p>petitdoigt is a free typing trainer that teaches which finger hits each key. Keyboard and switch specs come from the makers' own pages, checked ${fmtDate(CHECKED)}. Photos belong to the brands credited under each one.</p>
  <nav class="foot-links" aria-label="sections"><a href="${u}en/">typing guides</a><a href="${u}en/keyboards/">keyboards</a><a href="${u}en/keyboards/finder/">keyboard finder</a><a href="${u}en/switches/">switches</a><a href="https://github.com/latranchee/typing_trainer">source code</a></nav>
</footer>
${scripts}
</body>
</html>
`;
}

const sitemap = [];
function write(path, html, { lastmod = null, image = null, imageTitle = '' } = {}) {
  const file = join(OUT, path, 'index.html');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
  sitemap.push({ loc: abs(path), lastmod, image, imageTitle });
}

const crumbs = (depth, items) => `<nav class="crumbs" aria-label="breadcrumb">${items.map(([label, href]) => (href ? `<a href="${up(depth)}${href}">${esc(label)}</a>` : `<span class="here">${esc(label)}</span>`)).join('<span aria-hidden="true">/</span>')}</nav>`;

// ---------- spec sheet with source numbers ----------

const NIL = '<span class="nil">not published</span>';
const yesNo = (v) => (v === true ? 'yes' : v === false ? 'no' : NIL);

function sheet(record, groups) {
  const sources = record.sources ?? [];
  const refs = (fields) => {
    const n = sources.map((s, i) => (s.backs?.some((b) => fields.includes(b)) ? i + 1 : 0)).filter(Boolean);
    return n.length ? `<span class="refs">${n.map((i) => `<a href="#src-${i}" aria-label="source ${i}">${i}</a>`).join('')}</span>` : '';
  };
  return groups
    .map(([title, rows]) => {
      const live = rows.filter((r) => r);
      const id = `g-${title.toLowerCase().replace(/\W+/g, '-')}`;
      // A group with nothing published collapses to one line naming what is missing.
      if (live.every(([, value]) => value === NIL)) {
        return `<section class="sheet-group" aria-labelledby="${id}"><h2 id="${id}">${esc(title)}</h2><p class="empty-line">Not published: ${esc(list(live.map(([label]) => label.toLowerCase())))}.</p></section>`;
      }
      return `<section class="sheet-group" aria-labelledby="${id}"><h2 id="${id}">${esc(title)}</h2><dl class="sheet">${live
        .map(([label, value, fields]) => `<div class="sheet-row"><dt>${esc(label)}</dt><dd><span class="v">${value}</span>${refs(fields)}</dd></div>`)
        .join('')}</dl></section>`;
    })
    .join('');
}

function sourcesBlock(record) {
  const s = record.sources ?? [];
  if (!s.length) return '';
  const KIND = { official: 'official', datasheet: 'datasheet', retailer: 'retailer', review: 'review', measurement: 'measurement', reference: 'reference' };
  return `<section class="sources data-sources" aria-labelledby="sources"><h2 id="sources">Sources</h2><ol>${s
    .map((x, i) => `<li id="src-${i + 1}"><a href="${esc(x.url)}" rel="noopener">${esc(x.title)}</a> <span class="kind kind-${esc(x.kind)}">${KIND[x.kind] ?? esc(x.kind)}</span><span class="checked">checked ${fmtDate(x.checked)}</span></li>`)
    .join('')}</ol></section>`;
}

function reviewsBlock(record, name) {
  const r = record.reviews ?? [];
  const items = r
    .map(
      (x) => `<li><a class="review" href="${esc(x.url)}" rel="noopener"><span class="rv-head"><span class="rv-outlet">${esc(x.outlet)}</span>${x.score ? `<span class="rv-score">${esc(x.score)}</span>` : ''}<span class="rv-date">${x.date ? fmtDate(x.date) : ''}</span></span><span class="rv-verdict">${esc(x.verdict)}</span><span class="rv-go">read the review${OUT_ARROW}</span></a></li>`,
    )
    .join('');
  return `<section class="block" aria-labelledby="reviews"><h2 id="reviews">Reviews</h2>${r.length ? `<ul class="reviews">${items}</ul><p class="fine">Each line sums up the review in our words; the score is the outlet's own.</p>` : `<p class="empty-line">No published review of the ${esc(name)} turned up when this page was checked.</p>`}</section>`;
}

/** A switch's name linked to its page when it has one. */
const swLink = (u, s, label = s.name) => (switchHasPage(s) ? `<a href="${u}${swPath(s)}">${esc(label)}</a>` : esc(label));

// ---------- keyboard page ----------

const HOTSWAP = { none: 'no: switches are soldered', yes: 'yes (socket type not stated)', '3-pin': 'yes, 3-pin sockets', '5-pin': 'yes, 5-pin sockets (take 3 and 5 pins)', choc: 'yes, Choc sockets', magnetic: 'yes, magnetic switches lift out', optical: 'yes, optical sockets', other: 'yes, other sockets' };
const KIND = { prebuilt: 'assembled, with switches and keycaps', barebones: 'barebones: no switches or keycaps', kit: 'kit: you assemble it', pcb: 'open design: a PCB or vendor builds' };
const STAGGER = { row: 'row stagger (classic)', ortholinear: 'ortholinear (grid)', column: 'column stagger (columnar)' };
const SPLIT = { none: 'one piece', 'unibody-angled': 'angled one-piece (Alice style)', split: 'split: two halves' };
const TENT = { none: 'none', 'built-in': 'built in', accessory: 'with an accessory' };
const CONN = { usb: 'USB', bluetooth: 'Bluetooth', '2.4ghz': '2.4 GHz' };
const OS = { windows: 'Windows', mac: 'macOS', linux: 'Linux', ios: 'iOS', android: 'Android' };

/** "split, column-staggered, low-profile keyboard": the shape words for a keyboard. */
function kbShape(k) {
  const adj = [];
  if (k.split === 'split') adj.push('split');
  if (k.split === 'unibody-angled') adj.push('angled one-piece');
  if (k.stagger === 'column') adj.push('column-staggered');
  if (k.stagger === 'ortholinear') adj.push('ortholinear');
  if (k.low_profile) adj.push('low-profile');
  if (k.size === 'full') adj.push('full-size');
  else if (k.size === 'tkl') adj.push('tenkeyless');
  else if (k.size !== 'other' && k.size !== 'numpad') adj.push(`${k.size}%`);
  if (k.connectivity.some((c) => c !== 'usb')) adj.push('wireless');
  const noun = k.size === 'numpad' ? 'numpad' : 'keyboard';
  return { adj, noun, text: adj.length ? `${adj.join(', ')} ${noun}` : noun };
}

function kbLede(k, brand) {
  const shape = kbShape(k);
  const adj = shape.adj.filter((a) => a !== 'wireless');
  const head = adj.length ? `${article(adj[0])} ${adj.join(', ')} ${shape.noun}` : `${article(shape.noun)} ${shape.noun}`;
  const extras = [];
  if (k.key_count) extras.push(`${k.key_count} keys`);
  if (k.thumb_cluster) extras.push(k.split === 'split' ? 'a thumb cluster on each half' : 'a thumb cluster');
  if (k.tenting === 'built-in') extras.push('built-in tenting');
  if (k.key_wells) extras.push('curved key wells');
  const s = [`${head}${extras.length ? ` with ${list(extras)}` : ''}.`];
  const sw = [];
  const foot = FOOTPRINT[k.switch_footprint];
  if (foot && k.switch_footprint !== 'other' && k.switch_footprint !== 'proprietary') sw.push(`It takes ${foot} switches`);
  if (k.hot_swap === 'none') sw.push(sw.length ? 'soldered to the board' : 'Its switches are soldered to the board');
  else if (k.hot_swap) sw.push(sw.length ? 'in hot-swap sockets' : 'Its switches sit in hot-swap sockets');
  if (sw.length) s.push(`${sw.join(', ')}.`);
  if (k.adjustable_actuation) s.push(`You set the actuation point${k.rapid_trigger ? ', and rapid trigger is built in' : ''}.`);
  const wireless = k.connectivity.filter((c) => c !== 'usb').map((c) => CONN[c]);
  if (wireless.length) s.push(`It connects over ${list(['USB', ...wireless].filter((x) => x !== 'USB' || k.connectivity.includes('usb')))}.`);
  if (k.price_usd != null) s.push(`${brand.name} lists it at ${money(k.price_usd)} (${fmtDate(k.price_date)}).`);
  return s.join(' ');
}

/** The brand's own photo, background removed, credited and linked to the page it came from. */
function photoFigure(id, alt, u, line = '') {
  const p = photos[id];
  if (!p) return '';
  const host = new URL(p.page).host.replace(/^www\./, '');
  return `<figure class="photo" style="--bg:var(--photo-tile)">
        <div class="photo-frame"><img src="${photoUrl(PHOTOS, p.kind, id, 1200)}" srcset="${photoUrl(PHOTOS, p.kind, id, 480)} 480w, ${photoUrl(PHOTOS, p.kind, id, 1200)} 1200w" sizes="(max-width: 52rem) 100vw, 48rem" width="1600" height="1200" alt="${esc(alt)}" decoding="async" fetchpriority="high"></div>
        <figcaption>${p.line > 1 && line ? `Photo of the ${esc(line)} line: ` : 'Photo: '}<a href="${esc(p.page)}" rel="noopener">${esc(p.credit)}, ${esc(host)}</a></figcaption>
      </figure>`;
}

const resultRow = (u, x, { withRev = true, showBrand = true } = {}) =>
  `<li><a class="result" href="${u}${kbPath(keyboardById.get(x.id))}">${thumb(x, PHOTOS)}<span class="r-main"><span class="r-name">${showBrand ? `${esc(x.b)} ` : ''}${esc(x.m)}${x.status !== 'current' ? ' <span class="tag">discontinued</span>' : ''}</span><span class="r-spec">${specLine(x, new Set())}</span></span><span class="r-side"><span class="r-price">${x.price != null ? money(x.price) : '<span class="nil">no price</span>'}</span>${withRev ? `<span class="r-rev">${x.rev ? `${x.rev} review${x.rev > 1 ? 's' : ''}` : ''}</span>` : ''}</span></a></li>`;

function keyboardPage(k) {
  const brand = brandById.get(k.brand);
  const name = `${brand.name} ${k.model}`;
  const depth = 4;
  const u = up(depth);
  const swList = k.switches.length ? `<ul class="sw-list">${k.switches.map((o) => `<li>${o.id && switchById.has(o.id) ? swLink(u, switchById.get(o.id), o.name) : esc(o.name)}</li>`).join('')}</ul>` : NIL;
  const size = k.size === 'other' ? (k.key_count ? `${k.key_count} keys (no standard size)` : NIL) : `${SIZE_LABEL[k.size]}${k.key_count ? `, ${k.key_count} keys` : ''}`;
  const groups = [
    ['Shape', [
      ['Size', size, ['size', 'key_count']],
      ['Stagger', STAGGER[k.stagger], ['stagger']],
      ['Split', SPLIT[k.split], ['split']],
      k.stagger === 'row' ? ['Layouts', k.layout_standards.length ? k.layout_standards.map((x) => x.toUpperCase()).join(', ') : NIL, ['layout_standards']] : null,
      ['Tenting', TENT[k.tenting] ?? NIL, ['tenting']],
      ['Thumb cluster', yesNo(k.thumb_cluster), ['thumb_cluster']],
      ['Key wells', yesNo(k.key_wells), ['key_wells']],
      ['Low profile', yesNo(k.low_profile), ['low_profile']],
    ]],
    ['Switches', [
      ['Fits', FOOTPRINT[k.switch_footprint] ?? NIL, ['switch_footprint']],
      ['Hot-swap', k.hot_swap ? HOTSWAP[k.hot_swap] : NIL, ['hot_swap']],
      ['Sold with', swList, ['switches']],
      ['Adjustable actuation', yesNo(k.adjustable_actuation), ['adjustable_actuation']],
      k.adjustable_actuation || k.rapid_trigger ? ['Rapid trigger', yesNo(k.rapid_trigger), ['rapid_trigger']] : null,
    ]],
    ['Connection', [
      ['Connects by', k.connectivity.length ? k.connectivity.map((c) => CONN[c]).join(', ') : NIL, ['connectivity']],
      k.connectivity.some((c) => c !== 'usb') ? ['Battery', k.battery_mah ? `${k.battery_mah.toLocaleString('en-US')} mAh` : NIL, ['battery_mah']] : null,
      ['Polling rate', k.polling_rate_hz ? `${k.polling_rate_hz.toLocaleString('en-US')} Hz` : NIL, ['polling_rate_hz']],
    ]],
    ['Build and software', [
      ['Comes as', KIND[k.kind], ['kind']],
      ['Case', k.case_material ? esc(k.case_material) : NIL, ['case_material']],
      ['Mount', k.mount ? esc(k.mount) : NIL, ['mount']],
      ['Firmware', k.firmware.length ? k.firmware.map((f) => FW[f] ?? (f === 'proprietary' ? 'the brand’s own' : f)).join(', ') : NIL, ['firmware']],
      ['Software', k.software ? esc(k.software) : NIL, ['software']],
      ['Systems', k.os.length ? k.os.map((o) => OS[o]).join(', ') : NIL, ['os']],
    ]],
    ['Price and status', [
      ['Price', k.price_usd != null ? `${money(k.price_usd)} <span class="sub">on ${k.price_url ? `<a href="${esc(k.price_url)}" rel="noopener">${esc(brand.name)}'s store</a>` : `${esc(brand.name)}'s store`}, ${fmtDate(k.price_date)}</span>` : NIL, ['price_usd']],
      ['Status', k.status === 'current' ? 'sold now' : 'discontinued', ['status']],
      ['Released', k.released ? esc(k.released) : NIL, ['released']],
      k.aka.length ? ['Also sold as', esc(k.aka.join(', ')), ['aka']] : null,
    ]],
  ];
  // Similar boards: same shape, nearest price.
  const fk = finderById.get(k.id);
  const similar = finderData.keyboards
    .filter((x) => x.id !== k.id && x.stagger === k.stagger && x.split === k.split && (k.stagger !== 'row' || x.size === k.size))
    .sort((a, b) => Math.abs((a.price ?? 1e5) - (k.price_usd ?? 0)) - Math.abs((b.price ?? 1e5) - (k.price_usd ?? 0)))
    .slice(0, 6);
  const shape = kbShape(k).text;
  const alt = `${name}, ${article(shape).toLowerCase()} ${shape}`;
  const lists = LISTS.filter((l) => l.items.includes(k)).slice(0, 4);
  const body = `<div class="page data-page">
    <article class="article">
      ${crumbs(depth, [['Keyboards', 'en/keyboards/'], [brand.name, `en/keyboards/${brand.id}/`]])}
      <div class="title-row">${glyph(fk).replace('class="glyph"', 'class="glyph glyph-lg"')}<h1>${esc(name)}</h1></div>
      <p class="lede">${esc(kbLede(k, brand))}</p>
      ${photoFigure(k.id, alt, u)}
      <p class="meta">${k.official_url ? `<a href="${esc(k.official_url)}" rel="noopener">${esc(brand.name)}'s page${OUT_ARROW}</a>` : ''}<span>${k.reviews.length} review${k.reviews.length === 1 ? '' : 's'}</span><span>${k.sources.length} source${k.sources.length === 1 ? '' : 's'}, checked ${fmtDate(checkedOf(k) ?? CHECKED)}</span><a href="${u}en/keyboards/finder/">keyboard finder${ARROW}</a></p>
      ${k.notes ? `<p class="note-line">${esc(k.notes)}</p>` : ''}
      ${sheet(k, groups)}
      ${reviewsBlock(k, name)}
      ${similar.length ? `<section class="block" aria-labelledby="similar"><h2 id="similar">Boards of the same shape</h2><ul class="results-list">${similar.map((x) => resultRow(u, x)).join('')}</ul></section>` : ''}
      ${lists.length ? `<p class="meta">${lists.map((l) => `<a href="${u}${listPath(l.id)}">${esc(l.name)}${ARROW}</a>`).join('')}</p>` : ''}
      ${sourcesBlock(k)}
    </article>
  </div>`;
  const description = clip(`${specLead(name, kbLede(k, brand))} Switch options, sources and reviews.`);
  const image = hasPhoto(k.id) ? photoAbs('keyboard', k.id) : null;
  // A Product item only with a price and a photo: Google reports a Product without offers or an image as an error.
  const asProduct = k.price_usd != null && image;
  const jsonLd = [
    breadcrumbLd([['Keyboards', 'en/keyboards/'], [brand.name, `en/keyboards/${brand.id}/`], [k.model, kbPath(k)]]),
    !asProduct
      ? { '@type': 'WebPage', '@id': abs(kbPath(k)), name: `${name} specs`, url: abs(kbPath(k)), inLanguage: 'en', about: { '@type': 'Thing', name, description: kbLede(k, brand) }, ...(image ? { primaryImageOfPage: { '@type': 'ImageObject', url: image } } : {}), publisher: PUBLISHER }
      : {
      '@type': 'Product',
      '@id': `${abs(kbPath(k))}#product`,
      name,
      brand: { '@type': 'Brand', name: brand.name },
      category: 'Computer keyboard',
      description: kbLede(k, brand),
      url: abs(kbPath(k)),
      ...(image ? { image } : {}),
      ...(k.price_usd != null
        ? { offers: { '@type': 'Offer', price: k.price_usd, priceCurrency: 'USD', url: k.price_url ?? k.official_url ?? abs(kbPath(k)), availability: k.status === 'current' ? 'https://schema.org/InStock' : 'https://schema.org/Discontinued', seller: { '@type': 'Organization', name: brand.name } } }
        : {}),
    },
  ];
  return {
    html: shell({ depth, title: fitTitle(name, [': specs, switches, price and reviews', ': specs, price and reviews', ': specs and price', ' specs', '']), description, path: kbPath(k), section: 'keyboards', body, image, imageAlt: alt, jsonLd, type: 'product' }),
    image,
    imageTitle: name,
  };
}

// ---------- switch page ----------

const TYPE = { linear: 'linear', tactile: 'tactile', clicky: 'clicky', 'silent-linear': 'silent linear', 'silent-tactile': 'silent tactile' };
const SENSE = { contact: 'metal contact', magnetic: 'magnetic (Hall effect)', optical: 'optical', capacitive: 'capacitive', inductive: 'inductive' };
const MOUNT = { mx: 'MX cross', choc: 'Choc', alps: 'Alps', topre: 'Topre', other: 'other' };
const PROFILE = { standard: 'standard height', low: 'low profile', 'ultra-low': 'ultra-low profile' };

const swName = (s) => {
  const maker = makerById.get(s.maker);
  return s.name.toLowerCase().startsWith(maker.name.toLowerCase()) ? s.name : `${maker.name} ${s.name}`;
};
const swKind = (s) => {
  const prof = s.profile === 'low' ? 'low-profile ' : s.profile === 'ultra-low' ? 'ultra-low-profile ' : '';
  const sense = s.sensing === 'magnetic' ? 'magnetic ' : s.sensing === 'optical' ? 'optical ' : '';
  return `${prof}${sense}${TYPE[s.type]} switch`;
};

function swLede(s, maker) {
  const kind = swKind(s);
  const first = `${article(kind)} ${kind} from ${maker.name}${s.family && !s.name.toLowerCase().includes(s.family.toLowerCase()) ? `, in its ${s.family} line` : ''}.`;
  const parts = [];
  if (s.actuation_range_mm) parts.push(`you set its actuation point between ${s.actuation_range_mm[0]} and ${s.actuation_range_mm[1]} mm`);
  else if (s.actuation_force_gf && s.pre_travel_mm) parts.push(`it actuates at ${s.actuation_force_gf} gf after ${s.pre_travel_mm} mm`);
  else if (s.actuation_force_gf) parts.push(`it actuates at ${s.actuation_force_gf} gf`);
  if (s.tactile_force_gf) parts.push(`its bump peaks at ${s.tactile_force_gf} gf`);
  if (s.bottom_out_force_gf) parts.push(`it bottoms out at ${s.bottom_out_force_gf} gf`);
  if (s.total_travel_mm) parts.push(`it travels ${s.total_travel_mm} mm in all`);
  const second = parts.length ? `${maker.name} says ${list(parts)}.` : '';
  const third = s.rated_lifespan_million ? `It is rated for ${s.rated_lifespan_million} million presses.` : '';
  return [first, second, third].filter(Boolean).join(' ');
}

/** A ruler of the switch's travel, to scale: where it actuates and where it bottoms out. Bars drawn in CSS, words in HTML. */
function travelFigure(s) {
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
    label = `<span class="travel-label" style="${place(pct(a))}">actuation set anywhere from ${a} to ${b} mm</span>`;
  } else if (s.pre_travel_mm) {
    fill = `<span class="travel-pre" style="width:${pct(s.pre_travel_mm)}%"></span><span class="travel-mark" style="left:${pct(s.pre_travel_mm)}%"></span>`;
    label = `<span class="travel-label" style="${place(pct(s.pre_travel_mm))}">actuates at ${s.pre_travel_mm} mm${s.actuation_force_gf ? ` · ${s.actuation_force_gf} gf` : ''}</span>`;
  }
  return `<figure class="figure data-figure travel" aria-label="Key travel: ${s.pre_travel_mm ?? '?'} mm to actuate, ${total} mm in all">
    <div class="travel-labels">${label}</div>
    <div class="travel-track" style="--n:${Math.round(span / 0.5)}">${fill}<span class="travel-end"></span></div>
    <div class="travel-ends"><span>key at rest</span><span>bottom at ${total} mm${s.bottom_out_force_gf ? ` · ${s.bottom_out_force_gf} gf` : ''}</span></div>
    <figcaption>Key travel to scale, from the maker's figures. Ticks every 0.5 mm.</figcaption>
  </figure>`;
}

const forces = switches.map((x) => x.actuation_force_gf).filter((f) => typeof f === 'number');
/** Where the switch's actuation force falls among every switch in the database that publishes one. */
function forceFigure(s) {
  const f = s.actuation_force_gf;
  if (!f) return '';
  const lo = 20;
  const hi = 100;
  const step = 5;
  const bins = [];
  for (let b = lo; b < hi; b += step) bins.push(forces.filter((v) => (b === lo ? v < b + step : b + step >= hi ? v >= b : v >= b && v < b + step)).length);
  const max = Math.max(...bins);
  const mine = Math.min(Math.max(Math.floor((f - lo) / step), 0), bins.length - 1);
  const lighter = forces.filter((v) => v < f).length;
  const heavier = forces.filter((v) => v > f).length;
  const pct = (n) => Math.round((n / forces.length) * 100);
  return `<figure class="figure data-figure force">
    <div class="hist" role="img" aria-label="Actuation force of ${forces.length} switches in 5 gf steps; ${f} gf highlighted">${bins.map((n, i) => `<span${i === mine ? ' class="on"' : ''} style="height:${Math.max(2, Math.round((n / max) * 100))}%"></span>`).join('')}</div>
    <div class="hist-axis" aria-hidden="true"><span>20</span><span>40</span><span>60</span><span>80</span><span>100 gf</span></div>
    <figcaption>Actuation force of the ${forces.length.toLocaleString('en-US')} switches in the petitdoigt switch database that publish one, in steps of 5 gf (the end bars hold everything lighter or heavier). At ${f} gf, ${pct(lighter)}% of them are lighter and ${pct(heavier)}% heavier.</figcaption>
  </figure>`;
}

const boardsBySwitch = new Map();
for (const k of keyboards) for (const o of k.switches) if (o.id) (boardsBySwitch.get(o.id) ?? boardsBySwitch.set(o.id, []).get(o.id)).push(finderById.get(k.id));

function switchPage(s) {
  const maker = makerById.get(s.maker);
  const name = swName(s);
  const depth = 4;
  const u = up(depth);
  const madeBy = s.made_by && makerById.get(s.made_by) ? `<a href="${u}en/switches/${s.made_by}/">${esc(makerById.get(s.made_by).name)}</a>` : null;
  const groups = [
    ['Feel', [
      ['Type', TYPE[s.type], ['type']],
      ['Sensing', SENSE[s.sensing], ['sensing']],
      ['Actuation force', s.actuation_force_gf ? `${s.actuation_force_gf} gf` : NIL, ['actuation_force_gf']],
      s.type.includes('tactile') || s.type === 'clicky' ? ['Bump peak', s.tactile_force_gf ? `${s.tactile_force_gf} gf` : NIL, ['tactile_force_gf']] : null,
      ['Bottom-out force', s.bottom_out_force_gf ? `${s.bottom_out_force_gf} gf` : NIL, ['bottom_out_force_gf']],
    ]],
    ['Travel', [
      s.actuation_range_mm ? ['Actuation range', `${s.actuation_range_mm[0]} to ${s.actuation_range_mm[1]} mm`, ['actuation_range_mm']] : ['Pre-travel', s.pre_travel_mm ? `${s.pre_travel_mm} mm` : NIL, ['pre_travel_mm']],
      ['Total travel', s.total_travel_mm ? `${s.total_travel_mm} mm` : NIL, ['total_travel_mm']],
    ]],
    ['Fit', [
      ['Footprint', FOOTPRINT[s.footprint] ?? s.footprint, ['footprint']],
      ['Keycap mount', MOUNT[s.keycap_mount] ?? NIL, ['keycap_mount']],
      ['Height', PROFILE[s.profile] ?? NIL, ['profile']],
      s.footprint === 'mx' ? ['Pins', s.pins ? `${s.pins}-pin` : NIL, ['pins']] : null,
    ]],
    ['Build', [
      ['Top housing', s.materials?.top ? esc(s.materials.top) : NIL, ['materials']],
      ['Bottom housing', s.materials?.bottom ? esc(s.materials.bottom) : NIL, ['materials']],
      ['Stem', s.materials?.stem ? esc(s.materials.stem) : NIL, ['materials']],
      ['Spring', s.spring ? esc(s.spring) : NIL, ['spring']],
      ['Factory lubed', yesNo(s.factory_lubed), ['factory_lubed']],
      ['Light pipe', yesNo(s.light_pipe), ['light_pipe']],
    ]],
    ['Maker and status', [
      ['Sold by', `<a href="${u}en/switches/${maker.id}/">${esc(maker.name)}</a>`, ['maker']],
      madeBy ? ['Made by', madeBy, ['made_by']] : null,
      ['Rated for', s.rated_lifespan_million ? `${s.rated_lifespan_million} million presses` : NIL, ['rated_lifespan_million']],
      ['Status', s.status === 'current' ? 'sold now' : s.status === 'limited' ? 'limited run' : 'discontinued', ['status']],
      ['Released', s.released ? esc(s.released) : NIL, ['released']],
      s.aka.length ? ['Also sold as', esc(s.aka.join(', ')), ['aka']] : null,
    ]],
  ];
  const boards = boardsBySwitch.get(s.id) ?? [];
  const family = s.family ? switches.filter((x) => x.maker === s.maker && x.family === s.family && x.id !== s.id && switchHasPage(x)).slice(0, 12) : [];
  const alt = `${name}, ${article(swKind(s)).toLowerCase()} ${swKind(s)}`;
  const body = `<div class="page data-page">
    <article class="article">
      ${crumbs(depth, [['Switches', 'en/switches/'], [maker.name, `en/switches/${maker.id}/`]])}
      <h1>${esc(name)}</h1>
      <p class="lede">${esc(swLede(s, maker))}</p>
      ${photoFigure(s.id, alt, u, s.family ? `${maker.name} ${s.family}` : '')}
      <p class="meta">${s.official_url ? `<a href="${esc(s.official_url)}" rel="noopener">${esc(maker.name)}'s page${OUT_ARROW}</a>` : ''}<span>${s.sources.length} source${s.sources.length === 1 ? '' : 's'}, checked ${fmtDate(checkedOf(s) ?? CHECKED)}</span><a href="${u}?lang=en#words">type with recorded switch sounds${ARROW}</a></p>
      ${s.notes ? `<p class="note-line">${esc(s.notes)}</p>` : ''}
      ${travelFigure(s)}
      ${sheet(s, groups)}
      ${s.actuation_force_gf ? `<section class="block" aria-labelledby="force"><h2 id="force">How heavy it is next to other switches</h2>${forceFigure(s)}</section>` : ''}
      <section class="block" aria-labelledby="boards"><h2 id="boards">Keyboards sold with it</h2>${boards.length ? `<ul class="results-list">${boards.map((x) => resultRow(u, x, { withRev: false })).join('')}</ul>` : `<p class="empty-line">No keyboard in the petitdoigt keyboard database lists the ${esc(name)} as a factory option.</p>`}</section>
      ${family.length ? `<section class="block" aria-labelledby="family"><h2 id="family">More in the ${esc(s.family)} line</h2><ul class="chip-links">${family.map((x) => `<li><a href="${u}${swPath(x)}">${esc(x.name)}<span>${TYPE[x.type]}${x.actuation_force_gf ? ` · ${x.actuation_force_gf} gf` : ''}</span></a></li>`).join('')}</ul></section>` : ''}
      ${reviewsBlock(s, name)}
      ${sourcesBlock(s)}
    </article>
  </div>`;
  const image = hasPhoto(s.id) ? photoAbs('switch', s.id) : null;
  const jsonLd = [
    breadcrumbLd([['Switches', 'en/switches/'], [maker.name, `en/switches/${maker.id}/`], [s.name, swPath(s)]]),
    { '@type': 'WebPage', '@id': abs(swPath(s)), name: `${name} specs`, url: abs(swPath(s)), inLanguage: 'en', about: { '@type': 'Thing', name, description: swLede(s, maker) }, ...(image ? { primaryImageOfPage: { '@type': 'ImageObject', url: image } } : {}), publisher: PUBLISHER },
  ];
  return {
    html: shell({ depth, title: fitTitle(name, [': force, travel and full specs', ': force, travel and specs', ' specs', '']), description: clip(((d) => (d.length < 110 ? `${d} Type, fit, build, sources and the keyboards sold with it.` : d))(specLead(name, swLede(s, maker)))), path: swPath(s), section: 'switches', body, image, imageAlt: alt, jsonLd }),
    image,
    imageTitle: name,
  };
}

// ---------- finder ----------

const EXAMPLES = [
  'ansi, ortholinear, split, wireless keyboard with gateron switches under $500',
  'split columnar with thumb cluster under $300',
  'hall effect 75% with rapid trigger',
  'low profile wireless for mac',
  'ortholinear qmk',
  'tkl with cherry switches, hot-swap',
];

function finderPage() {
  const depth = 3;
  const u = up(depth);
  const body = `<div class="finder-page">
    ${crumbs(depth, [['Keyboards', 'en/keyboards/'], ['Finder', null]])}
    <h1>Find a keyboard by describing it</h1>
    <p class="lede">Write the keyboard you want in your own words. The finder turns them into filters and searches ${finderData.keyboards.length.toLocaleString('en-US')} keyboards from ${brands.length} brands, with specs taken from each brand's own pages.</p>
    <div class="query">
      <label class="sr-only" for="q">Describe the keyboard you want</label>
      <svg class="query-icon" viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.75" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M13 13l4.25 4.25" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
      <input id="q" type="search" autocomplete="off" spellcheck="false" placeholder="split wireless keyboard with Gateron switches under $500" enterkeyhint="search">
    </div>
    <div class="chips" id="chips" aria-live="polite"></div>
    <div class="examples"><span class="examples-label">try</span>${EXAMPLES.map((e) => `<button type="button" class="example" data-example="${esc(e)}">${esc(e)}</button>`).join('')}</div>
    <div class="results-head">
      <p class="count" id="count" aria-live="polite">&nbsp;</p>
      <div class="results-tools"><button type="button" class="switch-line" id="kits" role="switch" aria-checked="false"><span class="switch" aria-hidden="true"><i></i></span>kits and PCBs</button>
      <div class="segmented" id="sort" role="group" aria-label="sort by"><button type="button" data-sort="price" aria-pressed="true">price</button><button type="button" data-sort="reviews" aria-pressed="false">reviews</button><button type="button" data-sort="name" aria-pressed="false">name</button></div></div>
    </div>
    <div id="results" class="results"></div>
    <p class="fine finder-fine">A blank in a brand's specs stays blank: a board whose brand does not publish a value never matches a filter on it, and shows up under the closest matches with the value marked as not published. Prices are the brand's own, in US dollars.</p>
    <section class="block" aria-labelledby="lists"><h2 id="lists">Ready-made lists</h2><ul class="chip-links">${LISTS.map((l) => `<li><a href="${u}${listPath(l.id)}">${esc(l.name)}<span>${l.items.length}</span></a></li>`).join('')}</ul></section>
  </div>`;
  const description = `Search ${finderData.keyboards.length} keyboards by describing them: split, ortholinear, wireless, Hall effect, switch brand, size and price, from each brand's own specs.`;
  const jsonLd = [
    breadcrumbLd([['Keyboards', 'en/keyboards/'], ['Keyboard finder', 'en/keyboards/finder/']]),
    { '@type': 'WebApplication', name: 'petitdoigt keyboard finder', url: abs('en/keyboards/finder/'), applicationCategory: 'UtilitiesApplication', operatingSystem: 'Any (web browser)', offers: { '@type': 'Offer', price: 0, priceCurrency: 'USD' }, description, publisher: PUBLISHER },
  ];
  return shell({ depth, title: 'Keyboard finder: describe the keyboard you want', description, path: 'en/keyboards/finder/', section: 'keyboards', body, scripts: '<script type="module" src="finder.js"></script>', jsonLd });
}

// ---------- hubs, brands, makers, lists ----------

const itemListLd = (path, name, items) => ({
  '@type': 'CollectionPage',
  '@id': abs(path),
  name,
  url: abs(path),
  inLanguage: 'en',
  publisher: PUBLISHER,
  mainEntity: { '@type': 'ItemList', numberOfItems: items.length, itemListElement: items.slice(0, 100).map(([n, p], i) => ({ '@type': 'ListItem', position: i + 1, name: n, url: abs(p) })) },
});

function keyboardsHub() {
  const depth = 2;
  const u = up(depth);
  const counts = new Map();
  for (const k of keyboards) counts.set(k.brand, (counts.get(k.brand) ?? 0) + 1);
  const sorted = [...brands].sort((a, b) => a.name.localeCompare(b.name));
  const body = `<div class="hub-page">
    <h1>Keyboards</h1>
    <p class="lede">${keyboards.length.toLocaleString('en-US')} keyboards from ${brands.length} brands, each with its specs, the switches it ships with, its price and the reviews that tested it. Every value comes from the brand's own page or a named source.</p>
    <p><a class="cap-button cap-lg" href="${u}en/keyboards/finder/">Describe the keyboard you want${ARROW}</a></p>
    <section class="block" aria-labelledby="lists"><h2 id="lists">By shape, size and feature</h2><ul class="chip-links">${LISTS.map((l) => `<li><a href="${u}${listPath(l.id)}">${esc(l.name)}<span>${l.items.length}</span></a></li>`).join('')}</ul></section>
    <section class="block" aria-labelledby="brands"><h2 id="brands">Brands</h2><ul class="brand-grid">${sorted.map((b) => `<li><a href="${u}en/keyboards/${b.id}/"><span class="bn">${esc(b.name)}</span><span class="bc">${counts.get(b.id) ?? 0}</span></a></li>`).join('')}</ul></section>
    ${guideSection(u, [['staggered-vs-ortholinear-vs-columnar', 'Staggered, ortholinear or columnar'], ['split-keyboard', 'Split keyboards'], ['ergonomic-keyboard', 'Ergonomic keyboards'], ['keyboard-sizes', 'Keyboard sizes'], ['hot-swappable-keyboard', 'Hot-swappable keyboards']])}
  </div>`;
  const description = `${keyboards.length} keyboards from ${brands.length} brands with specs from the brands' own pages, the switches they ship with, prices and reviews. Split, ergonomic, wireless and more.`;
  const jsonLd = [breadcrumbLd([['Keyboards', 'en/keyboards/']]), itemListLd('en/keyboards/', 'Keyboards', sorted.map((b) => [`${b.name} keyboards`, `en/keyboards/${b.id}/`]))];
  return shell({ depth, title: 'Keyboards: specs, switches, prices and reviews', description: clip(description), path: 'en/keyboards/', section: 'keyboards', body, jsonLd });
}

function brandPage(file) {
  const b = file.brand;
  const depth = 3;
  const u = up(depth);
  const ks = file.keyboards.map((k) => finderById.get(k.id)).sort((a, c) => (a.status === c.status ? (a.price ?? 1e9) - (c.price ?? 1e9) : a.status === 'current' ? -1 : 1));
  const body = `<div class="page data-page"><article class="article">
    ${crumbs(depth, [['Keyboards', 'en/keyboards/'], [b.name, null]])}
    <h1>${esc(b.name)} keyboards</h1>
    <p class="lede">${esc(b.about ?? '')}</p>
    <p class="meta">${b.official_url ? `<a href="${esc(b.official_url)}" rel="noopener">${esc(b.name)}'s site${OUT_ARROW}</a>` : ''}<span>${ks.length} keyboard${ks.length === 1 ? '' : 's'}</span>${b.country ? `<span>${esc(b.country)}</span>` : ''}${b.founded ? `<span>founded ${b.founded}</span>` : ''}</p>
    <ul class="results-list">${ks.map((x) => resultRow(u, x, { showBrand: false })).join('')}</ul>
  </article></div>`;
  const firstPhoto = ks.find((x) => hasPhoto(x.id));
  const image = firstPhoto ? photoAbs('keyboard', firstPhoto.id) : null;
  const jsonLd = [breadcrumbLd([['Keyboards', 'en/keyboards/'], [b.name, `en/keyboards/${b.id}/`]]), itemListLd(`en/keyboards/${b.id}/`, `${b.name} keyboards`, ks.map((x) => [`${b.name} ${x.m}`, kbPath(keyboardById.get(x.id))]))];
  const description = clip(`${ks.length} ${b.name} keyboard${ks.length === 1 ? '' : 's'} with specs from ${b.name}'s own pages, switch options, prices and reviews. ${b.about ?? ''}`);
  return shell({ depth, title: fitTitle(`${b.name} keyboards`, [': every model with specs and prices', ': specs and prices', '']), description, path: `en/keyboards/${b.id}/`, section: 'keyboards', body, image, imageAlt: firstPhoto ? `${b.name} ${firstPhoto.m}` : '', jsonLd });
}

function listPage(l) {
  const depth = 3;
  const u = up(depth);
  const all = l.items.map((k) => finderById.get(k.id));
  const assembled = all.filter((x) => x.kind !== 'kit' && x.kind !== 'pcb');
  const kits = all.length - assembled.length;
  const priced = all.filter((x) => x.price != null).map((x) => x.price).sort((a, b) => a - b);
  const brandCount = new Set(all.map((x) => x.brand)).size;
  const wirelessN = all.filter((x) => x.conn.some((c) => c !== 'usb')).length;
  const hsN = all.filter((x) => x.hs && x.hs !== 'none').length;
  const LIMIT = 120;
  // Reviewed boards first, then by price: the page shows the best-documented ones; the finder holds the rest.
  const shown = [...all].sort((a, b) => (b.rev > 0) - (a.rev > 0) || (a.status === 'current' ? 0 : 1) - (b.status === 'current' ? 0 : 1) || (a.price ?? 1e9) - (b.price ?? 1e9)).slice(0, LIMIT);
  const facts = [
    `${all.length} ${l.what} from ${brandCount} brand${brandCount === 1 ? '' : 's'} are in the petitdoigt keyboard database${kits ? `, ${kits} of them kits or PCBs you assemble` : ''}.`,
    priced.length ? `Brand prices run from ${money(priced[0])} to ${money(priced.at(-1))}, with half of them under ${money(priced[Math.floor(priced.length / 2)])}.` : '',
    l.id !== 'wireless-mechanical-keyboards' ? `${wirelessN} connect wirelessly` : '',
    l.id !== 'hot-swappable-keyboards' ? `${hsN} take hot-swap switches` : '',
  ].filter(Boolean);
  const tail = facts.slice(2);
  const lede = `${facts.slice(0, 2).join(' ')}${tail.length ? ` Of these, ${tail.join(' and ')}.` : ''}`;
  const finderHref = `${u}en/keyboards/finder/?q=${encodeURIComponent(l.q)}`;
  const body = `<div class="page data-page"><article class="article">
    ${crumbs(depth, [['Keyboards', 'en/keyboards/'], [l.name, null]])}
    <h1>${esc(l.name)}</h1>
    <p class="lede">${esc(lede)}</p>
    <p class="meta"><a href="${finderHref}">narrow it down in the finder${ARROW}</a>${hasGuide(l.guide) ? `<a href="${u}en/${l.guide}/">read the guide${ARROW}</a>` : ''}<span>specs checked ${fmtDate(CHECKED)}</span></p>
    <ul class="results-list">${shown.map((x) => resultRow(u, x)).join('')}</ul>
    ${all.length > LIMIT ? `<p class="fine">This page shows ${LIMIT} of the ${all.length}, reviewed boards first. <a href="${finderHref}">The finder lists all ${all.length}</a> and sorts them by price, reviews or name.</p>` : ''}
    <section class="block" aria-labelledby="more"><h2 id="more">More lists</h2><ul class="chip-links">${LISTS.filter((x) => x !== l).map((x) => `<li><a href="${u}${listPath(x.id)}">${esc(x.name)}<span>${x.items.length}</span></a></li>`).join('')}</ul></section>
  </article></div>`;
  const firstPhoto = shown.find((x) => hasPhoto(x.id));
  const image = firstPhoto ? photoAbs('keyboard', firstPhoto.id) : null;
  const jsonLd = [breadcrumbLd([['Keyboards', 'en/keyboards/'], [l.name, listPath(l.id)]]), itemListLd(listPath(l.id), l.name, shown.map((x) => [`${x.b} ${x.m}`, kbPath(keyboardById.get(x.id))]))];
  return shell({ depth, title: fitTitle(l.name, [`: ${all.length} models with specs and prices`, `: ${all.length} models compared`, '']), description: clip(lede), path: listPath(l.id), section: 'keyboards', body, image, imageAlt: firstPhoto ? `${firstPhoto.b} ${firstPhoto.m}` : '', jsonLd });
}

function switchesHub() {
  const depth = 2;
  const u = up(depth);
  const sorted = [...makerFiles].sort((a, b) => b.switches.length - a.switches.length);
  const ROLE = { manufacturer: 'factory', brand: 'brand', both: 'factory and brand' };
  const body = `<div class="hub-page">
    <h1>Keyboard switches</h1>
    <p class="lede">${switches.length.toLocaleString('en-US')} switches from ${makers.length} makers, with force, travel, materials and the keyboards that ship with each, from the makers' own spec sheets.</p>
    ${hasGuide('keyboard-switches') ? `<p><a class="cap-button cap-lg" href="${u}en/keyboard-switches/">How switches work${ARROW}</a></p>` : ''}
    <section class="block" aria-labelledby="makers"><h2 id="makers">Makers</h2><ul class="brand-grid">${sorted.map((f) => `<li><a href="${u}en/switches/${f.maker.id}/"><span class="bn">${esc(f.maker.name)}<em>${ROLE[f.maker.role] ?? ''}</em></span><span class="bc">${f.switches.length}</span></a></li>`).join('')}</ul></section>
    ${guideSection(u, [['linear-vs-tactile-vs-clicky', 'Linear, tactile or clicky'], ['red-vs-brown-vs-blue-switches', 'Red, brown or blue'], ['quiet-switches', 'Quiet switches'], ['hall-effect-switches', 'Hall effect switches'], ['switch-specs', 'Reading switch specs'], ['switch-manufacturers', 'Who makes switches']])}
  </div>`;
  const description = `${switches.length} keyboard switches from ${makers.length} makers with actuation force, travel, materials and the keyboards that ship with each, from the makers' own spec sheets.`;
  const jsonLd = [breadcrumbLd([['Switches', 'en/switches/']]), itemListLd('en/switches/', 'Keyboard switches', sorted.map((f) => [`${f.maker.name} switches`, `en/switches/${f.maker.id}/`]))];
  return shell({ depth, title: 'Keyboard switches: specs from every maker', description: clip(description), path: 'en/switches/', section: 'switches', body, jsonLd });
}

function makerPage(file) {
  const m = file.maker;
  const depth = 3;
  const u = up(depth);
  const ss = [...file.switches].sort((a, b) => (a.family ?? '').localeCompare(b.family ?? '') || a.name.localeCompare(b.name));
  const DOT = '<span class="nil">·</span>';
  const body = `<div class="page data-page wide"><article class="article">
    ${crumbs(depth, [['Switches', 'en/switches/'], [m.name, null]])}
    <h1>${esc(m.name)} switches</h1>
    <p class="lede">${esc(m.about ?? '')}</p>
    <p class="meta">${m.official_url ? `<a href="${esc(m.official_url)}" rel="noopener">${esc(m.name)}'s site${OUT_ARROW}</a>` : ''}<span>${ss.length} switch${ss.length === 1 ? '' : 'es'}</span>${m.country ? `<span>${esc(m.country)}</span>` : ''}</p>
    <div class="prose"><div class="table-wrap"><table><caption class="sr-only">${esc(m.name)} switches with type, force and travel</caption><thead><tr><th scope="col">Switch</th><th scope="col">Type</th><th scope="col" class="num">Actuation</th><th scope="col" class="num">Pre-travel</th><th scope="col" class="num">Travel</th><th scope="col">Line</th></tr></thead><tbody>${ss
      .map((s) => `<tr><td>${swLink(u, s)}</td><td>${TYPE[s.type]}</td><td class="num">${s.actuation_force_gf ? `${s.actuation_force_gf} gf` : DOT}</td><td class="num">${s.actuation_range_mm ? `${s.actuation_range_mm[0]}–${s.actuation_range_mm[1]} mm` : s.pre_travel_mm ? `${s.pre_travel_mm} mm` : DOT}</td><td class="num">${s.total_travel_mm ? `${s.total_travel_mm} mm` : DOT}</td><td>${esc(s.family ?? '')}</td></tr>`)
      .join('')}</tbody></table></div></div>
  </article></div>`;
  const firstPhoto = ss.find((s) => hasPhoto(s.id) && switchHasPage(s));
  const image = firstPhoto ? photoAbs('switch', firstPhoto.id) : null;
  const jsonLd = [breadcrumbLd([['Switches', 'en/switches/'], [m.name, `en/switches/${m.id}/`]]), itemListLd(`en/switches/${m.id}/`, `${m.name} switches`, ss.filter(switchHasPage).map((s) => [swName(s), swPath(s)]))];
  const description = clip(`${ss.length} ${m.name} keyboard switches with actuation force, pre-travel, total travel and type, from ${m.name}'s own spec sheets. ${m.about ?? ''}`);
  return shell({ depth, title: fitTitle(`${m.name} switches`, [': force, travel and specs of every model', ': specs of every model', '']), description, path: `en/switches/${m.id}/`, section: 'switches', body, image, imageAlt: firstPhoto ? swName(firstPhoto) : '', jsonLd });
}

// ---------- write ----------

if (!existsSync(join(OUT, 'guides-assets', 'guides.css'))) throw new Error(`${OUT} has no guides-assets: run scripts/guides/build.mjs first`);
mkdirSync(join(OUT, 'en', 'keyboards', 'finder'), { recursive: true });
writeFileSync(join(OUT, 'en', 'keyboards', 'finder', 'finder-data.json'), JSON.stringify(finderData));
copyFileSync(join(import.meta.dirname, 'finder.js'), join(OUT, 'en', 'keyboards', 'finder', 'finder.js'));
copyFileSync(join(import.meta.dirname, 'data.css'), join(OUT, 'guides-assets', 'data.css'));

write('en/keyboards/', keyboardsHub(), { lastmod: CHECKED });
write('en/keyboards/finder/', finderPage(), { lastmod: CHECKED });
write('en/switches/', switchesHub(), { lastmod: CHECKED });
for (const l of LISTS) write(listPath(l.id), listPage(l), { lastmod: CHECKED });
for (const f of brandFiles) write(`en/keyboards/${f.brand.id}/`, brandPage(f), { lastmod: f.keyboards.map(checkedOf).filter(Boolean).sort().at(-1) ?? CHECKED });
for (const f of makerFiles) write(`en/switches/${f.maker.id}/`, makerPage(f), { lastmod: f.switches.map(checkedOf).filter(Boolean).sort().at(-1) ?? CHECKED });
for (const k of keyboards) {
  const p = keyboardPage(k);
  write(kbPath(k), p.html, { lastmod: checkedOf(k), image: p.image, imageTitle: p.imageTitle });
}
const switchPages = switches.filter(switchHasPage);
for (const s of switchPages) {
  const p = switchPage(s);
  write(swPath(s), p.html, { lastmod: checkedOf(s), image: p.image, imageTitle: p.imageTitle });
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
  `data pages: finder (${finderData.keyboards.length} keyboards, ${(JSON.stringify(finderData).length / 1024).toFixed(0)} KB), ${keyboards.length} keyboards, ${switchPages.length} of ${switches.length} switches, ${brandFiles.length} brands, ${makerFiles.length} makers, ${LISTS.length} lists, ${Object.keys(photos).length} photos; sitemap +${sitemap.length} urls`,
);
