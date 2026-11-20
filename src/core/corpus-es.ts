const split = (text: string): string[] => text.trim().split(/\s+/);

/**
 * Common Spanish words, lowercase. Most carry no accent and no ñ, so a layout
 * without those keys still has plenty to type; the accented ones come last.
 */
export const ES_WORDS = split(`
de la que el en los se del las un por con no una su para es al lo como pero sus le ya fue este ha si
porque esta son entre cuando muy sin sobre ser tiene hasta hay donde han quien desde todo nos durante
todos uno les ni contra otros ese eso ante ellos esto mi antes algunos unos yo otro otras otra tanto
esa estos mucho nada muchos cual sea poco ella estar haber estas algo nosotros mis tu te nuestro
nuestra cada mismo entonces luego siempre nunca ahora hoy ayer bien mal mejor peor menos tan aunque
mientras pues casi solo tarde pronto cerca lejos dentro fuera arriba abajo junto hacia bajo nadie
alguien bastante
hacer poder decir ir ver dar saber querer llegar pasar poner quedar creer hablar llevar dejar seguir
encontrar llamar venir pensar salir volver tomar conocer vivir sentir mirar contar empezar esperar
buscar entrar trabajar escribir perder entender pedir recibir recordar terminar necesitar mantener
leer caer cambiar abrir ganar traer explicar preguntar tocar estudiar correr pagar ayudar gustar jugar
escuchar usar cerrar comer beber dormir caminar cantar bailar nadar viajar cocinar limpiar comprar
vender aprender olvidar subir bajar lavar preparar visitar practicar repetir guardar
tengo hace puede voy va vamos van quiero estoy soy
tiempo vida vez casa parte mundo hombre mujer forma momento lugar persona cosa hora trabajo ciudad
nombre agua punto historia padre madre grupo hijo hija familia noche tierra cuerpo camino mano ojo ojos
cabeza puerta calle mesa silla cama libro papel carta palabra idea problema verdad guerra amor fuerza
orden amigo amiga gente pueblo dinero luz sol luna cielo mar campo flor perro gato pan leche vino carne
fruta comida cena ventana pared suelo techo cocina escuela clase profesor alumno tienda mercado plaza
parque hospital banco auto tren barco viaje ropa zapato camisa sombrero color blanco negro rojo azul
verde amarillo gris grande alto largo corto nuevo viejo joven bueno malo feliz triste lento claro
oscuro caliente lleno fuerte suave dulce limpio sucio rico pobre libre cierto seguro semana mes fin
final centro lado cara voz juego equipo partido pelota fiesta regalo dos tres cuatro cinco seis siete
ocho nueve diez once doce veinte treinta cien mil primero segundo teclado tecla dedo pantalla letra
texto frase mapa nube lluvia nieve viento fuego piedra arena isla lago playa bosque valle puente
barrio vecino hermano hermana abuelo abuela primo prima esposa novio novia chico chica caballo vaca
pollo pescado huevo arroz queso sopa sal aceite manzana naranja pera uva tomate cebolla paz arte salud
dolor miedo suerte espacio pregunta respuesta ejemplo libertad edad mitad error foto imagen lista nota
taza pez cruz zona pozo zorro examen taxi kiwi jefe caja reloj llave torre lunes martes jueves viernes
domingo enero marzo abril mayo junio julio agosto octubre verano invierno primavera vaso plato cuchara
cuchillo botella bonito alegre tranquilo cansado amable simple igual brazo pierna pie rodilla espalda
hombro cuello boca nariz oreja diente pelo piel hambre calor ruido silencio paseo vuelta salida
entrada llegada museo teatro cine hotel cuarto sala piso gracias hola
más también así aquí allí además después según qué cómo dónde cuándo quién cuál está están estás había
tenía podía sería él tú mí sí sé té aún día país río tío tía mamá papá sofá café bebé todavía quizás
detrás jamás algún ningún través
año niño niña mañana señor señora pequeño pequeña montaña baño sueño otoño español compañero enseñar
soñar cumpleaños diseño dueño leña caña araña piña uña
razón corazón canción acción nación información situación relación educación atención camión avión
jardín inglés francés autobús región reunión lección opinión adiós perdón jamón salón limón ratón
botón balcón televisión decisión dirección estación habitación
árbol lápiz fácil difícil útil rápido música número último página teléfono película periódico pájaro
sábado miércoles médico público común único práctica fábrica máquina cámara lámpara plátano océano
vehículo kilómetro área época física química energía policía alegría compañía tranvía guía frío
vacío maíz raíz oír reír
pingüino vergüenza bilingüe cigüeña
`);

/** The most frequent letter pairs of Spanish text, most common first. */
export const ES_PAIRS = split(`
de es en el la os ue ar ra re er as on st ad al or ta co se nt an do ci qu ac te io ro ia ie ca ma un
to le ri na ne ti ec nd sa ic lo ns me ll mo tr il em pa po ni li di si ce so pr pe ol us mi cu
`);

/** The most frequent letter triples of Spanish words. */
export const ES_TRIPLES = split(`
que ent ion del con ade cio nte las est los aci ara ado dad ien par era sta ida pro tra res nto ene
tos dos com men ant ica ero una ada ido ici ter pre ten mos ndo tar
`);

const lines = (text: string): string[] => text.trim().split(/\s*\n\s*/);

/**
 * Whole sentences, one per line, written the way they are typed with capitals on.
 * They stay inside what a Spanish keyboard types without a second thought: letters,
 * the comma, the period, the hyphen, the question mark and the opening ¿.
 * The first thirty carry no accent, no ñ, no ü and no ¿, so a layout without
 * those keys still has Spanish to type.
 */
export const ES_SENTENCES = lines(`
El gato duerme sobre la alfombra roja.
Llueve sobre la ciudad desde muy temprano.
Vamos al lago con nuestros amigos el domingo.
Mira tu texto, no tus manos.
Paso a paso se llega lejos.
Mi vecina toca el piano todas las noches.
Ella lee una novela de misterio en el tren.
El sol se pone tarde en el mes de junio.
Pablo trae una ensalada y pan para la cena.
Teclea despacio, la velocidad llega con el tiempo.
Cada dedo tiene su lugar en el teclado.
Cambiar una vieja costumbre lleva su tiempo.
Los chicos juegan en la nieve frente a la casa.
Mi abuelo vende manzanas y miel en el pueblo.
Vimos seis patos cruzar el lago al amanecer.
La lluvia cae suave sobre el techo de la casa.
Quiero un plato de sopa y un vaso de agua.
Este rompecabezas tiene mil piezas, buena suerte.
Lola viaja a Madrid con su maleta azul.
El piloto saluda a la gente antes del vuelo.
Es tarde, vamos a dormir.
Al mal tiempo, buena cara.
Deja los hombros sueltos y la espalda recta.
Basta de hablar, vamos a trabajar.
Pon los dedos en la fila del medio y respira.
Mi hermana canta en un coro todos los jueves.
Pide un taxi para llegar a tiempo al examen.
Hoy hace sol, pero el viento sopla fuerte.
Zoe toca jazz en un bar los viernes.
Cierra la ventana, que entra mucho aire.
Tu dedo meñique trabaja tanto como los otros.
¿Dónde está la estación de tren?
¿Quién dejó mi libro sobre la mesa?
El veloz murciélago hindú comía feliz cardillo y kiwi.
En verano cenamos afuera casi todas las noches.
Hace falta paciencia para aprender a teclear sin mirar.
El café está listo, ven a sentarte con nosotros.
¿Dónde guardaste las llaves de la casa?
El bosque está tranquilo después de la primera nevada.
Mi hermano prepara un pastel para el cumpleaños de mamá.
Ella ya leyó este libro tres veces este año.
El meñique es el dedo más débil, por eso lo entrenamos.
Repite la palabra hasta que salga sin pensar.
Iremos a la costa en tren a fin de mes.
El río se congeló durante la noche.
Olvidó su teléfono en la escuela.
Hoy es un día perfecto para ir a la playa.
El viejo castillo domina el valle desde hace siglos.
Recibí una carta de mi abuela esta mañana.
La lección de hoy trata sobre los acentos.
Ya casi terminas, no te rindas.
El niño escondió el regalo detrás del sofá.
Después de cenar, jugamos a las cartas.
La precisión va antes que la velocidad.
Una ardilla robó las nueces del balcón.
El teatro estaba lleno a reventar anoche.
Sofía ganó el primer premio del concurso.
Nieva con fuerza sobre la montaña.
Se acerca la Navidad y la casa huele a pino.
El mercado abre a las ocho los sábados.
Ponte el abrigo, hace mucho frío afuera.
Se mejora escribiendo un poco cada día.
La llave está debajo de la maceta, junto a la puerta.
Mi padre arregla la bicicleta en el garaje.
El bebé por fin duerme, hablemos en voz baja.
Ella prefiere el té de menta al café.
Los alumnos escuchan la historia en silencio.
Mantén la vista en la pantalla y deja que los dedos busquen.
Un error corregido vale más que un error escondido.
El partido de fútbol empieza a las siete.
Llovió toda la tarde y luego salió el sol.
¿Quién apagó la luz de la cocina?
Cada mañana corre por la orilla del río.
¿Por qué el pingüino no puede volar?
En agosto comemos maíz dulce junto al lago.
¿Cuántos años tiene tu hermana pequeña?
¿Te gustaría un vaso de leche caliente antes de dormir?
La cigüeña volvió a su nido en la torre de la iglesia.
¿Cómo se llama tu perro?
El español se habla en muchos países del mundo.
`);
