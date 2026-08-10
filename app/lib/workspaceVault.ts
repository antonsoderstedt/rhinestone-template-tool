import type { TemplateCoverageMode, TemplateFillMode } from '@/src/lib/rhinestone-engine/index';
import type { HtvHistoryEntry, HtvState } from '../htv/HtvState';

export const WORKSPACE_VAULT_STORAGE_KEY = 'rhinestone-workspace-vault';

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
  fileName: string;
  mimeType: string;
  sizeBytes: number;
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
  sourceDataUrl: string;
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

export interface WorkspaceSettings {
  machineModel: string;
  cuttingMat: string;
  bladeStrategy: string;
  defaultMaterial: string;
  defaultFlock: string;
  defaultStoneSize: string;
  defaultRhinestoneSpacingMm: number;
  defaultHtvCarrier: string;
  htvWeedMarginMm: number;
  outputFolderHint: string;
  qualityChecklist: string;
}

export interface WorkspaceVault {
  version: 1;
  assets: WorkspaceAsset[];
  uploadedFonts: UploadedWorkspaceFont[];
  fontPreferences: FontPreference[];
  htvDesigns: HtvDesignEntry[];
  designPreferences: DesignPreference[];
  settings: WorkspaceSettings;
}

export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  machineModel: 'Cricut Maker 3',
  cuttingMat: 'StandardGrip 12x12',
  bladeStrategy: 'Fresh fine-point blade before production runs',
  defaultMaterial: 'Magic Flock',
  defaultFlock: 'Magic Flock template material',
  defaultStoneSize: 'SS10',
  defaultRhinestoneSpacingMm: 4,
  defaultHtvCarrier: 'Hot peel performance vinyl',
  htvWeedMarginMm: 6,
  outputFolderHint: 'Jobs/Ready To Cut',
  qualityChecklist: 'Check font coverage, preview garment placement, verify labels off for Cricut, confirm material preset, cut a calibration test for new batches.',
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

  return {
    version: 1,
    assets: Array.isArray(raw?.assets) ? raw.assets : [],
    uploadedFonts,
    fontPreferences: Array.isArray(raw?.fontPreferences) ? raw.fontPreferences : [],
    htvDesigns: Array.isArray(raw?.htvDesigns) ? raw.htvDesigns : [],
    designPreferences: Array.isArray(raw?.designPreferences) ? raw.designPreferences : [],
    settings: {
      ...DEFAULT_WORKSPACE_SETTINGS,
      ...(raw?.settings ?? {}),
    },
  };
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
  return {
    projectName: snapshot.projectName,
    layers: structuredClone(snapshot.layers),
    selectedLayerIds: new Set(snapshot.selectedLayerIds),
    canvas: structuredClone(snapshot.canvas),
    garment: structuredClone(snapshot.garment),
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
    garmentLabel: `${state.garment.type} · ${state.garment.size} · ${state.garment.placementZone}`,
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