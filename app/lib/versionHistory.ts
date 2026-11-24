/**
 * Version history of a saved design: the last few versions, kept in this browser, so a change that turned out worse can be
 * undone after saving. A version is recorded just before it is replaced by a save, or before an older one is restored.
 *
 * Storage is small (everything is in localStorage), so a design that is large as text is not kept, only a few versions are
 * kept and an identical version is not kept twice. Pure apart from the read and write functions, which take a `Storage`.
 */

export const MAX_VERSIONS_PER_DESIGN = 5;
/** A version larger than this (characters of project JSON) is not kept: hand-edited designs with thousands of stones. */
export const MAX_VERSION_CHARS = 150_000;
const KEY_PREFIX = 'rhinestone-design-versions:';

export interface DesignVersion {
  /** ISO time the version was current. */
  savedAt: string;
  name: string;
  stoneCount: number;
  projectJson: string;
}

export type RecordResult = { kept: true; versions: DesignVersion[] } | { kept: false; reason: 'too-big' | 'same-as-latest'; versions: DesignVersion[] };

/** Newest first. */
export function addVersion(existing: readonly DesignVersion[], version: DesignVersion, max: number = MAX_VERSIONS_PER_DESIGN): RecordResult {
  const versions = [...existing];
  if (version.projectJson.length > MAX_VERSION_CHARS) return { kept: false, reason: 'too-big', versions };
  if (versions[0]?.projectJson === version.projectJson) return { kept: false, reason: 'same-as-latest', versions };
  return { kept: true, versions: [version, ...versions].slice(0, Math.max(1, max)) };
}

const storageKey = (designId: string) => `${KEY_PREFIX}${designId}`;

export function readVersions(storage: Pick<Storage, 'getItem'> | null | undefined, designId: string): DesignVersion[] {
  try {
    const raw = storage?.getItem(storageKey(designId));
    if (!raw) return [];
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter(
      (item): item is DesignVersion =>
        typeof item === 'object' && item !== null &&
        typeof (item as DesignVersion).savedAt === 'string' &&
        typeof (item as DesignVersion).name === 'string' &&
        typeof (item as DesignVersion).stoneCount === 'number' &&
        typeof (item as DesignVersion).projectJson === 'string',
    );
  } catch {
    return [];
  }
}

export function writeVersions(storage: Pick<Storage, 'setItem' | 'removeItem'> | null | undefined, designId: string, versions: readonly DesignVersion[]): boolean {
  try {
    if (versions.length === 0) storage?.removeItem(storageKey(designId));
    else storage?.setItem(storageKey(designId), JSON.stringify(versions));
    return true;
  } catch {
    return false; // storage full: the history just stops growing; the design itself is saved separately
  }
}

/** Adds a version to a design's history in storage. Returns what happened. */
export function recordVersion(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null | undefined, designId: string, version: DesignVersion): RecordResult {
  const result = addVersion(readVersions(storage, designId), version);
  if (result.kept) writeVersions(storage, designId, result.versions);
  return result;
}

export function removeVersions(storage: Pick<Storage, 'removeItem'> | null | undefined, designId: string): void {
  try {
    storage?.removeItem(storageKey(designId));
  } catch {
    // nothing to do
  }
}
