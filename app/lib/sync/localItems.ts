/**
 * The saved items on this device, as the sync sees them: a flat list of (kind, id, updatedAt), and reading, writing and deleting
 * one item by its kind and id. Everything goes through the same stores the app itself uses.
 *
 *   template     My Designs (the user's saved templates)         localStorage "rhinestone-template-library"
 *   asset        files in the Library                            the workspace vault
 *   htv          saved HTV designs                               the workspace vault
 *   calibration  calibration profiles                            the workspace vault
 *
 * Not synced (yet): settings, font choices and uploaded fonts, which have no change times.
 */

import { DEFAULT_TEMPLATE_LIBRARY_STORAGE_KEY } from '@/src/lib/rhinestone-engine/templateLibrary/repository';
import { readWorkspaceVault, writeWorkspaceVault, type CalibrationProfile, type HtvDesignEntry, type WorkspaceAsset } from '../workspaceVault';
import { writeStorageItem } from '../storageQuota';
import type { ItemRef, SyncKind } from './syncPlan';

interface StoredTemplateRecord {
  version: 1;
  builtInTemplates?: unknown[];
  userTemplates: Array<{ templateId: string; updatedAt: string; builtIn?: boolean; readOnly?: boolean } & Record<string, unknown>>;
}

function storage(): Storage | null {
  const candidate = globalThis.localStorage as Partial<Storage> | undefined;
  return candidate && typeof candidate.getItem === 'function' && typeof candidate.setItem === 'function' ? (candidate as Storage) : null;
}

function readTemplateRecord(): StoredTemplateRecord {
  const raw = storage()?.getItem(DEFAULT_TEMPLATE_LIBRARY_STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as StoredTemplateRecord;
      if (parsed && parsed.version === 1) return { ...parsed, userTemplates: Array.isArray(parsed.userTemplates) ? parsed.userTemplates : [] };
    } catch {
      /* fall through to an empty record */
    }
  }
  return { version: 1, builtInTemplates: [], userTemplates: [] };
}

function writeTemplateRecord(record: StoredTemplateRecord): boolean {
  return writeStorageItem(storage(), DEFAULT_TEMPLATE_LIBRARY_STORAGE_KEY, JSON.stringify(record)) === 'ok';
}

export function listLocalItems(): ItemRef[] {
  const items: ItemRef[] = [];
  for (const entry of readTemplateRecord().userTemplates) {
    if (entry && typeof entry.templateId === 'string' && !entry.builtIn && !entry.readOnly) items.push({ kind: 'template', id: entry.templateId, updatedAt: entry.updatedAt });
  }
  const vault = readWorkspaceVault();
  for (const asset of vault.assets) items.push({ kind: 'asset', id: asset.assetId, updatedAt: asset.updatedAt });
  for (const design of vault.htvDesigns) items.push({ kind: 'htv', id: design.designId, updatedAt: design.updatedAt });
  for (const profile of vault.calibrationProfiles) items.push({ kind: 'calibration', id: profile.id, updatedAt: profile.updatedAt });
  return items;
}

/** The item's data as text, ready to send, or null if it is not here. */
export function readLocalItemData(kind: SyncKind, id: string): string | null {
  if (kind === 'template') {
    const entry = readTemplateRecord().userTemplates.find((item) => item.templateId === id);
    return entry ? JSON.stringify(entry) : null;
  }
  const vault = readWorkspaceVault();
  const found =
    kind === 'asset' ? vault.assets.find((item) => item.assetId === id)
    : kind === 'htv' ? vault.htvDesigns.find((item) => item.designId === id)
    : vault.calibrationProfiles.find((item) => item.id === id);
  return found ? JSON.stringify(found) : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function upsert<T>(list: T[], idOf: (item: T) => string, next: T): T[] {
  const id = idOf(next);
  const at = list.findIndex((item) => idOf(item) === id);
  return at >= 0 ? list.map((item, i) => (i === at ? next : item)) : [...list, next];
}

/** Puts an item that came from the server into this device's stores. Returns false if the data is not what it should be, or storage is full. */
export function applyRemoteItem(kind: SyncKind, id: string, data: string): boolean {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return false;
  }
  if (!isRecord(parsed)) return false;

  if (kind === 'template') {
    if (parsed.templateId !== id || typeof parsed.updatedAt !== 'string' || !isRecord(parsed.snapshot) || parsed.builtIn === true) return false;
    const record = readTemplateRecord();
    const entry = parsed as StoredTemplateRecord['userTemplates'][number];
    return writeTemplateRecord({ ...record, userTemplates: upsert(record.userTemplates, (item) => item.templateId, entry) });
  }

  const vault = readWorkspaceVault();
  if (kind === 'asset') {
    if (parsed.assetId !== id || typeof parsed.updatedAt !== 'string') return false;
    return writeWorkspaceVault({ ...vault, assets: upsert(vault.assets, (item) => item.assetId, parsed as unknown as WorkspaceAsset) });
  }
  if (kind === 'htv') {
    if (parsed.designId !== id || typeof parsed.updatedAt !== 'string' || !isRecord(parsed.snapshot)) return false;
    return writeWorkspaceVault({ ...vault, htvDesigns: upsert(vault.htvDesigns, (item) => item.designId, parsed as unknown as HtvDesignEntry) });
  }
  if (parsed.id !== id || typeof parsed.updatedAt !== 'string') return false;
  return writeWorkspaceVault({ ...vault, calibrationProfiles: upsert(vault.calibrationProfiles, (item) => item.id, parsed as unknown as CalibrationProfile) });
}

/** Removes an item from this device because it was deleted on another. */
export function deleteLocalItem(kind: SyncKind, id: string): boolean {
  if (kind === 'template') {
    const record = readTemplateRecord();
    return writeTemplateRecord({ ...record, userTemplates: record.userTemplates.filter((item) => item.templateId !== id) });
  }
  const vault = readWorkspaceVault();
  if (kind === 'asset') return writeWorkspaceVault({ ...vault, assets: vault.assets.filter((item) => item.assetId !== id) });
  if (kind === 'htv') return writeWorkspaceVault({ ...vault, htvDesigns: vault.htvDesigns.filter((item) => item.designId !== id) });
  return writeWorkspaceVault({ ...vault, calibrationProfiles: vault.calibrationProfiles.filter((item) => item.id !== id) });
}
