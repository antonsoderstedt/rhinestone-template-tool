'use client';

import { useEffect, useRef, useState } from 'react';
import { DatabaseBackup, Download, Upload } from 'lucide-react';
import { LocalStorageTemplateLibraryRepository } from '@/src/lib/rhinestone-engine/index';
import { readWorkspaceVault, writeWorkspaceVault } from '../lib/workspaceVault';
import { downloadJson } from '../lib/projectUtils';
import {
  MAX_BACKUP_FILE_BYTES,
  buildBackupFilename,
  createWorkspaceBackup,
  describeMergeSummary,
  mergeWorkspaceBackup,
  parseWorkspaceBackup,
  serializeWorkspaceBackup,
} from '../lib/workspaceBackup';
import { LOCAL_STORAGE_LIMIT_CHARS, getStorageStatus, measureLocalStorage, requestPersistentStorage } from '../lib/storageQuota';
import { getBackupStatus, readLastBackupAt, writeLastBackupAt } from '../lib/backupReminder';
import { WorkspaceSurface } from './workspace/WorkspaceChrome';

interface BackupPanelProps {
  /** Called after a restore wrote something, so the page can reload its lists. */
  onRestored: () => void;
}

type Notice = { tone: 'success' | 'error' | 'info'; text: string } | null;

/** Link-less backup: one file with every saved design, and a way to put it back. No server involved. */
export default function BackupPanel({ onRestored }: BackupPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  // When the last backup was made and how many designs there are, read after load (they live in this browser).
  const [backupState, setBackupState] = useState<{ lastBackupAt: string | null; designCount: number; now: Date } | null>(null);

  const [storageUsed, setStorageUsed] = useState<number | null>(null);
  useEffect(() => {
    const used = measureLocalStorage(window.localStorage);
    queueMicrotask(() => setStorageUsed(used));
    void requestPersistentStorage();
  }, []);

  const refreshBackupState = async () => {
    const record = await new LocalStorageTemplateLibraryRepository().list();
    const designCount = record.userTemplates.length + readWorkspaceVault().htvDesigns.length;
    setBackupState({ lastBackupAt: readLastBackupAt(window.localStorage), designCount, now: new Date() });
  };
  useEffect(() => {
    let cancelled = false;
    void new LocalStorageTemplateLibraryRepository().list().then((record) => {
      if (cancelled) return;
      const designCount = record.userTemplates.length + readWorkspaceVault().htvDesigns.length;
      setBackupState({ lastBackupAt: readLastBackupAt(window.localStorage), designCount, now: new Date() });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleBackup = async () => {
    setBusy(true);
    try {
      const record = await new LocalStorageTemplateLibraryRepository().list();
      const vault = readWorkspaceVault();
      const total = record.userTemplates.length + vault.htvDesigns.length;
      if (total === 0) {
        setNotice({ tone: 'info', text: 'There is nothing to back up yet. Save a design in a studio first.' });
        return;
      }
      const createdAt = new Date().toISOString();
      const backup = createWorkspaceBackup({ rhinestoneDesigns: record.userTemplates, htvDesigns: vault.htvDesigns, calibrationProfiles: vault.calibrationProfiles, createdAt });
      downloadJson(buildBackupFilename(createdAt), serializeWorkspaceBackup(backup));
      writeLastBackupAt(window.localStorage, createdAt);
      await refreshBackupState();
      setNotice({
        tone: 'success',
        text: `Backed up ${total} ${total === 1 ? 'design' : 'designs'} to a file. Keep it somewhere safe; you can restore it in any browser.`,
      });
    } catch (error) {
      setNotice({ tone: 'error', text: `Could not make the backup: ${error instanceof Error ? error.message : String(error)}` });
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      if (file.size > MAX_BACKUP_FILE_BYTES) throw new Error('This file is too large to be a backup.');
      const { backup, skippedCount } = parseWorkspaceBackup(await file.text());

      const repository = new LocalStorageTemplateLibraryRepository();
      const record = await repository.list();
      const vault = readWorkspaceVault();
      const merged = mergeWorkspaceBackup({ rhinestoneDesigns: record.userTemplates, htvDesigns: vault.htvDesigns, calibrationProfiles: vault.calibrationProfiles }, backup);

      for (const entry of merged.rhinestoneToSave) {
        await repository.save(entry);
      }
      // Read the vault again right before writing so nothing saved in another tab meanwhile is lost.
      const latest = readWorkspaceVault();
      const latestMerged = mergeWorkspaceBackup({ rhinestoneDesigns: [], htvDesigns: latest.htvDesigns, calibrationProfiles: latest.calibrationProfiles }, { ...backup, rhinestoneDesigns: [] });
      writeWorkspaceVault({ ...latest, htvDesigns: latestMerged.htvDesigns, calibrationProfiles: latestMerged.calibrationProfiles });

      setNotice({ tone: 'success', text: describeMergeSummary(merged.summary, skippedCount) });
      onRestored();
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const noticeClass = notice?.tone === 'error'
    ? 'border-danger-500/30 bg-danger-50 text-danger-600'
    : notice?.tone === 'success'
      ? 'border-success-500/30 bg-success-50 text-success-600'
      : 'border-border bg-surface text-ink-secondary';

  return (
    <WorkspaceSurface className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">
            <DatabaseBackup className="h-4 w-4" aria-hidden="true" />
            Backup
          </div>
          <h2 className="mt-2 text-lg font-semibold text-ink">Back up all designs to a file</h2>
          <p className="mt-1 text-sm leading-6 text-ink-secondary">
            Your designs live in this browser only. A backup is one file with every rhinestone and HTV design. It needs no account or link.
            Restoring it adds missing designs and keeps the newest copy of the rest; nothing is deleted.
            Your calibration profiles are included. Uploaded fonts and images and your settings are not.
          </p>
          {storageUsed !== null && (() => {
            const storage = getStorageStatus(storageUsed, LOCAL_STORAGE_LIMIT_CHARS);
            return (
              <p role="status" className={`mt-2 text-sm ${storage.level === 'ok' ? 'text-ink-secondary' : storage.level === 'warning' ? 'font-medium text-amber-600' : 'font-semibold text-danger-600'}`}>
                {storage.label}.{storage.advice ? ` ${storage.advice}` : ''}
              </p>
            );
          })()}
          {backupState && (() => {
            const status = getBackupStatus(backupState);
            return (
              <p
                role="status"
                className={`mt-2 text-sm font-medium ${status.due ? 'text-amber-600' : 'text-ink-secondary'}`}
              >
                {status.label}
                {status.due ? '. It is a good time to make a new backup.' : '.'}
              </p>
            );
          })()}
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void handleBackup()}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-ink-inverse disabled:opacity-60"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Back up all designs
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-ink-secondary transition hover:text-ink disabled:opacity-60"
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            Restore from backup…
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            tabIndex={-1}
            aria-label="Choose a backup file to restore"
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
        </div>
      </div>
      <div role="status" aria-live="polite">
        {notice && <p className={`mt-4 rounded-xl border px-4 py-3 text-sm ${noticeClass}`}>{notice.text}</p>}
      </div>
    </WorkspaceSurface>
  );
}
