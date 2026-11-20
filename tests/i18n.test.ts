import { afterEach, describe, expect, it } from 'vitest';
import { FINGERS } from '../src/core/fingers';
import { fingerName, fingerShort, preferredLang, preferredLayout, setUiLang, stringsOf, t } from '../src/core/i18n';
import { readLaunch, withoutLaunch } from '../src/core/launch';
import { ROW_IDS } from '../src/core/physical';
import { LANGS } from '../src/core/store';

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
    for (const lang of LANGS) expect(shape(stringsOf(lang)), lang).toEqual(shape(stringsOf('en')));
  });

  it('leaves no entry empty', () => {
    for (const lang of LANGS) {
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
    for (const lang of LANGS) {
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

  it('counts the sets of a hardcore run in the singular and the plural', () => {
    expect(stringsOf('en').hardcore.runValue(1, '0:42')).toBe('1 set, 0:42');
    expect(stringsOf('en').hardcore.runValue(3, '2:05')).toBe('3 sets, 2:05');
    expect(stringsOf('fr').hardcore.runValue(1, '0:42')).toBe('1 série, 0:42');
    expect(stringsOf('fr').hardcore.runValue(0, '0:07')).toBe('0 série, 0:07');
    expect(stringsOf('fr').hardcore.runValue(2, '1:10')).toBe('2 séries, 1:10');
  });

  it('mentions the climb of the floor only at a difficulty that has one', () => {
    for (const lang of LANGS) {
      const { floorTitle } = stringsOf(lang).hardcore;
      expect(floorTitle(60, 2, 15)).toContain('60');
      expect(floorTitle(60, 2, 15)).toContain('15 s');
      expect(floorTitle(60, 0, 15)).not.toContain('15 s');
      expect(floorTitle(60, 0, 15)).not.toMatch(/[.,]$/);
    }
  });

  it('takes the first language of the browser that the interface speaks', () => {
    expect(preferredLang(['fr-CA', 'en-CA'])).toBe('fr');
    expect(preferredLang(['en-US', 'fr'])).toBe('en');
    expect(preferredLang(['de-DE', 'FR-fr', 'en'])).toBe('de');
    expect(preferredLang(['es'])).toBe('es');
    expect(preferredLang(['pt-BR', 'it', 'es-MX'])).toBe('es');
    expect(preferredLang(['pt-BR', 'ja'])).toBe('en');
    expect(preferredLang([])).toBe('en');
  });

  it('starts a first visit on the layout of the browser language and region', () => {
    expect(preferredLayout(['fr-CA'])).toBe('ca-fr');
    expect(preferredLayout(['fr'])).toBe('ca-fr');
    expect(preferredLayout(['fr-FR'])).toBe('azerty');
    expect(preferredLayout(['fr-BE'])).toBe('azerty');
    expect(preferredLayout(['fr-CH'])).toBe('qwertz-ch');
    expect(preferredLayout(['de-DE'])).toBe('qwertz');
    expect(preferredLayout(['de-AT'])).toBe('qwertz');
    expect(preferredLayout(['de-CH'])).toBe('qwertz-ch');
    expect(preferredLayout(['es-ES'])).toBe('es');
    expect(preferredLayout(['es-MX'])).toBe('latam');
    expect(preferredLayout(['es-419'])).toBe('latam');
    expect(preferredLayout(['en-GB', 'fr-FR'])).toBe('us');
    expect(preferredLayout(['pt-BR', 'de'])).toBe('qwertz');
    expect(preferredLayout([])).toBe('us');
  });
});

describe('links into the trainer', () => {
  it('reads a known language and layout from the address and ignores the rest', () => {
    expect(readLaunch('?lang=de&layout=dvorak')).toEqual({ lang: 'de', layout: 'dvorak' });
    expect(readLaunch('?layout=colemak-dh')).toEqual({ layout: 'colemak-dh' });
    expect(readLaunch('?lang=ja&layout=neo')).toEqual({});
    expect(readLaunch('')).toEqual({});
  });

  it('drops the language and layout from the address, keeping the other parameters and the drill', () => {
    expect(withoutLaunch('?lang=de&layout=dvorak', '#words')).toBe('#words');
    expect(withoutLaunch('?demo=comp&layout=dvorak', '#pairs')).toBe('?demo=comp#pairs');
    expect(withoutLaunch('', '')).toBe('');
  });
});
