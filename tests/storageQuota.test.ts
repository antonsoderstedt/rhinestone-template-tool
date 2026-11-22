import { describe, expect, it } from 'vitest';
import { LOCAL_STORAGE_LIMIT_CHARS, getStorageStatus, measureLocalStorage } from '../app/lib/storageQuota';

describe('browser storage warning (plan F1)', () => {
  it('counts keys and values', () => {
    const data: Record<string, string> = { a: '12345', bb: '1234567890' };
    const storage = { get length() { return Object.keys(data).length; }, key: (i: number) => Object.keys(data)[i] ?? null, getItem: (k: string) => data[k] ?? null };
    expect(measureLocalStorage(storage)).toBe(1 + 5 + 2 + 10);
    expect(measureLocalStorage(null)).toBe(0);
  });

  it('is quiet until it is getting full, then warns, then says it is about to fail', () => {
    expect(getStorageStatus(1_000_000)).toMatchObject({ level: 'ok', advice: null, label: "20% of this browser's storage is used" });
    expect(getStorageStatus(0.85 * LOCAL_STORAGE_LIMIT_CHARS).level).toBe('warning');
    const critical = getStorageStatus(0.97 * LOCAL_STORAGE_LIMIT_CHARS);
    expect(critical.level).toBe('critical');
    expect(critical.advice).toMatch(/backup/i);
  });

  it('never goes past 100 %', () => {
    expect(getStorageStatus(10 * LOCAL_STORAGE_LIMIT_CHARS).fraction).toBe(1);
  });
});
