/**
 * The design and font libraries as the owner curates them in the admin panel (ADR 0063). The libraries themselves are large static
 * files built on the owner's computer; what the admin panel changes is a small overlay kept in the database: an item can be hidden,
 * and its name and category can be changed. Pure functions, shared by the Worker (which validates what it stores) and the browser
 * (which applies the overlay to the lists the studios show).
 */

export type LibraryKind = 'design' | 'font';
export const LIBRARY_KINDS: readonly LibraryKind[] = ['design', 'font'];

/** `name` and `category` are empty when the item keeps the library's own. */
export interface LibraryOverride {
  hidden: boolean;
  name: string;
  category: string;
}

/** The categories a font can have: the engine's own list; anything else is shown as Uploads. */
export const FONT_CATEGORIES = ['Block', 'Condensed', 'Varsity', 'Bubble', 'Serif', 'Gothic', 'Script', 'Handwritten', 'Display', 'Uploads'] as const;

export const LIBRARY_LIMITS = { name: 120, category: 60, id: 120, batch: 200 } as const;
export const LIBRARY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/;

export const NEUTRAL_OVERRIDE: LibraryOverride = { hidden: false, name: '', category: '' };

export const isNeutralOverride = (o: LibraryOverride): boolean => !o.hidden && o.name === '' && o.category === '';

export type LibraryPatch = Partial<LibraryOverride>;

const tidy = (value: string): string => value.replace(/\s+/g, ' ').trim();

export type PatchResult = { ok: true; patch: LibraryPatch } | { ok: false; error: string };

/** Checks what the admin panel sends for one or many items: only the fields that change are present. */
export function parsePatch(raw: unknown): PatchResult {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ok: false, error: 'A change must be an object.' };
  const o = raw as Record<string, unknown>;
  const patch: LibraryPatch = {};
  if (o.hidden !== undefined) {
    if (typeof o.hidden !== 'boolean') return { ok: false, error: 'Hidden must be on or off.' };
    patch.hidden = o.hidden;
  }
  for (const key of ['name', 'category'] as const) {
    if (o[key] === undefined) continue;
    if (typeof o[key] !== 'string') return { ok: false, error: `The ${key} must be text.` };
    const value = tidy(o[key] as string);
    if (value.length > LIBRARY_LIMITS[key]) return { ok: false, error: `The ${key} is at most ${LIBRARY_LIMITS[key]} characters.` };
    patch[key] = value;
  }
  if (Object.keys(patch).length === 0) return { ok: false, error: 'Nothing to change.' };
  return { ok: true, patch };
}

export type IdsResult = { ok: true; ids: string[] } | { ok: false; error: string };

/** The ids of a request: 1 to LIBRARY_LIMITS.batch distinct ids of the allowed shape. */
export function parseIds(raw: unknown): IdsResult {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > LIBRARY_LIMITS.batch) return { ok: false, error: `Give between 1 and ${LIBRARY_LIMITS.batch} ids.` };
  const ids: string[] = [];
  for (const id of raw) {
    if (typeof id !== 'string' || !LIBRARY_ID_PATTERN.test(id)) return { ok: false, error: 'Bad id.' };
    if (!ids.includes(id)) ids.push(id);
  }
  return { ok: true, ids };
}

export const isLibraryKind = (value: unknown): value is LibraryKind => value === 'design' || value === 'font';

/** The overrides of every item that has one, by kind and id. An item without an entry is as the library has it. */
export interface LibraryOverlay {
  design: Record<string, LibraryOverride>;
  font: Record<string, LibraryOverride>;
}

export const emptyOverlay = (): LibraryOverlay => ({ design: {}, font: {} });

/** The overlay as the server sent it; anything that does not fit is left out. */
export function parseOverlay(raw: unknown): LibraryOverlay {
  const overlay = emptyOverlay();
  if (typeof raw !== 'object' || raw === null) return overlay;
  for (const kind of LIBRARY_KINDS) {
    const group = (raw as Record<string, unknown>)[kind];
    if (typeof group !== 'object' || group === null || Array.isArray(group)) continue;
    for (const [id, value] of Object.entries(group as Record<string, unknown>)) {
      if (!LIBRARY_ID_PATTERN.test(id) || typeof value !== 'object' || value === null) continue;
      const v = value as Record<string, unknown>;
      const override: LibraryOverride = {
        hidden: v.hidden === true,
        name: typeof v.name === 'string' ? v.name.slice(0, LIBRARY_LIMITS.name) : '',
        category: typeof v.category === 'string' ? v.category.slice(0, LIBRARY_LIMITS.category) : '',
      };
      if (!isNeutralOverride(override)) overlay[kind][id] = override;
    }
  }
  return overlay;
}

/** The same rule the Worker applies: the given fields replace the old ones, and an item that is back to normal has no entry. */
export function patchOverlay(overlay: LibraryOverlay, kind: LibraryKind, ids: readonly string[], patch: LibraryPatch): LibraryOverlay {
  const group = { ...overlay[kind] };
  for (const id of ids) {
    const next: LibraryOverride = { ...NEUTRAL_OVERRIDE, ...group[id], ...patch };
    if (isNeutralOverride(next)) delete group[id];
    else group[id] = next;
  }
  return { ...overlay, [kind]: group };
}

/** A design as the studios list it: hidden ones are left out, and the owner's title and category are used. */
export function applyDesignOverlay<T extends { id: string; title: string; category: string }>(designs: readonly T[], overlay: LibraryOverlay): T[] {
  const out: T[] = [];
  for (const design of designs) {
    const o = overlay.design[design.id];
    if (!o) out.push(design);
    else if (!o.hidden) out.push({ ...design, title: o.name || design.title, category: o.category || design.category });
  }
  return out;
}

/**
 * A font as the studios list it. Hidden fonts stay in the list, marked `hidden`: a saved design that uses one must still find it,
 * so a hidden font is only left out of the pickers, never out of the lookup.
 */
export function applyFontOverlay<T extends { id: string; name: string; category?: string }>(fonts: readonly T[], overlay: LibraryOverlay): (T & { hidden?: boolean })[] {
  return fonts.map((font) => {
    const o = overlay.font[font.id];
    if (!o) return font;
    return { ...font, name: o.name || font.name, category: o.category || font.category, ...(o.hidden ? { hidden: true } : {}) };
  });
}
