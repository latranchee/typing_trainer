# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Vite + TypeScript (user's choice, 2026-11-17). Runs from a localhost URL on the owner's Windows machine and, since 2026-11-18, at https://petitdoigt.ca as a static-assets Cloudflare Worker. Progress is stored in the browser. No backend.

## Users

One user: the owner. A fast self-taught typist who plateaus around 100 WPM because he almost never uses his ring and pinky fingers. He types French and English. His physical keyboard carries QWERTY legends. He types on the Canadian French layout today and wants to try Colemak-DH.

Why he built it, in his words (2026-11-19): « les jeux vidéos ont fait en sorte que mes doigts sont toujours sur wasd au lieu de asdf et je dois remapper les touches dans ma tête et refaire ma mémoire musculaire ». The same day he wrote that he mostly uses his index and his "annulaire" and has to work his "3 autres plus petits doigts". Which three he means is not settled (it does not match the ring and pinky of the first brief), so the finger focus starts on ring and pinky and he picks the rest himself.

Since 2026-11-18 he also means to share the trainer with the readers of his newsletter, who read French: the reason the interface speaks French as well as English.

## Product Purpose

A typing trainer that retrains which finger hits each key, so the ring and pinky fingers take over their keys and his speed passes 100 WPM. Success: correct ten-finger technique becomes automatic, then speed climbs.

## Positioning

Ordinary typing tests score which key was hit. This trainer teaches which finger hits it: every key carries its finger's color, its shape and shade say which row it sits on, and the active finger is highlighted on screen.

## Operating Context

Practice sessions at his desk, eyes on the screen. The keycaps do not match the layout being practiced, so the screen shows the keyboard with the active layout's legends at all times.

## Capabilities and Constraints

Confirmed by the user:

- Several exercises aimed at ring and pinky use.
- One exercise in the falling-notes rhythm genre: each letter arrives with a color per finger, plus a highlight of the finger to use.
- Color means the finger; shape and shade mean the row (2026-11-18, replacing the first build's one shape per finger). The bottom row is darker, the home row the plain color, the top row brighter.
- A rolling average WPM counter.
- Layout dropdown: Canadian French and Colemak-DH at minimum. The app applies the layout itself from physical key positions, so Colemak-DH can be tried without installing it.
- On-screen keyboard with the selected layout's legends.
- Practice text: English words, French words (accents included), whole sentences in both languages (2026-11-19), and a no-words mode that drills the most common letter associations.
- Score history (2026-11-18): for the layout, for each finger and for each letter.
- A profile switcher (2026-11-18): each profile keeps its own options and numbers, so another typist or another experiment does not mix into his.
- A toggle that stops performance tracking (2026-11-18). While it is off nothing is saved, and the screen says so.
- A language picker for the interface, English and French (2026-11-18). On 2026-11-19 he asked that picking French bring French words and sentences: the picker now switches the practice text with the interface, and the drill options still set the text's language apart afterwards.
- A hardcore mode (2026-11-18) in the highway, words and pairs drills: a typo sticks and every key after it lands too until Backspace erases them, and an optional minimum WPM fails the set when the rolling rate stays under it too long. He chose a draining fuse over an instant fail, and a fuse with coral closing in from the screen edges as the stress cue. A failed set stays out of the set history. On 2026-11-19 he asked for more stress and took every option offered: typos burn the fuse, a tighter fuse, a floor that climbs, scars that shorten the fuse, a heartbeat he can hear, a jolt on each typo, tunnel vision, earlier and harder edges, and a best run (time held, sets cleared in a row) to beat. The same day he asked for a difficulty rating. It was built as three levels of the fuse: 1 is the fuse of the first release, 3 is the stress pass at full strength, 2 sits halfway and is where a profile starts.

- Delight to balance the stress (2026-11-19, his words: "now that we've added stuff to make it harder, let's also add stuff to make it delightful"). He asked for a streak counter in the text drills and on the highway, rewards when a streak passes the best one, and whatever else helps motivation. Built: a counter of right keys in a row over the keyboard, running on from set to set, with marks at milestones and a celebration when the longest streak falls; a result that holds the set against the last ten, names a clean set, the finger that gained the most and the days of practice in a row.
- Key sounds (2026-11-19): he asked for a library that reproduces common mechanical keyboard switches and a dropdown to pick one. No framework-free package on npm ships named switches, so the recordings of kbsim (MIT) were taken: thirteen switches, silent until one is picked.
- A calmer screen (2026-11-19): he found the interface cluttered after the additions and asked for a polish pass "to make it feel better, more candid", read here as plainer and less crowded. The options under the keyboard were regrouped in lines by subject, on / off options became switches, and labels that only repeated their choices were dropped.

- One settings list (2026-11-19): he asked for "a submenu" for the controls of the top strip (tracking, profile, layout, interface language) and for the options under the keyboard. Built as one list behind a `settings` button, opened in the right rail's place so the text and the board stay in view; the foot under the board keeps the key hints only.
- The shape of the keyboard (2026-11-19, his words: "we need to be able to match the user's key layout", with a picture of ANSI, ISO and JIS boards). The on-screen board is drawn as any of the three, the layouts follow (Canadian French guillemets and the Colemak-DH Z on the extra ISO key), and a key only one board has sets the board the first time it is pressed.
- Fingers to train (2026-11-19, his words: "a mode where we specify which finger to train more and adjust words selection based on that"). Eight fingers to light, each hand apart, so a whole hand can be retrained. The text leans toward the lit fingers' letters and the anchor drill takes them in turn. It replaces the pairs drill's own focus and the anchor drill's finger option.
- Glow (2026-11-19, his words: "shimmer or glow, particles. Very subtle. When we're doing good. Maybe on the finger that's the fastest or whatever"). Built on one rule: what is beating its own average glows in its own color. The WPM number over the pace of the last ten sets, a finger ahead of its saved pace (its bar and its fingertip), the streak counter from 25 keys, with a spark or two off each key hit on a long streak.
- Alignment fixes he pointed at (2026-11-19): the finger bars of the left rail now run level with their names, and a letter in a note sits in the middle of its shape.
- Two more after he tried the settings list (2026-11-19): the list sits as far from the keyboard as the left rail does, and the fuse's cord is drawn on the highway only (in the text drills he read it as a stray line at the top).
- More layouts (2026-11-20, his words: "add top 5 other popular layouts including azerty, dvorak"). The other three were my picks: German QWERTZ (the most used national layout after QWERTY and AZERTY) and Colemak and Workman (the most used alternative layouts after Dvorak). The list now runs national layouts first, then alternative ones.
- Adaptive transition training (2026-11-20, his written spec, aimed at building muscle memory on a new layout such as Colemak-DH). Each transition between two letters keeps its clean samples, its smoothed time and its misses (one per attempt, however many wrong keys). Its weakness weighs time against the median transition (75%) and misses (25%), scaled by confidence. The pairs drill's new `training` option defaults to `adaptive`: about 60% of a set from weak transitions, 25% common, 15% not yet measured; `classic` keeps frequency alone, and the highway follows the same choice. My additions to his spec: a 0.1 noise floor under which a transition is not drawn as weak, a spare weight in the weak draw so a lone weak transition gives its slots back gradually as it improves, the anchor drill left out of transition numbers (its taps are isolation work), and the stats list showing time in a `ms` column.

Hard constraint: a browser cannot see which finger pressed a key. The trainer may only claim what key events can prove (which key, which Shift, which keys are held, timing).
- German and Spanish (2026-11-20, his words: "add a language switcher for german, spanish, and add their popular layouts as well"). Interface and practice text in both, and three layouts: Swiss German QWERTZ, Spanish (Spain) and Latin American (German QWERTZ was already there). A first visit now picks the layout from the browser's language and region as well as the interface language.
- Typing guides (2026-11-20, his words: "have sub agents create ~15 hyperoptimized SEO pages for various questions regarding typing. Translate in all big language", so people can find the trainer). Fifteen guides in ten languages, built as static pages next to the trainer, each linking into the drill it talks about. Keyword volumes were measured for English only (US data); the other languages use the terms the pages ranking there use. The guides cite their sources and make no claim about learning speed with the trainer, since there is no evidence for one.

Undecided: extra layouts beyond the two named.

## Brand Commitments

- Name: petitdoigt, lowercase (2026-11-18, with the petitdoigt.ca domain; it replaces the first name, auriculaire, which survives only in the browser storage keys).
- Mark: four finger bars with the pinky lit in its own color.
- Visual stance: the category-standard quiet-dark typing-test look, chosen by the user over bolder directions. Standing preference: convention played straight, no themed skin.
- Quality bar named by the user: Linear / Raycast (tight spacing, soft surfaces, crisp motion).
- The user's bar, in his words: "Make it look super good."

## Evidence on Hand

None. No benchmarks, testimonials or learning-speed claims exist; future work must not invent them.

## Product Principles

- The finger is the unit of practice, the key is only where it lands.
- Correct finger and accuracy come before speed.
- Say only what the keyboard can measure.
- Work with the keyboard he owns: legends live on screen.

## Accessibility & Inclusion

Color is the finger; shape and shade are the row. Neither is ever the only cue: a finger is also told by its lane, its key column, its lit finger or its name, and a row by its shape as well as its shade.
