/**
 * When the user last made a backup, and whether it is time to remind them. Everything is stored in this browser, so a
 * backup file is the only protection against clearing the browser's data; a quiet reminder is worth having.
 *
 * Pure apart from the two storage functions, which take a `Storage` so they can be tested.
 */

import { formatRelativeTime } from './relativeTime';

export const LAST_BACKUP_STORAGE_KEY = 'rhinestone-studio-last-backup-at';
/** Remind when the last backup is older than this. */
export const BACKUP_REMINDER_AFTER_DAYS = 14;
/** Do not nag about a design or two: below this there is little to lose. */
export const BACKUP_REMINDER_MIN_DESIGNS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

export function readLastBackupAt(storage: Pick<Storage, 'getItem'> | null | undefined): string | null {
  try {
    const value = storage?.getItem(LAST_BACKUP_STORAGE_KEY);
    return value && Number.isFinite(new Date(value).getTime()) ? value : null;
  } catch {
    return null;
  }
}

export function writeLastBackupAt(storage: Pick<Storage, 'setItem'> | null | undefined, iso: string): void {
  try {
    storage?.setItem(LAST_BACKUP_STORAGE_KEY, iso);
  } catch {
    // Storage disabled or full: the reminder just comes back, which is the safe direction.
  }
}

export interface BackupStatus {
  /** "Last backed up 3 days ago", or "Not backed up yet". */
  label: string;
  /** True when it is time to make a backup. */
  due: boolean;
}

export function getBackupStatus(input: { designCount: number; lastBackupAt: string | null; now: Date }): BackupStatus {
  const { designCount, lastBackupAt, now } = input;
  if (!lastBackupAt) {
    return { label: 'Not backed up yet', due: designCount >= BACKUP_REMINDER_MIN_DESIGNS };
  }
  const age = now.getTime() - new Date(lastBackupAt).getTime();
  return {
    label: `Last backed up ${formatRelativeTime(lastBackupAt, now).toLowerCase()}`,
    due: designCount >= BACKUP_REMINDER_MIN_DESIGNS && age > BACKUP_REMINDER_AFTER_DAYS * DAY_MS,
  };
}
