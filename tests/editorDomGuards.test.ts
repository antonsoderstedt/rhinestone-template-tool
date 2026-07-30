import { describe, expect, it } from 'vitest';
import { isIgnoredKeyboardTarget } from '../app/editor/editorDomGuards';

describe('editorDomGuards', () => {
  it('ignores input elements', () => {
    expect(isIgnoredKeyboardTarget({ tagName: 'INPUT', isContentEditable: false } as unknown as EventTarget)).toBe(true);
  });

  it('ignores textarea elements', () => {
    expect(isIgnoredKeyboardTarget({ tagName: 'TEXTAREA', isContentEditable: false } as unknown as EventTarget)).toBe(true);
  });

  it('ignores select elements', () => {
    expect(isIgnoredKeyboardTarget({ tagName: 'SELECT', isContentEditable: false } as unknown as EventTarget)).toBe(true);
  });

  it('ignores contenteditable elements', () => {
    expect(isIgnoredKeyboardTarget({ tagName: 'DIV', isContentEditable: true } as unknown as EventTarget)).toBe(true);
  });

  it('does not ignore ordinary elements', () => {
    expect(isIgnoredKeyboardTarget({ tagName: 'DIV', isContentEditable: false } as unknown as EventTarget)).toBe(false);
  });
});
