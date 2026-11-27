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

/** What “Save project file” in the Rhinestone studio names its files; a Rhinestone JSON template must be one of those. */
export const RHINESTONE_PROJECT_SUFFIX = '.rhinestone.json';

/** Whether the studio can open a file of this name from the catalog (an SVG; for Rhinestone also a `.rhinestone.json` project). */
export function isOpenableFileName(studio: SvgStudio, fileName: string): boolean {
  const format = formatOfFileName(fileName);
  if (!OPEN_FORMATS[studio].includes(format)) return false;
  return format !== 'json' || fileName.toLowerCase().endsWith(RHINESTONE_PROJECT_SUFFIX);
}

/** The templates the studio can open: its own, published, with a file it can open. */
export function openableTemplates(studio: SvgStudio, templates: readonly CatalogTemplate[]): CatalogTemplate[] {
  return templates.filter((tpl) => tpl.studio === studio && tpl.published && tpl.file !== null && isOpenableFileName(studio, tpl.file.name));
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
