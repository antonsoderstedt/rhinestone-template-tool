/** What the library list in the admin panel shows: the rows as the owner has changed them, filtered and cut into pages. Pure. */

import type { LibraryOverlay, LibraryKind } from '@/src/lib/library/library';
import type { LibraryItem } from '@/src/lib/library/libraryItems';

/** One item of a library as it was built. */
export interface LibraryRow {
  id: string;
  name: string;
  category: string;
  /** A short line of facts for the list: the stones and size of a design, the family of a font. */
  detail: string;
  /** Uploaded in the admin panel (and so can be deleted), not part of the built library. */
  uploaded?: boolean;
}

export interface ShownRow extends LibraryRow {
  /** The name and category now (the owner's, or the library's own). */
  shownName: string;
  shownCategory: string;
  hidden: boolean;
  /** The owner has changed this item in some way. */
  changed: boolean;
}

export type StatusFilter = 'all' | 'visible' | 'hidden' | 'changed' | 'uploaded';

export interface ListFilter {
  query: string;
  /** The category shown, or '' for all. */
  category: string;
  status: StatusFilter;
}

export const EMPTY_FILTER: ListFilter = { query: '', category: '', status: 'all' };

/** The uploaded items as rows: the category they were given, or the one an upload gets when none is chosen. */
export function uploadedRows(kind: LibraryKind, items: readonly LibraryItem[]): LibraryRow[] {
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category || (kind === 'font' ? 'Uploads' : 'Uploaded'),
    detail: item.design ? `${item.design.stones} · ${item.design.widthMm}×${item.design.heightMm} mm` : item.family,
    uploaded: true,
  }));
}

export function shownRows(rows: readonly LibraryRow[], overlay: LibraryOverlay, kind: LibraryKind): ShownRow[] {
  return rows.map((row) => {
    const o = overlay[kind][row.id];
    return { ...row, shownName: o?.name || row.name, shownCategory: o?.category || row.category, hidden: o?.hidden === true, changed: o !== undefined };
  });
}

export function filterRows(rows: readonly ShownRow[], filter: ListFilter): ShownRow[] {
  const query = filter.query.trim().toLowerCase();
  return rows.filter((row) => {
    if (filter.category !== '' && row.shownCategory !== filter.category) return false;
    if (filter.status === 'visible' && row.hidden) return false;
    if (filter.status === 'hidden' && !row.hidden) return false;
    if (filter.status === 'changed' && !row.changed) return false;
    if (filter.status === 'uploaded' && !row.uploaded) return false;
    if (query === '') return true;
    return row.shownName.toLowerCase().includes(query) || row.shownCategory.toLowerCase().includes(query) || row.name.toLowerCase().includes(query) || row.id.toLowerCase().includes(query);
  });
}

/** The categories in use, each with how many items it has, most items first. */
export function categoryCounts(rows: readonly ShownRow[]): { category: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.shownCategory, (counts.get(row.shownCategory) ?? 0) + 1);
  return [...counts].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
}

export function pageCount(total: number, size: number): number {
  return Math.max(1, Math.ceil(total / size));
}

export function pageOf<T>(rows: readonly T[], page: number, size: number): T[] {
  const index = Math.min(Math.max(0, page), pageCount(rows.length, size) - 1);
  return rows.slice(index * size, index * size + size);
}
