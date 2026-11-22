import { describe, expect, it } from 'vitest';
import { shouldSkip, translateExact } from '../app/lib/domTranslation';

describe('translating text that is not written through t() (plan A9)', () => {
  it('translates a whole text and keeps the whitespace around it', () => {
    expect(translateExact('sv', '  Zoom in  ')).toBe('  Zooma in  ');
    expect(translateExact('sv', '\n   Settings\n')).toBe('\n   Inställningar\n');
  });

  it('leaves English alone, and anything that is not exactly a known text', () => {
    expect(translateExact('en', 'Zoom in')).toBe('Zoom in');
    expect(translateExact('sv', 'Zoom in a little')).toBe('Zoom in a little');
    expect(translateExact('sv', 'x')).toBe('x');
    expect(translateExact('sv', 'Mia Rose design')).toBe('Mia Rose design');
  });

  it('never touches fields the user types in, or marked parts', () => {
    expect(shouldSkip({ tagName: 'TEXTAREA' })).toBe(true);
    expect(shouldSkip({ tagName: 'INPUT' })).toBe(true);
    expect(shouldSkip({ tagName: 'DIV', isContentEditable: true })).toBe(true);
    expect(shouldSkip({ tagName: 'DIV', closest: (selector: string) => (selector.includes('data-no-translate') ? {} : null) })).toBe(true);
    expect(shouldSkip({ tagName: 'DIV', closest: () => null })).toBe(false);
    expect(shouldSkip(null)).toBe(true);
  });
});
