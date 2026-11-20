import { describe, expect, it } from 'vitest';
import { readRhinestoneAutosave } from '../app/editor/projectPersistence';

describe('rhinestone autosave decision', () => {
  it('returns null for missing, invalid, or incomplete autosave data', () => {
    expect(readRhinestoneAutosave(null)).toBeNull();
    expect(readRhinestoneAutosave('')).toBeNull();
    expect(readRhinestoneAutosave('{bad')).toBeNull();
    expect(readRhinestoneAutosave(JSON.stringify({ templateId: 'x' }))).toBeNull();
  });

  it('returns a restorable autosave entry synchronously', () => {
    const entry = {
      templateId: 'autosave-current-design',
      name: 'SMOOCH Autosave',
      snapshot: {
        project: {
          version: 1,
          projectName: 'SMOOCH',
        },
      },
    };

    expect(readRhinestoneAutosave(JSON.stringify(entry))).toEqual(entry);
  });
});
