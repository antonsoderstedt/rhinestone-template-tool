/**
 * The saved items on this device, as the sync sees them: a flat list of (kind, id, updatedAt), and reading, writing and deleting
 * one item by its kind and id. Everything goes through the same stores the app itself uses.
 *
 *   template     My Designs (the user's saved templates)         localStorage "rhinestone-template-library"
 *   asset        files in the Library                            the workspace vault
 *   htv          saved HTV designs                               the workspace vault
 *   papercraft   saved Papercraft models                         the workspace vault
 *   calibration  calibration profiles                            the workspace vault
 *   font         fonts the user uploaded                         the workspace vault
 *   fontpref     favourite / archived / tags of one font         the workspace vault
 *   designpref   whether a saved design is archived              the workspace vault
 *   settings     the workspace settings, the active calibration  the workspace vault, "rhinestone-active-calibration-profile",
 *                profile, the language and the length unit       "rt-language", "rt-unit"
 *
 * Settings and the two kinds of choices have no change time of their own. A change is noticed by comparing the content with what
 * it was at the last look, and the time of the change is kept in a small side table ("stamps").
 *
 * Not synced, on purpose: the theme (light or dark), which is about this screen and not about the work.
 */

import { DEFAULT_TEMPLATE_LIBRARY_STORAGE_KEY } from '@/src/lib/rhinestone-engine/templateLibrary/repository';
import {
  ACTIVE_CALIBRATION_PROFILE_STORAGE_KEY,
  readWorkspaceVault,
  writeWorkspaceVault,
  type CalibrationProfile,
  type DesignPreference,
  type FontPreference,
  type HtvDesignEntry,
  type PapercraftDesignEntry,
  isPapercraftEntry,
  type UploadedWorkspaceFont,
  type WorkspaceAsset,
} from '../workspaceVault';
import { DEFAULT_WORKSPACE_SETTINGS, sanitizeWorkspaceSettings } from '../workspaceSettings';
import { LANGUAGE_STORAGE_KEY, isLanguage, setLanguage } from '../i18n';
import { UNIT_STORAGE_KEY, isLengthUnit, setUnit } from '../units';
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


// ─── Items without a change time ──────────────────────────────────────────────

const STAMPS_STORAGE_KEY = 'rhinestone-sync-stamps-v1';
const EPOCH = '1970-01-01T00:00:00.000Z';

interface Stamp {
  hash: string;
  updatedAt: string;
}
type Stamps = Record<string, Stamp>;

/** A short fingerprint of some text (FNV-1a), enough to tell whether it changed. */
export function hashText(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function readStamps(): Stamps {
  try {
    const raw = storage()?.getItem(STAMPS_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Stamps) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** True only when the value really was stored (writeStorageItem answers 'ok', 'full' or 'failed': all non-empty, so never test it as a boolean). */
function stored(key: string, value: string): boolean {
  return writeStorageItem(storage(), key, value) === 'ok';
}

function writeStamps(stamps: Stamps): void {
  writeStorageItem(storage(), STAMPS_STORAGE_KEY, JSON.stringify(stamps));
}

/** Ids go in a web address and are checked by the server: anything but letters, digits and . _ : - is written as ~hex~. */
export function encodeSyncId(raw: string): string {
  return raw.replace(/[^A-Za-z0-9._:-]/g, (character) => `~${character.codePointAt(0)!.toString(16)}~`);
}
export function decodeSyncId(encoded: string): string {
  return encoded.replace(/~([0-9a-f]+)~/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)));
}

const STAMPED_KINDS: ReadonlySet<SyncKind> = new Set(['settings', 'fontpref', 'designpref']);
const SETTINGS_ID = 'workspace';
const ACTIVE_CALIBRATION_ID = 'active-calibration';
const LANGUAGE_ID = 'language';
const UNIT_ID = 'unit';

/** What the user chose for the language or the unit on this device, or null if they have not chosen (the default is not a choice). */
function readChoice(id: typeof LANGUAGE_ID | typeof UNIT_ID): string | null {
  const value = storage()?.getItem(id === LANGUAGE_ID ? LANGUAGE_STORAGE_KEY : UNIT_STORAGE_KEY);
  return id === LANGUAGE_ID ? (isLanguage(value) ? value : null) : isLengthUnit(value) ? value : null;
}
const choiceData = (id: typeof LANGUAGE_ID | typeof UNIT_ID) => {
  const value = readChoice(id);
  return value ? JSON.stringify({ value }) : null;
};

function readActiveProfileId(): string | null {
  const value = storage()?.getItem(ACTIVE_CALIBRATION_PROFILE_STORAGE_KEY);
  return value && value.trim().length > 0 ? value : null;
}

const fontPrefData = (item: FontPreference) => JSON.stringify({ fontKey: item.fontKey, tags: item.tags, favorite: item.favorite, archived: item.archived });
const designPrefData = (item: DesignPreference) => JSON.stringify({ designKey: item.designKey, archived: item.archived });

/** The current content of a stamped item as text, in one fixed form, or null if there is nothing there. */
function stampedData(kind: SyncKind, id: string): string | null {
  const vault = readWorkspaceVault();
  if (kind === 'settings') {
    if (id === SETTINGS_ID) return JSON.stringify(vault.settings);
    if (id === LANGUAGE_ID || id === UNIT_ID) return choiceData(id);
    const active = readActiveProfileId();
    return id === ACTIVE_CALIBRATION_ID && active ? JSON.stringify({ profileId: active }) : null;
  }
  if (kind === 'fontpref') {
    const found = vault.fontPreferences.find((item) => item.fontKey === decodeSyncId(id));
    return found ? fontPrefData(found) : null;
  }
  const found = vault.designPreferences.find((item) => item.designKey === decodeSyncId(id));
  return found ? designPrefData(found) : null;
}

/**
 * Settings and choices: a change gets the time it was first noticed. An item seen for the first time on this device gets the time
 * "never" when it is the untouched default, so a new device takes what the server has instead of overwriting it with defaults.
 */
function listStamped(items: ItemRef[], stamps: Stamps, now: string): Stamps {
  const next: Stamps = {};
  const vault = readWorkspaceVault();
  const entries: Array<[SyncKind, string, string | null]> = [
    ['settings', SETTINGS_ID, JSON.stringify(vault.settings)],
    ['settings', ACTIVE_CALIBRATION_ID, readActiveProfileId() ? JSON.stringify({ profileId: readActiveProfileId() }) : null],
    ['settings', LANGUAGE_ID, choiceData(LANGUAGE_ID)],
    ['settings', UNIT_ID, choiceData(UNIT_ID)],
    ...vault.fontPreferences.map((item): [SyncKind, string, string | null] => ['fontpref', encodeSyncId(item.fontKey), fontPrefData(item)]),
    ...vault.designPreferences.map((item): [SyncKind, string, string | null] => ['designpref', encodeSyncId(item.designKey), designPrefData(item)]),
  ];
  for (const [kind, id, data] of entries) {
    if (data === null) continue;
    const key = `${kind}:${id}`;
    const hash = hashText(data);
    const known = stamps[key];
    const untouchedDefault = kind === 'settings' && id === SETTINGS_ID && hash === hashText(JSON.stringify(DEFAULT_WORKSPACE_SETTINGS));
    const stamp: Stamp = known && known.hash === hash ? known : { hash, updatedAt: !known && untouchedDefault ? EPOCH : now };
    next[key] = stamp;
    items.push({ kind, id, updatedAt: stamp.updatedAt });
  }
  return next;
}

// ─── The list, and one item at a time ─────────────────────────────────────────

export function listLocalItems(): ItemRef[] {
  const items: ItemRef[] = [];
  for (const entry of readTemplateRecord().userTemplates) {
    if (entry && typeof entry.templateId === 'string' && !entry.builtIn && !entry.readOnly) items.push({ kind: 'template', id: entry.templateId, updatedAt: entry.updatedAt });
  }
  const vault = readWorkspaceVault();
  for (const asset of vault.assets) items.push({ kind: 'asset', id: asset.assetId, updatedAt: asset.updatedAt });
  for (const design of vault.htvDesigns) items.push({ kind: 'htv', id: design.designId, updatedAt: design.updatedAt });
  for (const design of vault.papercraftDesigns) items.push({ kind: 'papercraft', id: design.designId, updatedAt: design.updatedAt });
  for (const profile of vault.calibrationProfiles) items.push({ kind: 'calibration', id: profile.id, updatedAt: profile.updatedAt });
  for (const font of vault.uploadedFonts) {
    if (font.sourceKind !== 'workspace-installed') items.push({ kind: 'font', id: font.fontId, updatedAt: font.updatedAt });
  }
  const stamps = readStamps();
  const next = listStamped(items, stamps, new Date().toISOString());
  if (JSON.stringify(next) !== JSON.stringify(stamps)) writeStamps(next);
  return items;
}

/** The item's data as text, ready to send, or null if it is not here. */
export function readLocalItemData(kind: SyncKind, id: string): string | null {
  if (STAMPED_KINDS.has(kind)) return stampedData(kind, id);
  if (kind === 'template') {
    const entry = readTemplateRecord().userTemplates.find((item) => item.templateId === id);
    return entry ? JSON.stringify(entry) : null;
  }
  const vault = readWorkspaceVault();
  const found =
    kind === 'asset' ? vault.assets.find((item) => item.assetId === id)
    : kind === 'htv' ? vault.htvDesigns.find((item) => item.designId === id)
    : kind === 'papercraft' ? vault.papercraftDesigns.find((item) => item.designId === id)
    : kind === 'font' ? vault.uploadedFonts.find((item) => item.fontId === id)
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

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/** Remembers that this content is what the server's version of a stamped item looks like, so it is not sent back as a new change. */
function stampAs(kind: SyncKind, id: string, updatedAt: string): void {
  const data = stampedData(kind, id);
  const stamps = readStamps();
  if (data === null) delete stamps[`${kind}:${id}`];
  else stamps[`${kind}:${id}`] = { hash: hashText(data), updatedAt };
  writeStamps(stamps);
}

/**
 * Puts an item that came from the server into this device's stores. `updatedAt` is the server's time for it. Returns false if
 * the data is not what it should be, or storage is full.
 */
export function applyRemoteItem(kind: SyncKind, id: string, data: string, updatedAt?: string): boolean {
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

  if (kind === 'settings') {
    if (id === LANGUAGE_ID || id === UNIT_ID) {
      const value = parsed.value;
      if (id === LANGUAGE_ID ? !isLanguage(value) : !isLengthUnit(value)) return false;
      // In the browser the setters also tell the screen; without one (tests) the value is just stored.
      const live = typeof window !== 'undefined' && typeof document !== 'undefined';
      if (live) {
        if (id === LANGUAGE_ID) setLanguage(value as 'en' | 'sv');
        else setUnit(value as 'mm' | 'in');
      } else if (!stored(id === LANGUAGE_ID ? LANGUAGE_STORAGE_KEY : UNIT_STORAGE_KEY, value as string)) return false;
    } else if (id === ACTIVE_CALIBRATION_ID) {
      if (typeof parsed.profileId !== 'string' || parsed.profileId.trim().length === 0) return false;
      if (!stored(ACTIVE_CALIBRATION_PROFILE_STORAGE_KEY, parsed.profileId)) return false;
    } else if (id === SETTINGS_ID) {
      const vault = readWorkspaceVault();
      if (!writeWorkspaceVault({ ...vault, settings: sanitizeWorkspaceSettings(parsed) })) return false;
    } else {
      return false;
    }
    stampAs(kind, id, updatedAt ?? new Date().toISOString());
    return true;
  }

  const vault = readWorkspaceVault();
  if (kind === 'fontpref') {
    if (parsed.fontKey !== decodeSyncId(id) || !isStringArray(parsed.tags) || typeof parsed.favorite !== 'boolean' || typeof parsed.archived !== 'boolean') return false;
    const pref: FontPreference = { fontKey: parsed.fontKey, tags: parsed.tags, favorite: parsed.favorite, archived: parsed.archived };
    if (!writeWorkspaceVault({ ...vault, fontPreferences: upsert(vault.fontPreferences, (item) => item.fontKey, pref) })) return false;
    stampAs(kind, id, updatedAt ?? new Date().toISOString());
    return true;
  }
  if (kind === 'designpref') {
    if (parsed.designKey !== decodeSyncId(id) || typeof parsed.archived !== 'boolean') return false;
    const pref: DesignPreference = { designKey: parsed.designKey, archived: parsed.archived };
    if (!writeWorkspaceVault({ ...vault, designPreferences: upsert(vault.designPreferences, (item) => item.designKey, pref) })) return false;
    stampAs(kind, id, updatedAt ?? new Date().toISOString());
    return true;
  }
  if (kind === 'font') {
    if (parsed.fontId !== id || typeof parsed.updatedAt !== 'string' || typeof parsed.name !== 'string' || parsed.sourceKind === 'workspace-installed') return false;
    return writeWorkspaceVault({ ...vault, uploadedFonts: upsert(vault.uploadedFonts, (item) => item.fontId, parsed as unknown as UploadedWorkspaceFont) });
  }
  if (kind === 'asset') {
    if (parsed.assetId !== id || typeof parsed.updatedAt !== 'string') return false;
    return writeWorkspaceVault({ ...vault, assets: upsert(vault.assets, (item) => item.assetId, parsed as unknown as WorkspaceAsset) });
  }
  if (kind === 'htv') {
    if (parsed.designId !== id || typeof parsed.updatedAt !== 'string' || !isRecord(parsed.snapshot)) return false;
    return writeWorkspaceVault({ ...vault, htvDesigns: upsert(vault.htvDesigns, (item) => item.designId, parsed as unknown as HtvDesignEntry) });
  }
  if (kind === 'papercraft') {
    // The design must be one this build can open: the same check the vault applies when it reads.
    if (parsed.designId !== id || !isPapercraftEntry(parsed)) return false;
    return writeWorkspaceVault({ ...vault, papercraftDesigns: upsert(vault.papercraftDesigns, (item) => item.designId, parsed as unknown as PapercraftDesignEntry) });
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
  if (kind === 'settings') {
    // The settings themselves, the language and the unit are never deleted (nothing in the app can remove them); only the choice of
    // an active calibration profile can go.
    if (id !== ACTIVE_CALIBRATION_ID) return true;
    storage()?.removeItem(ACTIVE_CALIBRATION_PROFILE_STORAGE_KEY);
    stampAs(kind, id, EPOCH);
    return true;
  }
  const vault = readWorkspaceVault();
  if (kind === 'fontpref') {
    const ok = writeWorkspaceVault({ ...vault, fontPreferences: vault.fontPreferences.filter((item) => item.fontKey !== decodeSyncId(id)) });
    if (ok) stampAs(kind, id, EPOCH);
    return ok;
  }
  if (kind === 'designpref') {
    const ok = writeWorkspaceVault({ ...vault, designPreferences: vault.designPreferences.filter((item) => item.designKey !== decodeSyncId(id)) });
    if (ok) stampAs(kind, id, EPOCH);
    return ok;
  }
  if (kind === 'font') return writeWorkspaceVault({ ...vault, uploadedFonts: vault.uploadedFonts.filter((item) => item.fontId !== id) });
  if (kind === 'asset') return writeWorkspaceVault({ ...vault, assets: vault.assets.filter((item) => item.assetId !== id) });
  if (kind === 'htv') return writeWorkspaceVault({ ...vault, htvDesigns: vault.htvDesigns.filter((item) => item.designId !== id) });
  if (kind === 'papercraft') return writeWorkspaceVault({ ...vault, papercraftDesigns: vault.papercraftDesigns.filter((item) => item.designId !== id) });
  return writeWorkspaceVault({ ...vault, calibrationProfiles: vault.calibrationProfiles.filter((item) => item.id !== id) });
}
