import { fetchCatalogFile, saveCatalogDetails, uploadCatalogFile, type CatalogResult, type CatalogTemplate } from '../lib/catalog/catalogClient';
import { formatOfFileName, idFromName, mimeOfFormat, PAPERCRAFT_MODEL_FORMATS } from '../lib/catalog/catalogFormat';
import { meshOfSource } from './papercraftCompute';
import { canSavePapercraft, deserializePapercraft, snapshotText } from './papercraftSnapshot';
import type { PapercraftState } from './papercraftState';
import { thumbnailPolygons, thumbnailSvg } from './papercraftThumbnail';

/** What the studio can take from the catalog: a 3D model file (OBJ, STL, GLB), or a whole design saved as a template (JSON). */
export type CatalogEntryKind = 'model' | 'design';

export function entryKindOf(template: Pick<CatalogTemplate, 'file'>): CatalogEntryKind | null {
  if (!template.file) return null;
  const format = formatOfFileName(template.file.name);
  if (format === 'json') return 'design';
  return PAPERCRAFT_MODEL_FORMATS.includes(format) ? 'model' : null;
}

/** The templates the studio can open: published, for Papercraft, with a model file or a saved design. */
export function catalogModels(templates: readonly CatalogTemplate[]): CatalogTemplate[] {
  return templates.filter((tpl) => tpl.studio === 'papercraft' && tpl.published && entryKindOf(tpl) !== null);
}

/** Templates that match what was typed (name, category, tags, description). */
export function searchCatalogModels(models: readonly CatalogTemplate[], query: string): CatalogTemplate[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...models];
  return models.filter((tpl) => `${tpl.name} ${tpl.category} ${tpl.tags.join(' ')} ${tpl.description}`.toLowerCase().includes(q));
}

/** The model file of a template as a File, to go through the same import as a file the person picked. */
export async function catalogModelFile(template: CatalogTemplate, fetcher: typeof fetch = fetch): Promise<File | null> {
  const result = await fetchCatalogFile(template, 'file', fetcher);
  if (!result.ok) return null;
  const type = mimeOfFormat(formatOfFileName(result.value.name));
  return new File([result.value.bytes as BlobPart], result.value.name, { type });
}

/** A design saved as a template, as the state it stands for; null when the file is not one of ours. */
export async function catalogDesignState(template: CatalogTemplate, fetcher: typeof fetch = fetch): Promise<PapercraftState | null> {
  const result = await fetchCatalogFile(template, 'file', fetcher);
  if (!result.ok) return null;
  try {
    return deserializePapercraft(JSON.parse(new TextDecoder().decode(result.value.bytes)));
  } catch {
    return null;
  }
}

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

export type SaveTemplateResult = CatalogResult<{ id: string }> | { ok: false; reason: 'too-big' | 'no-name' };

/**
 * Saves the design (model, size, paper, tab settings and, for a model built in the studio, how it is built) as a template in the
 * catalog: the details, the design as a JSON file and a small picture of the model. A new template, never one that replaces another.
 */
export async function saveDesignAsTemplate(state: PapercraftState, options: SaveTemplateOptions, existingIds: Iterable<string>, fetcher: typeof fetch = fetch): Promise<SaveTemplateResult> {
  const name = options.name.trim();
  if (!name) return { ok: false, reason: 'no-name' };
  if (!canSavePapercraft(state)) return { ok: false, reason: 'too-big' };
  const id = uniqueTemplateId(name, existingIds);
  const saved = await saveCatalogDetails(
    { id, studio: 'papercraft', format: 'json', name, description: '', category: options.category.trim(), tags: [], licence: '', fields: { 'Made in': 'Papercraft Studio' }, published: options.published },
    fetcher,
  );
  if (!saved.ok) return saved;
  const text = snapshotText({ ...state, projectName: name, view: 'pattern', selectedPartId: null, fold: 1 });
  const file = await uploadCatalogFile(id, 'file', { name: `${id}.json`, bytes: new TextEncoder().encode(text) }, fetcher);
  if (!file.ok) return file;
  const mesh = meshOfSource(state);
  const svg = mesh ? thumbnailSvg(thumbnailPolygons(mesh, 0)) : null;
  if (svg) await uploadCatalogFile(id, 'preview', { name: `${id}.svg`, bytes: new TextEncoder().encode(svg) }, fetcher);
  return { ok: true, value: { id } };
}
