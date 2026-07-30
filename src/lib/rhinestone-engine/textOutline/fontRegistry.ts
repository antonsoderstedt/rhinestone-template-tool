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
  | 'Display';

export type OutlineFontId =
  | 'legacy-original'
  | 'archivo-black'
  | 'oswald-condensed'
  | 'black-ops-varsity'
  | 'lilita-bubble'
  | 'bitter-slab'
  | 'pirata-gothic'
  | 'pacifico-script'
  | 'caveat-handwritten'
  | 'audiowide-y2k'
  | 'comfortaa-rounded';

export interface OutlineFontDefinition {
  fontId: OutlineFontId;
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
  limitations?: string[];
}

export const LEGACY_OUTLINE_FONT_ID: OutlineFontId = 'legacy-original';
export const DEFAULT_OUTLINE_FONT_ID: OutlineFontId = LEGACY_OUTLINE_FONT_ID;

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
  },
  {
    fontId: 'pirata-gothic',
    displayName: 'Pirata One',
    category: 'Gothic',
    fontFamily: 'Pirata One',
    previewFontFamily: 'RhinestonePirataOne',
    fontWeight: 400,
    fontStyle: 'normal',
    assetUrl: localFontAssetUrl('pirata-gothic'),
    nodeFilePath: 'node_modules/@fontsource/pirata-one/files/pirata-one-latin-400-normal.woff',
    license: 'OFL-1.1',
    licenseSource: '@fontsource/pirata-one / Google Fonts',
    packageName: '@fontsource/pirata-one',
    isLegacy: false,
  },
  {
    fontId: 'pacifico-script',
    displayName: 'Pacifico',
    category: 'Script',
    fontFamily: 'Pacifico',
    previewFontFamily: 'RhinestonePacifico',
    fontWeight: 400,
    fontStyle: 'normal',
    assetUrl: localFontAssetUrl('pacifico-script'),
    nodeFilePath: 'node_modules/@fontsource/pacifico/files/pacifico-latin-400-normal.woff',
    license: 'OFL-1.1',
    licenseSource: '@fontsource/pacifico / Google Fonts',
    packageName: '@fontsource/pacifico',
    isLegacy: false,
  },
  {
    fontId: 'caveat-handwritten',
    displayName: 'Caveat',
    category: 'Handwritten',
    fontFamily: 'Caveat',
    previewFontFamily: 'RhinestoneCaveat',
    fontWeight: 600,
    fontStyle: 'normal',
    assetUrl: localFontAssetUrl('caveat-handwritten'),
    nodeFilePath: 'node_modules/@fontsource/caveat/files/caveat-latin-600-normal.woff',
    license: 'OFL-1.1',
    licenseSource: '@fontsource/caveat / Google Fonts',
    packageName: '@fontsource/caveat',
    isLegacy: false,
  },
  {
    fontId: 'audiowide-y2k',
    displayName: 'Audiowide',
    category: 'Display',
    fontFamily: 'Audiowide',
    previewFontFamily: 'RhinestoneAudiowide',
    fontWeight: 400,
    fontStyle: 'normal',
    assetUrl: localFontAssetUrl('audiowide-y2k'),
    nodeFilePath: 'node_modules/@fontsource/audiowide/files/audiowide-latin-400-normal.woff',
    license: 'OFL-1.1',
    licenseSource: '@fontsource/audiowide / Google Fonts',
    packageName: '@fontsource/audiowide',
    isLegacy: false,
  },
  {
    fontId: 'comfortaa-rounded',
    displayName: 'Comfortaa',
    category: 'Bubble',
    fontFamily: 'Comfortaa',
    previewFontFamily: 'RhinestoneComfortaa',
    fontWeight: 600,
    fontStyle: 'normal',
    assetUrl: localFontAssetUrl('comfortaa-rounded'),
    nodeFilePath: 'node_modules/@fontsource/comfortaa/files/comfortaa-latin-600-normal.woff',
    license: 'OFL-1.1',
    licenseSource: '@fontsource/comfortaa / Google Fonts',
    packageName: '@fontsource/comfortaa',
    isLegacy: false,
  },
] as const;

const FONT_MAP = new Map(OUTLINE_FONT_REGISTRY.map((font) => [font.fontId, font]));

export function listOutlineFonts(): readonly OutlineFontDefinition[] {
  return OUTLINE_FONT_REGISTRY;
}

export function getOutlineFontDefinition(fontId: string | undefined | null): OutlineFontDefinition {
  if (!fontId) {
    return FONT_MAP.get(LEGACY_OUTLINE_FONT_ID)!;
  }
  return FONT_MAP.get(fontId as OutlineFontId) ?? FONT_MAP.get(LEGACY_OUTLINE_FONT_ID)!;
}

export function isKnownOutlineFontId(fontId: string | undefined | null): fontId is OutlineFontId {
  return typeof fontId === 'string' && FONT_MAP.has(fontId as OutlineFontId);
}

export function getOutlineFontFaceCss(): string {
  return OUTLINE_FONT_REGISTRY.filter((font) => !font.isLegacy && font.assetUrl).map((font) => `
@font-face {
  font-family: '${font.previewFontFamily}';
  src: url('${font.assetUrl}') format('woff');
  font-style: ${font.fontStyle};
  font-weight: ${font.fontWeight};
  font-display: swap;
}
`).join('\n');
}
