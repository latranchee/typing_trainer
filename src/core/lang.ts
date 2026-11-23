/** The languages of the interface and of the practice text. Kept apart from the store so the server can import it. */
export type Lang = 'en' | 'fr' | 'de' | 'es';
export const LANGS: Lang[] = ['fr', 'en', 'de', 'es'];
export const isLang = (value: unknown): value is Lang => LANGS.includes(value as Lang);
