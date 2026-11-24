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

/** Extension of the explicit project-file download (backup / sharing). */
export const PROJECT_FILE_EXTENSION = '.rhinestone.json';

/** Project files are plain JSON of stones and settings; anything this big is not one. */
export const MAX_PROJECT_FILE_BYTES = 20 * 1024 * 1024;

export function buildProjectFilename(projectName: string): string {
  const name = projectName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'untitled';

  return `${name}${PROJECT_FILE_EXTENSION}`;
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
  if (file.size > MAX_PROJECT_FILE_BYTES) {
    throw new Error('This file is too large to be a project file.');
  }
  const json = await file.text();
  return readProjectJson(json);
}

/**
 * Serializes and downloads a RhinestoneProjectFile.
 * Filename is derived from the projectName and generatorId.
 */
export function downloadProject(project: RhinestoneProjectFile, filename?: string): void {
  const finalFilename = filename ?? buildProjectFilename(project.projectName);
  downloadJson(finalFilename, serializeRhinestoneProject(project));
}
