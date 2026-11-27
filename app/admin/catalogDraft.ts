/** The form of one template in the admin panel: what is typed, and the step from it to the details the server stores. */

import { formatOfFileName, idFromName, STUDIO_FORMATS, type CatalogStudio } from '../lib/catalog/catalogFormat';
import { RHINESTONE_PROJECT_SUFFIX } from '../lib/catalog/studioCatalog';
import type { CatalogDetails, CatalogTemplate } from '../lib/catalog/catalogClient';

export interface FieldRow { key: string; value: string }

export interface CatalogDraft {
  isNew: boolean;
  id: string;
  studio: CatalogStudio;
  format: string;
  name: string;
  description: string;
  category: string;
  tagsText: string;
  licence: string;
  fields: FieldRow[];
  published: boolean;
}

export function emptyDraft(studio: CatalogStudio = 'papercraft'): CatalogDraft {
  return { isNew: true, id: '', studio, format: STUDIO_FORMATS[studio][0]!, name: '', description: '', category: '', tagsText: '', licence: '', fields: [], published: false };
}

export function draftOf(template: CatalogTemplate): CatalogDraft {
  return {
    isNew: false,
    id: template.id,
    studio: template.studio,
    format: template.format,
    name: template.name,
    description: template.description,
    category: template.category,
    tagsText: template.tags.join(', '),
    licence: template.licence,
    fields: Object.entries(template.fields).map(([key, value]) => ({ key, value })),
    published: template.published,
  };
}

export function parseTags(text: string): string[] {
  const tags: string[] = [];
  for (const part of text.split(/[,;\n]/)) {
    const tag = part.trim();
    if (tag && !tags.includes(tag)) tags.push(tag);
  }
  return tags;
}

/** The details to save. A field with no name is left out; a repeated name keeps the last value. */
export function detailsOf(draft: CatalogDraft, formatFromFile: string | null): CatalogDetails {
  const fields: Record<string, string> = {};
  for (const row of draft.fields) {
    const key = row.key.trim();
    if (key) fields[key] = row.value.trim();
  }
  return {
    id: draft.isNew ? (draft.id.trim() || idFromName(draft.name)) : draft.id,
    studio: draft.studio,
    format: formatFromFile ?? draft.format,
    name: draft.name.trim(),
    description: draft.description.trim(),
    category: draft.category.trim(),
    tags: parseTags(draft.tagsText),
    licence: draft.licence.trim(),
    fields,
    published: draft.published,
  };
}

export type DraftProblem = 'name' | 'id' | 'format' | 'project-name' | 'publish-without-file';

/** What is wrong with the form before it is sent. `fileName` is the file chosen now, if any; `hasFile` says the template already has one. */
export function draftProblems(draft: CatalogDraft, fileName: string | null, hasFile: boolean): DraftProblem[] {
  const problems: DraftProblem[] = [];
  if (!draft.name.trim()) problems.push('name');
  const id = draft.isNew ? (draft.id.trim() || idFromName(draft.name)) : draft.id;
  if (!/^[a-z0-9][a-z0-9._-]{0,79}$/.test(id)) problems.push('id');
  if (fileName && !STUDIO_FORMATS[draft.studio].includes(formatOfFileName(fileName))) problems.push('format');
  // Rhinestone opens a project from the catalog only when it is named like the studio names its project files.
  else if (fileName && draft.studio === 'rhinestone' && formatOfFileName(fileName) === 'json' && !fileName.toLowerCase().endsWith(RHINESTONE_PROJECT_SUFFIX)) problems.push('project-name');
  if (draft.published && !fileName && !hasFile) problems.push('publish-without-file');
  return problems;
}
