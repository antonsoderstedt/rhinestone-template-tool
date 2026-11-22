import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isLanguage, languageFromBrowser, translate } from '../app/lib/i18n';
import { SV } from '../app/lib/i18n/sv';

const APP = path.resolve(__dirname, '../app');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === 'api' ? [] : sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

/** Every `t('…')` and `t("…")` call with a literal in the app's source. */
function literalKeys(): Array<{ file: string; key: string }> {
  const found: Array<{ file: string; key: string }> = [];
  for (const file of sourceFiles(APP)) {
    if (file.endsWith(`${path.sep}i18n.ts`) || file.includes(`${path.sep}i18n${path.sep}`)) continue;
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/\bt\(\s*'((?:[^'\\]|\\.)*)'/g)) found.push({ file: path.relative(APP, file), key: match[1]!.replace(/\\'/g, "'") });
    for (const match of text.matchAll(/\bt\(\s*"((?:[^"\\]|\\.)*)"/g)) found.push({ file: path.relative(APP, file), key: match[1]!.replace(/\\"/g, '"') });
  }
  return found;
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort();

describe('translation (plan A9)', () => {
  it('has a Swedish text for every t(\'…\') in the source', () => {
    const missing = literalKeys().filter(({ key }) => !(key in SV));
    expect(missing.map((m) => `${m.file}: ${m.key}`)).toEqual([]);
  });

  it('has no empty Swedish text and keeps every {value} of the English', () => {
    for (const [key, value] of Object.entries(SV)) {
      expect(value.trim().length, key).toBeGreaterThan(0);
      expect(placeholders(value), key).toEqual(placeholders(key));
    }
  });

  it('translates, falls back to English for a text it does not know, and fills in values', () => {
    expect(translate('sv', 'Menu')).toBe('Meny');
    expect(translate('en', 'Menu')).toBe('Menu');
    expect(translate('sv', 'A text nobody translated')).toBe('A text nobody translated');
    expect(translate('en', '{n} stones', { n: 12 })).toBe('12 stones');
    expect(translate('sv', '{n} stones', { n: 12 })).toBe('12 stenar');
    expect(translate('sv', '{n} stones')).toBe('{n} stenar');
  });

  it('starts in Swedish for a Swedish browser and in English otherwise', () => {
    expect(languageFromBrowser(['sv-SE', 'en'])).toBe('sv');
    expect(languageFromBrowser(['en-US'])).toBe('en');
    expect(languageFromBrowser(undefined)).toBe('en');
    expect(isLanguage('sv')).toBe(true);
    expect(isLanguage('de')).toBe(false);
  });
});
