import { DE_PAIRS, DE_SENTENCES, DE_TRIPLES, DE_WORDS } from './corpus-de';
import { ES_PAIRS, ES_SENTENCES, ES_TRIPLES, ES_WORDS } from './corpus-es';
import type { Lang } from './lang';

const split = (text: string): string[] => text.trim().split(/\s+/);

const EN_WORDS = split(`
the and that have for not with you this but his from they say her she will one all would there their what
out about who get which when make can like time just him know take people into year your good some could
them see other than then now look only come its over think also back after use two how our work first well
way even new want because any these give day most find here thing tell very still call world hand high keep
last long great same small large always place while follow point home water room mother area money story
fact month right study book eye job word business issue side kind head house service friend father power
hour game line end among ever stand bad lose however member pay law meet car city almost include continue
set later community name five once white least president learn real change team minute best several idea
kid body information nothing ago lead social understand whether watch together young level allow add office
spend door health person art sure war history party within grow result open morning walk reason low win
research girl guy early food before moment himself air teacher force offer enough both across although
remember foot second boy maybe toward able age policy everything love process music including consider
appear actually buy probably human wait serve market die send expect sense build stay fall nation plan cut
college interest death course someone experience behind reach local kill six remain effect suggest class
control raise care perhaps little late hard field else pass former sell major sometimes require along
development themselves report role better economic effort decide rate strong possible heart drug leader
light voice wife whole police mind finally pull return free military price less according decision explain
son hope develop view relationship carry town road drive arm true federal break difference thank receive
value international building action full model join season society tax director position player agree
especially record pick wear paper special space ground form support event official whose matter everyone
center couple site project hit base activity star table need court produce eat teach oil half situation
easy cost industry figure street image itself phone either data cover quite picture clear practice piece
land recent describe product doctor wall patient worker news test movie certain north personal simply
third technology catch step baby computer type attention draw film republican tree source red nearly
organization choose cause hair century evidence window difficult listen soon culture billion chance
brother energy period summer realize hundred available plant likelihood opportunity term short letter
condition choice single rule daughter administration south husband congress floor campaign material
population economy medical hospital church close thousand risk current fire future wrong involve defense
anyone increase security bank myself certainly west sport board seek per subject officer private rest
behavior deal performance fight throw top quickly past goal bed order author fill represent focus foreign
drop blood upon agency push nature color recently store reduce sound note fine near movement page enter
share common poor natural race concern series significant similar hot language usually response dead rise
animal factor decade article shoot east save seven artist away scene stock career despite central eight
thus treatment beyond happy exactly protect approach lie size dog fund serious occur media ready sign
thought list individual simple quality pressure accept answer resource identify left meeting determine
prepare disease whatever success argue cup particularly amount ability staff recognize indicate character
growth loss degree wonder attack herself region television box training pretty trade election everybody
physical lay general feeling standard bill message fail outside arrive analysis benefit sex forward lawyer
present section environmental glass skill sister professor operation financial crime stage authority miss
design sort act ten knowledge gun station blue strategy clearly discuss indeed truth song example democratic
check environment leg dark public various rather laugh guess executive prove hang entire rock forget claim
remove manager help enjoy network legal religious cold final main science green memory card above seat cell
establish nice trial expert spring firm radio visit management avoid imagine tonight huge ball finish
yourself theory impact respond statement maintain charge popular traditional onto reveal direction weapon
employee cultural contain peace pain apply play measure wide shake fly interview manage chair fish
particular camera structure politics perform bit weight suddenly discover candidate production treat trip
evening affect inside conference unit style adult worry range mention deep edge specific writer trouble
necessary throughout challenge fear shoulder institution middle sea dream bar beautiful property instead
improve stuff zone quiz zero lazy plaza pizza puzzle equal quote quiet apple pool polo solo swap wasp
also pass loop slow wall lap sap opal pulp plow aqua axle wax saw sow low law owl all ask app pop zip zap
`);

const FR_WORDS = split(`
le la les un une des et est pas que qui dans pour sur avec plus par mais nous vous ils elle elles son ses
mon mes ton tes notre votre leur leurs cette ces tout tous toute toutes bien aussi comme alors encore
toujours jamais souvent parfois ici maintenant avant devant chez entre sans sous vers pendant depuis
quand comment pourquoi parce donc ainsi enfin puis ensuite beaucoup peu assez trop moins autant quelque
plusieurs chaque autre aucun rien personne quelqu chose temps jour nuit matin soir heure minute semaine
mois saison printemps hiver automne monde pays ville village rue maison porte chambre table chaise lit
cuisine jardin arbre fleur herbe ciel soleil lune terre eau feu vent pluie neige mer lac montagne route
chemin pont voiture train avion bateau main pied bras jambe visage bouche nez oreille cheveux corps
homme femme enfant fille fils frère père mère ami famille voisin travail bureau école livre page mot phrase
lettre histoire question réponse idée raison exemple problème solution projet moment endroit place partie
point ligne forme couleur blanc noir rouge bleu vert jaune grand petit gros long court haut bas nouveau
vieux jeune beau bon mauvais vrai faux simple facile difficile possible important premier dernier seul
même être avoir faire dire pouvoir aller voir savoir vouloir venir devoir prendre trouver donner falloir
parler mettre passer regarder aimer croire demander rester répondre entendre penser arriver connaître
devenir sentir sembler tenir comprendre rendre attendre sortir vivre entrer porter chercher revenir
appeler mourir partir jeter suivre écrire montrer tomber ouvrir arrêter perdre commencer paraître
marcher lever permettre asseoir écouter monter apercevoir recevoir servir finir rire crier jouer tourner
garder reconnaître quitter manger courir continuer oublier descendre cacher poser tirer présenter
ajouter agir retrouver offrir apprendre tuer pleurer essayer compter occuper expliquer apporter choisir
pousser travailler découvrir toucher changer acheter vendre payer gagner lire dormir boire chanter
danser nager voyager construire produire traduire conduire détruire réussir grandir réfléchir
français québec montréal été après très déjà voilà où là à ça garçon leçon reçu façon fenêtre forêt tête fête bête
rêve crème problème système modèle collège siège pièce nièce siècle règle élève côté hôtel bientôt plutôt
tôt drôle rôle âge pâte gâteau théâtre château bâtiment île dîner maître boîte sûr mûr coût goût août
noël maïs naïf qualité quantité société liberté vérité beauté santé marché café clé pré thé début
métier équipe écran étude état énergie époque église étoile épaule épée spécial général numéro
téléphone télévision cinéma musée lycée armée année journée soirée entrée pensée vallée
quoi quel quelle lequel laquelle auquel puisque lorsque jusque presque quatre quinze quarante cinquante
soixante quart quartier qualité musique pratique politique publique unique logique magique rapide
souple simple sol salle sable salade salon soupe papa papier pape pompe pomme poule poisson plat plaque
plage place plaisir pluie plume plus plan aller salut alors parole pilote police pollen zoo zèbre zéro
zone gaz riz nez assez chez wagon kiwi axe taxe taxi luxe sexe texte exact exemple excellent expert
`);

const EN_PAIRS = split(`
th he in er an re on at en nd ti es or te of ed is it al ar st to nt ng se ha as ou io le ve co me de hi
ri ro ic ne ea ra ce li ch ll be ma si om ur ca el ta la ns ge ly ol pe so wa po lo ss op pl ap pa sa aw
`);

const FR_PAIRS = split(`
es le de en re nt on er ou an te ai se et el la it me qu ne is ti ur ie em co ra in ar us ue ns ce li tr
ll pa ss eu un io il au pr ch ta lo so sa po ol pl ap op as os al ou oi ux ez
`);

const EN_TRIPLES = split(`
the and ing ion tio ent ati for her ter hat tha ere ate his con res ver all ons nce men ith ted ers pro
thi wit are ess not ive was ect rea com eve per int est sta cti ica ist ear ain one our iti rat pla ply
`);

const FR_TRIPLES = split(`
ent les ion des que ait ant our lle ons men est tio eur par con res tre ous une dan ans pou ien ier ais
ire qui ell ess eux eau aux pas plu sol ssi pos app pal
`);

const lines = (text: string): string[] => text.trim().split(/\s*\n\s*/);

/**
 * Whole sentences, one per line, written the way they are typed with capitals on.
 * They stay inside what a keyboard types without a second thought: letters, the
 * comma, the period, the apostrophe, the hyphen and the question mark.
 */
const EN_SENTENCES = lines(`
The quick brown fox jumps over the lazy dog.
Please pass the salt and pepper, will you?
A slow walk always wakes up a sleepy soul.
Zoe plays jazz on a low stage every weekend.
Paul opened all the windows to let the air in.
We saw six swans cross the pool at dawn.
It was a quiet day, so we stayed at the lake.
Do you want apple pie or a slice of pizza?
Small steps add up to a long way.
She always asks the last question in class.
Type slowly at first, and the speed will follow.
Keep your wrists low and your fingers relaxed.
The pinky is small, but it has a job to do.
Look at the screen, not at your hands.
Each finger has its own row of keys to reach.
Practice a little every day and you will improve.
A wasp flew past the open door and was gone.
Lola sold all her old albums last fall.
The pizza was hot, so we waited a while.
Who left a wallet on the table in the hall?
I'll call you as soon as the plane lands.
Don't worry, we'll fix it before lunch.
Winter was long, but spring always comes back.
He put the box down and wiped his hands.
It's easy to quit and hard to start again.
They walked home across the park in the rain.
The puzzle took us an hour and a half to solve.
A good plan today beats a perfect plan next week.
My sister plays the piano and sings quite well.
Was that the last bus, or is there one more?
Close your eyes and listen to the waves.
The zoo opens at ten and closes at six.
Six lazy squirrels slept on a warm wall.
What would you do with a whole free week?
Speed is what is left when the mistakes are gone.
Rest your hands on the home row and breathe.
An old owl sat alone on a low oak branch.
We lost the map, yet we found the way.
Pack a warm sweater, it gets cold up there.
The soup was so salty that no one asked for more.
All is well as long as the coffee is hot.
Please allow a few extra days for the mail.
She sold apples and plums at the Sunday market.
A zebra, a lion and an ape share the same plaza.
Wax the floor, wash the walls and open the door.
I saw a quail and a sparrow in the tall grass.
Why is the sky so pale at this hour?
Slow is smooth, and smooth is fast.
The tall glass fell and spilled all over the sofa.
Our team won the quiz by a single point.
Wash the apples, peel the pears and slice the plums.
It was almost midnight when the phone rang.
Two swallows passed low over the pool.
Ask for a map at the desk in the lobby.
He always wears a wool hat, even in April.
Too many cooks spoil the soup, as people say.
The lamp was low, and the room was quiet.
Is it possible to laugh and whistle at once?
A pal of ours sells waffles and pop at the fair.
Follow the yellow wall as far as the last stop.
`);

/** The first thirty carry no accent, so a layout without accent keys still has French to type. */
const FR_SENTENCES = lines(`
Le chat dort sur le tapis du salon.
Il pleut sur la ville depuis ce matin.
Nous allons au lac avec nos amis samedi.
Ton petit doigt travaille aussi fort que les autres.
Regarde ton texte, pas tes mains.
La pomme ne tombe jamais loin de l'arbre.
Un pas lent vaut mieux que dix pas trop rapides.
Ma voisine joue du piano tous les soirs.
Qui a pris mon livre sur la table du salon?
Elle lit un roman policier dans le train.
Le soleil se couche tard au mois de juin.
Paul apporte une salade et du pain pour le souper.
Tape lentement, la vitesse viendra plus tard.
Chaque doigt a sa place sur le clavier.
Il faut du temps pour changer une vieille habitude.
Les enfants jouent dans la neige devant la maison.
Veux-tu une tasse de lait chaud avant de dormir?
Mon oncle vend des pommes et du sirop au village.
Nous avons vu six oies passer au-dessus du lac.
La pluie tombe doucement sur le toit du chalet.
Je prends un bol de soupe et un sandwich.
Ce puzzle compte mille morceaux, bonne chance.
Un bon plan vaut mieux qu'un plan parfait trop tard.
Lola part pour Paris avec sa valise bleue lundi.
As-tu vu le zoo avec les lions et les ours?
Le pilote salue la foule avant le vol.
Il est tard, allons dormir.
La nuit porte conseil, dit le proverbe.
Garde les poignets souples et le dos droit.
Assez parler, passons au travail.
Pose tes doigts sur la rangée du milieu et respire.
L'été, nous mangeons dehors presque tous les soirs.
Ça prend de la patience pour apprendre à taper.
Le café est prêt, viens t'asseoir avec nous.
Où as-tu rangé les clés de la voiture?
La forêt est calme après la première neige.
Mon frère prépare un gâteau pour la fête de maman.
Elle a déjà lu ce livre trois fois cet été.
Le petit doigt est le plus faible, alors on l'entraîne.
Répète ce mot jusqu'à ce qu'il sorte tout seul.
Nous irons à Québec en train à la fin du mois.
La rivière a gelé pendant la nuit.
Il a oublié son téléphone à l'école.
Quelle belle journée pour aller à la plage.
Le vieux château domine la vallée depuis des siècles.
J'ai reçu une lettre de ma grand-mère ce matin.
La leçon d'aujourd'hui porte sur les accents.
Tu as presque fini, ne lâche pas.
Le garçon a caché le cadeau derrière le canapé.
Après le souper, nous jouons aux cartes.
La précision passe avant la vitesse.
Un écureuil a volé les noix sur la galerie.
Le théâtre était plein à craquer hier soir.
Zoé a gagné le premier prix du concours.
Il neige à gros flocons sur Montréal.
Noël approche, la maison sent le sapin.
Le marché ouvre à huit heures le samedi.
Mets ton manteau, il fait très froid dehors.
C'est en tapant chaque jour qu'on s'améliore.
La clé est sous le pot de fleurs, près de la porte.
Mon père répare le vélo dans le garage.
Le bébé dort enfin, parlons tout bas.
Elle préfère le thé à la menthe au café.
Les élèves écoutent l'histoire en silence.
Garde les yeux sur l'écran et laisse tes doigts chercher.
Une erreur corrigée vaut mieux qu'une erreur cachée.
Le hockey commence à sept heures ce soir.
Il a plu toute la soirée, puis le ciel s'est dégagé.
Qui a éteint la lumière de la cuisine?
La poutine de ce casse-croûte est la meilleure du coin.
Chaque matin, elle court près du fleuve.
Le naïf croit tout ce qu'on lui dit.
Août est le mois des bleuets au Lac-Saint-Jean.
Nous avons mangé du maïs sucré au bord de l'eau.
Pourquoi le zèbre a-t-il des rayures?
`);

export const WORDS: Record<Lang, string[]> = { en: EN_WORDS, fr: FR_WORDS, de: DE_WORDS, es: ES_WORDS };
export const SENTENCES: Record<Lang, string[]> = { en: EN_SENTENCES, fr: FR_SENTENCES, de: DE_SENTENCES, es: ES_SENTENCES };
export const PAIRS: Record<Lang, string[]> = { en: EN_PAIRS, fr: FR_PAIRS, de: DE_PAIRS, es: ES_PAIRS };
export const TRIPLES: Record<Lang, string[]> = { en: EN_TRIPLES, fr: FR_TRIPLES, de: DE_TRIPLES, es: ES_TRIPLES };
