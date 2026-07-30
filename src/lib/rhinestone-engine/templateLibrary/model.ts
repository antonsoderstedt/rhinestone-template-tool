import type { RhinestoneProjectFile } from '../project/projectFormat';
import type { StoneSizeId } from '../types/index';

export type TemplateLibraryCategory =
  | 'text'
  | 'svg'
  | 'grid'
  | 'manual'
  | 'starter'
  | 'favorites';

export interface TemplateSnapshot {
  version: 1;
  project: RhinestoneProjectFile;
}

export interface TemplateLibraryEntry {
  templateId: string;
  name: string;
  category: TemplateLibraryCategory;
  tags: string[];
  builtIn: boolean;
  readOnly: boolean;
  favorite: boolean;
  previewRef: string | null;
  widthMm: number | null;
  heightMm: number | null;
  stoneCount: number;
  stoneSizes: StoneSizeId[];
  colorLayerCount: number;
  createdAt: string;
  updatedAt: string;
  snapshot: TemplateSnapshot;
}

export interface TemplateLibraryRecord {
  version: 1;
  builtInTemplates: TemplateLibraryEntry[];
  userTemplates: TemplateLibraryEntry[];
}

export function deepCloneProjectSnapshot(project: RhinestoneProjectFile): TemplateSnapshot {
  return {
    version: 1,
    project: structuredClone(project),
  };
}

export function createTemplateLibraryEntry(input: Omit<TemplateLibraryEntry, 'snapshot'> & { snapshot: RhinestoneProjectFile }): TemplateLibraryEntry {
  return {
    ...input,
    tags: [...input.tags],
    stoneSizes: [...input.stoneSizes],
    snapshot: deepCloneProjectSnapshot(input.snapshot),
  };
}
