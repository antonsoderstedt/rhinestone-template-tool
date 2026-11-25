import { writeStorageItem } from '../lib/storageQuota';

/**
 * The work in progress, kept so that a reload or a closed tab does not lose it. It is not a saved design (that is Save, in My Designs)
 * and it is not synced: it is this screen's working copy. `activeId` is the saved design it was opened from, if any.
 */
export const PAPERCRAFT_DRAFT_KEY = 'rhinestone-papercraft-draft';

export interface PapercraftDraft {
  activeId: string | null;
  snapshotText: string;
}

function storage(): Storage | null {
  const candidate = globalThis.localStorage as Partial<Storage> | undefined;
  return candidate && typeof candidate.getItem === 'function' && typeof candidate.setItem === 'function' ? (candidate as Storage) : null;
}

export function readPapercraftDraft(): PapercraftDraft | null {
  try {
    const raw = storage()?.getItem(PAPERCRAFT_DRAFT_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<PapercraftDraft>;
    if (typeof data.snapshotText !== 'string' || (data.activeId !== null && typeof data.activeId !== 'string')) return null;
    return { activeId: data.activeId ?? null, snapshotText: data.snapshotText };
  } catch {
    return null;
  }
}

/** False when the browser's storage is full (the draft is then simply not kept). */
export function writePapercraftDraft(draft: PapercraftDraft): boolean {
  return writeStorageItem(storage(), PAPERCRAFT_DRAFT_KEY, JSON.stringify(draft)) === 'ok';
}
