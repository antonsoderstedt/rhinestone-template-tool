import {
  exportPageDxf,
  exportPageSvg,
  exportPdf,
  renderBuildOrderPages,
  renderCover,
  renderPages,
  type CoverContent,
  type PapercraftResult,
} from '@/src/lib/papercraft-engine';
import { createZip } from '../lib/zip';

/** A safe base for file names, from the project name. */
export function exportBaseName(projectName: string): string {
  const cleaned = projectName
    .trim()
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/^\.+/, '')
    .slice(0, 80);
  return cleaned.length > 0 ? cleaned : 'papercraft';
}

/** The pages as a PDF, with a cover page first when `cover` is given. */
export function buildPatternPdf(run: PapercraftResult, cover?: { content: CoverContent; size: { widthMm: number; heightMm: number } } | null): Uint8Array {
  const pages = renderPages(run.layout.pages, run.pattern.parts, { pageNumbers: true });
  if (!cover) return exportPdf(pages);
  // The cover, then the build order (when there is more than one part), then the pages.
  const order = cover.content.buildOrder ? renderBuildOrderPages({ ...cover.content.buildOrder, footer: cover.content.footer }, cover.size) : [];
  return exportPdf([renderCover(cover.content, run.solid, run.pattern, run.layout, cover.size), ...order, ...pages]);
}

/** One Cricut SVG per page (cut, score and draw layers), named `<base>-page-<n>.svg`. */
export function buildCricutSvgs(run: PapercraftResult, base: string): { name: string; svg: string }[] {
  const drawings = renderPages(run.layout.pages, run.pattern.parts);
  return drawings.map((d, i) => ({
    name: drawings.length === 1 ? `${base}-cricut.svg` : `${base}-cricut-page-${i + 1}.svg`,
    svg: exportPageSvg(d, 'cricut'),
  }));
}

/** One DXF per page (layers CUT, SCORE and NUMBERS), named `<base>-silhouette-page-<n>.dxf`. */
export function buildSilhouetteDxfs(run: PapercraftResult, base: string): { name: string; dxf: string }[] {
  const drawings = renderPages(run.layout.pages, run.pattern.parts);
  return drawings.map((d, i) => ({
    name: drawings.length === 1 ? `${base}-silhouette.dxf` : `${base}-silhouette-page-${i + 1}.dxf`,
    dxf: exportPageDxf(d),
  }));
}

export interface ExportFile {
  fileName: string;
  mime: string;
  data: string | Uint8Array;
}

/** The files a "Cricut SVG" download gives: one SVG for one page, a zip for several. */
export function buildCricutDownload(run: PapercraftResult, projectName: string): ExportFile {
  const base = exportBaseName(projectName);
  const files = buildCricutSvgs(run, base);
  if (files.length === 1) return { fileName: files[0].name, mime: 'image/svg+xml', data: files[0].svg };
  return { fileName: `${base}-cricut.zip`, mime: 'application/zip', data: createZip(files.map((f) => ({ name: f.name, data: f.svg }))) };
}

/** The files a "DXF for Silhouette" download gives: one DXF for one page, a zip for several. */
export function buildSilhouetteDownload(run: PapercraftResult, projectName: string): ExportFile {
  const base = exportBaseName(projectName);
  const files = buildSilhouetteDxfs(run, base);
  if (files.length === 1) return { fileName: files[0].name, mime: 'application/dxf', data: files[0].dxf };
  return { fileName: `${base}-silhouette.zip`, mime: 'application/zip', data: createZip(files.map((f) => ({ name: f.name, data: f.dxf }))) };
}

export function buildPdfDownload(
  run: PapercraftResult,
  projectName: string,
  cover?: { content: CoverContent; size: { widthMm: number; heightMm: number } } | null,
): ExportFile {
  return { fileName: `${exportBaseName(projectName)}.pdf`, mime: 'application/pdf', data: buildPatternPdf(run, cover) };
}

export function downloadExportFile(file: ExportFile): void {
  const blob = new Blob([file.data as BlobPart], { type: file.mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.fileName;
  a.click();
  URL.revokeObjectURL(url);
}
