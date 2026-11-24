import type { RhinestoneTemplate, Stone } from '../types/index';
import { createBasicSvgExport } from '../export/svgExport';
import type { RhinestoneProjectFile, SavedStone } from '../project/projectFormat';
import { createTemplateLibraryEntry, type TemplateLibraryEntry } from './model';
import { getTemplatePhysicalSize } from '../sizing/templateSizing';
import { createDotMatrixTextTemplate } from '../text/textTemplate';
import {
  circleCurve,
  diamondVertices,
  heartCurve,
  moveToOrigin,
  rectangleVertices,
  sampleClosedCurve,
  sampleWithMinCenterDistance,
  samplePolygonEdges,
  starVertices,
  type StarterPoint,
} from './starterShapes';

function savedStone(id: string, x: number, y: number, stoneSize: SavedStone['stoneSize'], holeDiameterMm: number): SavedStone {
  return { id, x, y, stoneSize, holeDiameterMm };
}

function makePreviewRef(name: string, stones: Stone[]): string {
  const template: RhinestoneTemplate = {
    id: `${name.toLowerCase().replace(/\s+/g, '-')}-preview`,
    name,
    unit: 'mm',
    stones,
  };
  const svg = createBasicSvgExport(template, {
    includeGuideBox: false,
    includeLabels: false,
    paddingMm: 4,
    decimalPlaces: 2,
  });
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function makeManualProject(projectName: string, stones: SavedStone[]): RhinestoneProjectFile {
  return {
    schemaVersion: 1,
    savedAt: '2026-08-03T00:00:00.000Z',
    projectName,
    exportSettings: {
      includeGuideBox: true,
      includeLabels: false,
      paddingMm: 5,
    },
    generatorState: {
      generatorId: 'manual-editor',
      stones,
      includeGuideBox: true,
      paddingMm: 5,
    },
    activeTool: 'manual',
    manualToolState: {
      snapToGrid: true,
      gridSnapSize: 2,
      addStoneSize: 'SS10',
    },
  };
}

function starterEntry(input: {
  templateId: string;
  name: string;
  stones: SavedStone[];
  tags: string[];
  /** Overrides the default manual-editor project, e.g. to keep text editable. */
  project?: RhinestoneProjectFile;
}) {
  const previewStones: Stone[] = input.stones.map((stone) => ({
    id: stone.id,
    center: { x: stone.x, y: stone.y },
    stoneSize: stone.stoneSize,
    holeDiameterMm: stone.holeDiameterMm,
  }));
  const size = getTemplatePhysicalSize({
    id: `${input.templateId}-size`,
    name: input.name,
    unit: 'mm',
    stones: previewStones,
  });

  return createTemplateLibraryEntry({
    templateId: input.templateId,
    name: input.name,
    category: 'starter',
    tags: input.tags,
    builtIn: true,
    readOnly: true,
    favorite: false,
    previewRef: makePreviewRef(input.name, previewStones),
    widthMm: Math.round(size.widthMm * 10) / 10,
    heightMm: Math.round(size.heightMm * 10) / 10,
    stoneCount: input.stones.length,
    stoneSizes: Array.from(new Set(input.stones.map((stone) => stone.stoneSize))),
    colorLayerCount: 1,
    createdAt: '2026-08-03T00:00:00.000Z',
    updatedAt: '2026-08-03T00:00:00.000Z',
    snapshot: input.project ?? makeManualProject(input.name, input.stones),
  });
}

const STARTER_STONE_SIZE = 'SS10' as const;
const STARTER_HOLE_DIAMETER_MM = 3.429;
/** Comfortable centre-to-centre spacing for SS10 outlines (above the 3.937 mm minimum). */
const STARTER_OUTLINE_SPACING_MM = 5;
/** Hole diameter + the 0.508 mm minimum edge gap, so no starter is born with a collision. */
const STARTER_MIN_CENTER_DISTANCE_MM = STARTER_HOLE_DIAMETER_MM + 0.508;

/** Turns generated points into stones for a shape starter. */
function shapeStarter(input: { templateId: string; name: string; tags: string[]; points: StarterPoint[] }) {
  const placed = moveToOrigin(input.points, 10);
  return starterEntry({
    templateId: input.templateId,
    name: input.name,
    tags: ['starter', ...input.tags],
    stones: placed.map((point, index) => (
      savedStone(`${input.templateId}-${index + 1}`, point.x, point.y, STARTER_STONE_SIZE, STARTER_HOLE_DIAMETER_MM)
    )),
  });
}

/** Dot-matrix text starter. The text stays editable in the Text tool after opening. */
function textStarter(input: {
  templateId: string;
  name: string;
  tags: string[];
  text: string;
  spacingMm: number;
  align?: 'left' | 'center' | 'right';
}) {
  const align = input.align ?? 'left';
  const template = createDotMatrixTextTemplate({
    id: `${input.templateId}-template`,
    name: input.name,
    text: input.text,
    stoneSize: STARTER_STONE_SIZE,
    densityPreset: 'custom',
    customSpacingMm: input.spacingMm,
    letterSpacingColumns: 1,
    lineSpacingRows: 2,
    align,
  });

  const project: RhinestoneProjectFile = {
    schemaVersion: 1,
    savedAt: '2026-08-03T00:00:00.000Z',
    projectName: input.name,
    exportSettings: { includeGuideBox: true, includeLabels: false, paddingMm: 5 },
    generatorState: {
      generatorId: 'dot-matrix-text',
      text: input.text,
      stoneSize: STARTER_STONE_SIZE,
      includeGuideBox: true,
      includeLabels: false,
      paddingMm: 5,
      densityPreset: 'custom',
      customSpacingMm: input.spacingMm,
      targetWidthMm: null,
      targetHeightMm: null,
      preserveAspectRatio: true,
      align,
      letterSpacingColumns: 1,
      lineSpacingRows: 2,
    },
    activeTool: 'text',
  };

  return starterEntry({
    templateId: input.templateId,
    name: input.name,
    tags: ['starter', 'text', ...input.tags],
    stones: template.stones.map((stone) => savedStone(
      stone.id,
      stone.center.x,
      stone.center.y,
      stone.stoneSize,
      stone.holeDiameterMm,
    )),
    project,
  });
}

export const STARTER_TEMPLATE_LIBRARY_ENTRIES: readonly TemplateLibraryEntry[] = [
  starterEntry({
    templateId: 'starter-badge',
    name: 'Starter Badge',
    tags: ['starter', 'badge'],
    stones: [
      savedStone('s1', 10, 10, 'SS10', 3.429),
      savedStone('s2', 18, 10, 'SS10', 3.429),
      savedStone('s3', 26, 10, 'SS10', 3.429),
      savedStone('s4', 14, 18, 'SS10', 3.429),
      savedStone('s5', 22, 18, 'SS10', 3.429),
      savedStone('s6', 18, 26, 'SS10', 3.429),
    ],
  }),
  starterEntry({
    templateId: 'starter-grid',
    name: 'Starter Grid',
    tags: ['starter', 'grid'],
    stones: [
      savedStone('g1', 10, 10, 'SS10', 3.429),
      savedStone('g2', 18, 10, 'SS10', 3.429),
      savedStone('g3', 26, 10, 'SS10', 3.429),
      savedStone('g4', 10, 18, 'SS10', 3.429),
      savedStone('g5', 18, 18, 'SS10', 3.429),
      savedStone('g6', 26, 18, 'SS10', 3.429),
    ],
  }),
  starterEntry({
    templateId: 'starter-chevron',
    name: 'Starter Chevron',
    tags: ['starter', 'chevron'],
    stones: [
      savedStone('c1', 10, 10, 'SS10', 3.429),
      savedStone('c2', 18, 18, 'SS10', 3.429),
      savedStone('c3', 26, 26, 'SS10', 3.429),
      savedStone('c4', 34, 18, 'SS10', 3.429),
      savedStone('c5', 42, 10, 'SS10', 3.429),
    ],
  }),
  textStarter({
    templateId: 'starter-name',
    name: 'Name',
    tags: ['name'],
    text: 'NAME',
    spacingMm: 5,
  }),
  textStarter({
    templateId: 'starter-monogram',
    name: 'Monogram',
    tags: ['monogram', 'initials'],
    text: 'ABC',
    spacingMm: 6,
  }),
  textStarter({
    templateId: 'starter-number',
    name: 'Jersey number',
    tags: ['number', 'team'],
    text: '23',
    spacingMm: 7,
  }),
  textStarter({
    templateId: 'starter-team-number',
    name: 'Team name + number',
    tags: ['team', 'number'],
    text: 'TEAM\n23',
    spacingMm: 5,
    align: 'center',
  }),
  textStarter({
    templateId: 'starter-scoreboard',
    name: 'Scoreboard',
    tags: ['scoreboard', 'sport'],
    text: '00 - 00',
    spacingMm: 5,
  }),
  shapeStarter({
    templateId: 'starter-heart',
    name: 'Heart',
    tags: ['heart', 'shape'],
    points: sampleWithMinCenterDistance((spacing) => sampleClosedCurve(heartCurve(70), spacing), STARTER_OUTLINE_SPACING_MM, STARTER_MIN_CENTER_DISTANCE_MM),
  }),
  shapeStarter({
    templateId: 'starter-star',
    name: 'Star',
    tags: ['star', 'shape'],
    // Tips of a 5-point star are narrow, so use a wider spacing there to keep
    // stones on both sides of a tip from touching.
    points: sampleWithMinCenterDistance((spacing) => samplePolygonEdges(starVertices(40), spacing), 7, STARTER_MIN_CENTER_DISTANCE_MM),
  }),
  shapeStarter({
    templateId: 'starter-circle',
    name: 'Circle ring',
    tags: ['circle', 'shape'],
    points: sampleWithMinCenterDistance((spacing) => sampleClosedCurve(circleCurve(70), spacing), STARTER_OUTLINE_SPACING_MM, STARTER_MIN_CENTER_DISTANCE_MM),
  }),
  shapeStarter({
    templateId: 'starter-border',
    name: 'Border frame',
    tags: ['border', 'frame'],
    points: sampleWithMinCenterDistance((spacing) => samplePolygonEdges(rectangleVertices(100, 60), spacing), STARTER_OUTLINE_SPACING_MM, STARTER_MIN_CENTER_DISTANCE_MM),
  }),
  shapeStarter({
    templateId: 'starter-diamond',
    name: 'Diamond',
    tags: ['diamond', 'shape'],
    points: sampleWithMinCenterDistance((spacing) => samplePolygonEdges(diamondVertices(60, 80), spacing), STARTER_OUTLINE_SPACING_MM, STARTER_MIN_CENTER_DISTANCE_MM),
  }),
];
