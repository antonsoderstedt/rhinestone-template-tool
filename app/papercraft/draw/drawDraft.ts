import { parseDoc, serializeDoc, type DrawDoc } from '@/src/lib/papercraft-engine';
import { writeStorageItem } from '../../lib/storageQuota';

/** The drawing in progress, kept for the next visit (a reload or a closed tab loses nothing). It is this browser's working copy: not synced. */
export const DRAW_DRAFT_KEY = 'rhinestone-papercraft-draw-draft';

function storage(): Storage | null {
  const candidate = globalThis.localStorage as Partial<Storage> | undefined;
  return candidate && typeof candidate.getItem === 'function' && typeof candidate.setItem === 'function' ? (candidate as Storage) : null;
}

export function readDrawDraft(): DrawDoc | null {
  try {
    const raw = storage()?.getItem(DRAW_DRAFT_KEY);
    return raw ? parseDoc(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function writeDrawDraft(doc: DrawDoc): void {
  writeStorageItem(storage(), DRAW_DRAFT_KEY, JSON.stringify(serializeDoc(doc)));
}
