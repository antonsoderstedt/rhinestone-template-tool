import { describe, expect, it } from 'vitest';
import { buildProjectFileFromEditorState } from '../app/editor/projectPersistence';
import { DEFAULT_EDITOR_STATE } from '../app/editor/EditorState';
import { buildProjectFilename, readProjectJson } from '../app/lib/projectUtils';
import { serializeRhinestoneProject } from '../src/lib/rhinestone-engine/index';

describe('project utils', () => {
  it('builds a portable project filename from the project name and generator', () => {
    expect(buildProjectFilename('My Project', 'outline-text')).toBe('rhinestone-project-outline-text-my-project.json');
    expect(buildProjectFilename('   My   Project   ', 'svg-upload')).toBe('rhinestone-project-svg-upload-my-project.json');
  });

  it('reads a project JSON back into the canonical project format', () => {
    const project = buildProjectFileFromEditorState(DEFAULT_EDITOR_STATE);
    expect(project).not.toBeNull();

    const json = serializeRhinestoneProject(project!);
    const restored = readProjectJson(json);

    expect(restored.projectName).toBe(DEFAULT_EDITOR_STATE.projectName);
    expect(restored.generatorState.generatorId).toBe(project!.generatorState.generatorId);
  });
});
