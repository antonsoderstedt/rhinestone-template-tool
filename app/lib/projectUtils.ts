/**
 * Browser utility helpers for project save/load.
 *
 * These are client-side only — never call from the engine.
 */

import {
  serializeRhinestoneProject,
  type RhinestoneProjectFile,
} from '@/src/lib/rhinestone-engine/index';

/**
 * Triggers a browser download of a JSON file.
 */
export function downloadJson(filename: string, json: string): void {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Serializes and downloads a RhinestoneProjectFile.
 * Filename is derived from the projectName and generatorId.
 */
export function downloadProject(project: RhinestoneProjectFile): void {
  const slug = project.generatorState.generatorId;
  const name = project.projectName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const filename = `rhinestone-project-${slug}-${name}.json`;
  downloadJson(filename, serializeRhinestoneProject(project));
}
