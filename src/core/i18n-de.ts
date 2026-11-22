import type { Finger, FingerKind } from './fingers';
import { fingerHand, fingerKind } from './fingers';
import type { Strings } from './i18n';
import type { Row } from './physical';

/**
 * Every string the interface shows, in German. Same keys as the English and the
 * French in `i18n.ts`. Short labels are lowercase, nouns included; full sentences
 * keep German capitalization. The typist is addressed with du.
 */

type Side = 'left' | 'right';

const DE_KINDS: Record<FingerKind, string> = {
  pinky: 'kleiner finger',
  ring: 'ringfinger',
  middle: 'mittelfinger',
  index: 'zeigefinger',
  thumb: 'daumen',
};
/** Where the finger goes, short enough to follow a finger's name on one line. */
const DE_ROWS: Record<Row, string> = { number: 'ziffern', top: 'oben', home: 'grundreihe', bottom: 'unten', thumb: 'leertaste' };
/** Every finger is masculine (der Finger, der Daumen), so the side takes the strong masculine ending. */
const deFinger = (finger: Finger): string => `${fingerHand(finger) === 'left' ? 'linker' : 'rechter'} ${DE_KINDS[fingerKind(finger)]}`;
const deShort = (finger: Finger): string => `${DE_KINDS[fingerKind(finger)]} ${fingerHand(finger) === 'left' ? 'l.' : 'r.'}`;
const deSide = (side: Side): string => (side === 'left' ? 'links' : 'rechts');
/** The Shift key as the object of a sentence: die linke Shift-Taste. */
const deShift = (side: Side): string => `${side === 'left' ? 'linke' : 'rechte'} shift-taste`;

export const de: Strings = {
  none: 'k. a.',
  drills: { highway: 'autobahn', words: 'wörter', pairs: 'paare', anchors: 'anker', stats: 'statistik' },
  layouts: {
    'ca-fr': 'kanadisch-französisch',
    us: 'us-qwerty',
    azerty: 'französisch azerty',
    qwertz: 'deutsch qwertz',
    'qwertz-ch': 'schweizerdeutsch',
    es: 'spanisch',
    latam: 'lateinamerikanisch',
    dvorak: 'dvorak',
    colemak: 'colemak',
    'colemak-dh': 'colemak-dh',
    workman: 'workman',
  },
  layoutNotes: {
    azerty: 'ziffern tippst du mit shift',
    'colemak-dh': 'die untere reihe links folgt dem schrägen fingersatz',
    'colemak-dh|iso': 'das z liegt auf der taste neben der linken shift-taste',
  },
  languages: { fr: 'französisch', en: 'englisch', de: 'deutsch', es: 'spanisch' },
  kinds: DE_KINDS,
  finger: deFinger,
  fingerShort: deShort,
  keyCaps: { bksp: 'rück', tab: 'tab', caps: 'feststell', enter: 'enter', shift: 'shift', ctrl: 'strg', alt: 'alt', space: 'leertaste' },
  months: ['jan', 'feb', 'mär', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dez'],
  day: (month, date) => `${date}. ${month}`,

  top: {
    drills: 'übungen',
    tracking: 'speichern',
    trackingOn: 'runden und werte pro taste werden gespeichert',
    trackingOff: 'solange das aus ist, wird nichts gespeichert',
    layout: 'tastaturbelegung',
    guides: 'ratgeber',
  },

  touch: {
    type: 'tippen zum schreiben',
    field: 'hier tippen',
    close: 'schließen',
    hide: 'tastatur ausblenden',
  },

  menu: {
    button: 'einstellungen',
    region: 'einstellungen',
    profile: 'profil',
    layout: 'belegung',
    board: 'format',
    boards: { ansi: 'ansi', iso: 'iso', jis: 'jis' },
    boardNotes: {
      ansi: 'shift links breit, enter flach',
      iso: 'enter hoch, eine taste mehr neben shift links',
      jis: 'enter hoch, rücktaste kurz, tasten rund um die leertaste',
    },
    boardFound: (board) => `${board}-tastatur erkannt: die tastatur am bildschirm passt jetzt dazu`,
    interface: 'oberfläche',
    focus: 'finger',
    focusGroup: 'finger, die mehr üben',
    focusNote: 'die leuchtenden finger tippen mehr',
    focusNone: 'keiner leuchtet: alle finger tippen gleich viel',
    focusAnchors: 'eine runde pro leuchtendem finger',
    focusOn: (finger) => `${finger}: übt mehr`,
    focusOff: (finger) => `${finger}: wie gewohnt`,
  },

  rail: {
    region: 'tempo und genauigkeit',
    wpm: 'wörter pro minute, gleitender schnitt',
    window: 'zeitfenster des schnitts ändern',
    spark: 'wörter pro minute in der letzten minute',
    caption: (seconds) => `wpm · letzte ${seconds} s`,
    accuracy: 'genauigkeit',
    streak: 'serie',
    fingers: 'finger',
    bar: (kind, wpm) => (wpm === null ? `${DE_KINDS[kind]}: noch nicht gemessen` : `${DE_KINDS[kind]}: ${wpm} wpm`),
    hot: 'schneller als sein eigener schnitt in dieser runde',
    untracked: 'speichern ist aus: nichts, was du tippst, bleibt erhalten',
  },

  streak: {
    title: 'richtige tasten in folge, von runde zu runde, über deinem rekord auf dieser belegung und in dieser übung',
    inRow: 'in folge',
    newBest: 'neuer rekord',
    best: (count) => `rekord ${count}`,
    passed: 'rekord',
  },

  next: {
    region: 'welcher finger',
    title: 'nächste taste',
    space: 'daumen, leertaste',
    finger: (finger, row) => `${deFinger(finger)}, ${DE_ROWS[row]}`,
    plusShift: (side) => `+ shift ${deSide(side)}`,
    hold: (keys) => `halte ${keys}`,
    useShift: (side) => `nimm dafür die ${deShift(side)}`,
  },

  result: {
    forSet: 'wpm in dieser runde',
    accuracy: 'genauigkeit',
    bestStreak: 'beste serie',
    time: 'tippzeit',
    slowest: 'langsamster finger',
    slowestValue: (finger, wpm) => `${deFinger(finger)}, ${wpm} wpm`,
    weakPairs: 'paare zum üben',
    unsaved: 'nicht gespeichert: speichern ist aus',
    enter: 'enter',
    nextSet: 'nächste runde',
    newBest: 'neuer rekord',
    clean: 'fehlerfrei',
    over: (wpm) => `${wpm} wpm über deinen letzten zehn`,
    under: (wpm) => `${wpm} wpm unter deinen letzten zehn`,
    level: 'gleichauf mit deinen letzten zehn',
    gain: 'größter fortschritt',
    gainValue: (finger, wpm, gain) => `${deFinger(finger)}, ${wpm} wpm, ${gain} über seinem schnitt`,
    days: (count) => `${count} ${count === 1 ? 'tag' : 'tage'} in folge`,
  },

  options: {
    region: 'übung',
    language: 'sprache',
    esc: 'esc',
    newText: 'neuer text',
    arrows: 'auf / ab',
    tempo: 'tempo',
    noAccents: 'wörter mit buchstaben, für die diese belegung keine taste hat, fallen weg',
    keys: 'tasten',
    keySound: 'tastenklang',
    keySoundOff: 'stumm',
    keySoundTitle: 'wie jede taste klingt: aufnahmen echter schalter',
  },

  hardcore: {
    label: 'hardcore',
    floor: 'min. wpm',
    noFloor: 'aus',
    floorTitle: (floor, step, seconds) =>
      `bleib bei ${floor} wpm oder mehr, sonst scheitert die runde${step > 0 ? `. es steigt um ${step} wpm alle ${seconds} s, die du hältst` : ''}`,
    difficulty: 'stufe',
    difficultyNotes: {
      1: 'nur die lunte: unter min. wpm brennt sie ab und wächst ganz nach',
      2: 'fehler brennen an der lunte, brände hinterlassen narben und min. wpm steigt',
      3: 'die regeln von 2 in doppelter stärke, mit einer schnelleren lunte',
    },
    sound: 'herzschlag',
    soundTitle: 'der herzschlag, das klopfen bei einer falschen taste, das ticken, wenn min. wpm steigt, und der absturz bei einer gescheiterten runde',
    erase: (count) => (count === 1 ? 'lösch den fehler' : `lösch ${count} fehler`),
    ctrlBksp: 'strg rück',
    eraseAll: 'lösch alles',
    failed: (floor) => `runde gescheitert: zu lange unter ${floor} wpm`,
    failedTypos: 'runde gescheitert: die fehler haben die lunte abgebrannt',
    lasted: 'gehalten',
    notSaved: 'eine gescheiterte runde kommt nicht in deinen verlauf',
    held: (floor) => `${floor} wpm, gehalten`,
    climbed: (floor) => `min. wpm liegt jetzt bei ${floor}`,
    runHeld: 'gehalten',
    runSets: 'runden',
    runTitle: 'gehaltene zeit und geschaffte runden in folge bei diesem min. wpm, jeweils über deinem rekord',
    best: 'rekord',
    run: 'lauf',
    runOver: 'lauf vorbei',
    bestRun: 'bester lauf',
    // German takes the plural for zero too.
    runValue: (sets, time) => `${sets} ${sets === 1 ? 'runde' : 'runden'}, ${time}`,
    runEnded: (value) => `lauf vorbei: ${value}`,
    newBest: 'neuer rekord',
  },

  highway: {
    text: 'text',
    words: 'wörter',
    pairs: 'paare',
    sentences: 'sätze',
    tempo: 'tempo',
    follows: 'folgt dir',
    locked: (wpm) => `bei ${wpm} wpm`,
    tempoNow: (wpm) => `tempo ${wpm} wpm`,
    early: 'zu früh: warte auf die linie',
  },

  line: {
    groups: 'gruppen',
    pairs: 'paare',
    triples: 'tripel',
    training: 'training',
    adaptive: 'adaptiv',
    classic: 'klassisch',
    adaptiveNote: 'setzt auf die paare, die du am langsamsten tippst oder am öftesten verfehlst, und zieht weiter, sobald sie schneller werden',
    classicNote: 'die häufigsten buchstabengruppen der sprache, nur nach ihrer häufigkeit',
    text: 'text',
    sentences: 'sätze',
    words: 'wörter',
    capitals: 'groß/klein',
    off: 'aus',
    on: 'an',
  },

  anchors: {
    held: 'Halte die anderen Finger dieser Hand auf ihren Grundtasten gedrückt. Nur dieser Finger kommt an die Noten.',
    free: 'Ohne Anker: Tippe die Noten mit diesem Finger und lass die Hand auf der Grundreihe.',
    hold: 'halte',
    lifted: (keys) =>
      `anker losgelassen: halte ${keys} gedrückt. Wenn deine Tastatur nicht so viele Tasten auf einmal erkennt, drück Esc und stell „anker“ in den Einstellungen niedriger.`,
    anchors: 'anker',
    off: 'keine',
  },

  keyboard: {
    space: 'leertaste',
    key: (legend) => `taste ${legend}`,
  },

  profile: {
    button: 'profil',
    menu: 'profile',
    title: (name) => `profil: ${name}`,
    switch: 'profil wechseln',
    add: 'neues profil',
    rename: (name) => `${name} umbenennen`,
    remove: (name) => `${name} löschen`,
    ask: (name) => `${name} und alle gespeicherten werte löschen?`,
    keep: 'behalten',
    confirm: 'löschen',
    placeholder: 'name',
    newName: 'name des neuen profils',
    renameTo: (name) => `neuer name für ${name}`,
    starts: 'startet mit den aktuellen optionen und ohne werte',
    submitAdd: 'anlegen',
    submitRename: 'speichern',
    problems: { empty: 'gib zuerst einen namen ein', taken: 'den namen gibt es schon: nimm einen anderen' },
  },

  stats: {
    chart: 'diagramm',
    speed: 'tempo',
    accuracy: 'genauigkeit',
    range: 'zeitraum',
    recent: (sets) => `${sets} runden`,
    all: 'alle',
    saved: 'daten',
    keep: 'behalten',
    erase: 'löschen',
    eraseAll: (profile) => `alles von ${profile} löschen`,
    allKeys: 'alle tasten',
    spaceBar: 'leertaste, daumen',
    key: (legend, finger) => `taste ${legend}, ${deShort(finger)}`,
    wpm: 'wpm',
    value: (wpm) => `${wpm} wpm`,
    untracked: ' Speichern ist aus, also bleibt nichts erhalten.',
    empty: (layout, profile) =>
      `Auf ${layout} ist für ${profile} noch nichts gemessen. Schließ eine Runde in irgendeiner Übung ab, dann erscheinen hier die Werte pro Finger.`,
    tooFew: (metric) => `${metric}, noch zu wenige runden`,
    window: (metric, sets) => (sets === 1 ? `${metric}, letzte runde` : `${metric}, letzte ${sets} runden`),
    hint: 'wähl unten einen finger oder eine taste',
    back: 'zurück zu allen tasten',
    chartLabel: (metric, subject) => `${metric} von ${subject} über die gespeicherten runden`,
    noSets: 'Noch keine abgeschlossene Runde auf dieser Belegung. Das Diagramm beginnt mit der ersten.',
    noHistory: (subject) => `Noch kein Verlauf für ${subject}. Der Verlauf pro Finger und Taste beginnt mit der nächsten Runde, die du abschließt.`,
    byFinger: 'pro finger',
    slowKeys: 'langsamste tasten',
    slowPairs: 'schwächste paare',
    heads: { finger: 'finger', acc: 'gen.', trend: 'trend', keys: 'anschläge', key: 'taste', pair: 'paar', ms: 'ms', seen: 'anzahl' },
    footPick: 'Wähl einen Finger oder eine Taste, in diesen Listen oder auf der Tastatur, um den Verlauf zu sehen.',
    footTrend: (speed) => `Der Trend vergleicht die letzten zehn Runden mit den zehn davor, in ${speed ? 'wpm' : 'Prozentpunkten Genauigkeit'}. `,
    footHeat: 'Auf der Tastatur heißt eine kräftigere Farbe, dass die Taste mehr Übung braucht.',
    footShift: (share, capitals) => ` Shift mit der anderen Hand: ${share} von ${capitals} Großbuchstaben.`,
    sets: (sets) => `${sets} ${sets === 1 ? 'runde' : 'runden'}`,
    nothing: 'nichts getippt',
    lastTen: (value) => `letzte zehn: ${value}`,
    caption: (speed, grouped) =>
      `${speed ? 'balken' : 'punkte'}: jede runde${grouped ? ', ältere pro tag' : ''}. linie: schnitt der letzten zehn.`,
  },
};
