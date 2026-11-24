import { describe, expect, it } from 'vitest';
import { isQuotaError, writeStorageItem } from '../app/lib/storageQuota';

function fakeStorage(capacity: number) {
  const data = new Map<string, string>();
  const used = () => [...data].reduce((n, [k, v]) => n + k.length + v.length, 0);
  return {
    data,
    setItem(key: string, value: string) {
      const next = used() - (data.has(key) ? key.length + data.get(key)!.length : 0) + key.length + value.length;
      if (next > capacity) throw new DOMException('full', 'QuotaExceededError');
      data.set(key, value);
    },
    removeItem(key: string) {
      data.delete(key);
    },
  };
}

describe('writeStorageItem', () => {
  it('writes normally', () => {
    const s = fakeStorage(100);
    expect(writeStorageItem(s, 'a', 'x'.repeat(10))).toBe('ok');
    expect(s.data.get('a')).toHaveLength(10);
  });

  it('frees leftovers when full, then writes', () => {
    const s = fakeStorage(60);
    s.setItem('junk', 'j'.repeat(40));
    expect(writeStorageItem(s, 'a', 'x'.repeat(40), ['junk'])).toBe('ok');
    expect(s.data.has('junk')).toBe(false);
  });

  it('reports full instead of throwing, and keeps the old value', () => {
    const s = fakeStorage(30);
    s.setItem('a', 'old');
    expect(writeStorageItem(s, 'a', 'x'.repeat(100))).toBe('full');
    expect(s.data.get('a')).toBe('old');
  });

  it('does not treat other errors as full, and survives missing storage', () => {
    const broken = { setItem() { throw new Error('nope'); }, removeItem() {} };
    expect(writeStorageItem(broken, 'a', 'x')).toBe('failed');
    expect(writeStorageItem(null, 'a', 'x')).toBe('failed');
    expect(isQuotaError(new DOMException('x', 'QuotaExceededError'))).toBe(true);
    expect(isQuotaError(new Error('x'))).toBe(false);
  });
});
