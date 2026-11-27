/**
 * What the Rhinestone and HTV studios take from the template catalog (ADR 0061): the published templates of their own studio that
 * have a file they can open. Rhinestone opens an SVG (as artwork, like a library asset) or a saved project (`.rhinestone.json`);
 * HTV opens an SVG (as a vector layer, like an imported one).
 */

import { fetchCatalogFile, type CatalogTemplate } from './catalogClient';
import { HTV_DESIGN_SUFFIX, formatOfFileName, mimeOfFormat } from './catalogFormat';
import { saveTemplateToCatalog, type SaveTemplateOptions, type SaveTemplateResult } from './saveTemplate';

export type SvgStudio = 'rhinestone' | 'htv';

/** The file types each studio can open from the catalog. */
export const OPEN_FORMATS: Record<SvgStudio, readonly string[]> = {
  rhinestone: ['svg', 'json'],
  htv: ['svg', 'json'],
};

/** What “Save project file” in the Rhinestone studio names its files; a Rhinestone JSON template must be one of those. */
export const RHINESTONE_PROJECT_SUFFIX = '.rhinestone.json';

/** What each studio's own JSON files are named: a JSON template of a studio must end like this to be listed (ADR 0061, 0064). */
export const PROJECT_SUFFIX: Record<SvgStudio, string> = { rhinestone: RHINESTONE_PROJECT_SUFFIX, htv: HTV_DESIGN_SUFFIX };

/** Whether the studio can open a file of this name from the catalog (an SVG; also a saved project: `.rhinestone.json`, `.htv.json`). */
export function isOpenableFileName(studio: SvgStudio, fileName: string): boolean {
  const format = formatOfFileName(fileName);
  if (!OPEN_FORMATS[studio].includes(format)) return false;
  return format !== 'json' || fileName.toLowerCase().endsWith(PROJECT_SUFFIX[studio]);
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

/** The most characters of a project file the studio opens from the catalog (`MAX_PROJECT_FILE_BYTES`, 20 MB). */
const MAX_PROJECT_CHARS = 20 * 1024 * 1024;

/**
 * Saves the current HTV design as a template: the design file (named `<id>.htv.json`, so the studio lists it again) and a small SVG
 * picture of the cut shapes. A new template, never one that replaces another.
 */
export function saveHtvTemplate(designJson: string, previewSvg: string | null, options: SaveTemplateOptions, existingIds: Iterable<string>, fetcher: typeof fetch = fetch): Promise<SaveTemplateResult> {
  return saveTemplateToCatalog(
    { studio: 'htv', fileName: (id) => `${id}${HTV_DESIGN_SUFFIX}`, text: designJson, previewSvg, maxChars: MAX_PROJECT_CHARS, fields: { 'Made in': 'HTV Studio' } },
    options,
    existingIds,
    fetcher,
  );
}

/**
 * Saves the current Rhinestone design as a template: the project file (named `<id>.rhinestone.json`, so the studio lists it again),
 * and a small SVG picture of the stones. A new template, never one that replaces another.
 */
export function saveRhinestoneTemplate(projectJson: string, previewSvg: string | null, options: SaveTemplateOptions, existingIds: Iterable<string>, fetcher: typeof fetch = fetch): Promise<SaveTemplateResult> {
  return saveTemplateToCatalog(
    { studio: 'rhinestone', fileName: (id) => `${id}${RHINESTONE_PROJECT_SUFFIX}`, text: projectJson, previewSvg, maxChars: MAX_PROJECT_CHARS, fields: { 'Made in': 'Rhinestone Studio' } },
    options,
    existingIds,
    fetcher,
  );
}
