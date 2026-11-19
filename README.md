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

Other commands: `npm test` (engine tests), `npm run typecheck`, `npm run build`.

## How it works

Color tells the finger: pinky pink, ring yellow, middle green, index blue, thumb grey. Shape and shade tell the row, and the shape points the way the finger travels from the home row:

- top row: a triangle pointing up, in a brighter shade;
- home row: a circle, in the plain color;
- bottom row: a triangle pointing down, in a darker shade.

The space bar is a grey bar. The same coding runs through the falling notes, the on-screen keyboard, the hands and the stats, so a note says "ring finger, top row" before you have read its letter. That matters most on a layout you do not know yet.

The trainer applies the layout itself from physical key positions (`KeyboardEvent.code`), so the layout chosen in the dropdown works whatever layout Windows is set to. The on-screen keyboard always shows the selected layout's legends.

Layouts: Canadian French (with dead-key accents), Colemak-DH for ANSI boards (angle fingering on the left bottom row), US QWERTY.

## Languages

The interface speaks English and French. The `fr / en` picker at the right of the top strip switches it at once, and the choice is saved with the profile. A first visit starts in the browser's language: French when French comes before English in the browser's list, English otherwise.

The practice text has its own language, French or English, set with the `language` option under the keyboard in the highway, words and pairs drills. So a French interface can drill English words, and the other way round. A first visit starts the practice text in the interface's language.

## Drills

- **highway**: falling notes, one lane per finger, each note dropping onto that finger's home key on the keyboard below. The note's shape and shade say which row to reach for. By default the road follows your pace and waits when you are late. Lock the tempo to hold one speed: early keys are refused, which forces slow, deliberate fingering. Up and down arrows change the locked tempo.
- **words**: English or French words, weighted toward ring and pinky letters and toward your own slow keys. The cursor is the next letter in its finger's color.
- **pairs**: the most common letter pairs or triples of the language, three times each, no words.
- **anchors**: isolation sets. The other fingers of the hand hold their home keys while one finger taps its keys. Held keys are something the keyboard can report, so this drill can check that the right finger did the work.
- **stats**: per-finger and per-key speed and accuracy for the selected layout, the slowest keys and letter pairs, and a history chart: one mark per finished set with the average of the last ten drawn over them. The chart follows the whole layout until you pick a finger or a key, in the lists or on the keyboard; then it shows that finger's or that key's history, in speed or in accuracy. The keyboard lights the keys that trail the others.

Keys: `esc` new text, `enter` next set after a result. Options hide while you type and return when you stop or move the mouse. Click the caption under the WPM number to change the rolling window (5, 10 or 30 seconds).

## Hardcore

`hardcore` is an option of the highway, words and pairs drills. A wrong key sticks: it lands in the text in coral, and every key after it lands too, until `backspace` has erased them all (`ctrl` + `backspace` erases the whole run). Only then does the right key count. The longer you type past a typo, the more you erase, as in real typing.

With hardcore on, `min wpm` sets a floor of 40 to 120. A fuse across the top of the drill is lit three seconds after the first right key. While the rolling WPM is under the floor it burns in from both ends, in five seconds just under it and in two seconds a quarter under or worse; above the floor it grows back. Near the end the WPM beats in coral and the screen edges close in. An empty fuse fails the set, and a failed set stays out of your history (its keys still count, as they were typed).

## Profiles and tracking

The profile menu in the top strip switches between typists. Each profile keeps its own layout, interface language, practice language, options, key numbers and sets; the menu also adds, renames and deletes profiles. A new profile starts from the current options with no numbers.

The tracking switch beside it stops the trainer from saving anything for the current profile: no key numbers, no sets. Use it for a warm-up or when someone else tries the keyboard. While it is off the left rail and the set result say so.

History is kept per profile in local storage. The newest 300 sets stay as they are; older ones are merged into one entry per day and layout, so the long view survives without filling the browser's storage. Finger and key history starts with the sets finished after this feature arrived: earlier sets only carry their overall speed and accuracy. Numbers saved by the first version (one typist, no profiles) are carried over into the first profile, `main`.

## What it can and cannot check

A browser cannot see which finger pressed a key. The trainer only claims what key events prove:

- which key was pressed and when;
- which Shift key was used (capitals should use the Shift on the other hand);
- which keys are held down (the anchor drill).

Everything else is guidance: the color, the shape, the lit finger.

If the anchor drill reports a lifted anchor while your fingers are down, your keyboard cannot register that many keys at once. Lower the anchor count in the drill's options.

## Layout notes

- French words with accents are left out on layouts that have no accent keys (Colemak-DH, US QWERTY).
- The Colemak-DH finger map follows the layout's ANSI angle fingering: the physical Z, X, C, V, B keys are typed with ring, middle, index, index, index.

## Project files

- `src/core/`: layouts, finger maps, text generation, metrics, storage (`store.ts`: profiles, options, numbers), history math (`history.ts`) and every interface string in both languages (`i18n.ts`). No DOM.
- `src/drills/`: one file per drill.
- `src/ui/`: shell, keyboard, hands, dropdown, profile menu.
- `PRODUCT.md`: product record. `DESIGN.md`: the design system. `.impeccable/`: design tokens, the surface brief and the approved mock.
- `?demo=comp` freezes the screen on fixed values for visual checks.

## License

MIT. See [LICENSE](LICENSE).
