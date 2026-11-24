/**
 * Opening the studio from a link (a starter, a font, a saved design) keeps the last session as a copy in My Designs, so
 * nothing is lost. Without limits that filled My Designs with near-identical "(previous session)" copies, so a copy is
 * only made when it is worth keeping, and only a few are kept.
 */

import type { TemplateLibraryEntry } from '@/src/lib/rhinestone-engine/index';

export const MAX_PREVIOUS_SESSIONS = 3;
const SUFFIX = ' (previous session)';

export const isPreviousSessionCopy = (entry: Pick<TemplateLibraryEntry, 'templateId' | 'name'>): boolean =>
  entry.templateId.startsWith('previous-session-') && entry.name.endsWith(SUFFIX);

/** What the design is, without its name or when it was saved, so two copies of the same design compare equal. */
function contentSignature(entry: TemplateLibraryEntry): string {
  try {
    return JSON.stringify({ ...(entry.snapshot.project as unknown as Record<string, unknown>), projectName: '' });
  } catch {
    return entry.templateId;
  }
}

export interface PreviousSessionPlan {
  keep: boolean;
  /** Why not, in a short phrase (for tests and logs). */
  reason?: 'empty' | 'already-saved';
  /** Old "(previous session)" copies to delete so that at most `MAX_PREVIOUS_SESSIONS` remain with the new one. */
  prune: string[];
}

export function planPreviousSessionKeep(previous: TemplateLibraryEntry, userTemplates: readonly TemplateLibraryEntry[]): PreviousSessionPlan {
  if (previous.stoneCount === 0) return { keep: false, reason: 'empty', prune: [] };

  const signature = contentSignature(previous);
  if (userTemplates.some((entry) => contentSignature(entry) === signature)) return { keep: false, reason: 'already-saved', prune: [] };

  const copies = userTemplates
    .filter(isPreviousSessionCopy)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.templateId.localeCompare(b.templateId));
  return { keep: true, prune: copies.slice(MAX_PREVIOUS_SESSIONS - 1).map((entry) => entry.templateId) };
}
