---
name: petitdoigt
description: A typing trainer that teaches which finger hits each key.
colors:
  charcoal-ground: "#212227"
  key-slate: "#33363c"
  key-slate-lit: "#3c4047"
  bar-track: "#31353d"
  hairline: "#32353b"
  hairline-strong: "#4b4f57"
  lane-rule: "#4a4d55"
  strike-line: "#848b97"
  warm-paper-text: "#e6e6e2"
  cool-grey-text: "#aab0ba"
  muted-label: "#8a8f9b"
  mustard: "#f8d95c"
  miss-coral: "#f2715f"
  finger-ink: "#1d1e22"
  finger-pinky-top: "#fcb3ca"
  finger-pinky: "#fb8ab1"
  finger-pinky-bottom: "#e46695"
  finger-ring-top: "#ffe99f"
  finger-ring: "#fbd75a"
  finger-ring-bottom: "#e1b905"
  finger-middle-top: "#aeddae"
  finger-middle: "#7fcc81"
  finger-middle-bottom: "#57b25c"
  finger-index-top: "#9ac1ef"
  finger-index: "#6ba9f2"
  finger-index-bottom: "#448cde"
  finger-thumb: "#aab0ba"
typography:
  display:
    fontFamily: "'Roboto Mono Variable', ui-monospace, 'Cascadia Mono', Consolas, monospace"
    fontSize: "6.5rem"
    fontWeight: 700
    lineHeight: 0.846
    letterSpacing: "-0.03em"
    fontFeature: "'tnum'"
  headline:
    fontFamily: "'Roboto Mono Variable', ui-monospace, 'Cascadia Mono', Consolas, monospace"
    fontSize: "4.5rem"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "'tnum'"
  headline-sm:
    fontFamily: "'Roboto Mono Variable', ui-monospace, 'Cascadia Mono', Consolas, monospace"
    fontSize: "3.5rem"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "'tnum'"
  title:
    fontFamily: "'Roboto Mono Variable', ui-monospace, 'Cascadia Mono', Consolas, monospace"
    fontSize: "1.9375rem"
    fontWeight: 700
    lineHeight: 1.1
    fontFeature: "'tnum'"
  drill:
    fontFamily: "'Roboto Mono Variable', ui-monospace, 'Cascadia Mono', Consolas, monospace"
    fontSize: "1.75rem"
    fontWeight: 400
    lineHeight: 2
  wordmark:
    fontFamily: "'Roboto Mono Variable', ui-monospace, 'Cascadia Mono', Consolas, monospace"
    fontSize: "1.4375rem"
    fontWeight: 600
    letterSpacing: "0.01em"
  body:
    fontFamily: "'Roboto Mono Variable', ui-monospace, 'Cascadia Mono', Consolas, monospace"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.3
  base:
    fontFamily: "'Roboto Mono Variable', ui-monospace, 'Cascadia Mono', Consolas, monospace"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.3
  label:
    fontFamily: "'Roboto Mono Variable', ui-monospace, 'Cascadia Mono', Consolas, monospace"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.3
  label-sm:
    fontFamily: "'Roboto Mono Variable', ui-monospace, 'Cascadia Mono', Consolas, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.3
  micro:
    fontFamily: "'Roboto Mono Variable', ui-monospace, 'Cascadia Mono', Consolas, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.3
  legend:
    fontFamily: "'Roboto Mono Variable', ui-monospace, 'Cascadia Mono', Consolas, monospace"
    fontSize: "1.0625rem"
    fontWeight: 500
    lineHeight: 1
  root:
    fontFamily: "'Roboto Mono Variable', ui-monospace, 'Cascadia Mono', Consolas, monospace"
    fontSize: "clamp(11px, min(1.04167vw, 1.5625vh), 28px)"
  root-narrow:
    fontFamily: "'Roboto Mono Variable', ui-monospace, 'Cascadia Mono', Consolas, monospace"
    fontSize: "14px"
  narrow-wordmark:
    fontFamily: "'Roboto Mono Variable', ui-monospace, 'Cascadia Mono', Consolas, monospace"
    fontSize: "1.25rem"
    fontWeight: 600
    letterSpacing: "0.01em"
  narrow-next-cap:
    fontFamily: "'Roboto Mono Variable', ui-monospace, 'Cascadia Mono', Consolas, monospace"
    fontSize: "1.125rem"
    fontWeight: 500
    lineHeight: 1
  narrow-legend:
    fontFamily: "'Roboto Mono Variable', ui-monospace, 'Cascadia Mono', Consolas, monospace"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1
  narrow-legend-modifier:
    fontFamily: "'Roboto Mono Variable', ui-monospace, 'Cascadia Mono', Consolas, monospace"
    fontSize: "0.5625rem"
    fontWeight: 400
    lineHeight: 1
rounded:
  underline-end: "0.0625rem"
  cursor-end: "0.15625rem"
  hair: "0.25rem"
  inner: "0.3125rem"
  cap: "0.5rem"
  next-cap: "0.75rem"
  pill: "1rem"
spacing:
  xs: "0.375rem"
  sm: "0.625rem"
  md: "1.25rem"
  lg: "2.25rem"
  gutter: "2.875rem"
components:
  tab:
    textColor: "{colors.muted-label}"
    typography: "{typography.body}"
    padding: "0.5rem 0"
  tab-hover:
    textColor: "{colors.cool-grey-text}"
  tab-active:
    textColor: "{colors.warm-paper-text}"
  select-button:
    textColor: "{colors.cool-grey-text}"
    typography: "{typography.label}"
    rounded: "{rounded.cap}"
    padding: "0 0.75rem 0 0.875rem"
    height: "2.1875rem"
  select-button-hover:
    backgroundColor: "{colors.key-slate}"
    textColor: "{colors.warm-paper-text}"
  select-menu:
    backgroundColor: "{colors.key-slate}"
    rounded: "{rounded.cap}"
    padding: "0.25rem"
  select-option:
    textColor: "{colors.cool-grey-text}"
    rounded: "{rounded.hair}"
    padding: "0.5rem 0.75rem"
  select-option-hover:
    backgroundColor: "{colors.key-slate-lit}"
    textColor: "{colors.warm-paper-text}"
  select-option-active:
    backgroundColor: "{colors.hairline-strong}"
  segmented-track:
    backgroundColor: "{colors.key-slate}"
    rounded: "{rounded.cap}"
    padding: "0.1875rem"
  segment:
    textColor: "{colors.cool-grey-text}"
    rounded: "{rounded.inner}"
    padding: "0.375rem 0.625rem"
  segment-hover:
    backgroundColor: "{colors.key-slate-lit}"
    textColor: "{colors.warm-paper-text}"
  segment-on:
    backgroundColor: "{colors.hairline-strong}"
    textColor: "{colors.warm-paper-text}"
  key-cap:
    backgroundColor: "{colors.key-slate}"
    textColor: "{colors.cool-grey-text}"
    rounded: "{rounded.cap}"
    height: "3.125rem"
  key-cap-finger:
    backgroundColor: "{colors.finger-index}"
    textColor: "{colors.finger-ink}"
    typography: "{typography.legend}"
    rounded: "{rounded.cap}"
  key-cap-wrong:
    backgroundColor: "{colors.miss-coral}"
    textColor: "{colors.finger-ink}"
  next-cap:
    backgroundColor: "{colors.finger-pinky}"
    textColor: "{colors.finger-ink}"
    rounded: "{rounded.next-cap}"
    size: "4.625rem"
  finger-token:
    backgroundColor: "{colors.finger-ring}"
    textColor: "{colors.finger-ink}"
    size: "2.75rem"
  stat-value:
    textColor: "{colors.mustard}"
    typography: "{typography.title}"
  finger-bar:
    backgroundColor: "{colors.bar-track}"
    rounded: "{rounded.hair}"
    height: "0.5rem"
  tracking-switch:
    backgroundColor: "{colors.key-slate}"
    textColor: "{colors.cool-grey-text}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    height: "1.125rem"
  tracking-switch-on:
    backgroundColor: "{colors.hairline-strong}"
  profile-menu:
    backgroundColor: "{colors.key-slate}"
    rounded: "{rounded.cap}"
    padding: "0.25rem"
    width: "15.5rem"
  profile-input:
    backgroundColor: "{colors.charcoal-ground}"
    textColor: "{colors.warm-paper-text}"
    typography: "{typography.label}"
    rounded: "{rounded.inner}"
    height: "2rem"
  stats-pick:
    textColor: "{colors.warm-paper-text}"
    typography: "{typography.label}"
    rounded: "{rounded.inner}"
    padding: "0.25rem 0.5rem"
  stats-pick-on:
    backgroundColor: "{colors.hairline-strong}"
  history-chart:
    textColor: "{colors.muted-label}"
    typography: "{typography.micro}"
    height: "6.5rem"
---

# Design System: petitdoigt

## Overview

**Creative North Star: "The Practice Cockpit"**

petitdoigt is the familiar quiet-dark typing test finished to the Linear / Raycast standard, with one change of unit: the finger, not the key, is what the screen teaches. One fixed screen holds three zones on a charcoal ground. The left rail carries the product's numbers, the centre stage drops falling notes straight onto an on-screen keyboard, and the right rail shows the hands with the finger to use filled in. Nothing scrolls on desktop and nothing needs a click to start; the primary action is typing.

The palette is restrained everywhere except where it carries meaning. Chrome stays in four steps of cool slate and three greys of text; color arrives only as finger hues, one mustard accent for the product's own figures, and a coral for misses. Zones are separated by space and low-contrast hairlines rather than cards or boxes. Roboto Mono runs through everything, so legends, drill text and numerals share one grid and tabular digits never jump.

Motion is short and ease-out, with no bounce. The signature beat is a note landing on the strike line, its key cap pressing, and its finger lighting on the hands plate, all within about 80 to 220ms.

**Key Characteristics:**
- One screen scaled from a 1536 x 1024 reference frame through the root font size.
- Color is the finger; shape and shade are the row. That coding is the system's only chromatic language besides mustard and coral.
- Flat charcoal surfaces; soft 8px key caps lit by a one-pixel top highlight.
- Lowercase text throughout, monospace throughout.
- Every control shares one hover / release / press timing.

## Colors

A cool charcoal chrome with four soft finger hues in three row shades each, one mustard accent and one coral for misses.

### Primary
- **Mustard** (`mustard`): the wordmark and the product's own numbers: the live WPM numeral, acc and streak values, the result WPM, the stats average and its trend line. On a result or stats view the live WPM steps back to Muted Label so the centre figure leads. The build also uses mustard for the focus ring, text selection and the active language; those are the existing exceptions and new surfaces should not add more.

### Secondary (finger hues)
The hue names the finger. Each hue comes in three shades, one per letter row; the named value is the home-row shade and is also the finger's own color wherever no row is involved (bars, fingertip dots, finger markers).

- **Pinky Pink** (`finger-pinky`): pinky keys, notes, bars and mattes. Top row `finger-pinky-top`, bottom row `finger-pinky-bottom`.
- **Ring Yellow** (`finger-ring`): ring-finger keys, notes, bars and mattes. Top row `finger-ring-top`, bottom row `finger-ring-bottom`. Its home value sits within a hair of Mustard (both about oklch 89% 0.15 at hue 93 to 95), so on screen the two read as one color. Treat that as an open defect; see Do's and Don'ts.
- **Middle Green** (`finger-middle`): middle-finger keys, notes, bars and mattes. Top row `finger-middle-top`, bottom row `finger-middle-bottom`.
- **Index Blue** (`finger-index`): index-finger keys, notes, bars and mattes. Top row `finger-index-top`, bottom row `finger-index-bottom`.
- **Thumb Grey** (`finger-thumb`): the space bar's finger, one shade. Shape: horizontal bar. Same value as Cool Grey Text.

**Row shades.** Top-row shades are brighter and softer (about +0.075 OKLCH lightness at 0.6 of the chroma; the yellow, already near white, steps up +0.05 so it stays yellow). Bottom-row shades are darker and richer (-0.09 lightness, chroma pushed to the gamut edge). The darkest shade, `finger-index-bottom`, still carries Finger Ink at 4.8:1 and reads on Charcoal Ground at 4.6:1; a new shade has to clear the same two checks.

### Tertiary
- **Miss Coral** (`miss-coral`): a wrong key, a wrong letter, a missing anchor, the error ring around the front note, error notes. In hardcore mode it also carries what a miss leads to: the typo run, the Backspace target, the burning fuse, the live WPM under the floor, the edges closing in and a failed set. Nothing else.

### Neutral
- **Charcoal Ground** (`charcoal-ground`): the page, and the far end of every finger-hue mix (dimmed keys and tokens mix toward it in OKLab).
- **Key Slate** (`key-slate`): neutral key caps, the segmented-control track, the dropdown button's hover fill, the dropdown menu.
- **Key Slate Lit** (`key-slate-lit`): hover fill for segments and menu options, the pressed neutral key.
- **Bar Track** (`bar-track`): empty finger-bar tracks.
- **Hairline** (`hairline`): the top-strip divider, rail rules, stats table row rules, sparkline baseline.
- **Hairline Strong** (`hairline-strong`): dropdown border, the selected segment, the pressed option, the stats scrollbar.
- **Lane Rule** (`lane-rule`): the vertical lane edges of the highway.
- **Strike Line** (`strike-line`): the 2px line notes land on.
- **Warm Paper Text** (`warm-paper-text`): primary text, the active tab, drill text.
- **Cool Grey Text** (`cool-grey-text`): secondary text, stat labels, neutral key legends.
- **Muted Label** (`muted-label`): idle tabs, captions, table headers, typed-done letters.
- **Finger Ink** (`finger-ink`): text set on any finger hue or on Miss Coral.

The highway fades notes in at the top through a mask (`linear-gradient(to bottom, transparent 0, var(--bg) 3rem)`). The opaque stop reuses the ground token; only its alpha matters.

### Named Rules
**The Finger Means Finger Rule.** Pink, yellow, green, blue and the thumb grey mean a finger and nothing else. Never use them for status, category, decoration or charts that are not about fingers.

**The Row Shape Rule.** Shape and shade mean the row and nothing else. A mark for a key takes its row's shape, which points the way the finger travels from the home row: a triangle pointing up in the brighter shade for the top row, a circle in the plain hue for the home row, a triangle pointing down in the darker shade for the bottom row. The number row, when it is a target, is a diamond in the top-row shade; the space bar is a horizontal bar. A mark for a finger with no key in play (a stats-table finger marker, a result line) is that finger's home circle.

**The Second Channel Rule.** Color is never the only cue for the finger. A falling note sits in its finger's lane, a key cap sits in its finger's column, a matte fills the finger itself, and bars, tables and the next-key line spell the finger's name. The row is never shade alone either: shape always travels with it, and the next-key line spells the row.

**The One Brightness Rule.** In the stats view the keyboard's brightness means how much work a key needs, so the row shades switch off there and every key shows its home shade.

**The Mustard Is Ours Rule.** Mustard is for the wordmark and the figures the product measures. It is never a fill, never a button, never a finger.

**The Dim Fill, Never Dim Letter Rule.** Upcoming and finished tokens dim their fill (30% and 12% mixed toward Charcoal Ground) and switch their letter to light text, so the letter stays readable.

## Typography

**Display Font:** Roboto Mono Variable (with ui-monospace, Cascadia Mono, Consolas)
**Body Font:** Roboto Mono Variable
**Label/Mono Font:** Roboto Mono Variable

**Character:** One monospace family in every role, with tabular numerals on by default. Weight carries hierarchy: 700 for numbers, 600 for the wordmark and tokens, 500 for finger legends, 400 for everything else.

### Hierarchy
- **Display** (700, 6.5rem, 0.846, -0.03em): the live rolling WPM numeral in the left rail only.
- **Headline** (700, 4.5rem, 1): the result WPM.
- **Headline Small** (700, 3.5rem, 1): the stats average; on narrow screens also the live WPM.
- **Title** (700, 1.9375rem, 1.1): acc and streak values.
- **Drill** (400, 1.75rem, 3.5rem line box): words and pairs drill text and the anchors heading.
- **Wordmark** (600, 1.4375rem, 0.01em): "petitdoigt", lowercase, mustard. The mark leads it, 0.4em away: four finger bars standing on the baseline (index, middle, ring, pinky; the middle reaches the ascender line) in Muted Label, with the pinky bar in the pinky's plain hue. The favicon is the same mark on a Charcoal Ground tile.
- **Body** (400, 1.0625rem, 1.3): tabs, stat labels, captions, finger names, result list.
- **Base** (400, 1rem, 1.3): the body default, the fr / en toggle, anchor copy and status (1.5 line height on the anchor explanation), the result hint.
- **Label** (400, 0.9375rem): dropdown, menu options, table cells, line meta, stage notes, stats headings.
- **Label Small** (400, 0.875rem): option labels and segments, option notes, key hints, neutral and modifier key legends.
- **Micro** (400, 0.8125rem): shifted legends on key caps, the stats chart's caption, values and dates, the unit line under the stats figure, profile menu messages.
- **Legend** (500, 1.0625rem, 1): finger key legends in Finger Ink.

The root scale is itself part of the ramp: `root` (`clamp(11px, min(1.04167vw, 1.5625vh), 28px)`, 16px at the reference frame) sizes every rem step above.

**Narrow layout only (below 900px):** the root locks to `root-narrow` (14px); the wordmark drops to 1.25rem, the next-key cap letter to 1.125rem, key legends to 0.6875rem (finger and neutral alike) and unassigned modifier legends to 0.5625rem; acc, streak and their labels drop to Label (0.9375rem), the WPM caption to Label Small, and the live WPM to Headline Small.

### Named Rules
**The Lowercase Voice Rule.** Every visible string is lowercase, the wordmark included. No uppercase labels, no tracked small caps.

**The Two Languages Rule.** Every string lives in `src/core/i18n.ts`, in English and in French, and the French follows the same voice: lowercase labels, the reader addressed as "tu", no space before a colon. French runs about a quarter longer, so a new string is checked in French at the width its English fits.

**The One Family Rule.** Roboto Mono for everything, numerals included; no second face.

## Layout

The screen is built at a 1536 x 1024 reference frame where 1rem = 16px, and the root font size scales with the viewport (`clamp(11px, min(1.04167vw, 1.5625vh), 28px)`) so the whole cockpit fits without scrolling. Every measurement is in rem so it scales with that root.

A 5.0625rem top strip (wordmark, five text tabs, tracking switch, profile and layout dropdowns, the fr / en interface-language picker) sits above a hairline. Below it a 96rem centred cockpit holds three fixed columns: a 17rem left rail, a 49.75rem centre and a 21rem right rail, separated by 2.375rem and 1.25rem gaps with a 2.875rem outer gutter. The centre is a grid of stage, keyboard and an options row of 7rem that grows when its groups and note need a third line. The highway lanes are measured from the keyboard, so every note falls straight onto its finger's home key.

Spacing recurs at 0.375rem, 0.625rem, 1.25rem, 2.25rem and 2.875rem. The keyboard is a 60-column grid with 0.625rem row gaps and 3.125rem rows.

Below 900px the root locks to 14px, the page scrolls, and the rails stack: next key and finger name first, then WPM with acc and streak inline, then the highway at 44vh and a compact 2rem-row keyboard. The sparkline, finger bars and hands plate are hidden on narrow screens.

## Elevation & Depth

The system is flat and tonal. Depth comes from three slate steps over the charcoal ground and from a one-pixel inner top highlight on key caps, which gives each cap an edge without a border. Finger-colored caps get a brighter highlight than neutral ones. The only cast shadow belongs to the dropdown menu, the one element that floats over content.

### Shadow Vocabulary
- **Cap top light** (`box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.07)`): neutral, quiet and dimmed key caps.
- **Finger cap top light** (`box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.26)`): key caps filled with a finger hue.
- **Menu float** (`box-shadow: 0 0.75rem 2rem rgb(0 0 0 / 0.35)`): the open layout dropdown and profile menu.

### Named Rules
**The No Boxes Rule.** Zones are separated by space and Hairline rules, never by cards, panels or bordered containers. Filled shapes are reserved for controls, key caps and finger tokens.

## Shapes

Softly rounded rectangles for everything you press or read as a key (0.5rem caps, 0.3125rem inner segments, 0.25rem menu options and bar ends, 0.75rem for the large next-key cap). Thin bars are pill-ended: the radius is half the bar's height, so the 0.125rem letter underline takes 0.0625rem and the 0.3125rem cursor bar takes 0.15625rem. The finger tokens are the system's only geometry beyond rounded rectangles: a diamond (square at 45 degrees, 14% corners), a triangle with rounded corners, a square with 14% corners, a circle, and a horizontal bar with fully rounded ends. The canvas highway and the DOM tokens draw the same five shapes. Focus and target states use a 0.125rem outline offset from the shape, never a border change.

## Components

### Buttons and tabs
Text-only and quiet: tabs and the fr / en picker are bare text with no fill. The picker sets the language of the interface and sits last in the top strip, where a visitor looks for it; each of its two buttons is named in its own language.
- **Shape:** none at rest.
- **States:** Muted Label at rest, Cool Grey Text on hover, Warm Paper Text when active (the active language uses Mustard at 600).
- **Interaction:** every control carries the shared interaction system: color, background, border and scale transition over 240ms on release, 160ms on hover in, 80ms on press, with a 0.96 scale dip on press, all on `cubic-bezier(0.16, 1, 0.3, 1)`. Full-width menu options replace the scale dip with a darker fill.

### Dropdown (layout select)
- **Button:** 1px Hairline Strong border, 0.5rem radius, Cool Grey Text, a chevron that rotates 180 degrees when open. Hover or open: Muted Label border, Key Slate fill, Warm Paper Text.
- **Menu:** Key Slate panel, Hairline Strong border, Menu float shadow; fades and drops 0.25rem in over 160ms, out over 240ms. Options highlight on Key Slate Lit; the selected option is Warm Paper Text at weight 600.

### Profile menu
The dropdown's button and Key Slate popover, 15.5rem wide, as a dialog. The profiles come first, the active one in Warm Paper Text at weight 600. Under a Hairline Strong rule sit the tools: new profile, rename, delete. A tool opens in place: a name field on Charcoal Ground with a 1px Hairline Strong border (Muted Label on hover, Miss Coral when the name is refused, a Mustard caret) beside a Key Slate Lit button, or the delete question with keep and delete. Escape steps back, then closes.

### Tracking switch
A label and a 1.875 by 1.125rem pill in the top strip. On: Hairline Strong track, Warm Paper Text knob at the right. Off: Key Slate track with a Hairline Strong border, Muted Label knob at the left. The knob slides over 240ms. While it is off, the left rail and the set result say that nothing is saved.

### Segmented control
- **Track:** Key Slate, 0.5rem radius, 0.1875rem inset.
- **Segments:** Cool Grey Text, 0.3125rem radius; hover to Key Slate Lit; the chosen segment sits on Hairline Strong with Warm Paper Text.
- **Context:** drill options (text source, practice language, tempo, saved numbers) sit in the bottom row and fade out while typing. Groups that do not fit one line wrap to a second; the key hints close the last line at its right end, and a note takes its own line under them. On a phone a long row of segments wraps inside its track.

### On-screen keyboard (signature)
- **Neutral cap:** Key Slate, Cool Grey Text, cap top light.
- **Finger cap:** the finger hue in its row's shade at full strength, Finger Ink legend at 500, so the three letter rows read as three bands of brightness. The stats view drops the row shades, mixes the home shade toward Charcoal Ground by a heat value, and dims low-work keys to a dark mix with light legends.
- **Row legend:** a 0.625rem Muted Label mark in the gutter left of each letter row, in that row's shape. Hidden on the narrow layout, which has no gutter.
- **Number row:** stays neutral until it is the target, so the letter rows lead.
- **Next / shift target:** its row's shade with a Warm Paper Text outline offset 0.125rem. The outline is what marks the target; the fill does not change.
- **Anchor:** outline in the finger's hue.
- **Pressed:** scales to 0.93 in 80ms.
- **Wrong:** Miss Coral fill, Finger Ink legend.

### Finger token (signature)
The row's shape filled with the finger's hue in the row's shade, letter in Finger Ink at 600 and 45% of the token size. Triangles have rounded corners and carry the letter at their centroid, toward the flat side. Sizes: 2.75rem in drills, 1.125rem as a stats-table marker, 1rem beside the next key. On the highway each note is drawn on canvas with the same geometry, plus a small caret above it when the letter needs Shift.

### Note highway (signature)
Canvas stage: vertical Lane Rule edges taken from the keyboard, a 2px Strike Line, notes fading in through a 3rem top mask. A landed note pops (150ms) and lights its lane's stretch of the strike line in its hue (220ms). A miss shakes the front note (180ms) and rings it in Miss Coral; reduced motion keeps the notes falling and drops the shake and pop.

### Hands plate and next key
An outline plate of both hands with a fingertip dot in each finger's hue. The finger to use fills through a matte cut from the plate, in the shade of the row it is about to reach, fading in over 80ms. Below it, the next key sits in a 4.625rem cap filled with the same shade. Under the cap a 1rem token in the row's shape sits beside the finger and the row spelled out ("right ring, top row"), so the words accompany color and shape in every drill, the text drills included.

### Stat rail
The live WPM in Display Mustard, a caption that cycles the rolling window, a sparkline, acc and streak split by a vertical Hairline between top and bottom Hairline rules, then four finger bars (0.5rem tall, Bar Track, fill grows over 600ms ease-out).

### Stats view
- **Figure:** Headline Small in Mustard: the current last-ten average of the chart's subject. Under it the subject, with its token when it is a finger or a key, the unit and window in Micro, and one slot that holds either the picking hint or the "back to all keys" button.
- **History chart:** a 6.5rem canvas. One mark per saved set, oldest at the left: Key Slate Lit bars from zero for speed, Muted Label dots for accuracy on a range that opens near the top. Over them runs a 0.125rem line, the average of the last ten sets, ending in a dot on the figure's value. The line takes its subject's color: Mustard for the layout, the finger's hue for a finger, the row's shade of it for a key. Value rules are Hairline with Micro labels in a 2.5rem gutter; a date label marks where a day starts. Pointing at a set puts its date, drill and value in the caption.
- **Lists:** fingers, slowest keys and slowest pairs: three tables of eight 1.875rem rows that end together. A finger or key name is a button (Key Slate on hover, Hairline Strong when picked) that makes it the chart's subject.
- **Keyboard:** every finger key is a button there as well. A hovered key takes a Muted Label outline, the picked key the Warm Paper Text outline.

### Drill text
Words and pairs in the Drill style. Each letter carries a 0.125rem underline in its finger hue at 75% opacity; the current letter turns its finger hue over a 0.3125rem bar; typed letters turn Muted Label; a wrong letter turns Miss Coral.

### Hardcore mode
An option of the highway, words and pairs drills (2026-11-18, the user's three picks: typos stick, a draining fuse, fuse plus closing edges). Two segmented groups join the drill options: `hardcore` off / on and, when on, `min wpm` none / 40 / 60 / 80 / 100 / 120. Turning either starts a fresh set. Coral is the mode's only color; it adds no token.
- **Typo run:** a wrong key lands in the text and so does every key after it, up to ten, until Backspace erases them (Ctrl or Alt with Backspace erases the run). In the text drills the run sits inside the word, just before the letter it replaced: Miss Coral glyphs over full-opacity coral underlines, the last one carrying the 0.3125rem cursor bar, while the replaced letter drops back to its plain upcoming look. On the highway the front note keeps its coral ring and the run is drawn in coral above it, same bars. New typos enter with a 120ms drop.
- **Backspace target:** while typos wait, the board's bksp cap fills Miss Coral with a Warm Paper Text outline, the right pinky lights on the hands plate, and the next-key cap becomes a coral cap as wide as its legend (min 4.625rem, 1rem side padding) with "right pinky, bksp" and "erase 3 typos" under it.
- **Floor:** "/100" follows the live WPM in Title size, Muted Label, 400. The sparkline draws the floor as a 1px dashed rule (Hairline Strong, coral while under) and keeps it in range.
- **Fuse:** a 0.1875rem cord across the top of the centre column, 1.25rem down, on a Hairline track. Unlit through a 3 s warm-up after the first right key (Hairline Strong). Lit, it is Cool Grey Text mixed toward Miss Coral as it shortens; it burns in from both ends toward the middle while the rolling WPM is under the floor (empty in 5 s just under, 2 s a quarter under or worse) and grows back at 0.12 a second above it. Under the floor each end carries a spark: a 0.875rem radial of Warm Paper Text core into coral, flickering in three steps at 220ms.
- **Stress:** under the floor the live WPM numeral and its "/100" turn Miss Coral and the numeral beats (scale up to 1.045, lub-dub keyframes on a registered `--pulse`). Below 40% fuse, coral closes in from the screen edges: a fixed radial vignette, coral at 44% at the corners, opacity growing to full as the fuse empties and beating with the numeral. The beat quickens with the fuse: 1.2s, 0.82s, 0.52s.
- **Fail:** an empty fuse ends the set. The edges flood once (900ms fade) and the stage jolts (320ms, four decaying steps). The result leads with "set failed: under 100 wpm too long" in Miss Coral, the WPM in Cool Grey Text instead of Mustard, then lasted, accuracy and best streak, and says the set stays out of the history. A held floor adds "min wpm: 100 wpm, held" to a normal result.
- **Reduced motion:** the beat, the sparks, the drop and the jolt stop outright; the coral states and the vignette's strength stay.

## Do's and Don'ts

### Do:
- **Do** size everything in rem from the 1536 x 1024 reference frame so the cockpit scales as one piece.
- **Do** give every interactive element the shared interaction timing: 160ms hover in, 240ms release, 80ms press, 0.96 scale dip, ease-out `cubic-bezier(0.16, 1, 0.3, 1)`.
- **Do** keep the reduced-motion override that collapses transitions and animations to near zero.
- **Do** give every mark for a key its row's shape and shade: triangle up and brighter for the top row, circle and plain for the home row, triangle down and darker for the bottom row.
- **Do** keep a second cue for the finger beside its color: the lane, the key column, the lit finger or the finger's name.
- **Do** set text on a finger hue or on Miss Coral in Finger Ink.
- **Do** draw a history line in its subject's color: Mustard for the layout's own number, the finger's hue for a finger, the row's shade of it for a key.
- **Do** separate zones with space and Hairline rules.
- **Do** keep all copy lowercase and in Roboto Mono.
- **Do** write every string in both languages in `src/core/i18n.ts`, and look at the French at desktop and phone width before calling a screen done.

### Don't:
- **Don't** use a finger hue for anything that is not a finger: no status, category or link color, and no chart color except that finger's own history.
- **Don't** use shape or shade for anything that is not the row, and never tie a shape to a finger.
- **Don't** extend Mustard beyond the wordmark, the product's numbers and the few selection marks the build already carries.
- **Don't** add a new yellow, or reuse Ring Yellow or Mustard for each other's role; the two values already sit too close and need separating rather than more overlap.
- **Don't** wrap rails or drills in cards, panels or bordered boxes.
- **Don't** introduce a second typeface or uppercase labels.
- **Don't** use bounce, overshoot or spring easing.
