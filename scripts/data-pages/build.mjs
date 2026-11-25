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
const REGIONS = new Intl.DisplayNames(['en'], { type: 'region' });
/** "CN" -> "China". */
const region = (cc) => (cc ? REGIONS.of(cc) : null);
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
    ${compareChips(u, null, 'Brands compared')}
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
    <p class="meta">${b.official_url ? `<a href="${esc(b.official_url)}" rel="noopener">${esc(b.name)}'s site${OUT_ARROW}</a>` : ''}<span>${ks.length} keyboard${ks.length === 1 ? '' : 's'}</span>${b.country ? `<span>${esc(region(b.country))}</span>` : ''}${b.founded ? `<span>founded ${b.founded}</span>` : ''}</p>
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
  // The boards outlets reviewed, most reviews first: what searchers asking for "the best" one want to read.
  const reviewed = l.items.filter((k) => k.reviews.length).sort((a, b) => b.reviews.length - a.reviews.length || (a.price_usd ?? 1e9) - (b.price_usd ?? 1e9));
  const outlets = [...new Set(reviewed.flatMap((k) => k.reviews.map((r) => r.outlet)))];
  const reviewBlock = reviewed.length
    ? `<section class="block" aria-labelledby="reviewed"><h2 id="reviewed">What the reviews say</h2><p>${reviewed.length === 1 ? 'One board on this list was' : `${reviewed.length} boards on this list were`} reviewed by ${esc(list(outlets.slice(0, 4)))}${outlets.length > 4 ? ` and ${outlets.length - 4} more outlet${outlets.length - 4 > 1 ? 's' : ''}` : ''}. ${reviewed.length > 8 ? 'The 8 with the most reviews' : 'Each one'}, with each review summed up in our words:</p>${reviewed
        .slice(0, 8)
        .map((k) => {
          const name = `${brandById.get(k.brand).name} ${k.model}`;
          return `<h3 class="rv-board"><a href="${u}${kbPath(k)}">${esc(name)}</a>${k.price_usd != null ? ` <span class="sub">${money(k.price_usd)}</span>` : ''}</h3><ul class="reviews">${k.reviews
            .map((x) => `<li><a class="review" href="${esc(x.url)}" rel="noopener"><span class="rv-head"><span class="rv-outlet">${esc(x.outlet)}</span>${x.score ? `<span class="rv-score">${esc(x.score)}</span>` : ''}<span class="rv-date">${x.date ? fmtDate(x.date) : ''}</span></span><span class="rv-verdict">${esc(x.verdict)}</span><span class="rv-go">read the review${OUT_ARROW}</span></a></li>`)
            .join('')}</ul>`;
        })
        .join('')}</section>`
    : '';
  const body = `<div class="page data-page"><article class="article">
    ${crumbs(depth, [['Keyboards', 'en/keyboards/'], [l.name, null]])}
    <h1>${esc(l.name)}</h1>
    <p class="lede">${esc(lede)}</p>
    <p class="meta"><a href="${finderHref}">narrow it down in the finder${ARROW}</a>${hasGuide(l.guide) ? `<a href="${u}en/${l.guide}/">read the guide${ARROW}</a>` : ''}<span>specs checked ${fmtDate(CHECKED)}</span></p>
    ${reviewBlock}
    ${reviewed.length ? `<h2 id="all">All ${all.length}</h2>` : ''}
    <ul class="results-list">${shown.map((x) => resultRow(u, x)).join('')}</ul>
    ${all.length > LIMIT ? `<p class="fine">This page shows ${LIMIT} of the ${all.length}, reviewed boards first. <a href="${finderHref}">The finder lists all ${all.length}</a> and sorts them by price, reviews or name.</p>` : ''}
    <section class="block" aria-labelledby="more"><h2 id="more">More lists</h2><ul class="chip-links">${LISTS.filter((x) => x !== l).map((x) => `<li><a href="${u}${listPath(x.id)}">${esc(x.name)}<span>${x.items.length}</span></a></li>`).join('')}</ul></section>
  </article></div>`;
  const firstPhoto = shown.find((x) => hasPhoto(x.id));
  const image = firstPhoto ? photoAbs('keyboard', firstPhoto.id) : null;
  const jsonLd = [breadcrumbLd([['Keyboards', 'en/keyboards/'], [l.name, listPath(l.id)]]), itemListLd(listPath(l.id), l.name, shown.map((x) => [`${x.b} ${x.m}`, kbPath(keyboardById.get(x.id))]))];
  const title = reviewed.length
    ? fitTitle(l.name, [`: ${all.length} compared, with what reviewers found`, `: ${all.length} compared, with reviews`, `: ${all.length} models compared`, ''])
    : fitTitle(l.name, [`: ${all.length} models with specs and prices`, `: ${all.length} models compared`, '']);
  const description = clip(reviewed.length ? `Looking for the best ${l.name.replace(/keyboards\b/, 'keyboard').replace(/^[A-Z](?=[a-z])/, (c) => c.toLowerCase())}?${facts[0]} See what ${list(outlets.slice(0, 2))} found in their reviews.` : lede);
  return shell({ depth, title, description, path: listPath(l.id), section: 'keyboards', body, image, imageAlt: firstPhoto ? `${firstPhoto.b} ${firstPhoto.m}` : '', jsonLd });
}

// ---------- comparisons ----------

/** Brand and switch-maker pairs people search for ("nuphy vs keychron"), in the order they search them. */
const BRAND_PAIRS = [['nuphy', 'keychron'], ['epomaker', 'keychron'], ['ducky', 'keychron'], ['hhkb', 'realforce']];
const MAKER_PAIRS = [['cherry', 'gateron'], ['gateron', 'kailh']];
const pairPath = (kind, [a, b]) => `en/${kind}/compare/${a}-vs-${b}/`;
for (const [a, b] of BRAND_PAIRS) if (!brandById.has(a) || !brandById.has(b)) throw new Error(`compare: no brand ${a} or ${b}`);
for (const [a, b] of MAKER_PAIRS) if (!makerById.has(a) || !makerById.has(b)) throw new Error(`compare: no maker ${a} or ${b}`);
if (brandById.has('compare') || makerById.has('compare') || LISTS.some((l) => l.id === 'compare')) throw new Error('"compare" is taken');

const pct = (n, of) => (of ? `${Math.round((n / of) * 100)}%` : '–');
/** Sizes from the largest board to the smallest. */
const SIZE_ORDER = ['full', '96', 'tkl', '75', '65', '60', '50', '40', '30', 'numpad', 'other'];
const median = (xs) => (xs.length ? xs[Math.floor((xs.length - 1) / 2)] : null);
const share = (n, of) => `${n} of ${of} (${pct(n, of)})`;

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
    zmk: ks.filter((k) => k.firmware.includes('zmk')).length,
    aluminum: ks.filter((k) => /alumin|^metal$/i.test(k.case_material ?? '') && !/plastic|abs|polymer/i.test(k.case_material)).length,
    sizes: new Map(SIZE_ORDER.filter((x) => SIZE_LABEL[x]).map((s) => [s, ks.filter((k) => k.size === s)]).filter(([, v]) => v.length)),
    makers: [...makerCount].sort((x, y) => y[1] - x[1]),
    reviews: ks.reduce((n, k) => n + k.reviews.length, 0),
    reviewed: ks.filter((k) => k.reviews.length),
  };
}

const cheapest = (ks) => ks.filter((k) => k.price_usd != null).sort((a, b) => a.price_usd - b.price_usd)[0] ?? null;

function brandComparePage(pair) {
  const depth = 4;
  const u = up(depth);
  const [A, B] = pair.map(brandStats);
  const path = pairPath('keyboards', pair);
  const title = `${A.b.name} vs ${B.b.name}`;
  const range = (s) => (s.prices.length ? `${money(s.prices[0])} to ${money(s.prices.at(-1))}` : 'no prices published');
  const lede = [
    `${A.b.name} has ${A.n} keyboard${A.n === 1 ? '' : 's'} in the petitdoigt keyboard database and ${B.b.name} has ${B.n}.`,
    A.prices.length && B.prices.length ? `${A.b.name}'s run from ${range(A)}, half of them under ${money(median(A.prices))}; ${B.b.name}'s run from ${range(B)}, half under ${money(median(B.prices))}.` : '',
    `${pct(A.wireless, A.n)} of ${A.b.name}'s boards and ${pct(B.wireless, B.n)} of ${B.b.name}'s connect wirelessly, and ${pct(A.hotswap, A.n)} against ${pct(B.hotswap, B.n)} take hot-swap switches.`,
  ]
    .filter(Boolean)
    .join(' ');
  const row = (label, f) => `<tr><th scope="row">${esc(label)}</th><td>${f(A)}</td><td>${f(B)}</td></tr>`;
  const table = `<div class="prose"><div class="table-wrap"><table><caption class="sr-only">${esc(title)}, side by side</caption><thead><tr><th scope="col"></th><th scope="col">${esc(A.b.name)}</th><th scope="col">${esc(B.b.name)}</th></tr></thead><tbody>
    ${row('Keyboards in the database', (s) => `${s.n} (${s.current} sold now)`)}
    ${row('Price range', (s) => range(s))}
    ${row('Median price', (s) => (s.prices.length ? money(median(s.prices)) : NIL))}
    ${row('Sizes', (s) => esc([...s.sizes.keys()].map((k) => SIZE_LABEL[k]).join(', ')))}
    ${row('Wireless', (s) => share(s.wireless, s.n))}
    ${row('Hot-swap', (s) => share(s.hotswap, s.n))}
    ${row('Low profile', (s) => share(s.lowProfile, s.n))}
    ${row('Adjustable actuation', (s) => share(s.adjustable, s.n))}
    ${row('Rapid trigger', (s) => share(s.rapid, s.n))}
    ${row('QMK, VIA or Vial', (s) => share(s.qmk, s.n))}
    ${row('Aluminum case', (s) => share(s.aluminum, s.n))}
    ${row('Switch makers', (s) => esc(s.makers.slice(0, 4).map(([m]) => m).join(', ') || 'not published'))}
    ${row('Reviews in the database', (s) => `${s.reviews} on ${s.reviewed.length} board${s.reviewed.length === 1 ? '' : 's'}`)}
    ${A.b.country || B.b.country ? row('Based in', (s) => esc(region(s.b.country) ?? 'not published')) : ''}
    ${A.b.founded || B.b.founded ? row('Founded', (s) => (s.b.founded ? String(s.b.founded) : NIL)) : ''}
  </tbody></table></div></div>`;
  const sizes = [...new Set([...A.sizes.keys(), ...B.sizes.keys()])].sort((x, y) => SIZE_ORDER.indexOf(x) - SIZE_ORDER.indexOf(y));
  const cell = (s, size) => {
    const ks = s.sizes.get(size) ?? [];
    if (!ks.length) return '<span class="nil">none</span>';
    const c = cheapest(ks);
    return `${ks.length} model${ks.length === 1 ? '' : 's'}${c ? `, from <a href="${u}${kbPath(c)}">${esc(c.model)}</a> at ${money(c.price_usd)}` : ''}`;
  };
  const sizeTable = `<div class="prose"><div class="table-wrap"><table><caption class="sr-only">Models by size and the cheapest of each</caption><thead><tr><th scope="col">Size</th><th scope="col">${esc(A.b.name)}</th><th scope="col">${esc(B.b.name)}</th></tr></thead><tbody>${sizes.map((size) => `<tr><th scope="row">${esc(SIZE_LABEL[size])}</th><td>${cell(A, size)}</td><td>${cell(B, size)}</td></tr>`).join('')}</tbody></table></div></div>`;
  const top = (s) => [...s.ks].sort((x, y) => y.reviews.length - x.reviews.length || (x.price_usd ?? 1e9) - (y.price_usd ?? 1e9)).slice(0, 4).map((k) => finderById.get(k.id));
  const body = `<div class="page data-page"><article class="article">
    ${crumbs(depth, [['Keyboards', 'en/keyboards/'], ['Compare', null]])}
    <h1>${esc(title)}: lineups, prices and specs side by side</h1>
    <p class="lede">${esc(lede)}</p>
    <p class="meta"><a href="${u}en/keyboards/${A.b.id}/">every ${esc(A.b.name)} keyboard${ARROW}</a><a href="${u}en/keyboards/${B.b.id}/">every ${esc(B.b.name)} keyboard${ARROW}</a><span>specs checked ${fmtDate(CHECKED)}</span></p>
    <section class="block" aria-labelledby="side"><h2 id="side">Side by side</h2>${table}<p class="fine">Counts cover the keyboards each brand lists on its own site, current and discontinued, as the petitdoigt keyboard database holds them. A value a brand does not publish counts as absent.</p></section>
    <section class="block" aria-labelledby="sizes"><h2 id="sizes">By size</h2>${sizeTable}</section>
    ${[A, B].map((s) => `<section class="block" aria-labelledby="top-${s.b.id}"><h2 id="top-${s.b.id}">${esc(s.b.name)}: the most reviewed</h2><ul class="results-list">${top(s).map((x) => resultRow(u, x, { showBrand: false })).join('')}</ul></section>`).join('')}
    <section class="block" aria-labelledby="about"><h2 id="about">The two brands</h2>${[A, B].map((s) => `<p><strong>${esc(s.b.name)}.</strong> ${esc(s.b.about ?? '')} ${s.b.official_url ? `<a href="${esc(s.b.official_url)}" rel="noopener">${esc(s.b.name)}'s site</a>` : ''}</p>`).join('')}</section>
    ${compareChips(u, path)}
  </article></div>`;
  const jsonLd = [
    breadcrumbLd([['Keyboards', 'en/keyboards/'], [title, path]]),
    { '@type': 'WebPage', '@id': abs(path), name: `${title}: keyboards compared`, url: abs(path), inLanguage: 'en', about: [A, B].map((s) => ({ '@type': 'Brand', name: s.b.name, ...(s.b.official_url ? { url: s.b.official_url } : {}) })), publisher: PUBLISHER },
  ];
  return shell({ depth, title: fitTitle(title, [': keyboards, prices and specs compared', ': keyboards compared', ' keyboards', '']), description: clip(lede), path, section: 'keyboards', body, jsonLd });
}

function makerStats(id) {
  const ss = switches.filter((s) => s.maker === id);
  const forces = ss.map((s) => s.actuation_force_gf).filter((f) => typeof f === 'number').sort((a, b) => a - b);
  const travel = ss.map((s) => s.total_travel_mm).filter((f) => typeof f === 'number').sort((a, b) => a - b);
  const life = ss.map((s) => s.rated_lifespan_million).filter((f) => typeof f === 'number').sort((a, b) => a - b);
  const families = new Map();
  for (const s of ss) if (s.family) families.set(s.family, (families.get(s.family) ?? 0) + 1);
  return {
    m: makerById.get(id),
    ss,
    n: ss.length,
    byType: new Map(Object.keys(TYPE).map((t) => [t, ss.filter((s) => s.type === t)])),
    magnetic: ss.filter((s) => s.sensing === 'magnetic').length,
    optical: ss.filter((s) => s.sensing === 'optical').length,
    lowProfile: ss.filter((s) => s.profile === 'low' || s.profile === 'ultra-low').length,
    lubed: ss.filter((s) => s.factory_lubed === true).length,
    forces,
    travel,
    life,
    families: [...families].sort((x, y) => y[1] - x[1]),
    boards: finderData.keyboards.filter((x) => x.swm.includes(id)).length,
  };
}

function makerComparePage(pair) {
  const depth = 4;
  const u = up(depth);
  const [A, B] = pair.map(makerStats);
  const path = pairPath('switches', pair);
  const title = `${A.m.name} vs ${B.m.name} switches`;
  const fr = (s) => (s.forces.length ? `${s.forces[0]} to ${s.forces.at(-1)} gf` : 'not published');
  const lede = [
    `The petitdoigt switch database holds ${A.n} ${A.m.name} switches and ${B.n} from ${B.m.name}.`,
    A.forces.length && B.forces.length ? `Half of ${A.m.name}'s actuate under ${median(A.forces)} gf and half of ${B.m.name}'s under ${median(B.forces)} gf, by the makers' own figures.` : '',
    `${A.boards} keyboards in the database ship with a ${A.m.name} switch option and ${B.boards} with a ${B.m.name} one.`,
  ]
    .filter(Boolean)
    .join(' ');
  const row = (label, f) => `<tr><th scope="row">${esc(label)}</th><td>${f(A)}</td><td>${f(B)}</td></tr>`;
  const table = `<div class="prose"><div class="table-wrap"><table><caption class="sr-only">${esc(title)}, side by side</caption><thead><tr><th scope="col"></th><th scope="col">${esc(A.m.name)}</th><th scope="col">${esc(B.m.name)}</th></tr></thead><tbody>
    ${row('Switches in the database', (s) => String(s.n))}
    ${A.m.country || B.m.country ? row('Based in', (s) => esc(region(s.m.country) ?? 'not published')) : ''}
    ${A.m.founded || B.m.founded ? row('Founded', (s) => (s.m.founded ? String(s.m.founded) : NIL)) : ''}
    ${[...Object.keys(TYPE)].map((t) => row(TYPE[t].replace(/^./, (c) => c.toUpperCase()), (s) => String(s.byType.get(t).length))).join('')}
    ${row('Magnetic (Hall effect)', (s) => String(s.magnetic))}
    ${row('Optical', (s) => String(s.optical))}
    ${row('Low profile', (s) => String(s.lowProfile))}
    ${row('Actuation force', (s) => fr(s))}
    ${row('Median actuation force', (s) => (s.forces.length ? `${median(s.forces)} gf` : NIL))}
    ${row('Median total travel', (s) => (s.travel.length ? `${median(s.travel)} mm` : NIL))}
    ${row('Factory lubed', (s) => share(s.lubed, s.n))}
    ${row('Rated lifespan', (s) => (s.life.length ? `${s.life[0]} to ${s.life.at(-1)} million presses` : NIL))}
    ${row('Keyboards sold with them', (s) => String(s.boards))}
  </tbody></table></div></div>`;
  const typeTable = `<div class="prose"><div class="table-wrap"><table><caption class="sr-only">Median actuation force by switch type</caption><thead><tr><th scope="col">Type</th><th scope="col">${esc(A.m.name)}</th><th scope="col">${esc(B.m.name)}</th></tr></thead><tbody>${Object.keys(TYPE)
    .filter((t) => A.byType.get(t).length || B.byType.get(t).length)
    .map((t) => {
      const cell = (s) => {
        const xs = s.byType.get(t);
        const f = xs.map((x) => x.actuation_force_gf).filter((v) => typeof v === 'number').sort((a, b) => a - b);
        return xs.length ? `${xs.length} switch${xs.length === 1 ? '' : 'es'}${f.length ? `, median ${median(f)} gf` : ''}` : '<span class="nil">none</span>';
      };
      return `<tr><th scope="row">${esc(TYPE[t])}</th><td>${cell(A)}</td><td>${cell(B)}</td></tr>`;
    })
    .join('')}</tbody></table></div></div>`;
  const lines = (s) => `<p><strong>${esc(s.m.name)}</strong>: ${esc(s.families.slice(0, 10).map(([f, n]) => `${f} (${n})`).join(', ') || 'no named lines')}.</p>`;
  const body = `<div class="page data-page"><article class="article">
    ${crumbs(depth, [['Switches', 'en/switches/'], ['Compare', null]])}
    <h1>${esc(title)}: force, types and lines side by side</h1>
    <p class="lede">${esc(lede)}</p>
    <p class="meta"><a href="${u}en/keyboards/finder/?q=${encodeURIComponent(`${A.m.name} switches`)}">keyboards with ${esc(A.m.name)} switches${ARROW}</a><a href="${u}en/keyboards/finder/?q=${encodeURIComponent(`${B.m.name} switches`)}">keyboards with ${esc(B.m.name)} switches${ARROW}</a><span>specs checked ${fmtDate(CHECKED)}</span></p>
    <section class="block" aria-labelledby="side"><h2 id="side">Side by side</h2>${table}<p class="fine">Forces and travel are the makers' published figures, not measurements. A switch whose maker publishes no figure is left out of the medians.</p></section>
    <section class="block" aria-labelledby="types"><h2 id="types">By type</h2>${typeTable}</section>
    <section class="block" aria-labelledby="lines"><h2 id="lines">Their lines</h2>${lines(A)}${lines(B)}<p class="meta">${[A, B].map((s) => `<a href="${u}en/switches/${s.m.id}/">every ${esc(s.m.name)} switch${ARROW}</a>`).join("")}</p></section>
    <section class="block" aria-labelledby="about"><h2 id="about">The two makers</h2>${[A, B].map((s) => `<p><strong>${esc(s.m.name)}.</strong> ${esc(s.m.about ?? '')} ${s.m.official_url ? `<a href="${esc(s.m.official_url)}" rel="noopener">${esc(s.m.name)}'s site</a>` : ''}</p>`).join('')}</section>
    ${hasGuide('switch-manufacturers') ? `<p class="meta"><a href="${u}en/switch-manufacturers/">who makes keyboard switches${ARROW}</a>${hasGuide('red-vs-brown-vs-blue-switches') ? `<a href="${u}en/red-vs-brown-vs-blue-switches/">red, brown or blue${ARROW}</a>` : ''}</p>` : ''}
    ${compareChips(u, path)}
  </article></div>`;
  const jsonLd = [
    breadcrumbLd([['Switches', 'en/switches/'], [title, path]]),
    { '@type': 'WebPage', '@id': abs(path), name: `${title} compared`, url: abs(path), inLanguage: 'en', about: [A, B].map((s) => ({ '@type': 'Organization', name: s.m.name, ...(s.m.official_url ? { url: s.m.official_url } : {}) })), publisher: PUBLISHER },
  ];
  return shell({ depth, title: fitTitle(title, [': force, types and lines compared', ' compared', '']), description: clip(lede), path, section: 'switches', body, jsonLd });
}

/** Every comparison, as chips (the current one left out). */
function compareChips(u, current, heading = 'More comparisons') {
  const items = [
    ...BRAND_PAIRS.map((p) => [`${brandById.get(p[0]).name} vs ${brandById.get(p[1]).name}`, pairPath('keyboards', p)]),
    ...MAKER_PAIRS.map((p) => [`${makerById.get(p[0]).name} vs ${makerById.get(p[1]).name} switches`, pairPath('switches', p)]),
  ].filter(([, p]) => p !== current);
  return `<section class="block" aria-labelledby="compare"><h2 id="compare">${heading}</h2><ul class="chip-links">${items.map(([n, p]) => `<li><a href="${u}${p}">${esc(n)}</a></li>`).join('')}</ul></section>`;
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
    ${compareChips(u, null, 'Makers compared')}
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
    <p class="meta">${m.official_url ? `<a href="${esc(m.official_url)}" rel="noopener">${esc(m.name)}'s site${OUT_ARROW}</a>` : ''}<span>${ss.length} switch${ss.length === 1 ? '' : 'es'}</span>${m.country ? `<span>${esc(region(m.country))}</span>` : ''}</p>
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
for (const pair of BRAND_PAIRS) write(pairPath('keyboards', pair), brandComparePage(pair), { lastmod: CHECKED });
for (const pair of MAKER_PAIRS) write(pairPath('switches', pair), makerComparePage(pair), { lastmod: CHECKED });
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
