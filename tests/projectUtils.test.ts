import { describe, expect, it } from 'vitest';
import { buildProjectFileFromEditorState } from '../app/editor/projectPersistence';
import { DEFAULT_EDITOR_STATE } from '../app/editor/EditorState';
import { buildProjectFilename, MAX_PROJECT_FILE_BYTES, readProjectFile, readProjectJson } from '../app/lib/projectUtils';
import { serializeRhinestoneProject } from '../src/lib/rhinestone-engine/index';

describe('project utils', () => {
  it('builds a portable project filename from the project name and generator', () => {
    expect(buildProjectFilename('My Project')).toBe('my-project.rhinestone.json');
    expect(buildProjectFilename('   My   Project   ')).toBe('my-project.rhinestone.json');
    expect(buildProjectFilename('???')).toBe('untitled.rhinestone.json');
  });

  it('reads a project JSON back into the canonical project format', () => {
    const project = buildProjectFileFromEditorState(DEFAULT_EDITOR_STATE);
    expect(project).not.toBeNull();

    const json = serializeRhinestoneProject(project!);
    const restored = readProjectJson(json);

    expect(restored.projectName).toBe(DEFAULT_EDITOR_STATE.projectName);
    expect(restored.generatorState.generatorId).toBe(project!.generatorState.generatorId);
  });

  it('rejects a file that is far too large to be a project file', async () => {
    const huge = { size: MAX_PROJECT_FILE_BYTES + 1, text: async () => '{}' } as unknown as File;
    await expect(readProjectFile(huge)).rejects.toThrow(/too large/);
  });

  it('rejects content that is not a project file without executing anything', () => {
    expect(() => readProjectJson('{"schemaVersion":1,"__proto__":{"polluted":true}}')).toThrow();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(() => readProjectJson('<script>alert(1)</script>')).toThrow(/could not be parsed/);
  });
});
