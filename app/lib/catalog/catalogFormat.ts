/**
 * How a catalog file travels: the Worker stores text, so a text format (an OBJ model, an SVG, a JSON snapshot) is sent as it is and a
 * binary one (a PDF, a picture) as base64. Which of the two follows from the format, so the file needs no marker.
 */

export const CATALOG_STUDIOS = ['rhinestone', 'htv', 'papercraft'] as const;
export type CatalogStudio = (typeof CATALOG_STUDIOS)[number];

export const STUDIO_NAMES: Record<CatalogStudio, string> = { rhinestone: 'Rhinestone', htv: 'HTV', papercraft: 'Papercraft' };

/** The formats a studio can use from the catalog. */
export const STUDIO_FORMATS: Record<CatalogStudio, readonly string[]> = {
  rhinestone: ['svg', 'json'],
  htv: ['svg'],
  papercraft: ['obj', 'stl', 'glb', 'pdf', 'svg', 'json'],
};

/** The catalog formats that are 3D models the Papercraft studio can open as a model. */
export const PAPERCRAFT_MODEL_FORMATS: readonly string[] = ['obj', 'stl', 'glb'];

export const TEXT_FORMATS: ReadonlySet<string> = new Set(['obj', 'svg', 'json', 'dxf', 'txt', 'csv']);
export const PREVIEW_FORMATS = ['svg', 'png', 'jpg', 'jpeg', 'webp'] as const;

export function isTextFormat(format: string): boolean {
  return TEXT_FORMATS.has(format.toLowerCase());
}

export function formatOfFileName(name: string): string {
  const match = /\.([A-Za-z0-9]{1,12})$/.exec(name);
  return match ? match[1]!.toLowerCase() : '';
}

export function mimeOfFormat(format: string): string {
  switch (format.toLowerCase()) {
    case 'svg': return 'image/svg+xml';
    case 'json': return 'application/json';
    case 'obj': return 'model/obj';
    case 'dxf': return 'image/vnd.dxf';
    case 'pdf': return 'application/pdf';
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'webp': return 'image/webp';
    default: return 'application/octet-stream';
  }
}

/** A readable id for a template from its name: lower case, a-z and 0-9 with dashes (å, ä, ö become a, a, o). */
export function idFromName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/å|ä/g, 'a')
    .replace(/ö/g, 'o')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'template';
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) binary += String.fromCharCode(...bytes.subarray(i, i + step));
  return btoa(binary);
}

export function base64ToBytes(text: string): Uint8Array {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** The text to send for a file's bytes. */
export function encodeForCatalog(format: string, bytes: Uint8Array): string {
  return isTextFormat(format) ? new TextDecoder().decode(bytes) : bytesToBase64(bytes);
}

/** The bytes of a file the Worker sent back as text. */
export function decodeFromCatalog(format: string, text: string): Uint8Array {
  return isTextFormat(format) ? new TextEncoder().encode(text) : base64ToBytes(text);
}
