import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_TEMPLATE_LIBRARY_STORAGE_KEY,
  LocalStorageTemplateLibraryRepository,
} from '../src/lib/rhinestone-engine/templateLibrary/repository';
import { createTemplateLibraryEntry } from '../src/lib/rhinestone-engine/templateLibrary/model';

class MemoryStorage implements Storage {
  private map = new Map<string, string>();

  get length() {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

function makeEntry(templateId: string, name: string) {
  return createTemplateLibraryEntry({
    templateId,
    name,
    category: 'starter',
    tags: ['test'],
    builtIn: false,
    readOnly: false,
    favorite: false,
    previewRef: null,
    widthMm: 120,
    heightMm: 80,
    stoneCount: 24,
    stoneSizes: ['SS10'],
    colorLayerCount: 1,
    createdAt: '2026-08-03T00:00:00.000Z',
    updatedAt: '2026-08-03T00:00:00.000Z',
    snapshot: {
      schemaVersion: 1,
      savedAt: '2026-08-03T00:00:00.000Z',
      projectName: name,
      exportSettings: {
        includeGuideBox: true,
        includeLabels: false,
        paddingMm: 5,
      },
      generatorState: {
        generatorId: 'manual-editor',
        stones: [],
        includeGuideBox: true,
        paddingMm: 5,
      },
      activeTool: 'manual',
      manualToolState: {
        snapToGrid: true,
        gridSnapSize: 2,
        addStoneSize: 'SS10',
      },
    },
  });
}

describe('LocalStorageTemplateLibraryRepository', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: new MemoryStorage(),
      configurable: true,
    });
  });

  it('seeds built-in starter templates when storage is empty', async () => {
    const repo = new LocalStorageTemplateLibraryRepository(DEFAULT_TEMPLATE_LIBRARY_STORAGE_KEY);
    const record = await repo.list();

    expect(record.builtInTemplates.length).toBeGreaterThan(0);
    expect(record.builtInTemplates[0]?.builtIn).toBe(true);
    expect(record.builtInTemplates[0]?.readOnly).toBe(true);
  });

  it('saves and lists user templates from browser storage', async () => {
    const repo = new LocalStorageTemplateLibraryRepository(DEFAULT_TEMPLATE_LIBRARY_STORAGE_KEY);
    await repo.save(makeEntry('entry-1', 'First'));

    const record = await repo.list();
    expect(record.userTemplates).toHaveLength(1);
    expect(record.userTemplates[0]?.name).toBe('First');
  });

  it('updates favorite state in browser storage', async () => {
    const repo = new LocalStorageTemplateLibraryRepository(DEFAULT_TEMPLATE_LIBRARY_STORAGE_KEY);
    await repo.save(makeEntry('entry-1', 'First'));
    const updated = await repo.favorite('entry-1', true);

    expect(updated.favorite).toBe(true);
    const stored = await repo.get('entry-1');
    expect(stored?.favorite).toBe(true);
  });

  it('deletes user templates from browser storage', async () => {
    const repo = new LocalStorageTemplateLibraryRepository(DEFAULT_TEMPLATE_LIBRARY_STORAGE_KEY);
    await repo.save(makeEntry('entry-1', 'First'));
    await repo.delete('entry-1');

    const record = await repo.list();
    expect(record.userTemplates).toHaveLength(0);
  });
});