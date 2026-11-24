# Keyboard and switch data

The facts behind the switch encyclopedia, the keyboard pages and the keyboard finder. English only; pages and translations are built from these files. Check every file with `node scripts/data/check.mjs` (exit 1 on an error, warnings printed apart).

## Files

- `switches/<maker-id>.json`: one switch maker and every switch it sells or sold.
- `keyboards/<brand-id>.json`: one keyboard brand and its keyboards.

One maker or brand per file, so a file can be researched, refreshed and reviewed on its own. File name = the maker's or brand's `id`.

## Rules for every record

1. **Nothing invented.** A value you could not read on a page you opened is `null` (or `[]`), never a guess, an average or a typical value. A `null` is better than a wrong number.
2. **Every URL was opened during the research run** and returned the page it claims to be. Never build a URL from a pattern, never copy one from memory. A product page that 404s, redirects to a home page or shows a different product is not a source.
3. **Official first.** Specs come from the maker's own product page, spec sheet or datasheet when one exists (`official_url`). A retailer, a review or a measurement fills a gap only when the maker publishes nothing, and its `kind` says so.
4. **Each source says what it backs** (`backs`: the field names it supports). A spec with no source backing it gets `null`.
5. **Dates** are `YYYY-MM-DD`; `checked` = the day the page was read.
6. **Numbers** are plain numbers in the unit the field names (`_gf` = gram-force, `_mm` = millimetres, `_usd` = US dollars). A maker writing "45±10gf" → `45`. A range of actuation on an adjustable switch goes in `actuation_range_mm`.
7. **Words** are the maker's own spelling for names; `notes` is one or two plain factual sentences, no marketing adjectives, no claim the sources do not make.
8. **ids** are lowercase ASCII words joined by hyphens. A switch id starts with its maker id (`gateron-milky-yellow-pro`), a keyboard id with its brand id (`keychron-q1-max`). Ids never change once published: a renamed product keeps its id and gets an `aka`.
9. **Reviews** are links to a published review of that exact product (outlet, URL, date, the outlet's own score if it gives one, and a verdict of at most 25 words in your own words). No forum threads, no affiliate listicles that only name the product.

## Source object

```json
{ "title": "Gateron: Milky Yellow Pro", "url": "https://...", "kind": "official", "backs": ["actuation_force_gf", "total_travel_mm"], "checked": "2026-11-23" }
```

`kind`: `official` (the maker or the brand selling it) · `datasheet` (a PDF spec sheet) · `retailer` · `review` · `measurement` (a force curve, a teardown) · `reference` (Wikipedia, a wiki, a standard).

## Switch maker file (`switches/<maker-id>.json`)

```json
{
  "maker": {
    "id": "gateron",
    "name": "Gateron",
    "role": "manufacturer",
    "country": "CN",
    "founded": 2000,
    "official_url": "https://www.gateron.com/",
    "about": "One or two factual sentences.",
    "sources": [ ... ]
  },
  "switches": [ { ...switch... } ]
}
```

`role`: `manufacturer` (makes switches) · `brand` (sells switches made by another factory) · `both`.

## Switch record

| field | type | meaning |
|---|---|---|
| `id` | string | `<maker-id>-<slug>` |
| `name` | string | as the maker writes it |
| `maker` | string | maker id of the file |
| `made_by` | string \| null | factory maker id when the brand is not the factory and a source says who is (NovelKeys Cream → `kailh` only if sourced) |
| `family` | string \| null | product line (`G Pro 3.0`, `Box`, `MX2A`) |
| `aka` | string[] | other names it is sold under |
| `type` | enum | `linear` · `tactile` · `clicky` · `silent-linear` · `silent-tactile` |
| `sensing` | enum | `contact` (metal leaf) · `magnetic` (Hall effect / TMR) · `optical` · `capacitive` (Topre, EC) · `inductive` |
| `footprint` | enum | `mx` · `choc-v1` · `choc-v2` · `gateron-lp` · `cherry-lp` · `cherry-ulp` · `alps` · `topre` · `buckling-spring` · `optical` · `proprietary` · `other` |
| `keycap_mount` | enum | `mx` · `choc` · `alps` · `topre` · `other` |
| `profile` | enum | `standard` · `low` · `ultra-low` |
| `pins` | 3 \| 5 \| null | PCB pins (MX footprint) |
| `actuation_force_gf` | number \| null | operating force |
| `bottom_out_force_gf` | number \| null | end force |
| `tactile_force_gf` | number \| null | peak of the bump (tactile, clicky) |
| `pre_travel_mm` | number \| null | travel to actuation |
| `total_travel_mm` | number \| null | full travel |
| `actuation_range_mm` | [number, number] \| null | adjustable switches: shortest and deepest actuation point |
| `materials` | object | `{ "top": "PC", "bottom": "nylon", "stem": "POM" }`, each `null` when unknown |
| `spring` | string \| null | as the maker writes it (`22mm two-stage`, `gold-plated`) |
| `factory_lubed` | bool \| null | |
| `light_pipe` | bool \| null | built-in light pipe / LED diffuser |
| `rated_lifespan_million` | number \| null | rated keystrokes, millions |
| `released` | string \| null | `YYYY` or `YYYY-MM` |
| `status` | enum | `current` · `discontinued` · `limited` |
| `official_url` | string \| null | the maker's page for this switch |
| `reviews` | review[] | |
| `sources` | source[] | |
| `notes` | string \| null | |

## Keyboard brand file (`keyboards/<brand-id>.json`)

```json
{
  "brand": {
    "id": "keychron",
    "name": "Keychron",
    "country": "CN",
    "founded": 2017,
    "official_url": "https://www.keychron.com/",
    "focus": ["enthusiast", "office"],
    "about": "One or two factual sentences.",
    "sources": [ ... ]
  },
  "keyboards": [ { ...keyboard... } ]
}
```

`focus`: any of `gaming` · `enthusiast` · `office` · `ergonomic` · `diy` · `premium` · `budget`.

## Keyboard record

| field | type | meaning |
|---|---|---|
| `id` | string | `<brand-id>-<slug>` |
| `brand` | string | brand id of the file |
| `model` | string | as the brand writes it, without the brand name |
| `aka` | string[] | |
| `status` | enum | `current` · `discontinued` |
| `released` | string \| null | `YYYY` or `YYYY-MM` |
| `kind` | enum | `prebuilt` (ships with switches and keycaps) · `barebones` (no switches/keycaps) · `kit` (needs soldering or assembly) · `pcb` (an open design sold as a PCB or by vendors) |
| `size` | enum | `full` · `96` · `tkl` · `75` · `65` · `60` · `50` · `40` · `30` · `numpad` · `other` |
| `key_count` | number \| null | |
| `layout_standards` | enum[] | offered of `ansi` · `iso` · `jis` (empty for ortholinear and columnar boards unless the brand names one) |
| `stagger` | enum | `row` (classic) · `ortholinear` (grid) · `column` (columnar) |
| `split` | enum | `none` · `unibody-angled` (Alice, Arisu) · `split` (two halves) |
| `tenting` | enum | `none` · `built-in` · `accessory` |
| `thumb_cluster` | bool | |
| `key_wells` | bool | curved key wells (Kinesis Advantage, Glove80) |
| `low_profile` | bool | |
| `connectivity` | enum[] | `usb` · `bluetooth` · `2.4ghz` |
| `battery_mah` | number \| null | |
| `polling_rate_hz` | number \| null | highest wired rate |
| `switch_footprint` | enum | which switches fit: the switch `footprint` enum |
| `hot_swap` | enum \| null | `none` · `yes` (hot-swap stated, socket type not stated) · `3-pin` · `5-pin` (takes 3 and 5) · `choc` · `magnetic` · `optical` · `other` (another socket type); `null` when the brand does not say (never `none` by default) |
| `switches` | object[] | options sold: `{ "name": "Gateron Jupiter Red", "id": "gateron-jupiter-red" \| null }` |
| `adjustable_actuation` | bool | Hall effect / analog boards with a settable actuation point |
| `rapid_trigger` | bool \| null | |
| `case_material` | string \| null | `aluminum`, `plastic`, `wood`, ... |
| `mount` | string \| null | `gasket`, `tray`, `top`, `plate-less`, ... |
| `firmware` | enum[] | `qmk` · `via` · `vial` · `zmk` · `kmk` · `proprietary` |
| `software` | string \| null | the brand's app (`Logitech G HUB`) |
| `os` | enum[] | `windows` · `mac` · `linux` · `ios` · `android` (only what the brand states) |
| `price_usd` | number \| null | cheapest assembled configuration on the brand's own store (or MSRP it states) |
| `price_date` | string \| null | day the price was read |
| `price_url` | string \| null | page the price was read on |
| `official_url` | string \| null | the brand's product page |
| `reviews` | review[] | |
| `sources` | source[] | |
| `notes` | string \| null | |

`switches[].id` names a record of `switches/` when one exists; `null` until the switch is in the encyclopedia. `node scripts/data/check.mjs` lists every unmatched name, so the ids can be filled in a later pass.

## Review object

```json
{ "outlet": "RTINGS", "url": "https://...", "date": "2024-05-02", "score": "8.4/10 (Office)", "verdict": "Solid build and long battery, but the stock keycaps feel thin." }
```

`score` and `date` are `null` when the outlet gives none.
