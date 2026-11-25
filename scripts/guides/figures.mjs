// The pictures a guide may ask for, drawn as inline SVG from the app's own colors:
// a keyboard colored by finger, and the three board shapes side by side.

const U = 44; // one key unit, in SVG pixels
const GAP = 5;
const R = 7;

const FINGER_HUE = { LP: 'pinky', LR: 'ring', LM: 'middle', LI: 'index', RI: 'index', RM: 'middle', RR: 'ring', RP: 'pinky' };
const SHADE = {
  pinky: { top: '#fcb3ca', home: '#fb8ab1', bottom: '#e46695' },
  ring: { top: '#ffe99f', home: '#fbd75a', bottom: '#e1b905' },
  middle: { top: '#aeddae', home: '#7fcc81', bottom: '#57b25c' },
  index: { top: '#9ac1ef', home: '#6ba9f2', bottom: '#448cde' },
};
const THUMB = '#aab0ba';
const SLATE = '#33363c';
const SLATE_LIT = '#3c4047';
const INK = '#1d1e22';
const TEXT = '#e6e6e2';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Fingers by physical column, as in the app's DEFAULT_FINGER. */
const NUM_FINGERS = ['LP', 'LP', 'LR', 'LM', 'LI', 'LI', 'RI', 'RI', 'RM', 'RR', 'RP', 'RP', 'RP'];
const TOP_FINGERS = ['LP', 'LR', 'LM', 'LI', 'LI', 'RI', 'RI', 'RM', 'RR', 'RP', 'RP', 'RP'];
const HOME_FINGERS = ['LP', 'LR', 'LM', 'LI', 'LI', 'RI', 'RI', 'RM', 'RR', 'RP', 'RP', 'RP'];
const BOTTOM_FINGERS = ['LP', 'LR', 'LM', 'LI', 'LI', 'RI', 'RI', 'RM', 'RR', 'RP'];

/**
 * Base legends per row. `iso` adds the key beside the left Shift (`isoKey`) and the key
 * beside Enter on the home row (`hash`). `bottomFingers` overrides the bottom row's fingers.
 */
const CHARTS = {
  qwerty: { num: '`1234567890-=', top: 'qwertyuiop[]', home: "asdfghjkl;'", bottom: 'zxcvbnm,./' },
  azerty: { num: ['²', '&', 'é', '"', "'", '(', '-', 'è', '_', 'ç', 'à', ')', '='], top: 'azertyuiop^$', home: 'qsdfghjklmù', hash: '*', isoKey: '<', bottom: 'wxcvbn,;:!' },
  qwertz: { num: '^1234567890ß´', top: 'qwertzuiopü+', home: 'asdfghjklöä', hash: '#', isoKey: '<', bottom: 'yxcvbnm,.-' },
  dvorak: { num: '`1234567890[]', top: "',.pyfgcrl/=", home: 'aoeuidhtns-', bottom: ';qjkxbmwvz' },
  colemak: { num: '`1234567890-=', top: 'qwfpgjluy;[]', home: "arstdhneio'", bottom: 'zxcvbkm,./' },
  'colemak-dh': { num: '`1234567890-=', top: 'qwfpbjluy;[]', home: "arstgmneio'", bottom: 'xcdvzkh,./', bottomFingers: ['LR', 'LM', 'LI', 'LI', 'LI', 'RI', 'RI', 'RM', 'RR', 'RP'] },
  workman: { num: '`1234567890-=', top: 'qdrwbjfup;[]', home: "ashtgyneoi'", bottom: 'zxmcvkl,./' },
};

const chars = (v) => (Array.isArray(v) ? v : [...v]);

function keyRect(x, y, w, fill, { stroke = '', legend = '', ink = INK, size = 17, bump = false, weight = 600 } = {}) {
  const px = x * U + GAP / 2;
  const py = y * U + GAP / 2;
  const pw = w * U - GAP;
  const ph = U - GAP;
  const s = stroke ? ` stroke="${stroke}" stroke-width="1.5"` : '';
  let out = `<rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="${R}" fill="${fill}"${s}/>`;
  if (legend) out += `<text x="${px + pw / 2}" y="${py + ph / 2 + size * 0.36}" text-anchor="middle" font-size="${size}" font-weight="${weight}" fill="${ink}">${esc(legend)}</text>`;
  if (bump) out += `<rect x="${px + pw / 2 - 6}" y="${py + ph - 8}" width="12" height="2.5" rx="1.25" fill="${ink}" opacity="0.55"/>`;
  return out;
}

/** A keyboard whose letter keys carry their finger's color, row shade included, with a legend of finger names. */
export function fingerChart(layoutId, fingerNames, label) {
  const c = CHARTS[layoutId];
  const iso = Boolean(c.isoKey);
  const parts = [];
  const shadeOf = (finger, row) => SHADE[FINGER_HUE[finger]][row];

  // Number row: 13 keys, then Backspace.
  chars(c.num).forEach((ch, i) => parts.push(keyRect(i, 0, 1, shadeOf(NUM_FINGERS[i], 'top'), { legend: ch })));
  parts.push(keyRect(13, 0, 2, SLATE));
  // Top row: Tab, 12 keys, then the backslash key (ANSI) or the top of Enter (ISO).
  parts.push(keyRect(0, 1, 1.5, SLATE));
  chars(c.top).forEach((ch, i) => parts.push(keyRect(1.5 + i, 1, 1, shadeOf(TOP_FINGERS[i], 'top'), { legend: ch })));
  // Home row: Caps, 11 keys (+ the ISO key beside Enter), then Enter.
  parts.push(keyRect(0, 2, 1.75, SLATE));
  const home = chars(c.home);
  if (c.hash) home.push(c.hash);
  home.forEach((ch, i) => parts.push(keyRect(1.75 + i, 2, 1, shadeOf(HOME_FINGERS[i], 'home'), { legend: ch, bump: i === 3 || i === 6 })));
  if (iso) {
    // ISO Enter: an L over two rows.
    const x = 13.5 * U + GAP / 2;
    const y1 = 1 * U + GAP / 2;
    const xr = 15 * U - GAP / 2;
    const xl2 = 13.75 * U + GAP / 2;
    const y2 = 3 * U - GAP / 2;
    const ym = 2 * U + GAP / 2;
    parts.push(`<path d="M${x + R} ${y1}H${xr - R}Q${xr} ${y1} ${xr} ${y1 + R}V${y2 - R}Q${xr} ${y2} ${xr - R} ${y2}H${xl2 + R}Q${xl2} ${y2} ${xl2} ${y2 - R}V${ym}H${x + R}Q${x} ${ym} ${x} ${ym - R}V${y1 + R}Q${x} ${y1} ${x + R} ${y1}Z" fill="${SLATE}"/>`);
  } else {
    parts.push(keyRect(13.5, 1, 1.5, SLATE));
    parts.push(keyRect(12.75, 2, 2.25, SLATE));
  }
  // Bottom row: Shift, (ISO key), 10 keys, right Shift.
  const fingers = c.bottomFingers ?? BOTTOM_FINGERS;
  let x = 0;
  if (iso) {
    parts.push(keyRect(0, 3, 1.25, SLATE));
    parts.push(keyRect(1.25, 3, 1, shadeOf('LP', 'bottom'), { legend: c.isoKey }));
    x = 2.25;
  } else {
    parts.push(keyRect(0, 3, 2.25, SLATE));
    x = 2.25;
  }
  chars(c.bottom).forEach((ch, i) => parts.push(keyRect(x + i, 3, 1, shadeOf(fingers[i], 'bottom'), { legend: ch })));
  parts.push(keyRect(x + 10, 3, 15 - x - 10, SLATE));
  // Space bar row.
  parts.push(keyRect(0, 4, 1.25, SLATE), keyRect(1.25, 4, 1.25, SLATE), keyRect(2.5, 4, 1.25, SLATE));
  parts.push(keyRect(3.75, 4, 6.25, THUMB));
  parts.push(keyRect(10, 4, 1.25, SLATE), keyRect(11.25, 4, 1.25, SLATE), keyRect(12.5, 4, 1.25, SLATE), keyRect(13.75, 4, 1.25, SLATE));

  // Legend: one swatch per finger, named, so color is never the only cue.
  const entries = [
    ['pinky', SHADE.pinky.home],
    ['ring', SHADE.ring.home],
    ['middle', SHADE.middle.home],
    ['index', SHADE.index.home],
    ['thumb', THUMB],
  ];
  const legend = `<div class="chart-legend">${entries
    .map(([k, color]) => `<span class="chart-swatch"><i style="background:${color}"></i>${esc(fingerNames[k])}</span>`)
    .join('')}</div>`;

  const svg = `<svg class="chart-board" viewBox="0 0 ${15 * U} ${5 * U}" role="img" aria-label="${esc(label)}" font-family="'Allo', system-ui, sans-serif">${parts.join('')}</svg>`;
  return svg + legend;
}

/** ANSI, ISO and JIS boards, one under the other, with the keys that tell them apart outlined. */
export function boardShapes() {
  const boards = [
    {
      name: 'ANSI',
      rows: [
        [[1, 13], [2, 'diff']],
        [[1.5], [1, 12], [1.5, 'diff']],
        [[1.75], [1, 11], [2.25, 'diff']],
        [[2.25, 'diff'], [1, 10], [2.75]],
        [[1.25], [1.25], [1.25], [6.25, 'space'], [1.25], [1.25], [1.25], [1.25]],
      ],
      isoEnter: false,
    },
    {
      name: 'ISO',
      rows: [
        [[1, 13], [2]],
        [[1.5], [1, 12]],
        [[1.75], [1, 11], [1, 'diff']],
        [[1.25, 'diff'], [1, 'diff'], [1, 10], [2.75]],
        [[1.25], [1.25], [1.25], [6.25, 'space'], [1.25], [1.25], [1.25], [1.25]],
      ],
      isoEnter: true,
    },
    {
      name: 'JIS',
      rows: [
        [[1, 13], [1, 'diff'], [1, 'diff']],
        [[1.5], [1, 12]],
        [[1.75], [1, 11], [1, 'diff']],
        [[2.25], [1, 10], [1, 'diff'], [1.75]],
        [[1.25], [1.25], [1.25], [1.25, 'diff'], [5, 'space'], [1.25, 'diff'], [1.25, 'diff'], [1.25], [1.25]],
      ],
      isoEnter: true,
    },
  ];
  const H = 5 * U;
  const block = (b) => {
    const parts = [];
    b.rows.forEach((row, y) => {
      let x = 0;
      for (const [w, kind] of row) {
        const count = typeof kind === 'number' ? kind : 1;
        for (let i = 0; i < count; i++) {
          const fill = kind === 'space' ? THUMB : kind === 'diff' ? SLATE_LIT : SLATE;
          parts.push(keyRect(x, y, w, fill, { stroke: kind === 'diff' ? TEXT : '' }));
          x += w;
        }
      }
    });
    if (b.isoEnter) {
      const x = 13.5 * U + GAP / 2;
      const y1 = 1 * U + GAP / 2;
      const xr = 15 * U - GAP / 2;
      const xl2 = 13.75 * U + GAP / 2;
      const y2 = 3 * U - GAP / 2;
      const ym = 2 * U + GAP / 2;
      parts.push(`<path d="M${x + R} ${y1}H${xr - R}Q${xr} ${y1} ${xr} ${y1 + R}V${y2 - R}Q${xr} ${y2} ${xr - R} ${y2}H${xl2 + R}Q${xl2} ${y2} ${xl2} ${y2 - R}V${ym}H${x + R}Q${x} ${ym} ${x} ${ym - R}V${y1 + R}Q${x} ${y1} ${x + R} ${y1}Z" fill="${SLATE_LIT}" stroke="${TEXT}" stroke-width="1.5"/>`);
    }
    return `<div class="board-shape"><p class="board-name">${b.name}</p><svg viewBox="0 0 ${15 * U} ${H}" role="img" aria-label="${b.name}">${parts.join('')}</svg></div>`;
  };
  return `<div class="board-shapes">${boards.map(block).join('')}</div>`;
}


// Three board shapes carrying the same QWERTY letters, colored by finger as in the trainer:
// row stagger (ANSI), an ortholinear grid (Preonic-style 12 x 5) and a split column-staggered
// board with thumb keys (Corne-style 3 x 6 + 3). B, N, Y and Z are ringed: the keys the
// stagger guide's table follows from one shape to the next. Column offsets on the split board
// are an example; every columnar board sets its own.

const MARKED = new Set(['b', 'n', 'y', 'z']);
const ROW_SHADE = ['top', 'top', 'home', 'bottom']; // number row, top, home, bottom
const LETTERS = ['1234567890', 'qwertyuiop', 'asdfghjkl;', 'zxcvbnm,./'];
const COL_FINGERS = ['LP', 'LR', 'LM', 'LI', 'LI', 'RI', 'RI', 'RM', 'RR', 'RP'];
/** Vertical offset of each column of the left half, outer column first, in key units. */
const COLUMN_OFFSETS = [0.45, 0.45, 0.15, 0, 0.15, 0.3];

function ring(x, y, w) {
  const px = x * U + 0.5;
  const py = y * U + 0.5;
  return `<rect x="${px}" y="${py}" width="${w * U - 1}" height="${U - 1}" rx="${R + 2}" fill="none" stroke="${TEXT}" stroke-width="1.75"/>`;
}

/** A letter key: `col` = letter column 0-9, `row` = 0 number, 1 top, 2 home, 3 bottom. */
function letterKey(x, y, col, row, ch) {
  const fill = SHADE[FINGER_HUE[COL_FINGERS[col]]][ROW_SHADE[row]];
  const key = keyRect(x, y, 1, fill, { legend: ch, bump: ch === 'f' || ch === 'j' });
  return MARKED.has(ch) ? key + ring(x, y, 1) : key;
}

function rowStagger() {
  const p = [];
  p.push(keyRect(0, 0, 1, SLATE));
  [...LETTERS[0]].forEach((ch, i) => p.push(letterKey(1 + i, 0, i, 0, ch)));
  p.push(keyRect(11, 0, 1, SLATE), keyRect(12, 0, 1, SLATE), keyRect(13, 0, 2, SLATE));
  p.push(keyRect(0, 1, 1.5, SLATE));
  [...LETTERS[1]].forEach((ch, i) => p.push(letterKey(1.5 + i, 1, i, 1, ch)));
  p.push(keyRect(11.5, 1, 1, SLATE), keyRect(12.5, 1, 1, SLATE), keyRect(13.5, 1, 1.5, SLATE));
  p.push(keyRect(0, 2, 1.75, SLATE));
  [...LETTERS[2]].forEach((ch, i) => p.push(letterKey(1.75 + i, 2, i, 2, ch)));
  p.push(keyRect(11.75, 2, 1, SLATE), keyRect(12.75, 2, 2.25, SLATE));
  p.push(keyRect(0, 3, 2.25, SLATE));
  [...LETTERS[3]].forEach((ch, i) => p.push(letterKey(2.25 + i, 3, i, 3, ch)));
  p.push(keyRect(12.25, 3, 2.75, SLATE));
  p.push(keyRect(0, 4, 1.25, SLATE), keyRect(1.25, 4, 1.25, SLATE), keyRect(2.5, 4, 1.25, SLATE));
  p.push(keyRect(3.75, 4, 6.25, THUMB));
  p.push(keyRect(10, 4, 1.25, SLATE), keyRect(11.25, 4, 1.25, SLATE), keyRect(12.5, 4, 1.25, SLATE), keyRect(13.75, 4, 1.25, SLATE));
  return { h: 5, svg: p.join('') };
}

function orthoGrid() {
  const p = [];
  for (let row = 0; row < 4; row++) {
    p.push(keyRect(0, row, 1, SLATE));
    [...LETTERS[row]].forEach((ch, i) => p.push(letterKey(1 + i, row, i, row, ch)));
    p.push(keyRect(11, row, 1, SLATE));
  }
  // Bottom row: four modifiers, Lower, a 2u space bar, Raise, four arrows. The thumbs take Lower, Space and Raise.
  [0, 1, 2, 3].forEach((x) => p.push(keyRect(x, 4, 1, SLATE)));
  p.push(keyRect(4, 4, 1, THUMB), keyRect(5, 4, 2, THUMB), keyRect(7, 4, 1, THUMB));
  [8, 9, 10, 11].forEach((x) => p.push(keyRect(x, 4, 1, SLATE)));
  return { h: 5, svg: p.join('') };
}

function columnSplit() {
  const p = [];
  const RIGHT = 7.5; // left edge of the right half
  for (let row = 1; row <= 3; row++) {
    const y = row - 1;
    // Left half: outer column, then letter columns 0-4.
    p.push(keyRect(0, y + COLUMN_OFFSETS[0], 1, SLATE));
    for (let c = 1; c <= 5; c++) p.push(letterKey(c, y + COLUMN_OFFSETS[c], c - 1, row, LETTERS[row][c - 1]));
    // Right half: letter columns 5-9, then the outer column, offsets mirrored.
    for (let j = 0; j < 5; j++) p.push(letterKey(RIGHT + j, y + COLUMN_OFFSETS[5 - j], 5 + j, row, LETTERS[row][5 + j]));
    p.push(keyRect(RIGHT + 5, y + COLUMN_OFFSETS[0], 1, SLATE));
  }
  // Thumb keys, three per half, stepping down toward the middle.
  const thumbs = [[3.5, 3.45], [4.5, 3.55], [5.5, 3.7]];
  for (const [x, y] of thumbs) {
    p.push(keyRect(x, y, 1, THUMB));
    p.push(keyRect(RIGHT + 6 - (x + 1), y, 1, THUMB));
  }
  return { h: 4.75, svg: p.join('') };
}

/** Default block names; the builder passes the page language's names. */
export const STAGGER_NAMES = {
  en: { row: 'Row stagger (ANSI)', ortho: 'Ortholinear grid', column: 'Column stagger, split, with thumb keys' },
  fr: { row: 'Décalage en rangées (ANSI)', ortho: 'Grille ortholinéaire', column: 'Décalage en colonnes, split, avec touches de pouce' },
};

/** The three board shapes one under the other, letters colored by finger, with a finger legend. */
export function staggerShapes(names, fingerNames) {
  const blocks = [
    [names.row, rowStagger()],
    [names.ortho, orthoGrid()],
    [names.column, columnSplit()],
  ];
  const html = blocks
    .map(([name, b]) => `<div class="board-shape"><p class="board-name">${esc(name)}</p><svg viewBox="0 0 ${15 * U} ${b.h * U}" role="img" aria-label="${esc(name)}" font-family="'Allo', system-ui, sans-serif">${b.svg}</svg></div>`)
    .join('');
  const entries = [
    ['pinky', SHADE.pinky.home],
    ['ring', SHADE.ring.home],
    ['middle', SHADE.middle.home],
    ['index', SHADE.index.home],
    ['thumb', THUMB],
  ];
  const legend = `<div class="chart-legend">${entries
    .map(([k, color]) => `<span class="chart-swatch"><i style="background:${color}"></i>${esc(fingerNames[k])}</span>`)
    .join('')}</div>`;
  return `<div class="board-shapes">${html}</div>${legend}`;
}

export const CHART_IDS = Object.keys(CHARTS);
