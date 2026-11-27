/**
 * New designs and fonts the owner uploads in the admin panel (ADR 0063). They are stored in the database and added to the lists of the
 * built libraries. Pure functions, shared by the Worker (which validates what it stores) and the browser (which merges the lists).
 */

import { FONT_CATEGORIES, LIBRARY_ID_PATTERN, LIBRARY_LIMITS, applyDesignOverlay, applyFontOverlay, type LibraryKind, type LibraryOverlay, isLibraryKind } from './library';

export const DESIGN_FORMAT = 'json';
export const FONT_FORMATS = ['ttf', 'otf', 'woff'] as const;
export type FontFormat = (typeof FONT_FORMATS)[number];

/** A design is stored as compact JSON text; a font as base64 text (the Worker stores text and never parses a file). */
export const ITEM_LIMITS = { designChars: 2_000_000, fontChars: 2_000_000, family: 80 } as const;
/** About 1.5 MB of font: what the Worker can decode when the font is asked for, in the CPU time it has. */
export const MAX_FONT_BYTES = 1_500_000;

export const UPLOAD_ID_PREFIX = 'upload-';

export interface DesignMeta {
  stones: number;
  widthMm: number;
  heightMm: number;
  stoneMm: number;
}

/** What the lists need to know about an uploaded item; the file itself is fetched when it is used. */
export interface LibraryItem {
  kind: LibraryKind;
  id: string;
  name: string;
  category: string;
  /** `json` for a design, the font file's format for a font. */
  format: string;
  /** Characters stored (base64 for a font). */
  chars: number;
  updatedAt: string;
  /** The family of a font. */
  family: string;
  /** The size of a design; empty for a font. */
  design: DesignMeta | null;
}

export interface LibraryItems {
  design: LibraryItem[];
  font: LibraryItem[];
}

export const emptyItems = (): LibraryItems => ({ design: [], font: [] });

const tidy = (value: string): string => value.replace(/\s+/g, ' ').trim();

/** A readable id for an uploaded item from its name: `upload-` and a-z, 0-9 and dashes. */
export function uploadIdFromName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/å|ä/g, 'a')
    .replace(/ö/g, 'o')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${UPLOAD_ID_PREFIX}${slug || 'item'}`;
}

/** An id that no other item in either library has: `upload-name`, then `upload-name-2`, `-3`, … */
export function uniqueUploadId(name: string, taken: ReadonlySet<string>): string {
  const base = uploadIdFromName(name);
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export type ParsedItem = { ok: true; item: Omit<LibraryItem, 'updatedAt' | 'chars'>; data: string } | { ok: false; error: string };

const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;

const finite = (value: unknown, min: number, max: number): number | null => (typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : null);

/** Checks an upload from the admin panel. The file text itself is only measured, never read. */
export function parseItem(raw: unknown): ParsedItem {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ok: false, error: 'An upload must be an object.' };
  const o = raw as Record<string, unknown>;
  if (!isLibraryKind(o.kind)) return { ok: false, error: 'Bad kind.' };
  const kind = o.kind;
  if (typeof o.id !== 'string' || !LIBRARY_ID_PATTERN.test(o.id) || !o.id.startsWith(UPLOAD_ID_PREFIX)) return { ok: false, error: `The id must start with ${UPLOAD_ID_PREFIX}.` };
  if (typeof o.name !== 'string' || tidy(o.name) === '') return { ok: false, error: 'An item needs a name.' };
  const name = tidy(o.name);
  const category = typeof o.category === 'string' ? tidy(o.category) : '';
  if (name.length > LIBRARY_LIMITS.name || category.length > LIBRARY_LIMITS.category) return { ok: false, error: 'The name or the category is too long.' };
  if (typeof o.data !== 'string' || o.data.length === 0) return { ok: false, error: 'The file is empty.' };

  if (kind === 'design') {
    if (o.data.length > ITEM_LIMITS.designChars) return { ok: false, error: 'The design is too large.' };
    const m = (typeof o.design === 'object' && o.design !== null ? o.design : {}) as Record<string, unknown>;
    const stones = finite(m.stones, 1, 200_000);
    const widthMm = finite(m.widthMm, 0.1, 3000);
    const heightMm = finite(m.heightMm, 0.1, 3000);
    const stoneMm = finite(m.stoneMm, 0.1, 100);
    if (stones === null || widthMm === null || heightMm === null || stoneMm === null) return { ok: false, error: 'The design needs its stones and size.' };
    return { ok: true, data: o.data, item: { kind, id: o.id, name, category, format: DESIGN_FORMAT, family: '', design: { stones: Math.round(stones), widthMm, heightMm, stoneMm } } };
  }

  const format = typeof o.format === 'string' ? o.format.toLowerCase() : '';
  if (!(FONT_FORMATS as readonly string[]).includes(format)) return { ok: false, error: 'A font must be a TTF, OTF or WOFF file.' };
  if (o.data.length > ITEM_LIMITS.fontChars) return { ok: false, error: 'The font is too large.' };
  // Only base64 text: a text with other characters would be stored and then fail when the font is asked for.
  if (o.data.length % 4 !== 0 || !BASE64_PATTERN.test(o.data)) return { ok: false, error: 'The font file is damaged.' };
  if (category !== '' && !(FONT_CATEGORIES as readonly string[]).includes(category)) return { ok: false, error: 'A font category must be one of the known ones.' };
  const family = typeof o.family === 'string' ? tidy(o.family).slice(0, ITEM_LIMITS.family) : '';
  return { ok: true, data: o.data, item: { kind, id: o.id, name, category, format, family, design: null } };
}

/** The address of an item's file; `v` changes when the item does, so a browser may keep the file for a long time. */
export function itemFileUrl(item: Pick<LibraryItem, 'kind' | 'id' | 'updatedAt'>): string {
  return `/api/library/file?kind=${item.kind}&id=${encodeURIComponent(item.id)}&v=${encodeURIComponent(item.updatedAt)}`;
}

/** The list the design picker shows: the built library and the uploaded designs, with the owner's changes on top. */
export function designsWithUploads<T extends { id: string; title: string; category: string }>(
  built: readonly T[],
  items: LibraryItems,
  overlay: LibraryOverlay,
  make: (item: LibraryItem, file: string) => T,
): T[] {
  const uploaded = items.design.filter((item) => item.design).map((item) => make(item, itemFileUrl(item)));
  return applyDesignOverlay([...built, ...uploaded], overlay);
}

/** The fonts the studios know: the built library and the uploaded fonts (each with the address of its file), hidden ones marked. */
export function fontsWithUploads<T extends { id: string; name: string; category?: string }>(
  built: readonly T[],
  items: LibraryItems,
  overlay: LibraryOverlay,
  make: (item: LibraryItem, url: string) => T,
): (T & { hidden?: boolean })[] {
  const uploaded = items.font.map((item) => make(item, itemFileUrl(item)));
  return applyFontOverlay([...built, ...uploaded], overlay);
}

/** What the server sent as the uploaded items; anything that does not fit is left out. */
export function parseItems(raw: unknown): LibraryItems {
  const items = emptyItems();
  if (typeof raw !== 'object' || raw === null) return items;
  for (const kind of ['design', 'font'] as const) {
    const list = (raw as Record<string, unknown>)[kind];
    if (!Array.isArray(list)) continue;
    for (const value of list) {
      if (typeof value !== 'object' || value === null) continue;
      const v = value as Record<string, unknown>;
      if (typeof v.id !== 'string' || !LIBRARY_ID_PATTERN.test(v.id) || typeof v.name !== 'string') continue;
      const d = (typeof v.design === 'object' && v.design !== null ? v.design : null) as Record<string, unknown> | null;
      const design = d && [d.stones, d.widthMm, d.heightMm, d.stoneMm].every((n) => typeof n === 'number' && Number.isFinite(n))
        ? { stones: d.stones as number, widthMm: d.widthMm as number, heightMm: d.heightMm as number, stoneMm: d.stoneMm as number }
        : null;
      if (kind === 'design' && !design) continue;
      items[kind].push({
        kind,
        id: v.id,
        name: v.name,
        category: typeof v.category === 'string' ? v.category : '',
        format: typeof v.format === 'string' ? v.format : kind === 'design' ? DESIGN_FORMAT : 'woff',
        chars: typeof v.chars === 'number' ? v.chars : 0,
        updatedAt: typeof v.updatedAt === 'string' ? v.updatedAt : '',
        family: typeof v.family === 'string' ? v.family : '',
        design: kind === 'design' ? design : null,
      });
    }
  }
  return items;
}
