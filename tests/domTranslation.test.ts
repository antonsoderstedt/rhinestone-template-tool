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

  it('translates the sentences with numbers in them that are made in code', () => {
    expect(translateExact('sv', '1 layer · full front')).toBe('1 lager · hela framsidan');
    expect(translateExact('sv', '3 layers · left chest')).toBe('3 lager · vänster bröst');
    expect(translateExact('sv', '127 stones · grid on')).toBe('127 stenar · rutnät på');
    expect(translateExact('sv', 'Design canvas. 127 stones, about 126 by 41 millimetres. 2 selected.')).toBe('Designyta. 127 stenar, ungefär 126 gånger 41 millimeter. 2 markerade.');
    expect(translateExact('sv', 'Design canvas. Nothing here yet.')).toBe('Designyta. Inget här än.');
    expect(translateExact('sv', '2 layers elsewhere, not exported')).toBe('2 lager på andra platser, exporteras inte');
    expect(translateExact('en', '1 layer · full front')).toBe('1 layer · full front');
  });

  it('translates favourites, storage and time sentences', () => {
    expect(translateExact('sv', 'Add Mia design to favorites')).toBe('Lägg till Mia design som favorit');
    expect(translateExact('sv', "9% of this browser's storage is used")).toBe('9 % av den här webbläsarens lagring används');
    expect(translateExact('sv', '2 days ago')).toBe('för 2 dagar sedan');
    expect(translateExact('sv', '127 stones · SS10')).toBe('127 stenar · SS10');
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
