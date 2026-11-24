/**
 * What the Fonts page shows: every font (bundled, the font library, the user's uploads) grouped into families, filtered and
 * sorted. Pure, so it can be tested.
 */

export type FontSource = 'bundled' | 'browser-uploaded' | 'workspace-installed';

/** One font file as the page lists it. */
export type FontEntry = {
  key: string;
  name: string;
  familyName: string;
  variantName: string;
  importSourceLabel: string;
  category: string;
  styleLabel: string;
  previewFamily: string;
  source: FontSource;
  favorite: boolean;
  archived: boolean;
  tags: string[];
  isBuiltInSimple: boolean;
  fontUrl: string | null;
  fontWeight: number;
  fontStyle: 'normal' | 'italic';
  note: string;
  licenseSource: string;
  preferredTextCoverageMode: 'outline' | 'fill' | 'outline-fill' | 'contour';
  fileName: string | null;
};

export interface FontFamily {
  key: string;
  name: string;
  category: string;
  source: FontSource;
  variants: FontEntry[];
  favorite: boolean;
  archived: boolean;
  tags: string[];
}

export type FontSort = 'name' | 'category' | 'favorites';

export interface FontFilters {
  query: string;
  category: string;
  source: 'all' | FontSource;
  favoritesOnly: boolean;
  showArchived: boolean;
}

export const DEFAULT_FONT_FILTERS: FontFilters = { query: '', category: 'all', source: 'all', favoritesOnly: false, showArchived: false };

const byName = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

/** Variants of one family in a stable order: Regular first, then by name. */
function variantOrder(a: FontEntry, b: FontEntry): number {
  const rank = (font: FontEntry) => (/regular|normal|book|roman/i.test(`${font.variantName} ${font.name}`) ? 0 : 1);
  return rank(a) - rank(b) || byName(a.name, b.name);
}

export function groupFamilies(fonts: readonly FontEntry[]): FontFamily[] {
  const groups = new Map<string, FontEntry[]>();
  for (const font of fonts) {
    const key = `${font.source}|${font.familyName.trim().toLowerCase()}`;
    groups.set(key, [...(groups.get(key) ?? []), font]);
  }
  return [...groups].map(([key, variants]) => {
    const sorted = [...variants].sort(variantOrder);
    return {
      key,
      name: sorted[0]!.familyName,
      category: sorted[0]!.category,
      source: sorted[0]!.source,
      variants: sorted,
      favorite: sorted.some((font) => font.favorite),
      archived: sorted.every((font) => font.archived),
      tags: [...new Set(sorted.flatMap((font) => font.tags))].sort(byName),
    };
  });
}

function matchesQuery(family: FontFamily, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = `${family.name} ${family.category} ${family.tags.join(' ')} ${family.variants.map((font) => `${font.name} ${font.variantName}`).join(' ')}`.toLowerCase();
  return words.every((word) => haystack.includes(word));
}

export function filterFamilies(families: readonly FontFamily[], filters: FontFilters, ignoreCategory = false): FontFamily[] {
  return families.filter((family) => {
    if (!filters.showArchived && family.archived) return false;
    if (filters.source !== 'all' && family.source !== filters.source) return false;
    if (!ignoreCategory && filters.category !== 'all' && family.category !== filters.category) return false;
    if (filters.favoritesOnly && !family.favorite) return false;
    return matchesQuery(family, filters.query);
  });
}

export function sortFamilies(families: readonly FontFamily[], sort: FontSort): FontFamily[] {
  return [...families].sort((a, b) => {
    if (sort === 'favorites' && a.favorite !== b.favorite) return Number(b.favorite) - Number(a.favorite);
    if (sort === 'category') {
      const diff = byName(a.category, b.category);
      if (diff !== 0) return diff;
    }
    return byName(a.name, b.name);
  });
}

/** Categories with how many families each has under the other filters (so the chips show what a click would give). */
export function categoryCounts(families: readonly FontFamily[], filters: FontFilters): Array<{ category: string; count: number }> {
  const counts = new Map<string, number>();
  for (const family of filterFamilies(families, filters, true)) counts.set(family.category, (counts.get(family.category) ?? 0) + 1);
  return [...counts].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count || byName(a.category, b.category));
}
