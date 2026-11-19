import { afterEach, describe, expect, it } from 'vitest';
import { FINGERS } from '../src/core/fingers';
import { fingerName, fingerShort, preferredLang, setUiLang, stringsOf, t } from '../src/core/i18n';
import { ROW_IDS } from '../src/core/physical';

/** Every leaf of a dictionary, as `path -> kind`, so two languages can be compared. */
function shape(value: unknown, path = ''): Record<string, string> {
  if (Array.isArray(value)) return { [path]: `array:${value.length}` };
  if (value !== null && typeof value === 'object') {
    return Object.assign({}, ...Object.entries(value).map(([key, child]) => shape(child, path ? `${path}.${key}` : key)));
  }
  return { [path]: typeof value };
}

describe('interface strings', () => {
  afterEach(() => setUiLang('en'));

  it('has the same entries in French as in English', () => {
    expect(shape(stringsOf('fr'))).toEqual(shape(stringsOf('en')));
  });

  it('leaves no entry empty', () => {
    for (const lang of ['en', 'fr'] as const) {
      const strings = stringsOf(lang);
      const walk = (value: unknown, path: string): void => {
        if (typeof value === 'string') expect(value.trim(), `${lang} ${path}`).not.toBe('');
        else if (Array.isArray(value)) value.forEach((item, i) => walk(item, `${path}[${i}]`));
        else if (value !== null && typeof value === 'object') Object.entries(value).forEach(([key, child]) => walk(child, `${path}.${key}`));
      };
      walk(strings, '');
      expect(strings.months).toHaveLength(12);
    }
  });

  it('switches every reader of `t` at once', () => {
    expect(t.drills.highway).toBe('highway');
    expect(fingerName('LP')).toBe('left pinky');
    setUiLang('fr');
    expect(t.drills.highway).toBe('autoroute');
    expect(fingerName('LP')).toBe('petit doigt gauche');
    expect(fingerShort('RR')).toBe('annulaire d.');
    expect(t.day(t.months[10], 16)).toBe('16 nov');
  });

  it('names every finger and every row in both languages', () => {
    for (const lang of ['en', 'fr'] as const) {
      const strings = stringsOf(lang);
      const names = FINGERS.map((finger) => strings.finger(finger));
      // The two thumbs share a lane but not a name.
      expect(new Set(names).size).toBe(FINGERS.length);
      for (const row of ROW_IDS) expect(strings.next.finger('LR', row)).toContain(strings.finger('LR'));
    }
  });

  it('counts sets in the singular and the plural', () => {
    expect(stringsOf('en').stats.window('wpm', 1)).toBe('wpm, last 1 set');
    expect(stringsOf('en').stats.window('wpm', 10)).toBe('wpm, last 10 sets');
    expect(stringsOf('fr').stats.window('mpm', 1)).toBe('mpm, dernière série');
    expect(stringsOf('fr').stats.window('mpm', 10)).toBe('mpm, 10 dernières séries');
  });

  it('takes the first language of the browser that the interface speaks', () => {
    expect(preferredLang(['fr-CA', 'en-CA'])).toBe('fr');
    expect(preferredLang(['en-US', 'fr'])).toBe('en');
    expect(preferredLang(['de-DE', 'FR-fr', 'en'])).toBe('fr');
    expect(preferredLang(['es'])).toBe('en');
    expect(preferredLang([])).toBe('en');
  });
});
