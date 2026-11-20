/**
 * German practice text, in the same shape as the English and French lists in
 * `corpus.ts`. Words are lowercase, nouns too: the generator capitalizes some
 * words itself when capitals are on.
 */

const split = (text: string): string[] => text.trim().split(/\s+/);

/** Most words carry no umlaut and no ß, so a layout without those keys still has plenty to type. */
export const DE_WORDS = split(`
der die das den dem des ein eine einen einem einer eines und oder aber denn sondern doch ich du er
sie es wir ihr mich mir dich dir sich uns euch ihn ihm ihnen mein meine dein deine sein seine ihre
unser unsere kein keine nicht auch noch schon nur sehr so wie was wer wo wann warum wenn als ob
dass weil da dann hier dort jetzt heute morgen gestern immer nie oft mal ja nein in im an am auf aus
bei beim mit nach von vom zu zum zur um bis durch gegen ohne unter zwischen vor hinter neben seit
dieser diese dieses jeder jede jedes alle alles viel viele mehr wenig etwas nichts man selbst ganz
gern gerne bitte danke also eben etwa fast genau gleich bald lange wieder weiter wohl sogar trotzdem
deshalb darum damit dabei davon dazu danach oben unten links rechts vorne hinten innen zusammen
allein manchmal meistens selten sonst endlich zuerst zuletzt vielleicht wirklich eigentlich ziemlich
besonders sofort vorher bereits erst eher kaum eins zwei drei vier sechs sieben acht neun
zehn elf zwanzig hundert tausend erste zweite dritte halb
zeit jahr tag woche monat stunde minute sekunde abend nacht mittag haus wohnung zimmer tisch stuhl
bett fenster wand boden dach garten baum blume gras wald feld berg see meer fluss wasser luft feuer
erde himmel sonne mond stern regen schnee wind wetter stadt dorf land welt weg platz park auto bahn
zug bus rad schiff mensch mann frau kind junge vater mutter bruder schwester sohn tochter freund
freundin familie name hand kopf auge ohr mund nase haar arm bein herz arbeit schule buch seite wort
satz brief frage antwort idee grund beispiel problem teil ende anfang punkt linie form farbe geld
preis markt laden brot milch kaffee tee wein apfel obst fisch suppe salat zucker salz butter glas
tasse teller messer gabel kuchen leute lehrer arzt nachbar gast gruppe firma
ort raum ecke bild film musik lied spiel sport ball tor ziel reise urlaub ferien fest
feier geschenk karte plan liste zahl nummer telefon handy computer bildschirm maus taste
tasten tastatur finger text zeile buchstabe sprache klasse kurs pause hilfe rat sache ding art weise
fall moment wochenende sommer herbst winter hund katze pferd vogel tier blatt holz stein sand
eis ei hose hemd jacke mantel schuh hut tasche koffer uhr brille bad keller treppe
kirche theater kino bank post bahnhof insel strand ufer turm
haben werden machen gehen kommen sehen geben nehmen sagen finden bleiben liegen stehen sitzen
lassen halten bringen denken kennen wissen spielen lernen leben wohnen arbeiten fahren laufen
schreiben lesen sprechen fragen antworten essen trinken schlafen kaufen zahlen helfen suchen zeigen
glauben brauchen beginnen tragen ziehen legen setzen stellen fallen rufen warten bauen tanzen singen
lachen weinen rennen reisen kochen putzen waschen holen schicken senden bekommen verstehen vergessen
erinnern versuchen gewinnen verlieren treffen teilen tippen schauen merken hoffen lieben danken
bitten fehlen passen gefallen schneiden springen schwimmen wandern malen zeichnen rechnen planen
bestellen besuchen packen werfen fangen steigen wachsen entscheiden atmen
geht macht gibt ist sind war waren hat hatte habe bin bist wird wurde kann muss soll will darf mag
kam ging sah gab nahm sagte
gut besser beste neu alt klein lang kurz hoch tief weit nah leicht schwer einfach richtig falsch
wichtig klar sicher frei voll leer warm kalt hell dunkel laut leise jung schnell langsam stark
schwach ruhig still wach froh traurig lustig nett lieb klug fertig bereit offen nass trocken sauber
rund breit schmal dick weich hart glatt scharf billig teuer reich krank gesund echt anders bunt rot
blau gelb schwarz grau braun
dafür draußen außen plötzlich natürlich ungefähr fünf zwölf dreißig tür straße mädchen fuß frühling
schlüssel küche brücke hören können müssen dürfen mögen öffnen schließen heißen erklären erzählen
üben drücken wünschen gehören hängen zählen ändern wählen lösen fühlen groß früh spät heiß schön
müde böse dünn grün weiß später über für gegenüber würde möchte hätte wäre schläft läuft fährt
zurück fröhlich ähnlich nächste größer älter jünger stück gemüse käse löffel bäcker brötchen äpfel
bäume blätter hände füße vögel städte brüder märz übung lösung prüfung gefühl glück körper
`);

/** The commonest letter pairs of German, by frequency. */
export const DE_PAIRS = split(`
er en ch de ei nd te in ie ge es ne un st re he an be se ng di sc ic it au ns le da ri ht
nt ra is el li ar al me hr ha ss us or at ll la rt mi si ti ag ck na ma ze wi zu so im ür
`);

/** The commonest letter triples of German, by frequency. */
export const DE_TRIPLES = split(`
ein ich nde die und der che end gen sch cht den ine nge ung ter ten ers ste eit
ber ach ver hen ert auf lic ren ige ier ess mit uch rde ent ege ges ell ist ens
`);

const lines = (text: string): string[] => text.trim().split(/\s*\n\s*/);

/**
 * Whole sentences, one per line, written the way they are typed with capitals on.
 * They stay inside what a keyboard types without a second thought: letters, the
 * comma, the period, the apostrophe, the hyphen and the question mark.
 * The first thirty carry no umlaut and no ß, so a layout without those keys still has German to type.
 */
export const DE_SENTENCES = lines(`
Der Hund liegt auf dem Sofa im Wohnzimmer.
Es regnet seit heute Morgen in der ganzen Stadt.
Am Samstag fahren wir mit Freunden an den See.
Dein kleiner Finger arbeitet genauso hart wie die anderen.
Schau auf den Bildschirm, nicht auf die Tasten.
Wer langsam geht, kommt auch ans Ziel.
Meine Nachbarin spielt jeden Abend Klavier.
Wer hat mein Buch vom Tisch genommen?
Sie liest einen Krimi im Zug nach Berlin.
Im Sommer bleibt es abends lange hell.
Paul bringt Brot und Salat zum Abendessen mit.
Tippe langsam, das Tempo kommt dann von selbst.
Jeder Finger hat seinen Platz auf der Tastatur.
Neue Gewohnheiten brauchen Zeit und Geduld.
Die Kinder spielen im Schnee vor dem Haus.
Willst du vor dem Schlafen noch einen Tee?
Mein Onkel verkauft Honig und Eier auf dem Markt.
Wir sahen sechs Schwalben am Himmel kreisen.
Leise trommelt der Regen auf das Dach.
Ich nehme eine Suppe und ein belegtes Brot.
Das Puzzle hat tausend Teile, viel Erfolg.
Ein guter Plan heute ist besser als ein perfekter Plan morgen.
Lisa fliegt am Montag mit ihrem blauen Koffer nach Wien.
Hast du die Pinguine im Zoo gesehen?
Der Pilot winkt den Leuten vor dem Start.
Es ist schon dunkel, gehen wir schlafen.
Morgen ist auch noch ein Tag, sagt meine Oma.
Halte die Handgelenke locker und sitz gerade.
Genug geredet, an die Arbeit.
Leg die Finger auf die mittlere Reihe und atme ruhig.
Bei warmem Wetter essen wir fast jeden Abend draußen.
Schnell tippen lernt man nicht an einem Tag.
Der Kaffee ist fertig, setz dich zu uns.
Wo hast du nur meine Brille hingelegt?
Nach dem ersten Schnee ist der Wald ganz still.
Mein Bruder backt einen Kuchen für Mamas Geburtstag.
Sie hat dieses Buch schon dreimal gelesen.
Der kleine Finger ist der schwächste, deshalb üben wir ihn.
Wiederhole das Wort, bis es von allein kommt.
Ende des Monats fahren wir mit dem Zug nach Hamburg.
Der Teich ist in der Nacht zugefroren.
Er hat sein Handy in der Schule vergessen.
Was für ein schöner Tag für einen Ausflug ans Meer.
Die alte Burg thront seit Jahrhunderten über dem Tal.
Heute Morgen kam ein Brief von meiner Großmutter.
In der heutigen Stunde geht es um die Umlaute.
Du bist fast fertig, gib jetzt nicht auf.
Der Junge hat das Geschenk hinter dem Schrank versteckt.
Nach dem Essen spielen wir noch eine Runde Karten.
Genauigkeit kommt vor Geschwindigkeit.
Ein Eichhörnchen hat die Nüsse vom Balkon geholt.
Das Theater war gestern Abend bis auf den letzten Platz besetzt.
Zoe hat beim Wettbewerb den ersten Preis gewonnen.
Es schneit in dicken Flocken über München.
Bald ist Weihnachten, das ganze Haus riecht nach Tanne.
Der Markt öffnet samstags um acht Uhr.
Zieh deine Jacke an, draußen ist es eiskalt.
Wer jeden Tag ein bisschen tippt, wird besser.
Der Schlüssel liegt unter dem Blumentopf neben der Tür.
Mein Vater repariert das Fahrrad in der Garage.
Das Baby schläft endlich, lass uns leise reden.
Sie trinkt lieber Pfefferminztee als Kaffee.
Die Schüler hören der Geschichte still zu.
Lass den Blick oben, die Finger finden den Weg.
Ein korrigierter Fehler ist besser als ein versteckter.
Das Spiel beginnt heute Abend um sieben Uhr.
Es hat den ganzen Abend geregnet, dann klarte der Himmel auf.
Wer hat in der Küche das Licht ausgemacht?
Jeden Morgen läuft sie eine Runde am Fluss entlang.
Wir haben am Seeufer frische Maiskolben gegessen.
Warum hat das Zebra eigentlich Streifen?
Victor jagt zwölf Boxkämpfer quer über den großen Sylter Deich.
Die Straße vor unserem Haus wird nächste Woche gesperrt.
Gibt's noch Kuchen, oder ist schon alles weg?
Ich schicke dir heute Abend noch eine kurze E-Mail.
Weißt du, wie spät es gerade ist?
Im Herbst fallen die Blätter von den Bäumen.
Ich hätte gern zwei Brötchen und ein Stück Butter.
Mit etwas Übung findet jeder Finger seine Taste.
`);
