export type OutlineFontCategory =
  | 'Legacy'
  | 'Block'
  | 'Condensed'
  | 'Varsity'
  | 'Bubble'
  | 'Serif'
  | 'Gothic'
  | 'Script'
  | 'Handwritten'
  | 'Display'
  | 'Uploads';

import type { TemplateCoverageMode, TemplateFillMode } from '../fill/fillTemplate';

export type OutlineFontId =
  | 'legacy-original'
  | 'archivo-black'
  | 'oswald-condensed'
  | 'black-ops-varsity'
  | 'lilita-bubble'
  | 'bitter-slab'
  | 'bebas-neue'
  | 'anton-condensed'
  | 'fredoka-one'
  | 'righteous-varsity';

export interface OutlineFontDefinition {
  fontId: string;
  sourceKind?: 'bundled' | 'workspace-installed' | 'browser-uploaded';
  displayName: string;
  category: OutlineFontCategory;
  fontFamily: string;
  previewFontFamily: string;
  fontWeight: number;
  fontStyle: 'normal' | 'italic';
  assetUrl: string | null;
  nodeFilePath: string | null;
  license: string;
  licenseSource: string;
  packageName: string | null;
  isLegacy: boolean;
  preferredTextCoverageMode: TemplateFillMode;
  supportedTextCoverageModes: readonly TemplateCoverageMode[];
  limitations?: string[];
}

export const LEGACY_OUTLINE_FONT_ID: OutlineFontId = 'legacy-original';
export const DEFAULT_OUTLINE_FONT_ID: OutlineFontId = LEGACY_OUTLINE_FONT_ID;
const WORKSPACE_VAULT_STORAGE_KEY = 'rhinestone-workspace-vault';

function localFontAssetUrl(fontId: Exclude<OutlineFontId, 'legacy-original'>): string {
  return `/api/outline-fonts/${fontId}`;
}

export const OUTLINE_FONT_REGISTRY: readonly OutlineFontDefinition[] = [
  {
    fontId: 'legacy-original',
    displayName: 'Legacy / Original',
    category: 'Legacy',
    fontFamily: 'Built-in Vector Outline v1',
    previewFontFamily: 'system-ui',
    fontWeight: 400,
    fontStyle: 'normal',
    assetUrl: null,
    nodeFilePath: null,
    license: 'Project internal legacy vector data',
    licenseSource: 'Embedded in src/lib/rhinestone-engine/textOutline/vectorFont.ts',
    packageName: null,
    isLegacy: true,
    preferredTextCoverageMode: 'outline',
    supportedTextCoverageModes: ['outline', 'fill', 'outline-fill', 'contour'],
    limitations: ['Uppercase vector stroke font', 'Lowercase maps to uppercase glyphs'],
  },
  {
    fontId: 'archivo-black',
    displayName: 'Archivo Black',
    category: 'Block',
    fontFamily: 'Archivo Black',
    previewFontFamily: 'RhinestoneArchivoBlack',
    fontWeight: 400,
    fontStyle: 'normal',
    assetUrl: localFontAssetUrl('archivo-black'),
    nodeFilePath: 'node_modules/@fontsource/archivo-black/files/archivo-black-latin-400-normal.woff',
    license: 'OFL-1.1',
    licenseSource: '@fontsource/archivo-black / Google Fonts',
    packageName: '@fontsource/archivo-black',
    isLegacy: false,
    preferredTextCoverageMode: 'outline',
    supportedTextCoverageModes: ['outline', 'fill', 'outline-fill', 'contour'],
  },
  {
    fontId: 'oswald-condensed',
    displayName: 'Oswald',
    category: 'Condensed',
    fontFamily: 'Oswald',
    previewFontFamily: 'RhinestoneOswald',
    fontWeight: 500,
    fontStyle: 'normal',
    assetUrl: localFontAssetUrl('oswald-condensed'),
    nodeFilePath: 'node_modules/@fontsource/oswald/files/oswald-latin-500-normal.woff',
    license: 'OFL-1.1',
    licenseSource: '@fontsource/oswald / Google Fonts',
    packageName: '@fontsource/oswald',
    isLegacy: false,
    preferredTextCoverageMode: 'outline-fill',
    supportedTextCoverageModes: ['outline', 'fill', 'outline-fill', 'contour'],
  },
  {
    fontId: 'black-ops-varsity',
    displayName: 'Black Ops One',
    category: 'Varsity',
    fontFamily: 'Black Ops One',
    previewFontFamily: 'RhinestoneBlackOpsOne',
    fontWeight: 400,
    fontStyle: 'normal',
    assetUrl: localFontAssetUrl('black-ops-varsity'),
    nodeFilePath: 'node_modules/@fontsource/black-ops-one/files/black-ops-one-latin-400-normal.woff',
    license: 'OFL-1.1',
    licenseSource: '@fontsource/black-ops-one / Google Fonts',
    packageName: '@fontsource/black-ops-one',
    isLegacy: false,
    preferredTextCoverageMode: 'outline',
    supportedTextCoverageModes: ['outline', 'fill', 'outline-fill', 'contour'],
  },
  {
    fontId: 'lilita-bubble',
    displayName: 'Lilita One',
    category: 'Bubble',
    fontFamily: 'Lilita One',
    previewFontFamily: 'RhinestoneLilitaOne',
    fontWeight: 400,
    fontStyle: 'normal',
    assetUrl: localFontAssetUrl('lilita-bubble'),
    nodeFilePath: 'node_modules/@fontsource/lilita-one/files/lilita-one-latin-400-normal.woff',
    license: 'OFL-1.1',
    licenseSource: '@fontsource/lilita-one / Google Fonts',
    packageName: '@fontsource/lilita-one',
    isLegacy: false,
    preferredTextCoverageMode: 'outline',
    supportedTextCoverageModes: ['outline', 'fill', 'outline-fill', 'contour'],
  },
  {
    fontId: 'bitter-slab',
    displayName: 'Bitter',
    category: 'Serif',
    fontFamily: 'Bitter',
    previewFontFamily: 'RhinestoneBitter',
    fontWeight: 600,
    fontStyle: 'normal',
    assetUrl: localFontAssetUrl('bitter-slab'),
    nodeFilePath: 'node_modules/@fontsource/bitter/files/bitter-latin-600-normal.woff',
    license: 'OFL-1.1',
    licenseSource: '@fontsource/bitter / Google Fonts',
    packageName: '@fontsource/bitter',
    isLegacy: false,
    preferredTextCoverageMode: 'outline',
    supportedTextCoverageModes: ['outline', 'fill', 'outline-fill', 'contour'],
  },
  {
    fontId: 'bebas-neue',
    displayName: 'Bebas Neue',
    category: 'Condensed',
    fontFamily: 'Bebas Neue',
    previewFontFamily: 'RhinestoneBebasNeue',
    fontWeight: 400,
    fontStyle: 'normal',
    assetUrl: localFontAssetUrl('bebas-neue'),
    nodeFilePath: 'node_modules/@fontsource/bebas-neue/files/bebas-neue-latin-400-normal.woff',
    license: 'OFL-1.1',
    licenseSource: '@fontsource/bebas-neue / Google Fonts',
    packageName: '@fontsource/bebas-neue',
    isLegacy: false,
    preferredTextCoverageMode: 'outline-fill',
    supportedTextCoverageModes: ['outline', 'fill', 'outline-fill', 'contour'],
  },
  {
    fontId: 'anton-condensed',
    displayName: 'Anton',
    category: 'Condensed',
    fontFamily: 'Anton',
    previewFontFamily: 'RhinestoneAnton',
    fontWeight: 400,
    fontStyle: 'normal',
    assetUrl: localFontAssetUrl('anton-condensed'),
    nodeFilePath: 'node_modules/@fontsource/anton/files/anton-latin-400-normal.woff',
    license: 'OFL-1.1',
    licenseSource: '@fontsource/anton / Google Fonts',
    packageName: '@fontsource/anton',
    isLegacy: false,
    preferredTextCoverageMode: 'outline',
    supportedTextCoverageModes: ['outline', 'fill', 'outline-fill', 'contour'],
  },
  {
    fontId: 'fredoka-one',
    displayName: 'Fredoka One',
    category: 'Bubble',
    fontFamily: 'Fredoka One',
    previewFontFamily: 'RhinestoneFredokaOne',
    fontWeight: 400,
    fontStyle: 'normal',
    assetUrl: localFontAssetUrl('fredoka-one'),
    nodeFilePath: 'node_modules/@fontsource/fredoka-one/files/fredoka-one-latin-400-normal.woff',
    license: 'OFL-1.1',
    licenseSource: '@fontsource/fredoka-one / Google Fonts',
    packageName: '@fontsource/fredoka-one',
    isLegacy: false,
    preferredTextCoverageMode: 'outline',
    supportedTextCoverageModes: ['outline', 'fill', 'outline-fill', 'contour'],
  },
  {
    fontId: 'righteous-varsity',
    displayName: 'Righteous',
    category: 'Varsity',
    fontFamily: 'Righteous',
    previewFontFamily: 'RhinestoneRighteous',
    fontWeight: 400,
    fontStyle: 'normal',
    assetUrl: localFontAssetUrl('righteous-varsity'),
    nodeFilePath: 'node_modules/@fontsource/righteous/files/righteous-latin-400-normal.woff',
    license: 'OFL-1.1',
    licenseSource: '@fontsource/righteous / Google Fonts',
    packageName: '@fontsource/righteous',
    isLegacy: false,
    preferredTextCoverageMode: 'outline',
    supportedTextCoverageModes: ['outline', 'fill', 'outline-fill', 'contour'],
  },
] as const;

const FONT_MAP = new Map(OUTLINE_FONT_REGISTRY.map((font) => [font.fontId, font]));

interface UploadedWorkspaceFontRecord {
  fontId: string;
  name: string;
  sourceKind?: 'browser-uploaded' | 'workspace-installed';
  category?: string;
  styleLabel?: string;
  previewFamily: string;
  previewText?: string;
  licenseSource?: string;
  note?: string;
  preferredTextCoverageMode?: TemplateFillMode;
  supportedTextCoverageModes?: TemplateCoverageMode[];
  sourceDataUrl?: string;
  assetUrl?: string;
  nodeFilePath?: string;
}

const VALID_UPLOAD_CATEGORIES: ReadonlySet<OutlineFontCategory> = new Set([
  'Block',
  'Condensed',
  'Varsity',
  'Bubble',
  'Serif',
  'Gothic',
  'Script',
  'Handwritten',
  'Display',
  'Uploads',
]);

function resolveUploadedCategory(category: string | undefined): OutlineFontCategory {
  return category && VALID_UPLOAD_CATEGORIES.has(category as OutlineFontCategory)
    ? category as OutlineFontCategory
    : 'Uploads';
}

function resolveUploadedCoverageModes(modes: readonly TemplateCoverageMode[] | undefined): readonly TemplateCoverageMode[] {
  if (!modes || modes.length === 0) return ['outline', 'fill', 'outline-fill', 'contour'];
  const valid = modes.filter((mode): mode is TemplateCoverageMode =>
    mode === 'outline' || mode === 'fill' || mode === 'outline-fill' || mode === 'contour',
  );
  return valid.length > 0 ? valid : ['outline', 'fill', 'outline-fill', 'contour'];
}

function getStorage(): Storage | null {
  const candidate = globalThis.localStorage as Partial<Storage> | undefined;
  return typeof candidate === 'object'
    && candidate !== null
    && typeof candidate.getItem === 'function'
    ? candidate as Storage
    : null;
}

function readUploadedWorkspaceFonts(): UploadedWorkspaceFontRecord[] {
  const storage = getStorage();
  if (!storage) return [];

  const raw = storage.getItem(WORKSPACE_VAULT_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as { uploadedFonts?: UploadedWorkspaceFontRecord[] };
    return Array.isArray(parsed.uploadedFonts) ? parsed.uploadedFonts : [];
  } catch {
    return [];
  }
}

function createUploadedOutlineFontDefinition(record: UploadedWorkspaceFontRecord): OutlineFontDefinition {
  const supportedTextCoverageModes = resolveUploadedCoverageModes(record.supportedTextCoverageModes);
  const preferredTextCoverageMode = record.preferredTextCoverageMode === 'fill' || record.preferredTextCoverageMode === 'outline-fill'
    ? record.preferredTextCoverageMode
    : 'outline';

  return {
    fontId: record.fontId,
    sourceKind: record.sourceKind,
    displayName: record.name,
    category: resolveUploadedCategory(record.category),
    fontFamily: record.name,
    previewFontFamily: record.previewFamily,
    fontWeight: 400,
    fontStyle: 'normal',
    assetUrl: record.assetUrl ?? record.sourceDataUrl ?? null,
    nodeFilePath: record.nodeFilePath ?? null,
    license: record.sourceKind === 'workspace-installed' ? 'Imported local workspace font' : 'User uploaded in browser',
    licenseSource: record.licenseSource ?? `Workspace upload: ${record.name}`,
    packageName: null,
    isLegacy: false,
    preferredTextCoverageMode,
    supportedTextCoverageModes,
    limitations: [record.styleLabel ? `Style: ${record.styleLabel}` : 'User uploaded workspace font', record.note ?? 'Available in this browser workspace only'],
  };
}

export function listUploadedOutlineFonts(): readonly OutlineFontDefinition[] {
  return readUploadedWorkspaceFonts().map(createUploadedOutlineFontDefinition);
}

export function listOutlineFonts(): readonly OutlineFontDefinition[] {
  return [...OUTLINE_FONT_REGISTRY, ...listUploadedOutlineFonts()];
}

export function getOutlineFontDefinition(fontId: string | undefined | null): OutlineFontDefinition {
  if (!fontId) {
    return FONT_MAP.get(LEGACY_OUTLINE_FONT_ID)!;
  }
  return FONT_MAP.get(fontId as OutlineFontId)
    ?? listUploadedOutlineFonts().find((font) => font.fontId === fontId)
    ?? FONT_MAP.get(LEGACY_OUTLINE_FONT_ID)!;
}

export function getPreferredTextCoverageMode(fontId: string | undefined | null): TemplateFillMode {
  return getOutlineFontDefinition(fontId).preferredTextCoverageMode;
}

export function getSupportedTextCoverageModes(fontId: string | undefined | null): readonly TemplateCoverageMode[] {
  return getOutlineFontDefinition(fontId).supportedTextCoverageModes;
}

export function isKnownOutlineFontId(fontId: string | undefined | null): fontId is OutlineFontId {
  return typeof fontId === 'string' && FONT_MAP.has(fontId as OutlineFontId);
}

export function isAvailableOutlineFontId(fontId: string | undefined | null): boolean {
  return isKnownOutlineFontId(fontId) || listUploadedOutlineFonts().some((font) => font.fontId === fontId);
}

export function getOutlineFontFaceCss(): string {
  return listOutlineFonts().filter((font) => !font.isLegacy && font.assetUrl).map((font) => `
@font-face {
  font-family: '${font.previewFontFamily}';
  src: url('${font.assetUrl}');
  font-style: ${font.fontStyle};
  font-weight: ${font.fontWeight};
  font-display: swap;
}
`).join('\n');
}
