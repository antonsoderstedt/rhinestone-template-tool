/**
 * Link-less backup of everything in "My Designs" (ADR 0016).
 *
 * One JSON file holds every saved rhinestone design and every saved HTV design. There is no server:
 * the file is downloaded to the user's disk and can be restored in any browser. Reading a backup only
 * parses JSON and validates it; nothing in the file is executed. Pure apart from the helpers that are
 * handed `Date` strings, so the same input always gives the same output.
 *
 * Calibration profiles are included (they take minutes to measure and are lost with the browser's data too).
 * Papercraft models are included too (an imported model's mesh is inside the design). Not included: uploaded fonts, uploaded assets and settings. Those are large or
 * machine-specific; HTV designs that use an uploaded font fall back to a default one when restored on a
 * computer that does not have it (ADR 0010).
 */

import { parseRhinestoneProject, type TemplateLibraryEntry } from '@/src/lib/rhinestone-engine/index';
import { isPapercraftEntry, type CalibrationProfile, type HtvDesignEntry, type PapercraftDesignEntry } from './workspaceVault';

export const WORKSPACE_BACKUP_KIND = 'rhinestone-studio-backup';
export const WORKSPACE_BACKUP_VERSION = 1;
export const WORKSPACE_BACKUP_EXTENSION = '.backup.json';
/** A backup is JSON of stones and layers; anything bigger than this is not one. */
export const MAX_BACKUP_FILE_BYTES = 50 * 1024 * 1024;

export interface WorkspaceBackup {
  kind: typeof WORKSPACE_BACKUP_KIND;
  version: typeof WORKSPACE_BACKUP_VERSION;
  /** ISO 8601 time the backup was made. */
  createdAt: string;
  rhinestoneDesigns: TemplateLibraryEntry[];
  htvDesigns: HtvDesignEntry[];
  /** Optional: backups made before the Papercraft studio have none. */
  papercraftDesigns?: PapercraftDesignEntry[];
  /** Optional: older backups have none. */
  calibrationProfiles?: CalibrationProfile[];
}

export interface ParsedWorkspaceBackup {
  backup: WorkspaceBackup;
  /** Entries in the file that were unreadable and left out. */
  skippedCount: number;
}

export interface BackupMergeSummary {
  addedRhinestone: number;
  addedHtv: number;
  addedPapercraft: number;
  /** Designs replaced because the backup copy is newer. */
  updatedRhinestone: number;
  updatedHtv: number;
  updatedPapercraft: number;
  /** Designs left alone because the copy already here is the same age or newer. */
  keptNewer: number;
  addedCalibration: number;
  updatedCalibration: number;
}

export interface BackupMergeResult {
  rhinestoneDesigns: TemplateLibraryEntry[];
  htvDesigns: HtvDesignEntry[];
  papercraftDesigns: PapercraftDesignEntry[];
  calibrationProfiles: CalibrationProfile[];
  summary: BackupMergeSummary;
  /** Only the rhinestone designs that must be written (added or replaced). */
  rhinestoneToSave: TemplateLibraryEntry[];
}

export function createWorkspaceBackup(input: {
  rhinestoneDesigns: readonly TemplateLibraryEntry[];
  htvDesigns: readonly HtvDesignEntry[];
  papercraftDesigns?: readonly PapercraftDesignEntry[];
  calibrationProfiles?: readonly CalibrationProfile[];
  createdAt: string;
}): WorkspaceBackup {
  return {
    kind: WORKSPACE_BACKUP_KIND,
    version: WORKSPACE_BACKUP_VERSION,
    createdAt: input.createdAt,
    rhinestoneDesigns: structuredClone([...input.rhinestoneDesigns]),
    htvDesigns: structuredClone([...input.htvDesigns]),
    ...(input.papercraftDesigns && input.papercraftDesigns.length > 0 ? { papercraftDesigns: structuredClone([...input.papercraftDesigns]) } : {}),
    ...(input.calibrationProfiles && input.calibrationProfiles.length > 0 ? { calibrationProfiles: structuredClone([...input.calibrationProfiles]) } : {}),
  };
}

export function serializeWorkspaceBackup(backup: WorkspaceBackup): string {
  return JSON.stringify(backup);
}

/** `rhinestone-studio-2026-11-19.backup.json`, from the ISO time of the backup. */
export function buildBackupFilename(createdAtIso: string): string {
  const day = /^\d{4}-\d{2}-\d{2}/.exec(createdAtIso)?.[0] ?? 'backup';
  return `rhinestone-studio-${day}${WORKSPACE_BACKUP_EXTENSION}`;
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Thumbnails are `data:image/` URIs the app made itself. A restored file must not be able to point an
 * <img> at a web address (which would make the browser contact it), so anything else is dropped.
 */
export function sanitizePreviewRef(value: unknown): string | null {
  return typeof value === 'string' && /^data:image\/(svg\+xml|png|jpeg|webp)[;,]/i.test(value) ? value : null;
}

function readRhinestoneEntry(value: unknown): TemplateLibraryEntry | null {
  if (!isRecord(value)) return null;
  if (!isNonEmptyString(value.templateId) || !isNonEmptyString(value.name)) return null;
  if (typeof value.updatedAt !== 'string' || typeof value.createdAt !== 'string') return null;
  const snapshot = value.snapshot;
  if (!isRecord(snapshot) || !isRecord(snapshot.project)) return null;

  // The project inside is checked by the same parser as "Open project file", so a bad one is skipped
  // here and never reaches the editor.
  try {
    parseRhinestoneProject(JSON.stringify(snapshot.project));
  } catch {
    return null;
  }

  return {
    ...(value as unknown as TemplateLibraryEntry),
    // A backup can never create a read-only or built-in entry; those only come from code.
    builtIn: false,
    readOnly: false,
    tags: Array.isArray(value.tags) ? value.tags.filter((tag): tag is string => typeof tag === 'string') : [],
    favorite: value.favorite === true,
    previewRef: sanitizePreviewRef(value.previewRef),
  };
}

function readHtvEntry(value: unknown): HtvDesignEntry | null {
  if (!isRecord(value)) return null;
  if (!isNonEmptyString(value.designId) || !isNonEmptyString(value.name)) return null;
  if (typeof value.updatedAt !== 'string' || typeof value.createdAt !== 'string') return null;
  const snapshot = value.snapshot;
  if (!isRecord(snapshot) || !Array.isArray(snapshot.layers) || !isRecord(snapshot.canvas) || !isRecord(snapshot.garment)) return null;

  return {
    ...(value as unknown as HtvDesignEntry),
    tags: Array.isArray(value.tags) ? value.tags.filter((tag): tag is string => typeof tag === 'string') : [],
    favorite: value.favorite === true,
    archived: value.archived === true,
  };
}

function readPapercraftEntry(value: unknown): PapercraftDesignEntry | null {
  if (!isRecord(value) || !isPapercraftEntry(value)) return null;
  return {
    ...(value as unknown as PapercraftDesignEntry),
    tags: Array.isArray(value.tags) ? value.tags.filter((tag): tag is string => typeof tag === 'string') : [],
    favorite: value.favorite === true,
    archived: value.archived === true,
  };
}

function readCalibrationProfile(value: unknown): CalibrationProfile | null {
  if (!isRecord(value)) return null;
  if (!isNonEmptyString(value.id) || !isNonEmptyString(value.name) || !isNonEmptyString(value.materialProfileId)) return null;
  if (typeof value.createdAt !== 'string' || typeof value.updatedAt !== 'string') return null;
  if (value.approvedAt !== undefined && typeof value.approvedAt !== 'string') return null;
  if (!Array.isArray(value.overrides)) return null;
  const overrides: CalibrationProfile['overrides'] = [];
  for (const item of value.overrides) {
    if (!isRecord(item) || !isNonEmptyString(item.stoneSize)) return null;
    if (typeof item.holeDiameterMm !== 'number' || !Number.isFinite(item.holeDiameterMm) || item.holeDiameterMm <= 0 || item.holeDiameterMm > 20) return null;
    overrides.push({ stoneSize: item.stoneSize, holeDiameterMm: item.holeDiameterMm, ...(typeof item.notes === 'string' ? { notes: item.notes } : {}) });
  }
  return {
    id: value.id,
    name: value.name,
    materialProfileId: value.materialProfileId,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    ...(typeof value.approvedAt === 'string' ? { approvedAt: value.approvedAt } : {}),
    overrides,
  };
}

/** Reads a backup file's text. Throws an Error with a message fit to show the user. */
export function parseWorkspaceBackup(json: string): ParsedWorkspaceBackup {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('This file is not a backup (it is not valid JSON).');
  }

  if (!isRecord(data) || data.kind !== WORKSPACE_BACKUP_KIND) {
    throw new Error('This file is not a Rhinestone Studio backup. Backups are made with "Back up all designs".');
  }
  if (data.version !== WORKSPACE_BACKUP_VERSION) {
    throw new Error('This backup was made by a newer version of the app and cannot be read here.');
  }
  if (!Array.isArray(data.rhinestoneDesigns) || !Array.isArray(data.htvDesigns)) {
    throw new Error('This backup file is damaged: its design lists are missing.');
  }

  const rhinestoneDesigns = data.rhinestoneDesigns.map(readRhinestoneEntry);
  const htvDesigns = data.htvDesigns.map(readHtvEntry);
  const papercraftDesigns = Array.isArray(data.papercraftDesigns) ? data.papercraftDesigns.map(readPapercraftEntry) : [];
  const calibrationProfiles = Array.isArray(data.calibrationProfiles) ? data.calibrationProfiles.map(readCalibrationProfile) : [];
  const skippedCount = [...rhinestoneDesigns, ...htvDesigns, ...papercraftDesigns, ...calibrationProfiles].filter((entry) => entry === null).length;

  return {
    backup: {
      kind: WORKSPACE_BACKUP_KIND,
      version: WORKSPACE_BACKUP_VERSION,
      createdAt: typeof data.createdAt === 'string' ? data.createdAt : '',
      rhinestoneDesigns: rhinestoneDesigns.filter((entry): entry is TemplateLibraryEntry => entry !== null),
      htvDesigns: htvDesigns.filter((entry): entry is HtvDesignEntry => entry !== null),
      ...(papercraftDesigns.length > 0 ? { papercraftDesigns: papercraftDesigns.filter((entry): entry is PapercraftDesignEntry => entry !== null) } : {}),
      ...(calibrationProfiles.length > 0 ? { calibrationProfiles: calibrationProfiles.filter((entry): entry is CalibrationProfile => entry !== null) } : {}),
    },
    skippedCount,
  };
}

/**
 * Combines a backup with the designs already here. Nothing is deleted: a design that exists in both
 * places is replaced only when the backup's copy is newer; everything else in the backup is added.
 */
export function mergeWorkspaceBackup(
  existing: { rhinestoneDesigns: readonly TemplateLibraryEntry[]; htvDesigns: readonly HtvDesignEntry[]; papercraftDesigns?: readonly PapercraftDesignEntry[]; calibrationProfiles?: readonly CalibrationProfile[] },
  backup: WorkspaceBackup,
): BackupMergeResult {
  const summary: BackupMergeSummary = { addedRhinestone: 0, addedHtv: 0, addedPapercraft: 0, updatedRhinestone: 0, updatedHtv: 0, updatedPapercraft: 0, keptNewer: 0, addedCalibration: 0, updatedCalibration: 0 };

  const rhinestoneById = new Map(existing.rhinestoneDesigns.map((entry) => [entry.templateId, entry]));
  const rhinestoneToSave: TemplateLibraryEntry[] = [];
  for (const incoming of backup.rhinestoneDesigns) {
    const current = rhinestoneById.get(incoming.templateId);
    if (!current) {
      rhinestoneById.set(incoming.templateId, incoming);
      rhinestoneToSave.push(incoming);
      summary.addedRhinestone += 1;
    } else if (incoming.updatedAt > current.updatedAt) {
      rhinestoneById.set(incoming.templateId, incoming);
      rhinestoneToSave.push(incoming);
      summary.updatedRhinestone += 1;
    } else {
      summary.keptNewer += 1;
    }
  }

  const htvById = new Map(existing.htvDesigns.map((entry) => [entry.designId, entry]));
  for (const incoming of backup.htvDesigns) {
    const current = htvById.get(incoming.designId);
    if (!current) {
      htvById.set(incoming.designId, incoming);
      summary.addedHtv += 1;
    } else if (incoming.updatedAt > current.updatedAt) {
      htvById.set(incoming.designId, incoming);
      summary.updatedHtv += 1;
    } else {
      summary.keptNewer += 1;
    }
  }

  const papercraftById = new Map((existing.papercraftDesigns ?? []).map((entry) => [entry.designId, entry]));
  for (const incoming of backup.papercraftDesigns ?? []) {
    const current = papercraftById.get(incoming.designId);
    if (!current) {
      papercraftById.set(incoming.designId, incoming);
      summary.addedPapercraft += 1;
    } else if (incoming.updatedAt > current.updatedAt) {
      papercraftById.set(incoming.designId, incoming);
      summary.updatedPapercraft += 1;
    } else {
      summary.keptNewer += 1;
    }
  }

  const profilesById = new Map((existing.calibrationProfiles ?? []).map((profile) => [profile.id, profile]));
  for (const incoming of backup.calibrationProfiles ?? []) {
    const current = profilesById.get(incoming.id);
    if (!current) {
      profilesById.set(incoming.id, incoming);
      summary.addedCalibration += 1;
    } else if (incoming.updatedAt > current.updatedAt) {
      profilesById.set(incoming.id, incoming);
      summary.updatedCalibration += 1;
    }
  }

  return {
    rhinestoneDesigns: [...rhinestoneById.values()],
    htvDesigns: [...htvById.values()],
    papercraftDesigns: [...papercraftById.values()],
    calibrationProfiles: [...profilesById.values()],
    summary,
    rhinestoneToSave,
  };
}

/** One sentence describing what a restore did. */
export function describeMergeSummary(summary: BackupMergeSummary, skippedCount: number): string {
  const parts: string[] = [];
  const added = summary.addedRhinestone + summary.addedHtv + summary.addedPapercraft;
  const updated = summary.updatedRhinestone + summary.updatedHtv + summary.updatedPapercraft;
  if (added > 0) parts.push(`added ${added} ${added === 1 ? 'design' : 'designs'}`);
  if (updated > 0) parts.push(`updated ${updated} to the newer copy`);
  const profiles = summary.addedCalibration + summary.updatedCalibration;
  if (profiles > 0) parts.push(`restored ${profiles} calibration ${profiles === 1 ? 'profile' : 'profiles'}`);
  if (summary.keptNewer > 0) parts.push(`kept ${summary.keptNewer} that ${summary.keptNewer === 1 ? 'is' : 'are'} already up to date here`);
  if (skippedCount > 0) parts.push(`skipped ${skippedCount} that could not be read`);
  return parts.length > 0 ? `Restored: ${parts.join(', ')}.` : 'The backup had no designs in it.';
}
