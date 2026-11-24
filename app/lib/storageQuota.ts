/**
 * How full the browser's storage is. Designs, settings and the autosave all live in localStorage, which holds about 5 million
 * characters per site; a few big designs can fill it, and then saving fails. A warning in time is worth more than an error
 * when it is already full.
 *
 * Pure apart from `measureLocalStorage`, which takes a `Storage` so it can be tested.
 */

/** What browsers allow per site, in characters (about 5 MB). */
export const LOCAL_STORAGE_LIMIT_CHARS = 5_000_000;
export const STORAGE_WARN_AT = 0.8;
export const STORAGE_CRITICAL_AT = 0.95;

export type StorageLevel = 'ok' | 'warning' | 'critical';

export interface StorageStatus {
  usedChars: number;
  fraction: number;
  level: StorageLevel;
  /** "62% of the browser's storage is used". */
  label: string;
  /** What to do, or null when all is well. */
  advice: string | null;
}

export function measureLocalStorage(storage: Pick<Storage, 'length' | 'key' | 'getItem'> | null | undefined): number {
  if (!storage) return 0;
  let total = 0;
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key === null) continue;
      total += key.length + (storage.getItem(key)?.length ?? 0);
    }
  } catch {
    return 0;
  }
  return total;
}

export function getStorageStatus(usedChars: number, limit: number = LOCAL_STORAGE_LIMIT_CHARS): StorageStatus {
  const fraction = limit > 0 ? Math.min(1, usedChars / limit) : 0;
  const percent = Math.round(fraction * 100);
  const level: StorageLevel = fraction >= STORAGE_CRITICAL_AT ? 'critical' : fraction >= STORAGE_WARN_AT ? 'warning' : 'ok';
  const advice =
    level === 'critical'
      ? 'Saving is about to fail. Make a backup now, then delete designs you no longer need.'
      : level === 'warning'
        ? 'Getting full. Make a backup and delete designs you no longer need before it fills up.'
        : null;
  return { usedChars, fraction, level, label: `${percent}% of this browser's storage is used`, advice };
}

/** Asks the browser not to clear this site's data when it is short of space. Harmless if refused or unsupported. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
    return (await navigator.storage.persisted?.()) || (await navigator.storage.persist());
  } catch {
    return false;
  }
}

/** True for the error a browser throws when storage is full (its name and code differ between browsers). */
export function isQuotaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { name, code } = error as { name?: unknown; code?: unknown };
  return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || code === 22 || code === 1014;
}

export type StorageWriteResult = 'ok' | 'full' | 'failed';

/**
 * Writes a value without ever throwing. When storage is full it first drops the keys listed in `reclaimable` (leftovers that
 * are safe to lose) and tries again; if that is not enough it reports `full` and leaves what was there untouched.
 */
export function writeStorageItem(
  storage: Pick<Storage, 'setItem' | 'removeItem'> | null | undefined,
  key: string,
  value: string,
  reclaimable: readonly string[] = [],
): StorageWriteResult {
  if (!storage) return 'failed';
  try {
    storage.setItem(key, value);
    return 'ok';
  } catch (error) {
    if (!isQuotaError(error)) return 'failed';
  }
  for (const stale of reclaimable) {
    try {
      storage.removeItem(stale);
    } catch {
      /* nothing to reclaim */
    }
  }
  try {
    storage.setItem(key, value);
    return 'ok';
  } catch (error) {
    return isQuotaError(error) ? 'full' : 'failed';
  }
}
