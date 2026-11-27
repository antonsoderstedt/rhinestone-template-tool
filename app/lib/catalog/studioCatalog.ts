/**
 * What the Rhinestone and HTV studios take from the template catalog (ADR 0061): the published templates of their own studio that
 * have a file they can open. Rhinestone opens an SVG (as artwork, like a library asset) or a saved project (`.rhinestone.json`);
 * HTV opens an SVG (as a vector layer, like an imported one).
 */

import { fetchCatalogFile, type CatalogTemplate } from './catalogClient';
import { formatOfFileName, mimeOfFormat } from './catalogFormat';

export type SvgStudio = 'rhinestone' | 'htv';

/** The file types each studio can open from the catalog. */
export const OPEN_FORMATS: Record<SvgStudio, readonly string[]> = {
  rhinestone: ['svg', 'json'],
  htv: ['svg'],
};

/** The templates the studio can open: its own, published, with a file of a type it can open. */
export function openableTemplates(studio: SvgStudio, templates: readonly CatalogTemplate[]): CatalogTemplate[] {
  return templates.filter((tpl) => tpl.studio === studio && tpl.published && tpl.file !== null && OPEN_FORMATS[studio].includes(formatOfFileName(tpl.file.name)));
}

/** Templates that match what was typed (name, category, tags, description). */
export function searchTemplates(templates: readonly CatalogTemplate[], query: string): CatalogTemplate[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...templates];
  return templates.filter((tpl) => `${tpl.name} ${tpl.category} ${tpl.tags.join(' ')} ${tpl.description}`.toLowerCase().includes(q));
}

/** The template's file as a File, to go through the same import as a file the person picked. Null when it cannot be fetched. */
export async function catalogTemplateFile(template: CatalogTemplate, fetcher: typeof fetch = fetch): Promise<File | null> {
  const result = await fetchCatalogFile(template, 'file', fetcher);
  if (!result.ok) return null;
  return new File([result.value.bytes as BlobPart], result.value.name, { type: mimeOfFormat(formatOfFileName(result.value.name)) });
}
