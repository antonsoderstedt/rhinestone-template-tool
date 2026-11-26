import { fetchCatalogFile, type CatalogTemplate } from '../lib/catalog/catalogClient';
import { formatOfFileName, mimeOfFormat, PAPERCRAFT_MODEL_FORMATS } from '../lib/catalog/catalogFormat';

/** The templates the studio can open as a 3D model: published, for Papercraft, with a model file. */
export function catalogModels(templates: readonly CatalogTemplate[]): CatalogTemplate[] {
  return templates.filter((tpl) => tpl.studio === 'papercraft' && tpl.published && tpl.file !== null && PAPERCRAFT_MODEL_FORMATS.includes(formatOfFileName(tpl.file.name)));
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
