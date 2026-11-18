# auriculaire

A typing trainer that teaches which finger hits each key. Built for one typist who plateaued near 100 WPM because the ring and pinky fingers were doing almost nothing.

**Try it: https://latranchee.github.io/typing_trainer/**

## Run it

```
npm install
npm run dev -- --port 5183
```

Then open http://127.0.0.1:5183/. Progress is saved in the browser's local storage, separately for each address: the hosted page and a local copy do not share it.

Every push to `main` runs the tests, builds, and publishes to GitHub Pages (`.github/workflows/deploy.yml`).

Other commands: `npm test` (engine tests), `npm run typecheck`, `npm run build`.

## How it works

Every finger has a color and a shape: pinky is a pink diamond, ring a yellow triangle, middle a green square, index a blue circle. The thumb is a grey bar. The same coding runs through the falling notes, the on-screen keyboard, the hands and the stats.

The trainer applies the layout itself from physical key positions (`KeyboardEvent.code`), so the layout chosen in the dropdown works whatever layout Windows is set to. The on-screen keyboard always shows the selected layout's legends.

Layouts: Canadian French (with dead-key accents), Colemak-DH for ANSI boards (angle fingering on the left bottom row), US QWERTY.

## Drills

- **highway**: falling notes, one lane per finger, each note dropping onto that finger's home key on the keyboard below. By default the road follows your pace and waits when you are late. Lock the tempo to hold one speed: early keys are refused, which forces slow, deliberate fingering. Up and down arrows change the locked tempo.
- **words**: English or French words, weighted toward ring and pinky letters and toward your own slow keys. The cursor is the next letter in its finger's color.
- **pairs**: the most common letter pairs or triples of the language, three times each, no words.
- **anchors**: isolation sets. The other fingers of the hand hold their home keys while one finger taps its keys. Held keys are something the keyboard can report, so this drill can check that the right finger did the work.
- **stats**: per-finger and per-key speed and accuracy for the selected layout, slowest letter pairs, set history with a ten-set rolling average. The keyboard lights the keys that trail the others.

Keys: `esc` new text, `enter` next set after a result. Options hide while you type and return when you stop or move the mouse. Click the caption under the WPM number to change the rolling window (5, 10 or 30 seconds).

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

- `src/core/`: layouts, finger maps, text generation, metrics, storage. No DOM.
- `src/drills/`: one file per drill.
- `src/ui/`: shell, keyboard, hands, dropdown.
- `PRODUCT.md`: product record. `DESIGN.md`: the design system. `.impeccable/`: design tokens, the surface brief and the approved mock.
- `?demo=comp` freezes the screen on fixed values for visual checks.
