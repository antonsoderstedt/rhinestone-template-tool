/**
 * Version history of a saved Papercraft design: the last few versions, kept in this browser, so a change that turned out worse can be
 * undone after saving. A version is recorded just before it is replaced by a save or by restoring an older one. An imported model's
 * mesh is inside every version, so a big model is not kept and only a few versions are. Same rules as the Rhinestone studio's history.
 */

export const MAX_PAPERCRAFT_VERSIONS = 5;
export const MAX_PAPERCRAFT_VERSION_CHARS = 200_000;
const KEY_PREFIX = 'rhinestone-papercraft-versions:';

export interface PapercraftVersion {
  /** ISO time the version was current. */
  savedAt: string;
  name: string;
  /** The design as text (`snapshotText`). */
  snapshotText: string;
}

export type PapercraftRecordResult =
  | { kept: true; versions: PapercraftVersion[] }
  | { kept: false; reason: 'too-big' | 'same-as-latest'; versions: PapercraftVersion[] };

/** Newest first. */
export function addPapercraftVersion(existing: readonly PapercraftVersion[], version: PapercraftVersion, max = MAX_PAPERCRAFT_VERSIONS): PapercraftRecordResult {
  const versions = [...existing];
  if (version.snapshotText.length > MAX_PAPERCRAFT_VERSION_CHARS) return { kept: false, reason: 'too-big', versions };
  if (versions[0]?.snapshotText === version.snapshotText) return { kept: false, reason: 'same-as-latest', versions };
  return { kept: true, versions: [version, ...versions].slice(0, Math.max(1, max)) };
}

const storageKey = (designId: string) => `${KEY_PREFIX}${designId}`;

export function readPapercraftVersions(storage: Pick<Storage, 'getItem'> | null | undefined, designId: string): PapercraftVersion[] {
  try {
    const raw = storage?.getItem(storageKey(designId));
    if (!raw) return [];
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter(
      (item): item is PapercraftVersion =>
        typeof item === 'object' && item !== null &&
        typeof (item as PapercraftVersion).savedAt === 'string' &&
        typeof (item as PapercraftVersion).name === 'string' &&
        typeof (item as PapercraftVersion).snapshotText === 'string',
    );
  } catch {
    return [];
  }
}

export function writePapercraftVersions(storage: Pick<Storage, 'setItem' | 'removeItem'> | null | undefined, designId: string, versions: readonly PapercraftVersion[]): boolean {
  try {
    if (versions.length === 0) storage?.removeItem(storageKey(designId));
    else storage?.setItem(storageKey(designId), JSON.stringify(versions));
    return true;
  } catch {
    return false; // storage full: the history just stops growing; the design itself is saved separately
  }
}

export function recordPapercraftVersion(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null | undefined,
  designId: string,
  version: PapercraftVersion,
): PapercraftRecordResult {
  const result = addPapercraftVersion(readPapercraftVersions(storage, designId), version);
  if (result.kept) writePapercraftVersions(storage, designId, result.versions);
  return result;
}

export function removePapercraftVersions(storage: Pick<Storage, 'removeItem'> | null | undefined, designId: string): void {
  try {
    storage?.removeItem(storageKey(designId));
  } catch {
    // nothing to do
  }
}
