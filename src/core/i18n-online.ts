import type { SizeKind } from './keyboards';
import type { Lang } from './lang';
import type { InputKind, KeyboardGroup, Period } from './online';

/**
 * The strings of the online parts, in the four interface languages: the account, the
 * boards, a set's rank, texts typed again, and races. Kept apart from `i18n.ts` and
 * reached through `t.online`. Short labels lowercase, sentences with their capital.
 */
export interface OnlineStrings {
  account: string;
  signIn: string;
  pitch: string;
  noPassword: string;
  checkMail: string;
  email: string;
  emailPlaceholder: string;
  send: string;
  sending: string;
  sent: (email: string) => string;
  code: string;
  enter: string;
  otherEmail: string;
  handle: string;
  handlePrompt: string;
  handleRule: string;
  save: string;
  saved: string;
  signedIn: string;
  signOut: string;
  keyboard: string;
  keyboardNote: string;
  model: string;
  modelPlaceholder: string;
  switchKind: string;
  size: string;
  notSet: string;
  sizes: Record<SizeKind, string>;
  remove: string;
  removeSure: string;
  keep: string;
  removeNote: string;
  otherProfile: (name: string) => string;
  followHere: string;
  privacy: string;
  errors: Record<string, string>;
  /** The boards. */
  boards: string;
  views: { players: string; keyboards: string; texts: string };
  periods: Record<Period, string>;
  inputs: Record<InputKind, string>;
  allLangs: string;
  allLayouts: string;
  groups: Record<KeyboardGroup, string>;
  cols: { name: string; wpm: string; acc: string; layout: string; keyboard: string; when: string; players: string; mean: string; top: string; text: string };
  empty: string;
  emptyKeyboards: string;
  emptyTexts: string;
  joinBoards: string;
  pickName: string;
  loading: string;
  failed: string;
  typeIt: string;
  keyboardsNote: string;
  ago: (ms: number) => string;
  /** A set's rank, on its result. */
  board: string;
  thisText: string;
  place: (rank: number, of: number) => string;
  yourBest: string;
  offBoards: string;
  rankIt: string;
  ranking: string;
  notSaved: string;
  share: string;
  copied: string;
  raceIt: string;
  /** A known text typed again. */
  textOf: (players: number) => string;
  bestOn: (handle: string, wpm: number) => string;
  leaveText: string;
  textMissing: string;
  textNeedsLayout: string;
  you: string;
  ghost: string;
  /** Races. */
  race: string;
  newRace: string;
  create: string;
  mode: string;
  modes: { line: string; highway: string };
  words: string;
  kindLabel: string;
  kinds: { words: string; sentences: string; pairs: string };
  room: (code: string) => string;
  copyLink: string;
  invite: string;
  yourName: string;
  start: string;
  waitHost: string;
  waitNext: string;
  alone: string;
  leaveRoom: string;
  again: string;
  host: string;
  go: string;
  placeOf: (place: number) => string;
  racing: string;
  stillTyping: string;
  roomGone: string;
  roomFull: string;
  lost: string;
  places: string;
}

const en: OnlineStrings = {
  account: 'account',
  signIn: 'sign in',
  pitch: 'Rank your sets, keep your numbers on every device and race other typists.',
  noPassword: 'No password. A link and a code come by email.',
  checkMail: 'check your email',
  email: 'email',
  emailPlaceholder: 'you@example.com',
  send: 'send the link',
  sending: 'sending',
  sent: (email) => `A link went to ${email}. Open it on this device, or type the code it holds.`,
  code: 'code',
  enter: 'sign in',
  otherEmail: 'another address',
  handle: 'name',
  handlePrompt: 'Pick the name the boards show. Your email is never shown.',
  handleRule: '2 to 20 characters: letters, digits, _ . -',
  save: 'save',
  saved: 'saved',
  signedIn: 'signed in as',
  signOut: 'sign out',
  keyboard: 'keyboard',
  keyboardNote: 'Your keyboard puts your sets on the keyboards board.',
  model: 'model',
  modelPlaceholder: 'keychron k2, hhkb, laptop',
  switchKind: 'switch',
  size: 'size',
  notSet: 'not set',
  sizes: { full: 'full size', '96': '96%', tkl: 'tkl', '75': '75%', '65': '65%', '60': '60%', '40': '40%', split: 'split', ergo: 'ergonomic', laptop: 'laptop', other: 'other' },
  remove: 'delete account',
  removeSure: 'delete for good',
  keep: 'keep it',
  removeNote: 'Your account, your sets and your places on the boards go for good.',
  otherProfile: (name) => `The account follows the profile ${name}: sets typed here stay off the boards.`,
  followHere: 'follow this profile',
  privacy: 'privacy',
  errors: {
    'bad-email': 'That email address looks wrong.',
    'slow-down': 'Too many tries. Wait a few minutes.',
    'mail-failed': 'The email did not go out. Try again in a moment.',
    'link-expired': 'That link is spent or expired. Ask for a new one.',
    'code-expired': 'That code is spent or expired. Ask for a new one.',
    'bad-code': 'Wrong code.',
    'bad-handle': '2 to 20 characters: letters, digits, _ . -',
    'handle-taken': 'That name is taken.',
    offline: 'No connection.',
    'no-room': 'That room is closed.',
    full: 'That room is full.',
    default: 'Something went wrong. Try again.',
  },
  boards: 'boards',
  views: { players: 'typists', keyboards: 'keyboards', texts: 'texts' },
  periods: { day: 'today', week: 'this week', all: 'all time' },
  inputs: { keys: 'keyboard', touch: 'phone' },
  allLangs: 'all languages',
  allLayouts: 'all layouts',
  groups: { model: 'model', switch: 'switch', size: 'size' },
  cols: { name: 'typist', wpm: 'wpm', acc: 'acc', layout: 'layout', keyboard: 'keyboard', when: 'when', players: 'typists', mean: 'mean', top: 'best', text: 'text' },
  empty: 'No one here yet. Finish a set while signed in and the first place is yours.',
  emptyKeyboards: 'No keyboard has a ranked typist yet.',
  emptyTexts: 'No text has a ranked typist yet.',
  joinBoards: 'sign in to be on the boards',
  pickName: 'pick a name to be on the boards',
  loading: 'loading',
  failed: 'The boards did not load.',
  typeIt: 'type it',
  keyboardsNote: 'The mean of the best set of each typist on it. It says who types on what, not what a keyboard does for you.',
  ago: (ms) => {
    const minutes = Math.round(ms / 60000);
    if (minutes < 60) return `${Math.max(1, minutes)} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 48) return `${hours} h ago`;
    return `${Math.round(hours / 24)} days ago`;
  },
  board: 'board',
  thisText: 'this text',
  place: (rank, of) => `#${rank} of ${of}`,
  yourBest: 'your best',
  offBoards: 'off the boards: 95% accuracy and 40 characters to rank',
  rankIt: 'sign in to rank this set',
  ranking: 'ranking',
  notSaved: 'The set did not reach the boards.',
  share: 'share this text',
  copied: 'link copied',
  raceIt: 'race it',
  textOf: (players) => (players === 1 ? '1 typist on it' : `${players} typists on it`),
  bestOn: (handle, wpm) => `best ${wpm} by ${handle}`,
  leaveText: 'new text',
  textMissing: 'That text was not found.',
  textNeedsLayout: 'That text has letters this layout cannot type.',
  you: 'you',
  ghost: 'ghost',
  race: 'race',
  newRace: 'new race',
  create: 'open a room',
  mode: 'drill',
  modes: { line: 'words', highway: 'highway' },
  words: 'words',
  kindLabel: 'text',
  kinds: { words: 'words', sentences: 'sentences', pairs: 'pairs' },
  room: (code) => `room ${code}`,
  copyLink: 'copy the link',
  invite: 'Whoever opens the link joins the room.',
  yourName: 'your name',
  start: 'start',
  waitHost: 'The host starts the race.',
  waitNext: 'A race is on. You join the next one.',
  alone: 'Alone for now: start anyway, or wait for someone to open the link.',
  leaveRoom: 'leave',
  again: 'again',
  host: 'host',
  go: 'go',
  placeOf: (place) => ['1st', '2nd', '3rd'][place - 1] ?? `${place}th`,
  racing: 'racing',
  stillTyping: 'typing',
  roomGone: 'That room is closed.',
  roomFull: 'That room is full.',
  lost: 'The room went quiet. Reconnecting.',
  places: 'places',
};

const fr: OnlineStrings = {
  account: 'compte',
  signIn: 'connexion',
  pitch: 'Classe tes séries, garde tes chiffres sur tous tes appareils et fais la course avec d’autres.',
  noPassword: 'Pas de mot de passe. Un lien et un code arrivent par courriel.',
  checkMail: 'vérifie tes courriels',
  email: 'courriel',
  emailPlaceholder: 'toi@exemple.com',
  send: 'envoyer le lien',
  sending: 'envoi',
  sent: (email) => `Un lien est parti à ${email}. Ouvre-le sur cet appareil, ou tape le code qu’il contient.`,
  code: 'code',
  enter: 'me connecter',
  otherEmail: 'une autre adresse',
  handle: 'nom',
  handlePrompt: 'Choisis le nom que montrent les classements. Ton courriel n’est jamais montré.',
  handleRule: '2 à 20 caractères : lettres, chiffres, _ . -',
  save: 'enregistrer',
  saved: 'enregistré',
  signedIn: 'connecté en tant que',
  signOut: 'me déconnecter',
  keyboard: 'clavier',
  keyboardNote: 'Ton clavier place tes séries au classement des claviers.',
  model: 'modèle',
  modelPlaceholder: 'keychron k2, hhkb, portable',
  switchKind: 'switch',
  size: 'format',
  notSet: 'non précisé',
  sizes: { full: 'complet', '96': '96 %', tkl: 'tkl', '75': '75 %', '65': '65 %', '60': '60 %', '40': '40 %', split: 'séparé', ergo: 'ergonomique', laptop: 'portable', other: 'autre' },
  remove: 'supprimer le compte',
  removeSure: 'supprimer pour de bon',
  keep: 'le garder',
  removeNote: 'Ton compte, tes séries et tes places aux classements partent pour de bon.',
  otherProfile: (name) => `Le compte suit le profil ${name} : les séries tapées ici restent hors classement.`,
  followHere: 'suivre ce profil',
  privacy: 'confidentialité',
  errors: {
    'bad-email': 'Cette adresse ne semble pas valide.',
    'slow-down': 'Trop d’essais. Attends quelques minutes.',
    'mail-failed': 'Le courriel n’est pas parti. Réessaie dans un moment.',
    'link-expired': 'Ce lien a déjà servi ou a expiré. Demandes-en un autre.',
    'code-expired': 'Ce code a déjà servi ou a expiré. Demandes-en un autre.',
    'bad-code': 'Code erroné.',
    'bad-handle': '2 à 20 caractères : lettres, chiffres, _ . -',
    'handle-taken': 'Ce nom est pris.',
    offline: 'Pas de connexion.',
    'no-room': 'Cette salle est fermée.',
    full: 'Cette salle est pleine.',
    default: 'Quelque chose n’a pas marché. Réessaie.',
  },
  boards: 'classements',
  views: { players: 'joueurs', keyboards: 'claviers', texts: 'textes' },
  periods: { day: 'aujourd’hui', week: 'cette semaine', all: 'depuis toujours' },
  inputs: { keys: 'clavier', touch: 'téléphone' },
  allLangs: 'toutes les langues',
  allLayouts: 'toutes les dispositions',
  groups: { model: 'modèle', switch: 'switch', size: 'format' },
  cols: { name: 'joueur', wpm: 'mpm', acc: 'préc.', layout: 'disposition', keyboard: 'clavier', when: 'quand', players: 'joueurs', mean: 'moyenne', top: 'record', text: 'texte' },
  empty: 'Personne encore. Termine une série en étant connecté et la première place est à toi.',
  emptyKeyboards: 'Aucun clavier n’a encore de joueur classé.',
  emptyTexts: 'Aucun texte n’a encore de joueur classé.',
  joinBoards: 'connecte-toi pour être au classement',
  pickName: 'choisis un nom pour être au classement',
  loading: 'chargement',
  failed: 'Les classements n’ont pas chargé.',
  typeIt: 'le taper',
  keyboardsNote: 'La moyenne de la meilleure série de chaque joueur dessus. Ça dit qui tape sur quoi, pas ce qu’un clavier fait pour toi.',
  ago: (ms) => {
    const minutes = Math.round(ms / 60000);
    if (minutes < 60) return `il y a ${Math.max(1, minutes)} min`;
    const hours = Math.round(minutes / 60);
    if (hours < 48) return `il y a ${hours} h`;
    return `il y a ${Math.round(hours / 24)} jours`;
  },
  board: 'classement',
  thisText: 'ce texte',
  place: (rank, of) => `${rank}e sur ${of}`,
  yourBest: 'ton record',
  offBoards: 'hors classement : 95 % de précision et 40 caractères pour être classé',
  rankIt: 'connecte-toi pour classer cette série',
  ranking: 'classement en cours',
  notSaved: 'La série n’a pas atteint les classements.',
  share: 'partager ce texte',
  copied: 'lien copié',
  raceIt: 'en faire une course',
  textOf: (players) => (players === 1 ? '1 joueur dessus' : `${players} joueurs dessus`),
  bestOn: (handle, wpm) => `record ${wpm} par ${handle}`,
  leaveText: 'nouveau texte',
  textMissing: 'Ce texte est introuvable.',
  textNeedsLayout: 'Ce texte a des lettres que cette disposition ne tape pas.',
  you: 'toi',
  ghost: 'fantôme',
  race: 'course',
  newRace: 'nouvelle course',
  create: 'ouvrir une salle',
  mode: 'exercice',
  modes: { line: 'mots', highway: 'autoroute' },
  words: 'mots',
  kindLabel: 'texte',
  kinds: { words: 'mots', sentences: 'phrases', pairs: 'paires' },
  room: (code) => `salle ${code}`,
  copyLink: 'copier le lien',
  invite: 'Qui ouvre le lien entre dans la salle.',
  yourName: 'ton nom',
  start: 'départ',
  waitHost: 'L’hôte lance la course.',
  waitNext: 'Une course est en cours. Tu entres dans la suivante.',
  alone: 'Seul pour l’instant : lance quand même, ou attends que quelqu’un ouvre le lien.',
  leaveRoom: 'quitter',
  again: 'encore',
  host: 'hôte',
  go: 'go',
  placeOf: (place) => (place === 1 ? '1er' : `${place}e`),
  racing: 'en course',
  stillTyping: 'tape encore',
  roomGone: 'Cette salle est fermée.',
  roomFull: 'Cette salle est pleine.',
  lost: 'La salle ne répond plus. Reconnexion.',
  places: 'places',
};

const de: OnlineStrings = {
  account: 'konto',
  signIn: 'anmelden',
  pitch: 'Bring deine Sets in die Ranglisten, behalte deine Zahlen auf jedem Gerät und tritt gegen andere an.',
  noPassword: 'Kein Passwort. Link und Code kommen per E-Mail.',
  checkMail: 'Posteingang prüfen',
  email: 'e-mail',
  emailPlaceholder: 'du@beispiel.de',
  send: 'link senden',
  sending: 'wird gesendet',
  sent: (email) => `Ein Link ging an ${email}. Öffne ihn auf diesem Gerät oder gib den Code darin ein.`,
  code: 'code',
  enter: 'anmelden',
  otherEmail: 'andere adresse',
  handle: 'name',
  handlePrompt: 'Wähle den Namen, den die Ranglisten zeigen. Deine E-Mail wird nie gezeigt.',
  handleRule: '2 bis 20 Zeichen: Buchstaben, Ziffern, _ . -',
  save: 'speichern',
  saved: 'gespeichert',
  signedIn: 'angemeldet als',
  signOut: 'abmelden',
  keyboard: 'tastatur',
  keyboardNote: 'Deine Tastatur bringt deine Sets in die Tastatur-Rangliste.',
  model: 'modell',
  modelPlaceholder: 'keychron k2, hhkb, laptop',
  switchKind: 'switch',
  size: 'größe',
  notSet: 'nicht angegeben',
  sizes: { full: 'volle größe', '96': '96 %', tkl: 'tkl', '75': '75 %', '65': '65 %', '60': '60 %', '40': '40 %', split: 'geteilt', ergo: 'ergonomisch', laptop: 'laptop', other: 'andere' },
  remove: 'konto löschen',
  removeSure: 'endgültig löschen',
  keep: 'behalten',
  removeNote: 'Dein Konto, deine Sets und deine Plätze in den Ranglisten sind dann endgültig weg.',
  otherProfile: (name) => `Das Konto folgt dem Profil ${name}: hier getippte Sets bleiben außerhalb der Ranglisten.`,
  followHere: 'diesem profil folgen',
  privacy: 'datenschutz',
  errors: {
    'bad-email': 'Diese Adresse sieht falsch aus.',
    'slow-down': 'Zu viele Versuche. Warte ein paar Minuten.',
    'mail-failed': 'Die E-Mail ging nicht raus. Versuch es gleich noch einmal.',
    'link-expired': 'Dieser Link ist verbraucht oder abgelaufen. Fordere einen neuen an.',
    'code-expired': 'Dieser Code ist verbraucht oder abgelaufen. Fordere einen neuen an.',
    'bad-code': 'Falscher Code.',
    'bad-handle': '2 bis 20 Zeichen: Buchstaben, Ziffern, _ . -',
    'handle-taken': 'Dieser Name ist vergeben.',
    offline: 'Keine Verbindung.',
    'no-room': 'Dieser Raum ist geschlossen.',
    full: 'Dieser Raum ist voll.',
    default: 'Etwas ist schiefgegangen. Versuch es noch einmal.',
  },
  boards: 'ranglisten',
  views: { players: 'tippende', keyboards: 'tastaturen', texts: 'texte' },
  periods: { day: 'heute', week: 'diese woche', all: 'gesamt' },
  inputs: { keys: 'tastatur', touch: 'handy' },
  allLangs: 'alle sprachen',
  allLayouts: 'alle layouts',
  groups: { model: 'modell', switch: 'switch', size: 'größe' },
  cols: { name: 'name', wpm: 'wpm', acc: 'genau', layout: 'layout', keyboard: 'tastatur', when: 'wann', players: 'tippende', mean: 'mittel', top: 'bestes', text: 'text' },
  empty: 'Noch niemand hier. Beende ein Set angemeldet und der erste Platz gehört dir.',
  emptyKeyboards: 'Noch keine Tastatur hat jemanden in der Rangliste.',
  emptyTexts: 'Noch kein Text hat jemanden in der Rangliste.',
  joinBoards: 'melde dich an, um in die ranglisten zu kommen',
  pickName: 'wähle einen namen für die ranglisten',
  loading: 'lädt',
  failed: 'Die Ranglisten haben nicht geladen.',
  typeIt: 'tippen',
  keyboardsNote: 'Das Mittel aus dem besten Set aller, die darauf tippen. Es sagt, wer worauf tippt, nicht was eine Tastatur für dich tut.',
  ago: (ms) => {
    const minutes = Math.round(ms / 60000);
    if (minutes < 60) return `vor ${Math.max(1, minutes)} min`;
    const hours = Math.round(minutes / 60);
    if (hours < 48) return `vor ${hours} h`;
    return `vor ${Math.round(hours / 24)} tagen`;
  },
  board: 'rangliste',
  thisText: 'dieser text',
  place: (rank, of) => `${rank}. von ${of}`,
  yourBest: 'dein bestes',
  offBoards: 'nicht in der rangliste: 95 % genauigkeit und 40 zeichen nötig',
  rankIt: 'melde dich an, um dieses set zu werten',
  ranking: 'wird gewertet',
  notSaved: 'Das Set kam nicht in die Ranglisten.',
  share: 'text teilen',
  copied: 'link kopiert',
  raceIt: 'als rennen',
  textOf: (players) => (players === 1 ? '1 person darauf' : `${players} personen darauf`),
  bestOn: (handle, wpm) => `bestes ${wpm} von ${handle}`,
  leaveText: 'neuer text',
  textMissing: 'Dieser Text wurde nicht gefunden.',
  textNeedsLayout: 'Dieser Text hat Buchstaben, die dieses Layout nicht tippt.',
  you: 'du',
  ghost: 'geist',
  race: 'rennen',
  newRace: 'neues rennen',
  create: 'raum öffnen',
  mode: 'übung',
  modes: { line: 'wörter', highway: 'autobahn' },
  words: 'wörter',
  kindLabel: 'text',
  kinds: { words: 'wörter', sentences: 'sätze', pairs: 'paare' },
  room: (code) => `raum ${code}`,
  copyLink: 'link kopieren',
  invite: 'Wer den Link öffnet, kommt in den Raum.',
  yourName: 'dein name',
  start: 'start',
  waitHost: 'Wer den Raum leitet, startet das Rennen.',
  waitNext: 'Ein Rennen läuft. Du bist beim nächsten dabei.',
  alone: 'Noch allein: starte trotzdem oder warte, bis jemand den Link öffnet.',
  leaveRoom: 'verlassen',
  again: 'noch mal',
  host: 'leitung',
  go: 'los',
  placeOf: (place) => `${place}.`,
  racing: 'im rennen',
  stillTyping: 'tippt noch',
  roomGone: 'Dieser Raum ist geschlossen.',
  roomFull: 'Dieser Raum ist voll.',
  lost: 'Der Raum antwortet nicht mehr. Verbindung wird neu aufgebaut.',
  places: 'plätze',
};

const es: OnlineStrings = {
  account: 'cuenta',
  signIn: 'entrar',
  pitch: 'Clasifica tus series, guarda tus números en todos tus dispositivos y compite con otros.',
  noPassword: 'Sin contraseña. Llegan un enlace y un código por correo.',
  checkMail: 'revisa tu correo',
  email: 'correo',
  emailPlaceholder: 'tu@ejemplo.com',
  send: 'enviar el enlace',
  sending: 'enviando',
  sent: (email) => `Un enlace salió hacia ${email}. Ábrelo en este dispositivo o escribe el código que trae.`,
  code: 'código',
  enter: 'entrar',
  otherEmail: 'otra dirección',
  handle: 'nombre',
  handlePrompt: 'Elige el nombre que muestran las clasificaciones. Tu correo nunca se muestra.',
  handleRule: 'De 2 a 20 caracteres: letras, cifras, _ . -',
  save: 'guardar',
  saved: 'guardado',
  signedIn: 'conectado como',
  signOut: 'salir',
  keyboard: 'teclado',
  keyboardNote: 'Tu teclado lleva tus series a la clasificación de teclados.',
  model: 'modelo',
  modelPlaceholder: 'keychron k2, hhkb, portátil',
  switchKind: 'switch',
  size: 'tamaño',
  notSet: 'sin indicar',
  sizes: { full: 'completo', '96': '96 %', tkl: 'tkl', '75': '75 %', '65': '65 %', '60': '60 %', '40': '40 %', split: 'partido', ergo: 'ergonómico', laptop: 'portátil', other: 'otro' },
  remove: 'borrar la cuenta',
  removeSure: 'borrar para siempre',
  keep: 'conservarla',
  removeNote: 'Tu cuenta, tus series y tus puestos en las clasificaciones se van para siempre.',
  otherProfile: (name) => `La cuenta sigue el perfil ${name}: las series de aquí quedan fuera de las clasificaciones.`,
  followHere: 'seguir este perfil',
  privacy: 'privacidad',
  errors: {
    'bad-email': 'Esa dirección no parece válida.',
    'slow-down': 'Demasiados intentos. Espera unos minutos.',
    'mail-failed': 'El correo no salió. Vuelve a intentarlo en un momento.',
    'link-expired': 'Ese enlace ya se usó o caducó. Pide otro.',
    'code-expired': 'Ese código ya se usó o caducó. Pide otro.',
    'bad-code': 'Código incorrecto.',
    'bad-handle': 'De 2 a 20 caracteres: letras, cifras, _ . -',
    'handle-taken': 'Ese nombre ya está tomado.',
    offline: 'Sin conexión.',
    'no-room': 'Esa sala está cerrada.',
    full: 'Esa sala está llena.',
    default: 'Algo falló. Vuelve a intentarlo.',
  },
  boards: 'clasificaciones',
  views: { players: 'jugadores', keyboards: 'teclados', texts: 'textos' },
  periods: { day: 'hoy', week: 'esta semana', all: 'siempre' },
  inputs: { keys: 'teclado', touch: 'móvil' },
  allLangs: 'todos los idiomas',
  allLayouts: 'todas las distribuciones',
  groups: { model: 'modelo', switch: 'switch', size: 'tamaño' },
  cols: { name: 'jugador', wpm: 'ppm', acc: 'prec.', layout: 'distribución', keyboard: 'teclado', when: 'cuándo', players: 'jugadores', mean: 'media', top: 'récord', text: 'texto' },
  empty: 'Aún no hay nadie. Termina una serie con la sesión iniciada y el primer puesto es tuyo.',
  emptyKeyboards: 'Ningún teclado tiene aún un jugador clasificado.',
  emptyTexts: 'Ningún texto tiene aún un jugador clasificado.',
  joinBoards: 'entra para estar en las clasificaciones',
  pickName: 'elige un nombre para estar en las clasificaciones',
  loading: 'cargando',
  failed: 'Las clasificaciones no cargaron.',
  typeIt: 'escribirlo',
  keyboardsNote: 'La media de la mejor serie de cada jugador en él. Dice quién escribe con qué, no lo que un teclado hace por ti.',
  ago: (ms) => {
    const minutes = Math.round(ms / 60000);
    if (minutes < 60) return `hace ${Math.max(1, minutes)} min`;
    const hours = Math.round(minutes / 60);
    if (hours < 48) return `hace ${hours} h`;
    return `hace ${Math.round(hours / 24)} días`;
  },
  board: 'clasificación',
  thisText: 'este texto',
  place: (rank, of) => `${rank}.º de ${of}`,
  yourBest: 'tu récord',
  offBoards: 'fuera de clasificación: hacen falta 95 % de precisión y 40 caracteres',
  rankIt: 'entra para clasificar esta serie',
  ranking: 'clasificando',
  notSaved: 'La serie no llegó a las clasificaciones.',
  share: 'compartir este texto',
  copied: 'enlace copiado',
  raceIt: 'hacer una carrera',
  textOf: (players) => (players === 1 ? '1 jugador en él' : `${players} jugadores en él`),
  bestOn: (handle, wpm) => `récord ${wpm} de ${handle}`,
  leaveText: 'texto nuevo',
  textMissing: 'No se encontró ese texto.',
  textNeedsLayout: 'Ese texto tiene letras que esta distribución no escribe.',
  you: 'tú',
  ghost: 'fantasma',
  race: 'carrera',
  newRace: 'nueva carrera',
  create: 'abrir una sala',
  mode: 'ejercicio',
  modes: { line: 'palabras', highway: 'autopista' },
  words: 'palabras',
  kindLabel: 'texto',
  kinds: { words: 'palabras', sentences: 'frases', pairs: 'pares' },
  room: (code) => `sala ${code}`,
  copyLink: 'copiar el enlace',
  invite: 'Quien abre el enlace entra en la sala.',
  yourName: 'tu nombre',
  start: 'salida',
  waitHost: 'Quien abrió la sala da la salida.',
  waitNext: 'Hay una carrera en marcha. Entras en la siguiente.',
  alone: 'Solo por ahora: sal igual, o espera a que alguien abra el enlace.',
  leaveRoom: 'salir',
  again: 'otra vez',
  host: 'anfitrión',
  go: 'ya',
  placeOf: (place) => `${place}.º`,
  racing: 'en carrera',
  stillTyping: 'escribiendo',
  roomGone: 'Esa sala está cerrada.',
  roomFull: 'Esa sala está llena.',
  lost: 'La sala dejó de responder. Reconectando.',
  places: 'puestos',
};

export const ONLINE: Record<Lang, OnlineStrings> = { en, fr, de, es };
