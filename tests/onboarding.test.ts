import { describe, expect, it } from 'vitest';
import {
  GETTING_STARTED_STEPS,
  ONBOARDING_STORAGE_KEY,
  readOnboardingDismissed,
  resetOnboarding,
  writeOnboardingDismissed,
} from '../app/lib/onboarding';
import { GLOSSARY, TEXT_EXAMPLES, getCanvasHint } from '../app/editor/editorUi';
import { DEFAULT_TEXT_TOOL_STATE } from '../app/editor/EditorState';

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value) };
}

describe('onboarding guide persistence', () => {
  it('shows until dismissed, then stays dismissed', () => {
    const storage = fakeStorage();
    expect(readOnboardingDismissed(storage)).toBe(false);
    writeOnboardingDismissed(storage);
    expect(storage.getItem(ONBOARDING_STORAGE_KEY)).toBe('true');
    expect(readOnboardingDismissed(storage)).toBe(true);
  });

  it('can be shown again after being dismissed', () => {
    const data = new Map<string, string>();
    const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
    writeOnboardingDismissed(storage);
    expect(readOnboardingDismissed(storage)).toBe(true);
    resetOnboarding(storage);
    expect(readOnboardingDismissed(storage)).toBe(false);
  });

  it('survives missing or blocked storage', () => {
    expect(readOnboardingDismissed(null)).toBe(false);
    const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(readOnboardingDismissed(blocked)).toBe(false);
    expect(() => writeOnboardingDismissed(blocked)).not.toThrow();
  });

  it('has the four steps from pick stone to export', () => {
    expect(GETTING_STARTED_STEPS.map((step) => step.title)).toEqual(['Pick a stone size', 'Type your text', 'Check the spacing', 'Export']);
  });
});

describe('first-run copy', () => {
  it('canvas hints point to the panel on the right and never tell the user to press Generate', () => {
    for (const tool of ['text', 'svg-alphabet', 'letter-stencil', 'svg', 'grid'] as const) {
      const hint = getCanvasHint(tool);
      expect(hint, tool).not.toMatch(/on the left/i);
      expect(hint, tool).not.toMatch(/\bGenerate\b/);
    }
    expect(getCanvasHint('text')).toMatch(/on the right/);
  });

  it('starts with neutral sample text, not a personal or brand word', () => {
    expect(DEFAULT_TEXT_TOOL_STATE.text).toBe('YOUR NAME');
  });

  it('offers examples and plain-language terms', () => {
    expect(TEXT_EXAMPLES.length).toBeGreaterThanOrEqual(3);
    expect(TEXT_EXAMPLES.every((example) => example.text.trim().length > 0)).toBe(true);
    expect(Object.values(GLOSSARY).every((entry) => entry.length > 20)).toBe(true);
  });
});
