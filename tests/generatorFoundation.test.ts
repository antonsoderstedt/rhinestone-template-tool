import { describe, expect, it } from 'vitest';
import {
  IMPLEMENTED_GENERATOR_CAPABILITIES,
  InMemoryTemplateLibraryRepository,
  createTemplateLibraryEntry,
  deepCloneProjectSnapshot,
  getGeneratorCapabilityProfile,
} from '../src/lib/rhinestone-engine/index';
import { DEFAULT_EDITOR_STATE } from '../app/editor/EditorState';
import { buildProjectFileFromEditorState } from '../app/editor/projectPersistence';

describe('generator capability foundation', () => {
  it('only exposes implemented coverage modes', () => {
    expect(getGeneratorCapabilityProfile('outline-text').supportedCoverageModes).toEqual(['outline', 'fill', 'outline-fill', 'contour']);
    expect(getGeneratorCapabilityProfile('outline-text').supportedPlacementPatterns).toEqual(['default', 'hexagonal', 'radial']);
    expect(getGeneratorCapabilityProfile('dot-matrix-text').supportedCoverageModes).not.toContain('contour');
    expect(getGeneratorCapabilityProfile('manual').supportedPlacementPatterns).toEqual([]);
    expect(IMPLEMENTED_GENERATOR_CAPABILITIES.svg.supportedFillPatterns).toEqual(['grid', 'offset-grid']);
  });
});

describe('template library foundation', () => {
  it('serializes a deep-cloned project snapshot', () => {
    const project = buildProjectFileFromEditorState(DEFAULT_EDITOR_STATE);
    expect(project).not.toBeNull();
    const snapshot = deepCloneProjectSnapshot(project!);
    expect(snapshot.project).toEqual(project);
    expect(snapshot.project).not.toBe(project);
  });

  it('creates entries with cloned snapshots and metadata', () => {
    const project = buildProjectFileFromEditorState(DEFAULT_EDITOR_STATE)!;
    const entry = createTemplateLibraryEntry({
      templateId: 'starter-1',
      name: 'Starter',
      category: 'starter',
      tags: ['starter'],
      builtIn: true,
      readOnly: true,
      favorite: false,
      previewRef: null,
      widthMm: null,
      heightMm: null,
      stoneCount: 0,
      stoneSizes: [],
      colorLayerCount: 1,
      createdAt: '2026-07-30T00:00:00.000Z',
      updatedAt: '2026-07-30T00:00:00.000Z',
      snapshot: project,
    });
    expect(entry.snapshot.project).toEqual(project);
    expect(entry.snapshot.project).not.toBe(project);
  });

  it('prevents built-in templates from being overwritten', async () => {
    const repo = new InMemoryTemplateLibraryRepository({
      version: 1,
      builtInTemplates: [
        createTemplateLibraryEntry({
          templateId: 'builtin-1',
          name: 'Builtin',
          category: 'starter',
          tags: [],
          builtIn: true,
          readOnly: true,
          favorite: false,
          previewRef: null,
          widthMm: null,
          heightMm: null,
          stoneCount: 0,
          stoneSizes: [],
          colorLayerCount: 1,
          createdAt: '2026-07-30T00:00:00.000Z',
          updatedAt: '2026-07-30T00:00:00.000Z',
          snapshot: buildProjectFileFromEditorState(DEFAULT_EDITOR_STATE)!,
        }),
      ],
      userTemplates: [],
    });

    await expect(repo.save((await repo.get('builtin-1'))!)).rejects.toThrow(/immutable/);
    await expect(repo.delete('builtin-1')).rejects.toThrow(/cannot be deleted/);
  });

  it('duplicates built-in templates into editable user templates', async () => {
    const repo = new InMemoryTemplateLibraryRepository({
      version: 1,
      builtInTemplates: [
        createTemplateLibraryEntry({
          templateId: 'builtin-1',
          name: 'Builtin',
          category: 'starter',
          tags: [],
          builtIn: true,
          readOnly: true,
          favorite: false,
          previewRef: null,
          widthMm: null,
          heightMm: null,
          stoneCount: 0,
          stoneSizes: [],
          colorLayerCount: 1,
          createdAt: '2026-07-30T00:00:00.000Z',
          updatedAt: '2026-07-30T00:00:00.000Z',
          snapshot: buildProjectFileFromEditorState(DEFAULT_EDITOR_STATE)!,
        }),
      ],
      userTemplates: [],
    });

    const duplicated = await repo.duplicate('builtin-1', 'copy-1', 'Copy');
    expect(duplicated.builtIn).toBe(false);
    expect(duplicated.readOnly).toBe(false);
    expect(duplicated.templateId).toBe('copy-1');
  });
});
