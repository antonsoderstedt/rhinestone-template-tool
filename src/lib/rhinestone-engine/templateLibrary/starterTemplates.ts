import type { RhinestoneTemplate, Stone } from '../types/index';
import { createBasicSvgExport } from '../export/svgExport';
import type { RhinestoneProjectFile, SavedStone } from '../project/projectFormat';
import { createTemplateLibraryEntry, type TemplateLibraryEntry } from './model';

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
}) {
  const previewStones: Stone[] = input.stones.map((stone) => ({
    id: stone.id,
    center: { x: stone.x, y: stone.y },
    stoneSize: stone.stoneSize,
    holeDiameterMm: stone.holeDiameterMm,
  }));

  return createTemplateLibraryEntry({
    templateId: input.templateId,
    name: input.name,
    category: 'starter',
    tags: input.tags,
    builtIn: true,
    readOnly: true,
    favorite: false,
    previewRef: makePreviewRef(input.name, previewStones),
    widthMm: null,
    heightMm: null,
    stoneCount: input.stones.length,
    stoneSizes: Array.from(new Set(input.stones.map((stone) => stone.stoneSize))),
    colorLayerCount: 1,
    createdAt: '2026-08-03T00:00:00.000Z',
    updatedAt: '2026-08-03T00:00:00.000Z',
    snapshot: makeManualProject(input.name, input.stones),
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
];