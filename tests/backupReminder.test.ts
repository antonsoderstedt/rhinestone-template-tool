import { describe, expect, it } from 'vitest';
import {
  BACKUP_REMINDER_AFTER_DAYS,
  LAST_BACKUP_STORAGE_KEY,
  getBackupStatus,
  readLastBackupAt,
  writeLastBackupAt,
} from '../app/lib/backupReminder';

const now = new Date('2026-11-22T12:00:00Z');
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

describe('backup reminder (plan F3)', () => {
  it('does not nag about a design or two', () => {
    expect(getBackupStatus({ designCount: 2, lastBackupAt: null, now })).toEqual({ label: 'Not backed up yet', due: false });
  });

  it('reminds when there are designs and no backup, or an old one', () => {
    expect(getBackupStatus({ designCount: 5, lastBackupAt: null, now }).due).toBe(true);
    const old = getBackupStatus({ designCount: 5, lastBackupAt: daysAgo(BACKUP_REMINDER_AFTER_DAYS + 1), now });
    expect(old.due).toBe(true);
    expect(old.label).toMatch(/^Last backed up /);
  });

  it('is quiet right after a backup', () => {
    const fresh = getBackupStatus({ designCount: 9, lastBackupAt: daysAgo(2), now });
    expect(fresh.due).toBe(false);
    expect(fresh.label).toBe('Last backed up 2 days ago');
  });

  it('stores and reads the time, and ignores junk', () => {
    const data = new Map<string, string>();
    const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
    expect(readLastBackupAt(storage)).toBeNull();
    writeLastBackupAt(storage, '2026-11-01T00:00:00Z');
    expect(readLastBackupAt(storage)).toBe('2026-11-01T00:00:00Z');
    data.set(LAST_BACKUP_STORAGE_KEY, 'not a date');
    expect(readLastBackupAt(storage)).toBeNull();
    expect(readLastBackupAt(null)).toBeNull();
    expect(() => writeLastBackupAt({ setItem: () => { throw new Error('full'); } }, 'x')).not.toThrow();
  });
});
