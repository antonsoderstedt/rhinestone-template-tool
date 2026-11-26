/**
 * Papercraft engine types. Everything is pure data in millimetres (the mesh may be in any unit until it is
 * scaled). 2D coordinates have y pointing up; exporters flip y when a format has y pointing down.
 */

export type Vec2 = readonly [number, number];
export type Vec3 = readonly [number, number, number];

/** A mesh as read from a file or generated: positions and faces (3 or more vertex indices, any winding). */
export interface RawMesh {
  positions: Vec3[];
  faces: number[][];
}

export type MeshWarningCode =
  | 'degenerate-faces-removed'
  | 'duplicate-faces-removed'
  | 'unused-vertices'
  | 'nonplanar-face-split'
  | 'orientation-fixed'
  | 'non-orientable'
  | 'inverted-normals-fixed'
  | 'open-edges'
  | 'non-manifold-edges'
  | 'multiple-shells'
  | 'tiny-faces'
  | 'empty';

export interface MeshWarning {
  code: MeshWarningCode;
  /** Plain-language default text (the app translates by code). */
  message: string;
  count?: number;
}

export interface SolidFace {
  id: number;
  /** Vertex indices, counter-clockwise seen from outside. */
  vertices: number[];
  /** Edge ids; edgeIds[k] joins vertices[k] and vertices[k + 1]. */
  edgeIds: number[];
  normal: Vec3;
  area: number;
}

export interface SolidEdge {
  id: number;
  /** a < b. */
  a: number;
  b: number;
  /** Faces on this edge (2 for a normal edge, 1 for an open edge, more for a non-manifold edge). */
  faces: number[];
  length: number;
}

export interface Solid {
  vertices: Vec3[];
  faces: SolidFace[];
  edges: SolidEdge[];
  /** True when every edge has exactly two faces. */
  closed: boolean;
  warnings: MeshWarning[];
}

export type FoldKind = 'mountain' | 'valley' | 'flat' | 'tab';

export interface FoldLine {
  a: Vec2;
  b: Vec2;
  kind: FoldKind;
}

export interface Label {
  text: string;
  /** Centre of the text. */
  x: number;
  y: number;
  /** Radians, counter-clockwise. */
  angle: number;
  height: number;
  role: 'edge' | 'part';
}

export interface PartFace {
  faceId: number;
  /** Corners in the same order as the solid's face. */
  points: Vec2[];
}

export interface Tab {
  /** The number shared with the matching edge. */
  edgeNumber: number;
  edgeId: number;
  faceId: number;
  /** Base edge first (a to b), then the two outer corners. */
  points: Vec2[];
  widthMm: number;
}

/** One edge of a face in a part, for drawing and for clicking (cut it, join it). */
export interface EdgeSegment {
  edgeId: number;
  a: Vec2;
  b: Vec2;
  /** `joined`: folded; `cut`: cut and glued to a partner; `open`: cut with no partner (a hole in the model). */
  state: 'joined' | 'cut' | 'open';
  /** The glue number, for a cut edge with a partner. */
  number?: number;
}

export interface Part {
  /** 1-based, stable. */
  id: number;
  faces: PartFace[];
  tabs: Tab[];
  /** Cut outline: closed loops (first point repeated is not stored; `closed` says it closes). */
  cutPaths: { points: Vec2[]; closed: boolean }[];
  foldLines: FoldLine[];
  labels: Label[];
  /** Every edge of every face (joined edges once), with the edge id of the solid. */
  edgeSegments: EdgeSegment[];
  /** Convex hull of faces and tabs. */
  hull: Vec2[];
  widthMm: number;
  heightMm: number;
  areaMm2: number;
}

export type PatternWarningCode =
  | 'tab-missing'
  | 'tab-narrowed'
  | 'tab-very-narrow'
  | 'forced-join-overlaps'
  | 'part-too-large'
  | 'non-manifold-edge-cut';

export interface PatternWarning {
  code: PatternWarningCode;
  message: string;
  count?: number;
}

export interface Pattern {
  /** The rule for ordering the edges that gave this net (see `weightVariant`). */
  rule: number;
  /** Edge ids of the glued edges that have no room for a tab (glue them edge to edge). */
  missingTabEdgeIds: number[];
  parts: Part[];
  /** Edge ids of the solid that are folded rather than cut. */
  joinedEdgeIds: number[];
  /** Number of glued edge pairs. */
  edgePairCount: number;
  warnings: PatternWarning[];
  stats: {
    partCount: number;
    faceCount: number;
    surfaceAreaMm2: number;
    tabCount: number;
    foldCount: number;
  };
}

export interface PatternSettings {
  /** Glue tab depth. */
  tabWidthMm: number;
  /** Narrowest tab that is called a proper tab; a tab can go down to 0.4 times this (at least 1.2 mm) where there is no room, and is then reported as very narrow. */
  minTabWidthMm: number;
  /** Angle of the tab's sides to the edge, in degrees. 90 gives a rectangle. */
  tabAngleDeg: number;
  /** Which side of the paper carries the print: decides which folds are mountain and which are valley. */
  printedSide: 'outside' | 'inside';
  numberHeightMm: number;
  partLabels: boolean;
  /** Largest allowed part (including tabs); parts are split to stay inside. Omit for no limit. */
  maxPartSize?: { widthMm: number; heightMm: number };
  /** Edge ids that must be cut / joined (a join is dropped if it makes a part overlap itself). */
  forceCutEdges?: number[];
  forceJoinEdges?: number[];
  /** Which rule orders the edges when unfolding (0 is the default). */
  weightVariant?: number;
}

export const DEFAULT_PATTERN_SETTINGS: PatternSettings = {
  tabWidthMm: 8,
  minTabWidthMm: 3,
  tabAngleDeg: 45,
  printedSide: 'outside',
  numberHeightMm: 3,
  partLabels: true,
};

export interface PageSettings {
  pageWidthMm: number;
  pageHeightMm: number;
  marginMm: number;
  /** Gap between parts. */
  gapMm: number;
  /**
   * How parts may be turned: `none` keeps them as unfolded, `quarter` (the default) only turns them by 90 degrees (and by any angle
   * only when a part would not fit otherwise), `free` turns each part to its smallest box.
   */
  rotation?: 'none' | 'quarter' | 'free';
}

export const PAGE_PRESETS = {
  a3: { pageWidthMm: 297, pageHeightMm: 420 },
  a4: { pageWidthMm: 210, pageHeightMm: 297 },
  a5: { pageWidthMm: 148, pageHeightMm: 210 },
  letter: { pageWidthMm: 215.9, pageHeightMm: 279.4 },
  /** US Tabloid / Ledger (11 x 17 in). */
  tabloid: { pageWidthMm: 279.4, pageHeightMm: 431.8 },
  /** The usable cutting area of the Cricut mats (the same figures the Rhinestone studio uses); to be confirmed on the machine. */
  cricut12x12: { pageWidthMm: 292.1, pageHeightMm: 292.1 },
  cricut12x24: { pageWidthMm: 292.1, pageHeightMm: 596.9 },
} as const;

export interface Placement {
  partId: number;
  /** Rotation applied to the part (radians, about its own origin) before translating. */
  rotation: number;
  /** After rotating the part, its bounding box's lower-left corner is moved to (x, y). */
  x: number;
  y: number;
  /** Rotated and translated to page coordinates: p' = R*p + t. */
  cos: number;
  sin: number;
  tx: number;
  ty: number;
}

/**
 * A part the person has put where they want it: on page `page` (0-based), turned by `rotation` radians, with the lower left corner of its
 * box at (`x`, `y`) on the page. `w` and `h` are the size of that box when it was put there; if the part has changed since (another size, another
 * model) the pin no longer fits it and is ignored.
 */
export interface PagePin {
  page: number;
  rotation: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutOptions {
  /** Parts the person has placed, by part id. */
  pins?: Readonly<Record<number, PagePin>>;
  /** Most parts on one page for the parts that are not pinned (a page may have more when they are pinned). */
  maxPartsPerPage?: number;
  /** Try several orders, turns and rules and keep the layout with the fewest pages. */
  tight?: boolean;
}

export interface Page {
  index: number;
  widthMm: number;
  heightMm: number;
  placements: Placement[];
}

export interface PageLayout {
  pages: Page[];
  warnings: PatternWarning[];
}
