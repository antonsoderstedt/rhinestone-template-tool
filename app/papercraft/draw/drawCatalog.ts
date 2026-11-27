import { drawingOf, exportPageSvg, parseDoc, serializeDoc, type DrawDoc } from '@/src/lib/papercraft-engine';
import { fetchCatalogFile, saveCatalogDetails, uploadCatalogFile, type CatalogTemplate } from '../../lib/catalog/catalogClient';
import { formatOfFileName } from '../../lib/catalog/catalogFormat';
import { DRAWING_KIND, isDrawingTemplate, KIND_FIELD, uniqueTemplateId, type SaveTemplateOptions } from '../papercraftCatalog';

/** The templates the drawing tool can open: published, for Papercraft, a JSON file marked as a drawing. */
export function drawingEntries(templates: readonly CatalogTemplate[]): CatalogTemplate[] {
  return templates.filter((tpl) => tpl.studio === 'papercraft' && tpl.published && tpl.file !== null && formatOfFileName(tpl.file.name) === 'json' && isDrawingTemplate(tpl));
}

/** A drawing saved as a template, as the document it stands for; null when the file is not a drawing of ours. */
export async function catalogDrawingDoc(template: CatalogTemplate, fetcher: typeof fetch = fetch): Promise<DrawDoc | null> {
  const result = await fetchCatalogFile(template, 'file', fetcher);
  if (!result.ok) return null;
  try {
    return parseDoc(JSON.parse(new TextDecoder().decode(result.value.bytes)));
  } catch {
    return null;
  }
}

export type SaveDrawingResult =
  | { ok: true; value: { id: string; previewSaved: boolean } }
  | { ok: false; reason: 'no-name' | 'nothing-drawn' | 'error'; message?: string };

/**
 * Saves the drawing as a new template in the catalog (ADR 0057): the details (marked `Kind: drawing`, so the studio does not offer it as a design),
 * the drawing as JSON and a small SVG picture. The id comes from the name and never replaces another template.
 */
export async function saveDrawingAsTemplate(doc: DrawDoc, options: SaveTemplateOptions, existingIds: Iterable<string>, fetcher: typeof fetch = fetch): Promise<SaveDrawingResult> {
  const name = options.name.trim();
  if (!name) return { ok: false, reason: 'no-name' };
  if (doc.items.length === 0) return { ok: false, reason: 'nothing-drawn' };
  const id = uniqueTemplateId(name, existingIds);
  const saved = await saveCatalogDetails(
    { id, studio: 'papercraft', format: 'json', name, description: '', category: options.category.trim(), tags: [], licence: '', fields: { 'Made in': 'Papercraft drawing tool', [KIND_FIELD]: DRAWING_KIND }, published: options.published },
    fetcher,
  );
  if (!saved.ok) return { ok: false, reason: 'error', message: saved.message };
  const file = await uploadCatalogFile(id, 'file', { name: `${id}.json`, bytes: new TextEncoder().encode(JSON.stringify(serializeDoc({ ...doc, name }))) }, fetcher);
  if (!file.ok) return { ok: false, reason: 'error', message: file.message };
  // The picture is only for the list: a template without one still opens, so a failed upload does not fail the save, but it is reported.
  const svg = exportPageSvg(drawingOf(doc, { crop: true }), 'print');
  const preview = await uploadCatalogFile(id, 'preview', { name: `${id}.svg`, bytes: new TextEncoder().encode(svg) }, fetcher);
  return { ok: true, value: { id, previewSaved: preview.ok } };
}
