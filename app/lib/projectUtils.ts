/**
 * Browser utility helpers for project save/load.
 *
 * These are client-side only — never call from the engine.
 */

import {
  parseRhinestoneProject,
  serializeRhinestoneProject,
  type RhinestoneProjectFile,
} from '@/src/lib/rhinestone-engine/index';

export function buildProjectFilename(projectName: string, generatorId: string): string {
  const slug = generatorId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24) || 'project';
  const name = projectName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'untitled';

  return `rhinestone-project-${slug}-${name}.json`;
}

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

export function readProjectJson(json: string): RhinestoneProjectFile {
  return parseRhinestoneProject(json);
}

export async function readProjectFile(file: File): Promise<RhinestoneProjectFile> {
  const json = await file.text();
  return readProjectJson(json);
}

/**
 * Serializes and downloads a RhinestoneProjectFile.
 * Filename is derived from the projectName and generatorId.
 */
export function downloadProject(project: RhinestoneProjectFile, filename?: string): void {
  const finalFilename = filename ?? buildProjectFilename(project.projectName, project.generatorState.generatorId);
  downloadJson(finalFilename, serializeRhinestoneProject(project));
}
