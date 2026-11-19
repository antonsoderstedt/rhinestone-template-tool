import type { TemplateCoverageMode, TemplateFillMode } from '@/src/lib/rhinestone-engine/index';
import { normalizeGarmentType } from '../components/garmentPreview/garmentCatalog';
import type { HtvHistoryEntry, HtvState } from '../htv/HtvState';
import {
  DEFAULT_WORKSPACE_SETTINGS,
  sanitizeWorkspaceSettings,
  type WorkspaceSettings,
} from './workspaceSettings';

export { DEFAULT_WORKSPACE_SETTINGS, type WorkspaceSettings };

export const WORKSPACE_VAULT_STORAGE_KEY = 'rhinestone-workspace-vault';
export const ACTIVE_CALIBRATION_PROFILE_STORAGE_KEY = 'rhinestone-active-calibration-profile';

export interface WorkspaceAsset {
  assetId: string;
  name: string;
  fileName: string;
  kind: 'svg' | 'image';
  mimeType: string;
  sizeBytes: number;
  tags: string[];
  favorite: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  previewDataUrl: string;
  sourceDataUrl: string;
  svgText: string | null;
}

export interface UploadedWorkspaceFont {
  fontId: string;
  name: string;
  familyName?: string;
  variantName?: string;
  importSourceLabel?: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sourceKind?: 'browser-uploaded' | 'workspace-installed';
  category: string;
  styleLabel: string;
  tags: string[];
  favorite: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  previewFamily: string;
  previewText: string;
  licenseSource: string;
  note: string;
  preferredTextCoverageMode: TemplateFillMode;
  supportedTextCoverageModes: TemplateCoverageMode[];
  sourceDataUrl?: string;
  assetUrl?: string;
  nodeFilePath?: string;
}

export interface FontPreference {
  fontKey: string;
  tags: string[];
  favorite: boolean;
  archived: boolean;
}

export interface DesignPreference {
  designKey: string;
  archived: boolean;
}

interface SerializedHtvHistoryEntry {
  layers: HtvHistoryEntry['layers'];
  selectedLayerIds: string[];
}

export interface SerializedHtvState {
  projectName: string;
  layers: HtvState['layers'];
  selectedLayerIds: string[];
  canvas: HtvState['canvas'];
  garment: HtvState['garment'];
  history: {
    past: SerializedHtvHistoryEntry[];
    future: SerializedHtvHistoryEntry[];
  };
}

export interface HtvDesignEntry {
  designId: string;
  name: string;
  tags: string[];
  favorite: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  previewText: string;
  layerCount: number;
  garmentLabel: string;
  snapshot: SerializedHtvState;
}

export interface CalibrationProfileOverride {
  stoneSize: string;
  holeDiameterMm: number;
  notes?: string;
}

export interface CalibrationProfile {
  id: string;
  name: string;
  materialProfileId: string;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  overrides: CalibrationProfileOverride[];
}

export interface WorkspaceVault {
  version: 1;
  assets: WorkspaceAsset[];
  uploadedFonts: UploadedWorkspaceFont[];
  fontPreferences: FontPreference[];
  htvDesigns: HtvDesignEntry[];
  designPreferences: DesignPreference[];
  settings: WorkspaceSettings;
  calibrationProfiles: CalibrationProfile[];
}

export const EMPTY_WORKSPACE_VAULT: WorkspaceVault = {
  version: 1,
  assets: [],
  uploadedFonts: [],
  fontPreferences: [],
  htvDesigns: [],
  designPreferences: [],
  settings: { ...DEFAULT_WORKSPACE_SETTINGS },
  calibrationProfiles: [],
};

function getStorage(): Storage | null {
  const candidate = globalThis.localStorage as Partial<Storage> | undefined;
  return typeof candidate === 'object'
    && candidate !== null
    && typeof candidate.getItem === 'function'
    && typeof candidate.setItem === 'function'
    ? candidate as Storage
    : null;
}

function normalizeVault(raw: Partial<WorkspaceVault> | null | undefined): WorkspaceVault {
  const uploadedFonts: UploadedWorkspaceFont[] = Array.isArray(raw?.uploadedFonts)
    ? raw.uploadedFonts.map((font): UploadedWorkspaceFont => ({
        ...font,
        familyName: typeof font.familyName === 'string' && font.familyName.length > 0 ? font.familyName : font.name,
        variantName: typeof font.variantName === 'string' && font.variantName.length > 0 ? font.variantName : font.styleLabel,
        importSourceLabel: typeof font.importSourceLabel === 'string' && font.importSourceLabel.length > 0 ? font.importSourceLabel : font.licenseSource,
        sourceKind: font.sourceKind === 'workspace-installed' ? 'workspace-installed' : 'browser-uploaded',
        category: typeof font.category === 'string' && font.category.length > 0 ? font.category : 'Display',
        styleLabel: typeof font.styleLabel === 'string' && font.styleLabel.length > 0 ? font.styleLabel : 'Uploaded',
        previewText: typeof font.previewText === 'string' && font.previewText.length > 0 ? font.previewText : 'Sulay 123',
        licenseSource: typeof font.licenseSource === 'string' && font.licenseSource.length > 0 ? font.licenseSource : 'User uploaded local workspace asset',
        note: typeof font.note === 'string' && font.note.length > 0 ? font.note : 'Review the generated outlines before production cutting.',
        preferredTextCoverageMode:
          font.preferredTextCoverageMode === 'fill' || font.preferredTextCoverageMode === 'outline-fill'
            ? font.preferredTextCoverageMode
            : 'outline',
        supportedTextCoverageModes: Array.isArray(font.supportedTextCoverageModes) && font.supportedTextCoverageModes.length > 0
          ? font.supportedTextCoverageModes.filter((mode): mode is TemplateCoverageMode =>
              mode === 'outline' || mode === 'fill' || mode === 'outline-fill' || mode === 'contour',
            )
          : ['outline', 'fill', 'outline-fill', 'contour'],
      }))
    : [];

  const calibrationProfiles: CalibrationProfile[] = Array.isArray(raw?.calibrationProfiles)
    ? raw.calibrationProfiles
        .filter((profile): profile is CalibrationProfile => !!profile && typeof profile === 'object')
        .map((profile) => ({
          id: typeof profile.id === 'string' ? profile.id : makeWorkspaceId('calibration-profile'),
          name: typeof profile.name === 'string' && profile.name.trim().length > 0 ? profile.name.trim() : 'Calibrated profile',
          materialProfileId: typeof profile.materialProfileId === 'string' ? profile.materialProfileId : 'magic-flock-cricut-maker',
          createdAt: typeof profile.createdAt === 'string' ? profile.createdAt : new Date().toISOString(),
          updatedAt: typeof profile.updatedAt === 'string' ? profile.updatedAt : new Date().toISOString(),
          approvedAt: typeof profile.approvedAt === 'string' ? profile.approvedAt : undefined,
          overrides: Array.isArray(profile.overrides)
            ? profile.overrides
                .filter((override): override is CalibrationProfileOverride => !!override && typeof override === 'object')
                .map((override) => ({
                  stoneSize: typeof override.stoneSize === 'string' ? override.stoneSize : 'SS10',
                  holeDiameterMm: typeof override.holeDiameterMm === 'number' && Number.isFinite(override.holeDiameterMm) && override.holeDiameterMm > 0
                    ? override.holeDiameterMm
                    : 3.43,
                  notes: typeof override.notes === 'string' ? override.notes : undefined,
                }))
            : [],
        }))
    : [];

  return {
    version: 1,
    assets: Array.isArray(raw?.assets) ? raw.assets : [],
    uploadedFonts,
    fontPreferences: Array.isArray(raw?.fontPreferences) ? raw.fontPreferences : [],
    htvDesigns: Array.isArray(raw?.htvDesigns) ? raw.htvDesigns : [],
    designPreferences: Array.isArray(raw?.designPreferences) ? raw.designPreferences : [],
    settings: sanitizeWorkspaceSettings(raw?.settings),
    calibrationProfiles,
  };
}

export function mergeInstalledWorkspaceFonts(
  vault: WorkspaceVault,
  installedFonts: UploadedWorkspaceFont[],
): WorkspaceVault {
  const browserFonts = vault.uploadedFonts.filter((font) => font.sourceKind !== 'workspace-installed');
  const existingInstalledById = new Map(
    vault.uploadedFonts
      .filter((font) => font.sourceKind === 'workspace-installed')
      .map((font) => [font.fontId, font]),
  );
  const normalizedInstalledFonts = installedFonts.map((font) => {
    const existing = existingInstalledById.get(font.fontId);
    return {
      ...font,
      sourceKind: 'workspace-installed' as const,
      sourceDataUrl: undefined,
      favorite: existing?.favorite ?? font.favorite,
      archived: existing?.archived ?? font.archived,
      tags: existing?.tags ?? font.tags,
      category: existing?.category ?? font.category,
      styleLabel: existing?.styleLabel ?? font.styleLabel,
      previewText: existing?.previewText ?? font.previewText,
      note: existing?.note ?? font.note,
      licenseSource: existing?.licenseSource ?? font.licenseSource,
      preferredTextCoverageMode: existing?.preferredTextCoverageMode ?? font.preferredTextCoverageMode,
      supportedTextCoverageModes: existing?.supportedTextCoverageModes ?? font.supportedTextCoverageModes,
      familyName: existing?.familyName ?? font.familyName,
      variantName: existing?.variantName ?? font.variantName,
      importSourceLabel: existing?.importSourceLabel ?? font.importSourceLabel,
      createdAt: existing?.createdAt ?? font.createdAt,
    };
  });
  return {
    ...vault,
    uploadedFonts: [...browserFonts, ...normalizedInstalledFonts],
  };
}

/** Just the settings, for studios that only need new-project defaults. */
export function readWorkspaceSettings(): WorkspaceSettings {
  return readWorkspaceVault().settings;
}

export function readWorkspaceVault(): WorkspaceVault {
  const storage = getStorage();
  if (!storage) return normalizeVault(null);

  const raw = storage.getItem(WORKSPACE_VAULT_STORAGE_KEY);
  if (!raw) return normalizeVault(null);

  try {
    return normalizeVault(JSON.parse(raw) as WorkspaceVault);
  } catch {
    return normalizeVault(null);
  }
}

export function writeWorkspaceVault(vault: WorkspaceVault): void {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(WORKSPACE_VAULT_STORAGE_KEY, JSON.stringify(vault));
}

export function readActiveCalibrationProfileId(): string | null {
  const storage = getStorage();
  if (!storage) return null;
  const value = storage.getItem(ACTIVE_CALIBRATION_PROFILE_STORAGE_KEY);
  return value && value.trim().length > 0 ? value : null;
}

export function readActiveCalibrationProfile(): CalibrationProfile | null {
  const activeId = readActiveCalibrationProfileId();
  if (!activeId) return null;
  return readWorkspaceVault().calibrationProfiles.find((profile) => profile.id === activeId) ?? null;
}

export function setActiveCalibrationProfile(profileId: string | null): void {
  const storage = getStorage();
  if (!storage) return;
  if (profileId && profileId.trim().length > 0) {
    storage.setItem(ACTIVE_CALIBRATION_PROFILE_STORAGE_KEY, profileId);
    return;
  }
  storage.removeItem(ACTIVE_CALIBRATION_PROFILE_STORAGE_KEY);
}

export function isApprovedCalibrationProfileActive(): boolean {
  return Boolean(readActiveCalibrationProfile()?.approvedAt);
}

export function upsertCalibrationProfile(
  vault: WorkspaceVault,
  profile: CalibrationProfile,
): WorkspaceVault {
  const normalizedProfile: CalibrationProfile = {
    ...profile,
    overrides: profile.overrides.filter((override) => typeof override.stoneSize === 'string' && override.holeDiameterMm > 0),
  };

  const nextProfiles = [...vault.calibrationProfiles.filter((item) => item.id !== normalizedProfile.id), normalizedProfile]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  return {
    ...vault,
    calibrationProfiles: nextProfiles,
  };
}

export function deleteCalibrationProfile(vault: WorkspaceVault, profileId: string): WorkspaceVault {
  return {
    ...vault,
    calibrationProfiles: vault.calibrationProfiles.filter((profile) => profile.id !== profileId),
  };
}

export function makeWorkspaceId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
}

export function serializeHtvState(state: HtvState): SerializedHtvState {
  return {
    projectName: state.projectName,
    layers: structuredClone(state.layers),
    selectedLayerIds: [...state.selectedLayerIds],
    canvas: structuredClone(state.canvas),
    garment: structuredClone(state.garment),
    history: {
      past: state.history.past.map((entry) => ({
        layers: structuredClone(entry.layers),
        selectedLayerIds: [...entry.selectedLayerIds],
      })),
      future: state.history.future.map((entry) => ({
        layers: structuredClone(entry.layers),
        selectedLayerIds: [...entry.selectedLayerIds],
      })),
    },
  };
}

export function deserializeHtvState(snapshot: SerializedHtvState): HtvState {
  const normalizedType = normalizeGarmentType(snapshot.garment.type);
  const placementZone = snapshot.garment.placementZone ?? 'full-front';
  const activePlacementZones = Array.isArray((snapshot.garment as Partial<typeof snapshot.garment> & { activePlacementZones?: string[] }).activePlacementZones)
    ? (snapshot.garment as Partial<typeof snapshot.garment> & { activePlacementZones?: string[] }).activePlacementZones!.filter((value): value is HtvState['garment']['placementZone'] => typeof value === 'string')
    : [placementZone];
  return {
    projectName: snapshot.projectName,
    layers: structuredClone(snapshot.layers),
    selectedLayerIds: new Set(snapshot.selectedLayerIds),
    canvas: structuredClone(snapshot.canvas),
    garment: {
      ...structuredClone(snapshot.garment),
      type: normalizedType,
      placementZone,
      activePlacementZones: activePlacementZones.length > 0 ? activePlacementZones : [placementZone],
    },
    history: {
      past: snapshot.history.past.map((entry) => ({
        layers: structuredClone(entry.layers),
        selectedLayerIds: new Set(entry.selectedLayerIds),
      })),
      future: snapshot.history.future.map((entry) => ({
        layers: structuredClone(entry.layers),
        selectedLayerIds: new Set(entry.selectedLayerIds),
      })),
    },
  };
}

export function buildHtvDesignEntry(state: HtvState, existing?: HtvDesignEntry | null): HtvDesignEntry {
  const now = new Date().toISOString();
  const firstTextLayer = state.layers.find((layer) => layer.type === 'text');
  const previewText = firstTextLayer?.type === 'text'
    ? firstTextLayer.text.trim() || state.projectName
    : state.layers[0]?.name ?? state.projectName;

  return {
    designId: existing?.designId ?? makeWorkspaceId('htv-design'),
    name: state.projectName.trim() || existing?.name || 'Untitled HTV Design',
    tags: existing?.tags ?? [],
    favorite: existing?.favorite ?? false,
    archived: existing?.archived ?? false,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    previewText,
    layerCount: state.layers.length,
    garmentLabel: `${state.garment.type} · ${state.garment.size} · ${state.garment.activePlacementZones.length} placement${state.garment.activePlacementZones.length === 1 ? '' : 's'}`,
    snapshot: serializeHtvState(state),
  };
}

export function findAssetById(assetId: string): WorkspaceAsset | null {
  return readWorkspaceVault().assets.find((asset) => asset.assetId === assetId) ?? null;
}

export function findUploadedFontById(fontId: string): UploadedWorkspaceFont | null {
  return readWorkspaceVault().uploadedFonts.find((font) => font.fontId === fontId) ?? null;
}

export function findHtvDesignById(designId: string): HtvDesignEntry | null {
  return readWorkspaceVault().htvDesigns.find((design) => design.designId === designId) ?? null;
}

export function getFontPreference(vault: WorkspaceVault, fontKey: string): FontPreference {
  return vault.fontPreferences.find((item) => item.fontKey === fontKey) ?? {
    fontKey,
    tags: [],
    favorite: false,
    archived: false,
  };
}

export function getDesignArchived(vault: WorkspaceVault, designKey: string): boolean {
  return vault.designPreferences.find((item) => item.designKey === designKey)?.archived ?? false;
}