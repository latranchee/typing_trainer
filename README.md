<img src="public/favicon.svg" width="56" alt="" />

# petitdoigt

A typing trainer that teaches which finger hits each key. Built for one typist who plateaued near 100 WPM because the ring and pinky fingers were doing almost nothing. The name is French for the little finger.

**Try it: https://petitdoigt.ca**

## Run it

```
npm install
npm run dev -- --port 5183
```

Then open http://127.0.0.1:5183/. Progress is saved in the browser's local storage, separately for each address: the hosted page and a local copy do not share it.

petitdoigt.ca is a Cloudflare Worker that serves the built files as static assets (`wrangler.jsonc`). Every push to `main` runs the tests, builds, and deploys there through Cloudflare's Git integration (Workers Builds). The same push publishes a copy to GitHub Pages (`.github/workflows/deploy.yml`). To deploy by hand: `npm run build`, then `npx wrangler deploy`.

Other commands: `npm test` (engine tests), `npm run typecheck`, `npm run build` (the trainer, then the guides), `npm run guides:check` (checks every guide file).

## How it works

Color tells the finger: pinky pink, ring yellow, middle green, index blue, thumb grey. Shape and shade tell the row, and the shape points the way the finger travels from the home row:

- top row: a triangle pointing up, in a brighter shade;
- home row: a circle, in the plain color;
- bottom row: a triangle pointing down, in a darker shade.

The space bar is a grey bar. The same coding runs through the falling notes, the on-screen keyboard, the hands and the stats, so a note says "ring finger, top row" before you have read its letter. That matters most on a layout you do not know yet.

The trainer applies the layout itself from physical key positions (`KeyboardEvent.code`), so the layout chosen in the dropdown works whatever layout Windows is set to. The on-screen keyboard always shows the selected layout's legends.

Layouts: Canadian French (with dead-key accents), US QWERTY, French AZERTY (accents on the number row, digits with Shift), German QWERTZ (umlauts, dead-key accents), Swiss German QWERTZ (ü ö ä with the French è é à on Shift), Spanish (ñ, dead-key accents, ¡ and ¿), Latin American (ñ, dead-key accents, braces beside the home row), Dvorak, Colemak, Colemak-DH (angle fingering on the left bottom row), Workman.

## On a phone

On a phone the trainer types with the phone's own keyboard: tap the text or `tap to type` and type. Each character counts as the keys the selected layout uses for it, so French accents work with any layout that has them. The numbers sit on one line over the text, the settings rise from the bottom, and the on-screen keyboard folds away (it comes back in the stats view). The anchor drill needs keys held down, so it is left out on touch screens, and a result there names no finger: a phone cannot tell which finger typed.

## Settings

`settings` at the right of the top strip opens one list in place of the hands: the open drill's options, the fingers to train, hardcore, the key sound, the layout and the shape of your keyboard, the profile, tracking and the interface language. The text and the board stay in view beside it, so you see a change as you make it. It closes on its button, on `esc`, on a click outside it, and at the first key you type.

Under the keyboard there is only a line of key hints: `esc` new text, `enter` next set after a result.

## Your keyboard's shape

`board` in the settings draws the on-screen keyboard like the one on your desk:

- `ansi`: a wide left Shift and a flat Enter;
- `iso`: a tall Enter and one more key beside the left Shift;
- `jis`: a tall Enter, a short Backspace with a key beside it, and three keys around the space bar.

The layout follows the board. Canadian French has its guillemets on the extra ISO key. Colemak-DH puts Z on that key on an ISO board, and in the middle of the bottom row on the two boards that lack it.

The trainer cannot see your keyboard. It starts on `ansi`, and the first time you press a key that only one board has (the key beside the left Shift, the one beside a short Backspace) it switches to that board and says so. Once the board is set, by that key or by you, it stays.

## Fingers to train

`fingers` in the settings shows two hands of four bars. Light the fingers you want to work: the words, sentences and letter pairs then lean toward their letters, and the anchor drill takes the lit fingers in turn, one set each. It starts on the ring and pinky fingers of both hands. With ring and pinky lit, more than half the letters are theirs, against a third in plain text; no word is ever ruled out. Light one hand to retrain that hand, or one finger to isolate it. With no finger lit, or all eight, every letter counts the same.

## Languages

The interface speaks English, French, German and Spanish. `interface` in the settings switches it at once, and the practice text follows: pick `deutsch` and the words and sentences you type are German too. The choice is saved with the profile. A first visit starts in the first of the four languages found in the browser's list, English when there is none, and on the layout of that language and region: Canadian French for `fr` and `fr-CA`, AZERTY for French elsewhere, Swiss German for `de-CH` and `fr-CH`, German QWERTZ for other German, Spanish for `es-ES`, Latin American for other Spanish, US QWERTY otherwise.

A link can choose for a first visit: `?lang=de` stands in for the browser's language, and `?layout=dvorak` switches the layout on any visit. Both are removed from the address once applied. The guides link into the trainer this way.

The practice text keeps a language of its own, set with `language` in the settings of the highway, words and pairs drills. Change it there after picking the interface language, and a French interface drills English text, or an English one French text.

## Drills

- **highway**: falling notes, one lane per finger, each note dropping onto that finger's home key on the keyboard below. The note's shape and shade say which row to reach for. By default the road follows your pace and waits when you are late. Lock the tempo to hold one speed: early keys are refused, which forces slow, deliberate fingering. Up and down arrows change the locked tempo. Its `text` option sends down words, sentences or letter pairs.
- **words**: words of the practice language, weighted toward the fingers you picked to train and toward your own slow keys. The cursor is the next letter in its finger's color. Set `text` to `sentences` to type whole sentences instead, with their commas, apostrophes and periods: enough of them to reach the word count, in lowercase unless `capitals` is on. On a layout without accent keys, French, German and Spanish keep the sentences that carry no accent.
- **pairs**: letter pairs or triples of the language, three times each, no words. With `training` on `adaptive` (the default) each set is built around your own weak transitions, the moves from one letter to the next that you type slowest or miss most: about three fifths of a set goes to them, a quarter to common groups and the rest to groups not measured enough yet. A transition scores against the median of your measured transitions, three quarters on time and one quarter on misses, and it needs five clean samples before it counts. As it gets quicker and cleaner it comes up less, and others take its place. `classic` draws by frequency in the language alone. The highway follows the same choice when its text is letter pairs. After a set of pairs the result names the three transitions that need the most work.
- **anchors**: isolation sets, one for each finger you picked to train. The other fingers of the hand hold their home keys while one finger taps its keys. Held keys are something the keyboard can report, so this drill can check that the right finger did the work.
- **stats**: per-finger and per-key speed and accuracy for the selected layout, the slowest keys, the weakest letter pairs (time in milliseconds, accuracy and attempts, ranked by how much each needs work), and a history chart: one mark per finished set with the average of the last ten drawn over them. The chart follows the whole layout until you pick a finger or a key, in the lists or on the keyboard; then it shows that finger's or that key's history, in speed or in accuracy. The keyboard lights the keys that trail the others.

Keys: `esc` new text, `enter` next set after a result. Click the caption under the WPM number to change the rolling window (5, 10 or 30 seconds).

## Streaks and records

A streak is the number of right keys in a row. It runs on from one set to the next and ends on a wrong key, or when you leave a set you have started. The left rail shows it over your longest streak for that layout and drill. From ten keys on, the same number comes up over the right end of the keyboard, where you can see it while you type.

- At 25, 50 and every hundred keys the counter swells once.
- When the streak passes your longest one (of 25 keys or more), the counter says `new best`, a wave crosses the on-screen keyboard and the mark beside the name drums its fingers.
- A wrong key shows the streak you just lost, in coral, as the counter goes out.

A finished set says what it was worth:

- its WPM against the pace of your last ten sets of the same drill, layout and language, and `new best` when it is the fastest of them;
- `clean set` beside the accuracy when no key was wrong;
- the finger that got furthest ahead of its own last ten sets, the ring and pinky fingers first;
- how many days in a row you have practiced.

All of it is counted from your keys and your saved sets. With tracking off the streak still counts, but no record is kept or announced.

What is beating its own average glows, softly, in its own color:

- the WPM number, while your rolling rate runs over the pace of your last ten sets;
- a finger, once its clean strokes in the set run ahead of its own saved pace: its bar in the left rail and its fingertip on the hands. A wrong key on one of its letters puts it out;
- the streak counter from 25 keys on, and each right key then throws a spark or two off its key on the board, in that key's color.

With reduced motion set in the system, the glows stay still and there are no sparks.

## Sound

`keys` in the settings picks what the keys sound like. It starts on `silent`. The list holds thirteen switches: Cherry MX Blue, Brown and Black, Holy Panda, Topre, buckling spring, Kailh Box Navy, Alps SKCM Blue, NovelKeys Cream, Gateron Black Ink and Red Ink, Turquoise Tealios and Alpaca. Moving through the list plays the switch under the cursor. Every key then sounds going down and coming back up, with its own recording for each row of the board and for the space bar, Enter and Backspace. With a switch picked, a streak's milestones tick and a record plays three rising notes.

The recordings are those of [kbsim](https://github.com/tplai/kbsim) by Thomas Lai, under the MIT license (`public/switches/LICENSE-kbsim.md`). A set is about 25 KB and is fetched when its switch is picked.

Hardcore has sounds of its own, synthesized in the page: `heartbeat` in the settings turns them on and off.

## Hardcore

`hardcore` is a setting of the highway, words and pairs drills. A wrong key sticks: it lands in the text in coral, and every key after it lands too, until `backspace` has erased them all (`ctrl` + `backspace` erases the whole run). Only then does the right key count. The longer you type past a typo, the more you erase, as in real typing.

With hardcore on, `min wpm` sets a floor of 40 to 120. A fuse is lit shortly after the first right key. While the rolling WPM is under the floor it burns, faster the further under; above the floor it grows back slowly. On the highway the fuse is drawn as a cord across the top of the road, burning in from both ends. In the words and pairs drills it is not drawn: the WPM number turning coral, the heartbeat and the coral closing in from the screen edges tell how it stands.

`difficulty` sets how hard the fuse is, from 1 to 3. It shows once a `min wpm` is picked and starts at 2. At 1 there is the fuse and nothing else. At 2 and 3 a wrong key burns a piece of it at once, part of whatever burns never grows back (the fuse is scarred shorter, down to about a third of its length), and the floor climbs while you hold it.

| | 1 | 2 | 3 |
|---|---|---|---|
| fuse lit after the first right key | 3 s | 2 s | 1.5 s |
| empty when just under the floor | 5 s | 4 s | 3 s |
| empty when a quarter under it or worse | 2 s | 1.5 s | 1.2 s |
| back from empty, above the floor | 8 s | 11 s | 17 s |
| a wrong key burns | nothing | 4% | 8% |
| share of a burn that never grows back | none | an eighth | a quarter |
| the floor climbs, per 15 s held | no | 1 WPM | 2 WPM |

Sets cleared in a row at the same `min wpm` and difficulty make a run. At 2 and 3 the floor climbs for every 15 seconds the run has held, and the scars stay from one set to the next. Under accuracy and streak, `held` and `sets` count the run against your best for that layout, drill, floor and difficulty. A failed set ends the run, and so does leaving a set you have started (`esc`, or a change of text, drill, layout or difficulty). The next set starts a new run at the floor you picked, on a whole fuse.

As the fuse empties a heartbeat sets in, which you also hear (`heartbeat` in the settings turns the mode's sounds off). Coral closes in from the screen edges, everything but the letters you are typing fades back, and at the very end the stage trembles. An empty fuse fails the set, and a failed set stays out of your history (its keys still count, as they were typed).

## Profiles and tracking

`profile` in the settings switches between typists. Each profile keeps its own layout, board, fingers to train, interface language, practice language, options, key numbers and sets; the menu also adds, renames and deletes profiles. A new profile starts from the current options with no numbers. With more than one profile, the top strip shows who is typing.

`tracking`, under it, stops the trainer from saving anything for the current profile: no key numbers, no sets. Use it for a warm-up or when someone else tries the keyboard. While it is off the left rail and the set result say so.

History is kept per profile in local storage. The newest 300 sets stay as they are; older ones are merged into one entry per day and layout, so the long view survives without filling the browser's storage. Finger and key history starts with the sets finished after this feature arrived: earlier sets only carry their overall speed and accuracy. Numbers saved by the first version (one typist, no profiles) are carried over into the first profile, `main`.

## What it can and cannot check

A browser cannot see which finger pressed a key. The trainer only claims what key events prove:

- which key was pressed and when;
- which Shift key was used (capitals should use the Shift on the other hand);
- which keys are held down (the anchor drill).

Everything else is guidance: the color, the shape, the lit finger.

If the anchor drill reports a lifted anchor while your fingers are down, your keyboard cannot register that many keys at once. Lower `anchors` in the settings.

## Layout notes

- French words with accents are left out on layouts that have no accent keys (US QWERTY, Dvorak, Colemak, Colemak-DH, Workman).
- French AZERTY types every lowercase French word; capital accented letters (É, À, Ç) need Caps Lock or AltGr there, which the trainer does not ask for, so sentences that start with one are left out when `capitals` is on. Its `<` `>` key exists on ISO boards only.
- German QWERTZ types French accents through its dead keys (`^`, `´`, `` ` ``); words with ç or a diaeresis are left out. It types every German word, and the Spanish words without ñ.
- Swiss German QWERTZ has no ß: German words with it are left out. It types every French word, è é à on their own keys and the other accents through dead keys.
- Spanish types every Spanish and French word. Latin American types every Spanish word but has no grave or circumflex accent, so French loses the words that need one. Both leave out German words with ß.
- On US QWERTY and the alternative layouts, German keeps the words without ä ö ü ß and Spanish the words without accents or ñ. The settings say when a layout leaves words out.
- Dvorak, Colemak and Workman use the standard finger map: only Colemak-DH changes the fingering.
- The Colemak-DH finger map follows the layout's angle fingering: the physical Z, X, C, V, B keys are typed with ring, middle, index, index, index. On an ISO board the key beside the left Shift carries Z, under the pinky.
- The JIS board is drawn for the layouts above: the keys only it has stay blank, and pressing one counts as a wrong key.

## Project files

- `src/core/`: the boards (`physical.ts`), layouts, finger maps, text generation and the finger focus (`generator.ts`), metrics, storage (`store.ts`: profiles, options, numbers), history math (`history.ts`), streaks, records and the glow rules (`rewards.ts`), the list of key sounds (`switches.ts`), the practice text (`corpus.ts`, with German and Spanish in `corpus-de.ts` and `corpus-es.ts`), launch links (`launch.ts`) and every interface string (`i18n.ts` for English and French, `i18n-de.ts`, `i18n-es.ts`). No DOM.
- `src/drills/`: one file per drill.
- `src/ui/`: shell, keyboard, hands, settings panel (`panel.ts`), finger picker, dropdown, profile menu, sound, sparks, and the ink centring of letters in shapes (`glyph.ts`).
- `public/switches/`: the switch recordings, one folder per switch.
- `PRODUCT.md`: product record. `DESIGN.md`: the design system. `.impeccable/`: design tokens, the surface brief and the approved mock.
- `content/guides/<lang>/<id>.html`: the guides, one file per guide and language. `scripts/guides/`: the checker, the page builder, the stylesheet, the keyboard figures and the page strings.
- `?demo=comp` freezes the screen on fixed values for visual checks.

## Guides

Fifteen written guides answer common typing questions (typing speed, words per minute, touch typing, finger placement, keyboard layouts and how they compare). Each one exists in English, Spanish, French, German, Portuguese, Italian, Polish, Indonesian, Japanese and Simplified Chinese, at `/<lang>/<slug>/`, with an index per language at `/<lang>/`. The top strip of the trainer links to the guides in the interface language.

A guide is one HTML file: a JSON head (title, description, H1, summary, FAQ, sources, the drill it links to) and a body of plain tags. `npm run guides:check` holds every file to the same rules: lengths of the title and description, at least four sections, links to three other guides, allowed tags only. `npm run build` stops on a file that fails. The builder adds the rest: the header and language switcher, a table of contents, the keyboard figures, the link into the trainer with the guide's layout, the FAQ, sources and related guides, canonical and `hreflang` links, Open Graph tags, JSON-LD (Article, FAQPage, BreadcrumbList), `sitemap.xml` and `robots.txt`.

The guides state only what their sources say; each one lists them. They make no claim about the trainer beyond what it does.

## License

MIT. See [LICENSE](LICENSE). The switch recordings in `public/switches/` come from kbsim and keep its MIT license, copied beside them.
