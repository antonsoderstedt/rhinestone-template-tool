/** What every studio's “Save as a template” shares: an id nobody has, the options the person gives, and putting the files in the catalog. */

import { saveCatalogDetails, uploadCatalogFile, type CatalogResult } from './catalogClient';
import { idFromName, type CatalogStudio } from './catalogFormat';

/** An id from the name that no template has yet: `box`, `box-2`, `box-3`, … */
export function uniqueTemplateId(name: string, existingIds: Iterable<string>): string {
  const taken = new Set(existingIds);
  const base = idFromName(name).slice(0, 70);
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export interface SaveTemplateOptions {
  name: string;
  category: string;
  published: boolean;
}

/** `previewSaved` is false when the template was saved but its picture could not be: the template works, it just has no picture. */
export type SaveTemplateResult = CatalogResult<{ id: string; previewSaved: boolean }> | { ok: false; reason: 'too-big' | 'no-name' };

export interface TemplateFiles {
  studio: CatalogStudio;
  /** The file's name, from the id the template gets (a Rhinestone project must end in `.rhinestone.json`). */
  fileName: (id: string) => string;
  /** The file's text. */
  text: string;
  /** A small SVG picture for the list, or null. */
  previewSvg: string | null;
  /** The most characters the studio can open again. */
  maxChars: number;
  fields: Record<string, string>;
}

/**
 * Puts a new template in the catalog: the details, the file and a small picture. Never replaces another template. A failed picture does
 * not fail the save (the template still opens) but is reported in `previewSaved`.
 */
export async function saveTemplateToCatalog(files: TemplateFiles, options: SaveTemplateOptions, existingIds: Iterable<string>, fetcher: typeof fetch = fetch): Promise<SaveTemplateResult> {
  const name = options.name.trim();
  if (!name) return { ok: false, reason: 'no-name' };
  if (files.text.length > files.maxChars) return { ok: false, reason: 'too-big' };
  const id = uniqueTemplateId(name, existingIds);
  const fileName = files.fileName(id);
  const saved = await saveCatalogDetails(
    { id, studio: files.studio, format: fileName.slice(fileName.lastIndexOf('.') + 1).toLowerCase(), name, description: '', category: options.category.trim(), tags: [], licence: '', fields: files.fields, published: options.published },
    fetcher,
  );
  if (!saved.ok) return saved;
  const file = await uploadCatalogFile(id, 'file', { name: fileName, bytes: new TextEncoder().encode(files.text) }, fetcher);
  if (!file.ok) return file;
  const preview = files.previewSvg ? await uploadCatalogFile(id, 'preview', { name: `${id}.svg`, bytes: new TextEncoder().encode(files.previewSvg) }, fetcher) : null;
  return { ok: true, value: { id, previewSaved: preview === null ? true : preview.ok } };
}
