import type { Finger, FingerKind, Hand } from './fingers';
import { fingerHand, fingerKind } from './fingers';
import type { Strings } from './i18n';
import type { Row } from './physical';

/**
 * Every string the interface shows, in Spanish: neutral, informal (tú), readable
 * in Spain and in Latin America. Short labels are lowercase; full sentences keep
 * their capital. Shift is "la mayús" (la tecla mayús), so its side is feminine.
 */

const ES_KINDS: Record<FingerKind, string> = { pinky: 'meñique', ring: 'anular', middle: 'medio', index: 'índice', thumb: 'pulgar' };
/** Where the finger goes, short enough to follow a finger's name on one line. */
const ES_ROWS: Record<Row, string> = { number: 'números', top: 'arriba', home: 'en reposo', bottom: 'abajo', thumb: 'espacio' };
const esFinger = (finger: Finger): string => `${ES_KINDS[fingerKind(finger)]} ${fingerHand(finger) === 'left' ? 'izquierdo' : 'derecho'}`;
const esShort = (finger: Finger): string => `${ES_KINDS[fingerKind(finger)]} ${fingerHand(finger) === 'left' ? 'izq.' : 'der.'}`;
const esSide = (side: Hand): string => (side === 'left' ? 'izquierda' : 'derecha');

export const es: Strings = {
  none: 'n/d',
  drills: { highway: 'autopista', words: 'palabras', pairs: 'pares', anchors: 'anclas', stats: 'stats' },
  layouts: {
    'ca-fr': 'francés canadiense',
    us: 'qwerty estadounidense',
    azerty: 'azerty francés',
    qwertz: 'qwertz alemán',
    'qwertz-ch': 'qwertz alemán suizo',
    es: 'español de España',
    latam: 'español latinoamericano',
    dvorak: 'dvorak',
    colemak: 'colemak',
    'colemak-dh': 'colemak-dh',
    workman: 'workman',
  },
  layoutNotes: {
    azerty: 'los números se escriben con mayús',
    'colemak-dh': 'la fila de abajo de la mano izquierda usa la digitación en ángulo',
    'colemak-dh|iso': 'la z está en la tecla junto a la mayús izquierda',
  },
  languages: { fr: 'francés', en: 'inglés', de: 'alemán', es: 'español' },
  kinds: ES_KINDS,
  finger: esFinger,
  fingerShort: esShort,
  keyCaps: { bksp: 'borrar', tab: 'tab', caps: 'bloq', enter: 'intro', shift: 'mayús', ctrl: 'ctrl', alt: 'alt', space: 'espacio' },
  months: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
  day: (month, date) => `${date} ${month}`,

  top: {
    drills: 'ejercicios',
    tracking: 'registro',
    trackingOn: 'se guardan las series y los datos por tecla',
    trackingOff: 'no se guarda nada mientras el registro esté desactivado',
    layout: 'distribución del teclado',
    guides: 'guías',
  },

  menu: {
    button: 'ajustes',
    region: 'ajustes',
    profile: 'perfil',
    layout: 'teclado',
    board: 'formato',
    boards: { ansi: 'ansi', iso: 'iso', jis: 'jis' },
    boardNotes: {
      ansi: 'mayús izquierda ancha, intro plano',
      iso: 'intro alto, una tecla más junto a la mayús izquierda',
      jis: 'intro alto, tecla de borrar corta, teclas alrededor de la barra espaciadora',
    },
    boardFound: (board) => `teclado ${board} detectado: el de la pantalla ya coincide`,
    interface: 'interfaz',
    focus: 'dedos',
    focusGroup: 'dedos que entrenar más',
    focusNote: 'los dedos encendidos teclean más',
    focusNone: 'ninguno encendido: todos teclean igual',
    focusAnchors: 'una serie por cada dedo encendido',
    focusOn: (finger) => `${finger}: se entrena más`,
    focusOff: (finger) => `${finger}: como siempre`,
  },

  rail: {
    region: 'velocidad y precisión',
    wpm: 'palabras por minuto, en media móvil',
    window: 'cambiar el periodo de la media',
    spark: 'palabras por minuto durante el último minuto',
    caption: (seconds) => `ppm · últimos ${seconds} s`,
    accuracy: 'precisión',
    streak: 'racha',
    fingers: 'dedos',
    bar: (kind, wpm) => (wpm === null ? `${ES_KINDS[kind]}: aún sin medir` : `${ES_KINDS[kind]}: ${wpm} ppm`),
    hot: 'por encima de su propia media en esta serie',
    untracked: 'registro desactivado: no se guarda nada de lo que escribes',
  },

  streak: {
    title: 'teclas correctas seguidas, de una serie a otra, sobre tu récord en esta distribución y este ejercicio',
    inRow: 'seguidas',
    newBest: 'nuevo récord',
    best: (count) => `récord ${count}`,
    passed: 'récord',
  },

  next: {
    region: 'qué dedo usar',
    title: 'siguiente tecla',
    space: 'pulgar, espacio',
    finger: (finger, row) => `${esFinger(finger)}, ${ES_ROWS[row]}`,
    plusShift: (side) => `+ mayús ${esSide(side)}`,
    hold: (keys) => `mantén ${keys}`,
    useShift: (side) => `usa la mayús ${esSide(side)} para esa tecla`,
  },

  result: {
    forSet: 'ppm en esta serie',
    accuracy: 'precisión',
    bestStreak: 'mejor racha',
    time: 'tiempo de tecleo',
    slowest: 'dedo más lento',
    slowestValue: (finger, wpm) => `${esFinger(finger)}, ${wpm} ppm`,
    weakPairs: 'pares por mejorar',
    unsaved: 'no guardada: el registro está desactivado',
    enter: 'intro',
    nextSet: 'siguiente serie',
    newBest: 'nuevo récord',
    clean: 'sin errores',
    over: (wpm) => `${wpm} ppm más que tus últimas diez`,
    under: (wpm) => `${wpm} ppm menos que tus últimas diez`,
    level: 'igual que tus últimas diez',
    gain: 'mayor progreso',
    gainValue: (finger, wpm, gain) => `${esFinger(finger)}, ${wpm} ppm, ${gain} más que su media`,
    days: (count) => `${count} días seguidos`,
  },

  options: {
    region: 'ejercicio',
    language: 'idioma',
    esc: 'esc',
    newText: 'texto nuevo',
    arrows: 'arriba / abajo',
    tempo: 'ritmo',
    noAccents: 'se omiten las palabras con letras que esta distribución no tiene',
    keys: 'teclas',
    keySound: 'sonido de teclas',
    keySoundOff: 'mudas',
    keySoundTitle: 'cómo suena cada tecla: grabaciones de interruptores reales',
  },

  hardcore: {
    label: 'hardcore',
    floor: 'ppm mín',
    noFloor: 'ninguno',
    floorTitle: (floor, step, seconds) =>
      `mantente en ${floor} ppm o más, o la serie falla${step > 0 ? `. sube ${step} ppm por cada ${seconds} s que aguantes` : ''}`,
    difficulty: 'dificultad',
    difficultyNotes: {
      1: 'solo la mecha: se quema bajo el ppm mín y vuelve a crecer entera',
      2: 'los errores queman la mecha, las quemaduras dejan cicatrices y el ppm mín sube',
      3: 'las reglas del 2 con el doble de fuerza, en una mecha más rápida',
    },
    sound: 'latido',
    soundTitle: 'el latido del corazón, el golpe en una tecla errónea, el tictac cuando sube el ppm mín y la caída al fallar una serie',
    erase: (count) => (count === 1 ? 'borra el error' : `borra ${count} errores`),
    ctrlBksp: 'ctrl borrar',
    eraseAll: 'borra todo',
    failed: (floor) => `serie fallida: demasiado tiempo bajo ${floor} ppm`,
    failedTypos: 'serie fallida: los errores quemaron toda la mecha',
    lasted: 'duración',
    notSaved: 'una serie fallida no entra en tu historial',
    held: (floor) => `${floor} ppm, mantenido`,
    climbed: (floor) => `el ppm mín sube a ${floor}`,
    runHeld: 'aguante',
    runSets: 'series',
    runTitle: 'tiempo aguantado y series superadas seguidas con este ppm mín, cada uno sobre tu récord',
    best: 'récord',
    // "racha" is the streak of right keys; a run of cleared sets is a chain.
    run: 'cadena',
    runOver: 'cadena rota',
    bestRun: 'mejor cadena',
    runValue: (sets, time) => `${sets} ${sets === 1 ? 'serie' : 'series'}, ${time}`,
    runEnded: (value) => `cadena rota: ${value}`,
    newBest: 'nuevo récord',
  },

  highway: {
    text: 'texto',
    words: 'palabras',
    pairs: 'pares',
    sentences: 'frases',
    tempo: 'ritmo',
    follows: 'te sigue',
    locked: (wpm) => `a ${wpm} ppm`,
    tempoNow: (wpm) => `ritmo ${wpm} ppm`,
    early: 'muy pronto: espera la línea',
  },

  line: {
    groups: 'grupos',
    pairs: 'pares',
    triples: 'tríos',
    training: 'modo',
    adaptive: 'adaptativo',
    classic: 'clásico',
    adaptiveNote: 'insiste en los pares que tecleas más lento o fallas más, y pasa a otros cuando se vuelven rápidos',
    classicNote: 'los grupos de letras más comunes del idioma, solo por su frecuencia',
    text: 'texto',
    sentences: 'frases',
    words: 'palabras',
    capitals: 'mayúsculas',
    off: 'no',
    on: 'sí',
  },

  anchors: {
    held: 'Mantén los otros dedos de esta mano presionando sus teclas de reposo. Solo este dedo puede alcanzar las notas.',
    free: 'Sin anclas: toca las notas con este dedo y deja la mano en la fila de reposo.',
    hold: 'mantén',
    lifted: (keys) =>
      `ancla levantada: mantén ${keys} presionadas. Si tu teclado no registra tantas teclas a la vez, presiona esc y baja «anclas» en los ajustes.`,
    anchors: 'anclas',
    off: 'ninguna',
  },

  keyboard: {
    space: 'barra espaciadora',
    key: (legend) => `tecla ${legend}`,
  },

  profile: {
    button: 'perfil',
    menu: 'perfiles',
    title: (name) => `perfil: ${name}`,
    switch: 'cambiar de perfil',
    add: 'nuevo perfil',
    rename: (name) => `renombrar ${name}`,
    remove: (name) => `eliminar ${name}`,
    ask: (name) => `¿eliminar ${name} y todos sus datos guardados?`,
    keep: 'conservar',
    confirm: 'eliminar',
    placeholder: 'nombre',
    newName: 'nombre del nuevo perfil',
    renameTo: (name) => `nuevo nombre para ${name}`,
    starts: 'empieza con las opciones actuales y sin datos',
    submitAdd: 'crear',
    submitRename: 'guardar',
    problems: { empty: 'escribe un nombre primero', taken: 'ese nombre ya existe: elige otro' },
  },

  stats: {
    chart: 'gráfico',
    speed: 'velocidad',
    accuracy: 'precisión',
    range: 'periodo',
    recent: (sets) => `${sets} series`,
    all: 'todo',
    saved: 'datos',
    keep: 'conservar',
    erase: 'borrar',
    eraseAll: (profile) => `borrar todo de ${profile}`,
    allKeys: 'todas las teclas',
    spaceBar: 'barra espaciadora, pulgar',
    key: (legend, finger) => `tecla ${legend}, ${esShort(finger)}`,
    wpm: 'ppm',
    value: (wpm) => `${wpm} ppm`,
    untracked: ' El registro está desactivado, así que no se guarda nada.',
    empty: (layout, profile) =>
      `Aún no hay nada medido en ${layout} para ${profile}. Termina una serie en cualquier ejercicio y aquí aparecerán los datos por dedo.`,
    tooFew: (metric) => `${metric}, aún pocas series`,
    window: (metric, sets) => (sets === 1 ? `${metric}, última serie` : `${metric}, últimas ${sets} series`),
    hint: 'elige un dedo o una tecla abajo',
    back: 'volver a todas las teclas',
    chartLabel: (metric, subject) => `${metric} de ${subject} a lo largo de las series guardadas`,
    noSets: 'Aún no hay ninguna serie terminada en esta distribución. El gráfico empieza con la primera.',
    noHistory: (subject) =>
      `Aún no hay historial de ${subject}. El historial por dedo y por tecla empieza con la próxima serie que termines.`,
    byFinger: 'por dedo',
    slowKeys: 'teclas más lentas',
    slowPairs: 'pares más débiles',
    heads: { finger: 'dedo', acc: 'prec.', trend: 'tend.', keys: 'teclas', key: 'tecla', pair: 'par', ms: 'ms', seen: 'vistos' },
    footPick: 'Elige un dedo o una tecla, en estas listas o en el teclado, para ver su historial. ',
    footTrend: (speed) => `La tendencia compara las diez últimas series con las diez anteriores, en ${speed ? 'ppm' : 'puntos de precisión'}. `,
    footHeat: 'En el teclado, un color más intenso indica que la tecla necesita más práctica.',
    footShift: (share, capitals) => ` Mayús de la mano contraria: ${share} de ${capitals} mayúsculas.`,
    sets: (sets) => `${sets} ${sets === 1 ? 'serie' : 'series'}`,
    nothing: 'nada tecleado',
    lastTen: (value) => `últimas diez: ${value}`,
    caption: (speed, grouped) =>
      `${speed ? 'barras' : 'puntos'}: una por serie${grouped ? ', las antiguas por día' : ''}. línea: media de las últimas diez.`,
  },
};
