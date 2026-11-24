import { describe, expect, it } from 'vitest';
import { MAX_VERSIONS_PER_DESIGN, MAX_VERSION_CHARS, addVersion, readVersions, recordVersion, removeVersions, writeVersions, type DesignVersion } from '../app/lib/versionHistory';

const version = (n: number, json = `{"n":${n}}`): DesignVersion => ({ savedAt: `2026-11-0${n}T10:00:00Z`, name: 'Mia design', stoneCount: n * 10, projectJson: json });

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

describe('version history (plan F5)', () => {
  it('puts the newest first and keeps only a few', () => {
    let versions: DesignVersion[] = [];
    for (let n = 1; n <= 8; n++) {
      const result = addVersion(versions, version(n));
      expect(result.kept).toBe(true);
      versions = result.versions;
    }
    expect(versions).toHaveLength(MAX_VERSIONS_PER_DESIGN);
    expect(versions[0]!.stoneCount).toBe(80);
    expect(versions.at(-1)!.stoneCount).toBe(40);
  });

  it('does not keep the same version twice in a row, nor one that is too big', () => {
    const first = addVersion([], version(1)).versions;
    expect(addVersion(first, { ...version(2), projectJson: first[0]!.projectJson })).toMatchObject({ kept: false, reason: 'same-as-latest' });
    expect(addVersion(first, version(3, 'x'.repeat(MAX_VERSION_CHARS + 1)))).toMatchObject({ kept: false, reason: 'too-big' });
  });

  it('reads and writes per design, and ignores damaged data', () => {
    const storage = memoryStorage();
    expect(readVersions(storage, 'a')).toEqual([]);
    recordVersion(storage, 'a', version(1));
    recordVersion(storage, 'a', version(2));
    recordVersion(storage, 'b', version(3));
    expect(readVersions(storage, 'a').map((v) => v.stoneCount)).toEqual([20, 10]);
    expect(readVersions(storage, 'b')).toHaveLength(1);
    storage.setItem('rhinestone-design-versions:a', '[{"nope":1},"x"]');
    expect(readVersions(storage, 'a')).toEqual([]);
    storage.setItem('rhinestone-design-versions:a', 'not json');
    expect(readVersions(storage, 'a')).toEqual([]);
  });

  it('removes a design\'s versions, and survives a full storage', () => {
    const storage = memoryStorage();
    recordVersion(storage, 'a', version(1));
    removeVersions(storage, 'a');
    expect(readVersions(storage, 'a')).toEqual([]);
    expect(writeVersions({ setItem: () => { throw new Error('quota'); }, removeItem: () => undefined }, 'a', [version(1)])).toBe(false);
  });
});
