import type { Lang } from './store';

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

export const WORDS: Record<Lang, string[]> = { en: EN_WORDS, fr: FR_WORDS };
export const PAIRS: Record<Lang, string[]> = { en: EN_PAIRS, fr: FR_PAIRS };
export const TRIPLES: Record<Lang, string[]> = { en: EN_TRIPLES, fr: FR_TRIPLES };
