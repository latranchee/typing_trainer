import type { Finger, FingerKind } from './fingers';
import { fingerHand, fingerKind } from './fingers';
import type { Difficulty } from './hardcore';
import { de } from './i18n-de';
import { es } from './i18n-es';
import type { LayoutId } from './layouts';
import type { Board, Row } from './physical';
import type { DrillId, Lang } from './store';

/**
 * Every string the interface shows: English and French here, German and Spanish in
 * `i18n-de.ts` and `i18n-es.ts`. The interface language is one setting; the language
 * of the practice text is another.
 * Short labels are lowercase; full sentences keep their capital.
 */

type Side = 'left' | 'right';

const en = {
  none: 'n/a',
  drills: { highway: 'highway', words: 'words', pairs: 'pairs', anchors: 'anchors', stats: 'stats' } satisfies Record<DrillId, string>,
  layouts: {
    'ca-fr': 'canadian french',
    us: 'us qwerty',
    azerty: 'french azerty',
    qwertz: 'german qwertz',
    'qwertz-ch': 'swiss german',
    es: 'spanish',
    latam: 'latin american',
    dvorak: 'dvorak',
    colemak: 'colemak',
    'colemak-dh': 'colemak-dh',
    workman: 'workman',
  } satisfies Record<LayoutId, string>,
  /** What a layout changes, said plainly in the settings. A note for one board (`layout|board`) comes before the layout's own. */
  layoutNotes: {
    azerty: 'digits are typed with shift',
    'colemak-dh': 'left bottom row uses the angle fingering',
    'colemak-dh|iso': 'z is on the key beside the left shift',
  } as Partial<Record<LayoutId | `${LayoutId}|${Board}`, string>>,
  /** The practice-text languages. */
  languages: { fr: 'french', en: 'english', de: 'german', es: 'spanish' } satisfies Record<Lang, string>,
  kinds: { pinky: 'pinky', ring: 'ring', middle: 'middle', index: 'index', thumb: 'thumb' } satisfies Record<FingerKind, string>,
  finger: (finger: Finger): string => `${fingerHand(finger)} ${fingerKind(finger)}`,
  /** A finger's name where room is short: segmented choices and table rows. */
  fingerShort: (finger: Finger): string => `${fingerHand(finger)} ${fingerKind(finger)}`,
  /** Legends of the keys that carry no layout character. */
  keyCaps: { bksp: 'bksp', tab: 'tab', caps: 'caps', enter: 'enter', shift: 'shift', ctrl: 'ctrl', alt: 'alt', space: 'space' } as Record<string, string>,
  months: ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'],
  day: (month: string, date: number): string => `${month} ${date}`,

  top: {
    drills: 'drills',
    tracking: 'tracking',
    trackingOn: 'sets and key numbers are saved',
    trackingOff: 'nothing is saved while this is off',
    layout: 'keyboard layout',
    /** The link to the written guides, in the top strip. */
    guides: 'guides',
  },

  /** On a phone: the on-screen keyboard types, and these say how to bring it up. */
  touch: {
    type: 'tap to type',
    field: 'type here',
    close: 'close',
  },

  /** The settings panel: one list for the drill's options, the fingers to train, the sound, the keyboard and the profile. */
  menu: {
    button: 'settings',
    region: 'settings',
    profile: 'profile',
    layout: 'layout',
    board: 'board',
    boards: { ansi: 'ansi', iso: 'iso', jis: 'jis' } satisfies Record<Board, string>,
    /** What tells one board from another: shown under the choice and on each button. */
    boardNotes: {
      ansi: 'wide left shift, flat enter',
      iso: 'tall enter, one more key beside the left shift',
      jis: 'tall enter, short backspace, keys around the space bar',
    } satisfies Record<Board, string>,
    boardFound: (board: string): string => `${board} keyboard detected: the board on screen now matches it`,
    interface: 'interface',
    focus: 'fingers',
    focusGroup: 'fingers to train more',
    focusNote: 'the lit fingers type more',
    focusNone: 'none lit: every finger types alike',
    focusAnchors: 'one set for each lit finger',
    focusOn: (finger: string): string => `${finger}: trained more`,
    focusOff: (finger: string): string => `${finger}: as usual`,
  },

  rail: {
    region: 'speed and accuracy',
    wpm: 'rolling words per minute',
    window: 'change the rolling window',
    spark: 'rolling words per minute over the last minute',
    caption: (seconds: number): string => `wpm · rolling ${seconds} s`,
    accuracy: 'acc',
    streak: 'streak',
    fingers: 'fingers',
    bar: (kind: FingerKind, wpm: number | null): string => (wpm === null ? `${kind}: not measured yet` : `${kind}: ${wpm} wpm`),
    /** Added to a bar's line while the bar glows. */
    hot: 'ahead of its own average in this set',
    untracked: 'tracking is off: nothing you type is saved',
  },

  /** Right keys in a row: the counter over the keyboard and the line under the streak in the left rail. */
  streak: {
    title: 'right keys in a row, from one set to the next, over your longest on this layout and drill',
    inRow: 'in a row',
    newBest: 'new best',
    best: (count: number): string => `best ${count}`,
    passed: 'best',
  },

  next: {
    region: 'finger to use',
    title: 'next key',
    space: 'thumb, space',
    finger: (finger: Finger, row: Row): string => `${fingerHand(finger)} ${fingerKind(finger)}, ${row} row`,
    plusShift: (side: Side): string => `+ ${side} shift`,
    hold: (keys: string): string => `hold ${keys}`,
    useShift: (side: Side): string => `use the ${side} shift for that key`,
  },

  result: {
    forSet: 'wpm for this set',
    accuracy: 'accuracy',
    bestStreak: 'best streak',
    time: 'typing time',
    slowest: 'slowest finger',
    slowestValue: (finger: Finger, wpm: number): string => `${fingerHand(finger)} ${fingerKind(finger)}, ${wpm} wpm`,
    /** After a set of letter groups: the three transitions that need the most work. */
    weakPairs: 'pairs to work on',
    unsaved: 'not saved: tracking is off',
    enter: 'enter',
    nextSet: 'next set',
    /** Marks beside a number of the result that beat what was saved before. */
    newBest: 'new best',
    clean: 'clean set',
    /** The set against the pace of the last ten sets of the same kind. */
    over: (wpm: number): string => `${wpm} wpm over your last ten`,
    under: (wpm: number): string => `${wpm} wpm under your last ten`,
    level: 'level with your last ten',
    gain: 'biggest gain',
    gainValue: (finger: Finger, wpm: number, gain: number): string =>
      `${fingerHand(finger)} ${fingerKind(finger)}, ${wpm} wpm, ${gain} over its average`,
    days: (count: number): string => `${count} days in a row`,
  },

  options: {
    region: 'drill',
    language: 'language',
    esc: 'esc',
    newText: 'new text',
    arrows: 'up / down',
    tempo: 'tempo',
    noAccents: 'words with letters this layout has no key for are left out',
    /** The sound of the keys. Its list names switches, so the label beside it only has to say what they are for. */
    keys: 'keys',
    keySound: 'key sound',
    keySoundOff: 'silent',
    keySoundTitle: 'what each key sounds like: recordings of real switches',
  },

  hardcore: {
    label: 'hardcore',
    floor: 'min wpm',
    noFloor: 'none',
    /** `step` is 0 at a difficulty whose floor stays put. */
    floorTitle: (floor: number, step: number, seconds: number): string =>
      `stay at ${floor} wpm or more, or the set fails${step > 0 ? `. it climbs ${step} wpm for every ${seconds} s you hold` : ''}`,
    difficulty: 'difficulty',
    /** What each difficulty asks, shown on its button. */
    difficultyNotes: {
      1: 'the fuse alone: it burns under min wpm and grows back whole',
      2: 'typos burn the fuse, burns leave scars and min wpm climbs',
      3: 'the rules of 2 at twice the strength, on a faster fuse',
    } satisfies Record<Difficulty, string>,
    /** The switch for hardcore's own sounds. The keys have theirs, picked apart. */
    sound: 'heartbeat',
    soundTitle: 'the heartbeat, the knock on a wrong key, the ticks when min wpm climbs and the drop on a failed set',
    erase: (count: number): string => (count === 1 ? 'erase the typo' : `erase ${count} typos`),
    ctrlBksp: 'ctrl bksp',
    eraseAll: 'erase all',
    failed: (floor: number): string => `set failed: under ${floor} wpm too long`,
    failedTypos: 'set failed: the typos burnt the fuse out',
    lasted: 'lasted',
    notSaved: 'a failed set stays out of your history',
    held: (floor: number): string => `${floor} wpm, held`,
    climbed: (floor: number): string => `min wpm is now ${floor}`,
    /** The run: sets cleared in a row under one floor, and the time held across them. */
    runHeld: 'held',
    runSets: 'sets',
    runTitle: 'time held and sets cleared in a row at this min wpm, each over your best',
    best: 'best',
    run: 'run',
    runOver: 'run over',
    bestRun: 'best run',
    runValue: (sets: number, time: string): string => `${sets} ${sets === 1 ? 'set' : 'sets'}, ${time}`,
    runEnded: (value: string): string => `run ended: ${value}`,
    newBest: 'new best',
  },

  highway: {
    text: 'text',
    words: 'words',
    pairs: 'pairs',
    sentences: 'sentences',
    tempo: 'tempo',
    follows: 'follows you',
    locked: (wpm: number): string => `at ${wpm} wpm`,
    tempoNow: (wpm: number): string => `tempo ${wpm} wpm`,
    early: 'early: wait for the line',
  },

  line: {
    groups: 'groups',
    pairs: 'pairs',
    triples: 'triples',
    /** How the letter groups are drawn. */
    training: 'training',
    adaptive: 'adaptive',
    classic: 'classic',
    adaptiveNote: 'leans on the letter pairs you type slowest or miss most, and moves on as they get quicker',
    classicNote: 'the most common letter groups of the language, by frequency alone',
    text: 'text',
    sentences: 'sentences',
    words: 'words',
    capitals: 'capitals',
    off: 'off',
    on: 'on',
  },

  anchors: {
    held: 'Keep the other fingers of this hand down on their home keys. Only this finger can reach the notes.',
    free: 'No anchors: tap the notes with this finger and keep the hand on the home row.',
    hold: 'hold',
    lifted: (keys: string): string =>
      `anchor lifted: keep ${keys} down. If your keyboard cannot register this many keys at once, press esc and lower "anchors" in the settings.`,
    anchors: 'anchors',
    off: 'off',
  },

  keyboard: {
    space: 'space bar',
    key: (legend: string): string => `key ${legend}`,
  },

  profile: {
    button: 'profile',
    menu: 'profiles',
    title: (name: string): string => `profile: ${name}`,
    switch: 'switch profile',
    add: 'new profile',
    rename: (name: string): string => `rename ${name}`,
    remove: (name: string): string => `delete ${name}`,
    ask: (name: string): string => `delete ${name} and every number saved for it?`,
    keep: 'keep',
    confirm: 'delete',
    placeholder: 'name',
    newName: 'name of the new profile',
    renameTo: (name: string): string => `new name for ${name}`,
    starts: 'starts with the current options and no numbers',
    submitAdd: 'add',
    submitRename: 'save',
    problems: { empty: 'type a name first', taken: 'that name is taken: pick another' },
  },

  stats: {
    chart: 'chart',
    speed: 'speed',
    accuracy: 'accuracy',
    range: 'range',
    recent: (sets: number): string => `${sets} sets`,
    all: 'all',
    saved: 'saved',
    keep: 'keep',
    erase: 'erase',
    eraseAll: (profile: string): string => `erase all of ${profile}`,
    allKeys: 'all keys',
    spaceBar: 'space bar, thumb',
    key: (legend: string, finger: Finger): string => `key ${legend}, ${fingerHand(finger)} ${fingerKind(finger)}`,
    wpm: 'wpm',
    value: (wpm: number): string => `${wpm} wpm`,
    untracked: ' Tracking is off, so nothing is being saved.',
    empty: (layout: string, profile: string): string =>
      `Nothing measured on ${layout} for ${profile} yet. Finish a set in any drill and the per-finger numbers show up here.`,
    tooFew: (metric: string): string => `${metric}, too few sets yet`,
    window: (metric: string, sets: number): string => `${metric}, last ${sets} ${sets === 1 ? 'set' : 'sets'}`,
    hint: 'pick a finger or key below',
    back: 'back to all keys',
    chartLabel: (metric: string, subject: string): string => `${metric} of ${subject} over the saved sets`,
    noSets: 'No finished set on this layout yet. The chart starts with the first one.',
    noHistory: (subject: string): string => `No history for ${subject} yet. Finger and key history starts with the next set you finish.`,
    byFinger: 'by finger',
    slowKeys: 'slowest keys',
    slowPairs: 'weakest pairs',
    heads: { finger: 'finger', acc: 'acc', trend: 'trend', keys: 'keys', key: 'key', pair: 'pair', ms: 'ms', seen: 'seen' },
    footPick: 'Pick a finger or a key, in these lists or on the keyboard, to chart its history. ',
    footTrend: (speed: boolean): string => `Trend is the last ten sets against the ten before, in ${speed ? 'wpm' : 'points of accuracy'}. `,
    footHeat: 'On the keyboard, a stronger color means the key needs more work.',
    footShift: (share: string, capitals: number): string => ` Shift on the opposite hand: ${share} of ${capitals} capitals.`,
    sets: (sets: number): string => `${sets} ${sets === 1 ? 'set' : 'sets'}`,
    nothing: 'nothing typed',
    lastTen: (value: string): string => `last ten: ${value}`,
    caption: (speed: boolean, grouped: boolean): string =>
      `${speed ? 'bars' : 'dots'}: each set${grouped ? ', older ones per day' : ''}. line: last-ten average.`,
  },
};

export type Strings = typeof en;

const FR_KINDS: Record<FingerKind, string> = { pinky: 'petit doigt', ring: 'annulaire', middle: 'majeur', index: 'index', thumb: 'pouce' };
/** Where the finger goes, short enough to follow a finger's name on one line. */
const FR_ROWS: Record<Row, string> = { number: 'chiffres', top: 'en haut', home: 'au repos', bottom: 'en bas', thumb: 'espace' };
const frFinger = (finger: Finger): string => `${FR_KINDS[fingerKind(finger)]} ${fingerHand(finger) === 'left' ? 'gauche' : 'droit'}`;
const frShort = (finger: Finger): string => `${FR_KINDS[fingerKind(finger)]} ${fingerHand(finger) === 'left' ? 'g.' : 'd.'}`;
const frSide = (side: Side): string => (side === 'left' ? 'gauche' : 'droite');

const fr: Strings = {
  none: 'n/d',
  drills: { highway: 'autoroute', words: 'mots', pairs: 'paires', anchors: 'ancrages', stats: 'stats' },
  layouts: {
    'ca-fr': 'français canadien',
    us: 'qwerty américain',
    azerty: 'azerty français',
    qwertz: 'qwertz allemand',
    'qwertz-ch': 'suisse allemand',
    es: 'espagnol',
    latam: 'latino-américain',
    dvorak: 'dvorak',
    colemak: 'colemak',
    'colemak-dh': 'colemak-dh',
    workman: 'workman',
  },
  layoutNotes: {
    azerty: 'les chiffres se tapent avec maj',
    'colemak-dh': 'la rangée du bas de la main gauche suit le doigté en angle',
    'colemak-dh|iso': 'le z est sur la touche à côté du maj gauche',
  },
  languages: { fr: 'français', en: 'anglais', de: 'allemand', es: 'espagnol' },
  kinds: FR_KINDS,
  finger: frFinger,
  fingerShort: frShort,
  keyCaps: { bksp: 'retour', tab: 'tab', caps: 'verr maj', enter: 'entrée', shift: 'maj', ctrl: 'ctrl', alt: 'alt', space: 'espace' },
  months: ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'],
  day: (month, date) => `${date} ${month}`,

  top: {
    drills: 'exercices',
    tracking: 'suivi',
    trackingOn: 'les séries et les chiffres par touche sont enregistrés',
    trackingOff: "rien n'est enregistré tant que le suivi est désactivé",
    layout: 'disposition du clavier',
    guides: 'guides',
  },

  touch: {
    type: 'touche pour taper',
    field: 'tape ici',
    close: 'fermer',
  },

  menu: {
    button: 'réglages',
    region: 'réglages',
    profile: 'profil',
    layout: 'disposition',
    board: 'format',
    boards: { ansi: 'ansi', iso: 'iso', jis: 'jis' },
    boardNotes: {
      ansi: 'maj gauche large, entrée plate',
      iso: 'entrée haute, une touche de plus à côté du maj gauche',
      jis: "entrée haute, retour court, des touches autour de la barre d'espace",
    },
    boardFound: (board) => `clavier ${board} détecté: le clavier à l'écran le suit`,
    interface: 'interface',
    focus: 'doigts',
    focusGroup: 'doigts à travailler',
    focusNote: 'les doigts allumés tapent plus',
    focusNone: 'aucun allumé: tous tapent autant',
    focusAnchors: 'une série par doigt allumé',
    focusOn: (finger) => `${finger}: travaillé davantage`,
    focusOff: (finger) => `${finger}: comme d'habitude`,
  },

  rail: {
    region: 'vitesse et précision',
    wpm: 'mots par minute, en moyenne mobile',
    window: 'changer la période de la moyenne',
    spark: 'mots par minute pendant la dernière minute',
    caption: (seconds) => `mpm · sur ${seconds} s`,
    accuracy: 'précision',
    streak: "d'affilée",
    fingers: 'doigts',
    bar: (kind, wpm) => (wpm === null ? `${FR_KINDS[kind]}: pas encore mesuré` : `${FR_KINDS[kind]}: ${wpm} mpm`),
    hot: 'en avance sur sa propre moyenne dans cette série',
    untracked: "suivi désactivé: rien de ce que tu tapes n'est enregistré",
  },

  streak: {
    title: "bonnes touches d'affilée, d'une série à l'autre, au-dessus de ton record sur cette disposition et cet exercice",
    inRow: "d'affilée",
    newBest: 'nouveau record',
    best: (count) => `record ${count}`,
    passed: 'record',
  },

  next: {
    region: 'doigt à utiliser',
    title: 'prochaine touche',
    space: 'pouce, espace',
    finger: (finger, row) => `${frFinger(finger)}, ${FR_ROWS[row]}`,
    plusShift: (side) => `+ maj de ${frSide(side)}`,
    hold: (keys) => `tiens ${keys}`,
    useShift: (side) => `utilise le maj de ${frSide(side)} pour cette touche`,
  },

  result: {
    forSet: 'mpm pour cette série',
    accuracy: 'précision',
    bestStreak: "record d'affilée",
    time: 'temps de frappe',
    slowest: 'doigt le plus lent',
    slowestValue: (finger, wpm) => `${frFinger(finger)}, ${wpm} mpm`,
    weakPairs: 'paires à travailler',
    unsaved: 'non enregistrée: le suivi est désactivé',
    enter: 'entrée',
    nextSet: 'série suivante',
    newBest: 'nouveau record',
    clean: 'sans faute',
    over: (wpm) => `${wpm} mpm de plus que tes dix dernières`,
    under: (wpm) => `${wpm} mpm de moins que tes dix dernières`,
    level: 'comme tes dix dernières',
    gain: 'plus gros progrès',
    gainValue: (finger, wpm, gain) => `${frFinger(finger)}, ${wpm} mpm, ${gain} de plus que sa moyenne`,
    days: (count) => `${count} jours de suite`,
  },

  options: {
    region: 'exercice',
    language: 'langue',
    esc: 'échap',
    newText: 'nouveau texte',
    arrows: 'haut / bas',
    tempo: 'tempo',
    noAccents: 'les mots aux lettres absentes de cette disposition sont retirés',
    keys: 'touches',
    keySound: 'son des touches',
    keySoundOff: 'muettes',
    keySoundTitle: 'le son de chaque touche: des enregistrements de vrais interrupteurs',
  },

  hardcore: {
    label: 'hardcore',
    floor: 'mpm min',
    noFloor: 'aucun',
    floorTitle: (floor, step, seconds) =>
      `reste à ${floor} mpm ou plus, sinon la série est ratée${step > 0 ? `. il monte de ${step} mpm toutes les ${seconds} s tenues` : ''}`,
    difficulty: 'difficulté',
    difficultyNotes: {
      1: 'la mèche seule: elle brûle sous le mpm min et repousse en entier',
      2: 'les fautes brûlent la mèche, les brûlures laissent des cicatrices et le mpm min monte',
      3: 'les règles du 2, deux fois plus fortes, sur une mèche plus rapide',
    },
    sound: 'battement',
    soundTitle: 'le battement de cœur, le coup sur une fausse touche, les tics quand le mpm min monte et la chute quand la série est ratée',
    erase: (count) => (count === 1 ? 'efface la faute' : `efface ${count} fautes`),
    ctrlBksp: 'ctrl retour',
    eraseAll: 'efface tout',
    failed: (floor) => `série ratée: trop longtemps sous ${floor} mpm`,
    failedTypos: 'série ratée: les fautes ont brûlé toute la mèche',
    lasted: 'tenu',
    notSaved: "une série ratée n'entre pas dans ton historique",
    held: (floor) => `${floor} mpm, tenu`,
    climbed: (floor) => `le mpm min passe à ${floor}`,
    runHeld: 'tenu',
    runSets: 'séries',
    runTitle: "temps tenu et séries réussies d'affilée à ce mpm min, chacun au-dessus de ton record",
    best: 'record',
    run: 'suite',
    runOver: 'suite terminée',
    bestRun: 'meilleure suite',
    // French keeps the singular under two.
    runValue: (sets, time) => `${sets} ${sets < 2 ? 'série' : 'séries'}, ${time}`,
    runEnded: (value) => `suite terminée: ${value}`,
    newBest: 'nouveau record',
  },

  highway: {
    text: 'texte',
    words: 'mots',
    pairs: 'paires',
    sentences: 'phrases',
    tempo: 'tempo',
    follows: 'te suit',
    locked: (wpm) => `à ${wpm} mpm`,
    tempoNow: (wpm) => `tempo ${wpm} mpm`,
    early: 'trop tôt: attends la ligne',
  },

  line: {
    groups: 'groupes',
    pairs: 'paires',
    triples: 'triplets',
    training: 'entraînement',
    adaptive: 'adaptatif',
    classic: 'classique',
    adaptiveNote: "insiste sur les paires que tu tapes le plus lentement ou rates le plus, puis passe à d'autres quand elles accélèrent",
    classicNote: 'les groupes de lettres les plus courants de la langue, selon leur fréquence seulement',
    text: 'texte',
    sentences: 'phrases',
    words: 'mots',
    capitals: 'majuscules',
    off: 'non',
    on: 'oui',
  },

  anchors: {
    held: 'Garde les autres doigts de cette main enfoncés sur leurs touches de repos. Seul ce doigt peut atteindre les notes.',
    free: 'Sans ancrage: tape les notes avec ce doigt et garde la main sur la rangée de repos.',
    hold: 'tiens',
    lifted: (keys) =>
      `ancrage relâché: garde ${keys} enfoncées. Si ton clavier ne peut pas enregistrer autant de touches à la fois, appuie sur échap et réduis « ancrages » dans les réglages.`,
    anchors: 'ancrages',
    off: 'aucun',
  },

  keyboard: {
    space: "barre d'espace",
    key: (legend) => `touche ${legend}`,
  },

  profile: {
    button: 'profil',
    menu: 'profils',
    title: (name) => `profil: ${name}`,
    switch: 'changer de profil',
    add: 'nouveau profil',
    rename: (name) => `renommer ${name}`,
    remove: (name) => `supprimer ${name}`,
    ask: (name) => `supprimer ${name} et tous ses chiffres enregistrés?`,
    keep: 'garder',
    confirm: 'supprimer',
    placeholder: 'nom',
    newName: 'nom du nouveau profil',
    renameTo: (name) => `nouveau nom pour ${name}`,
    starts: 'démarre avec les options actuelles, sans aucun chiffre',
    submitAdd: 'ajouter',
    submitRename: 'renommer',
    problems: { empty: "écris d'abord un nom", taken: 'ce nom est déjà pris: choisis-en un autre' },
  },

  stats: {
    chart: 'graphique',
    speed: 'vitesse',
    accuracy: 'précision',
    range: 'période',
    recent: (sets) => `${sets} séries`,
    all: 'tout',
    saved: 'données',
    keep: 'garder',
    erase: 'effacer',
    eraseAll: (profile) => `tout effacer pour ${profile}`,
    allKeys: 'toutes les touches',
    spaceBar: "barre d'espace, pouce",
    key: (legend, finger) => `touche ${legend}, ${frShort(finger)}`,
    wpm: 'mpm',
    value: (wpm) => `${wpm} mpm`,
    untracked: " Le suivi est désactivé, alors rien n'est enregistré.",
    empty: (layout, profile) =>
      `Rien de mesuré sur ${layout} pour ${profile} pour l'instant. Termine une série dans n'importe quel exercice et les chiffres par doigt s'afficheront ici.`,
    tooFew: (metric) => `${metric}, trop peu de séries`,
    window: (metric, sets) => (sets === 1 ? `${metric}, dernière série` : `${metric}, ${sets} dernières séries`),
    hint: 'choisis un doigt ou une touche',
    back: 'retour à toutes les touches',
    chartLabel: (metric, subject) => `${metric}, ${subject}, au fil des séries enregistrées`,
    noSets: 'Aucune série terminée sur cette disposition pour le moment. Le graphique commence à la première.',
    noHistory: (subject) =>
      `Pas encore d'historique pour ${subject}. L'historique par doigt et par touche commence à la prochaine série que tu termines.`,
    byFinger: 'par doigt',
    slowKeys: 'touches lentes',
    slowPairs: 'paires à travailler',
    heads: { finger: 'doigt', acc: 'préc.', trend: 'tend.', keys: 'frappes', key: 'touche', pair: 'paire', ms: 'ms', seen: 'vues' },
    footPick: 'Choisis un doigt ou une touche, dans ces listes ou sur le clavier, pour voir son historique. ',
    footTrend: (speed) => `La tendance compare les dix dernières séries aux dix précédentes, en ${speed ? 'mpm' : 'points de précision'}. `,
    footHeat: 'Sur le clavier, une couleur plus vive indique une touche à travailler.',
    footShift: (share, capitals) => ` Maj de la main opposée: ${share} de ${capitals} majuscules.`,
    sets: (sets) => `${sets} ${sets === 1 ? 'série' : 'séries'}`,
    nothing: 'rien de tapé',
    lastTen: (value) => `sur dix: ${value}`,
    caption: (speed, grouped) =>
      `${speed ? 'barres' : 'points'}: ${grouped ? 'jours, puis séries' : 'chaque série'}. ligne: moyenne sur dix.`,
  },
};

const STRINGS: Record<Lang, Strings> = { en, fr, de, es };

/** Each interface language under its own name, for the picker. */
export const LANG_NAMES: Record<Lang, string> = { fr: 'français', en: 'english', de: 'deutsch', es: 'español' };

/** The strings of the current interface language. Reassigned by `setUiLang`, so read it at the moment of use. */
export let t: Strings = en;

export function setUiLang(lang: Lang): void {
  t = STRINGS[lang] ?? en;
}

/** For tests and tools: one language's strings without switching the interface. */
export const stringsOf = (lang: Lang): Strings => STRINGS[lang];

export const fingerName = (finger: Finger): string => t.finger(finger);
export const fingerShort = (finger: Finger): string => t.fingerShort(finger);

const isLang = (value: string): value is Lang => value in STRINGS;

/** The first of the browser's languages the interface speaks; English when it names none. */
export function preferredLang(languages: readonly string[] = globalThis.navigator?.languages ?? []): Lang {
  for (const tag of languages) {
    const base = tag.toLowerCase().split('-')[0];
    if (isLang(base)) return base;
  }
  return 'en';
}

/**
 * The layout a typist with nothing saved starts on, from the first of the browser's
 * languages that names one: its region picks between the layouts of one language.
 * French with no region is taken as Canadian French, the trainer's first audience.
 */
export function preferredLayout(languages: readonly string[] = globalThis.navigator?.languages ?? []): LayoutId {
  for (const tag of languages) {
    const [base, region = ''] = tag.toLowerCase().split('-');
    if (base === 'en') return 'us';
    if (base === 'fr') return region === '' || region === 'ca' ? 'ca-fr' : region === 'ch' ? 'qwertz-ch' : 'azerty';
    if (base === 'de') return region === 'ch' ? 'qwertz-ch' : 'qwertz';
    if (base === 'es') return region === 'es' ? 'es' : 'latam';
  }
  return 'us';
}
