/**
 * "Pick up where you left off": the most recently changed saved designs, from both studios, in one list.
 * Pure: give it the saved designs, get back what to show.
 */

import type { TemplateLibraryEntry } from '@/src/lib/rhinestone-engine/index';
import type { HtvDesignEntry, PapercraftDesignEntry } from './workspaceVault';
import { savedDesignThumbnail } from '../papercraft/papercraftThumbnail';
import { sanitizePreviewRef } from './workspaceBackup';

export const DEFAULT_RECENT_DESIGN_LIMIT = 4;

export interface RecentDesign {
  /** Unique across both studios. */
  key: string;
  studio: 'rhinestone' | 'htv' | 'papercraft';
  id: string;
  name: string;
  updatedAt: string;
  /** Where "Open" goes: the studio with this design loaded. */
  href: string;
  /** A ready-to-show picture (a data: URI), or null when there is none. */
  thumbnail: string | null;
  /** Text to show in place of a picture. */
  placeholderText: string;
  /** Short facts, e.g. "120 stones · SS10". */
  details: string;
}

export function buildRecentDesigns(
  input: {
    rhinestoneDesigns: readonly TemplateLibraryEntry[];
    htvDesigns: readonly HtvDesignEntry[];
    papercraftDesigns?: readonly PapercraftDesignEntry[];
    /** Keys like `rhinestone:<id>` the user archived. HTV designs carry their own `archived` flag. */
    archivedKeys?: ReadonlySet<string>;
  },
  limit: number = DEFAULT_RECENT_DESIGN_LIMIT,
): RecentDesign[] {
  const archived = input.archivedKeys ?? new Set<string>();

  const rhinestone: RecentDesign[] = input.rhinestoneDesigns
    .filter((entry) => !archived.has(`rhinestone:${entry.templateId}`))
    .map((entry) => ({
      key: `rhinestone:${entry.templateId}`,
      studio: 'rhinestone' as const,
      id: entry.templateId,
      name: entry.name,
      updatedAt: entry.updatedAt,
      href: `/rhinestone?designId=${encodeURIComponent(entry.templateId)}`,
      thumbnail: sanitizePreviewRef(entry.previewRef),
      placeholderText: entry.name,
      details: `${entry.stoneCount.toLocaleString('en-US')} ${entry.stoneCount === 1 ? 'stone' : 'stones'}${entry.stoneSizes.length > 0 ? ` · ${entry.stoneSizes.join(', ')}` : ''}`,
    }));

  const htv: RecentDesign[] = input.htvDesigns
    .filter((entry) => !entry.archived)
    .map((entry) => ({
      key: `htv:${entry.designId}`,
      studio: 'htv' as const,
      id: entry.designId,
      name: entry.name,
      updatedAt: entry.updatedAt,
      href: `/htv?designId=${encodeURIComponent(entry.designId)}`,
      thumbnail: null,
      placeholderText: entry.previewText || entry.name,
      details: `${entry.layerCount} ${entry.layerCount === 1 ? 'layer' : 'layers'}${entry.garmentLabel ? ` · ${entry.garmentLabel}` : ''}`,
    }));

  const papercraft: RecentDesign[] = (input.papercraftDesigns ?? [])
    .filter((entry) => !entry.archived)
    .map((entry) => ({
      key: `papercraft:${entry.designId}`,
      studio: 'papercraft' as const,
      id: entry.designId,
      name: entry.name,
      updatedAt: entry.updatedAt,
      href: `/papercraft?designId=${encodeURIComponent(entry.designId)}`,
      thumbnail: savedDesignThumbnail(entry),
      placeholderText: entry.name,
      details: `${entry.sourceLabel} · ${entry.sizeLabel}`,
    }));

  return [...rhinestone, ...htv, ...papercraft]
    // Newest first; the key breaks ties so the order never depends on how the lists were stored.
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.key.localeCompare(b.key))
    .slice(0, Math.max(0, limit));
}
