import type { PageLayout, PageSettings, Pattern, PatternSettings, RawMesh, Solid } from './types';
import { PAGE_PRESETS } from './types';
import { buildSolid, type BuildOptions } from './mesh/build';
import { scaleMesh, type ScaleTarget } from './mesh/inspect';
import { buildPattern } from './unfold/pattern';
import { layoutPages } from './layout/pack';

export interface PapercraftInput {
  mesh: RawMesh;
  scale?: ScaleTarget;
  build?: BuildOptions;
  pattern?: Partial<PatternSettings>;
  page?: Partial<PageSettings>;
}

export interface PapercraftResult {
  solid: Solid;
  pattern: Pattern;
  layout: PageLayout;
  pageSettings: PageSettings;
}

export const DEFAULT_PAGE_SETTINGS: PageSettings = { ...PAGE_PRESETS.a4, marginMm: 10, gapMm: 3 };

/** Mesh in, pages out: scale, clean, unfold, add tabs and numbers, pack onto pages. */
export function createPapercraft(input: PapercraftInput): PapercraftResult {
  const pageSettings: PageSettings = { ...DEFAULT_PAGE_SETTINGS, ...input.page };
  const mesh = input.scale ? scaleMesh(input.mesh, input.scale) : input.mesh;
  const solid = buildSolid(mesh, input.build);
  const pattern = buildPattern(solid, {
    maxPartSize: {
      widthMm: pageSettings.pageWidthMm - 2 * pageSettings.marginMm,
      heightMm: pageSettings.pageHeightMm - 2 * pageSettings.marginMm,
    },
    ...input.pattern,
  });
  const layout = layoutPages(pattern.parts, pageSettings);
  return { solid, pattern, layout, pageSettings };
}
