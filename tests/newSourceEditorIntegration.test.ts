import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import EditorPropertiesPanel from '../app/editor/EditorPropertiesPanel';
import EditorToolbar from '../app/editor/EditorToolbar';
import {
  DEFAULT_EDITOR_STATE,
  editorReducer,
  type EditorState,
} from '../app/editor/EditorState';
import {
  buildEffectiveTemplate,
  buildProjectFileFromEditorState,
  savedStoneToEditableStone,
} from '../app/editor/projectPersistence';
import {
  createBasicSvgExport,
  createImportedTemplate,
  createRhinestoneFontTemplate,
  parseRhinestoneProject,
  serializeRhinestoneProject,
  TRW_CLEAN_STONE_FONT_ID,
  TRW_STONE_SIZE_CALIBRATION,
} from '../src/lib/rhinestone-engine/index';

const TWO_COLOR_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="30mm" height="10mm" viewBox="0 0 30 10">
  <circle cx="5" cy="5" r="1.25" fill="#ff006e"/>
  <circle cx="15" cy="5" r="1.75" fill="#00d4ff"/>
  <rect x="0" y="0" width="30" height="10" fill="none"/>
</svg>`;

function stateWith(overrides: Partial<EditorState>): EditorState {
  return {
    ...DEFAULT_EDITOR_STATE,
    textTool: { ...DEFAULT_EDITOR_STATE.textTool },
    svgTool: { ...DEFAULT_EDITOR_STATE.svgTool },
    gridTool: { ...DEFAULT_EDITOR_STATE.gridTool },
    manualTool: { ...DEFAULT_EDITOR_STATE.manualTool },
    rhinestoneFontTool: { ...DEFAULT_EDITOR_STATE.rhinestoneFontTool },
    templateImportTool: { ...DEFAULT_EDITOR_STATE.templateImportTool },
    editableTemplate: { ...DEFAULT_EDITOR_STATE.editableTemplate },
    canvas: { ...DEFAULT_EDITOR_STATE.canvas },
    selectedStoneIds: new Set(),
    history: { past: [], future: [] },
    ...overrides,
  };
}

describe('main editor integration — rhinestone font', () => {
  it('renders a reachable toolbar entry for the rhinestone font source', () => {
    const html = renderToStaticMarkup(
      createElement(EditorToolbar, {
        activeTool: 'rhinestone-font',
        dispatch: vi.fn() as never,
        orientation: 'horizontal',
      }),
    );
    expect(html).toContain('aria-label="Stone Font"');
    expect(html).toContain('bg-purple-600');
  });

  it('renders font, text, all four TRW sizes, and spacing controls', () => {
    const state = stateWith({ activeTool: 'rhinestone-font' });
    const html = renderToStaticMarkup(
      createElement(EditorPropertiesPanel, { state, dispatch: vi.fn() as never, mode: 'source' }),
    );
    expect(html).toContain('Rhinestone font text');
    expect(html).toContain('TRW Clean Stone');
    expect(html).toContain('Blessed SS10');
    expect(html).toContain('Old English SS10');
    expect(html).toContain('Script');
    expect(html).toContain('Gothic');
    expect(html).toContain('mode stones');
    expect(html).toContain('Suggested sample: Sulay');
    expect(html).toContain('Use sample');
    expect(html).toContain('SS10');
    expect(html).toContain('Letter spacing');
    expect(html).toContain('Line spacing');
  });

  it('renders line-style rhinestone fonts as a distinct workflow mode', () => {
    const state = stateWith({
      activeTool: 'rhinestone-font',
      rhinestoneFontTool: {
        ...DEFAULT_EDITOR_STATE.rhinestoneFontTool,
        presentationMode: 'line',
        rhinestoneFontId: 'small-line-ss10',
        stoneSize: 'SS10',
      },
    });
    const html = renderToStaticMarkup(
      createElement(EditorPropertiesPanel, { state, dispatch: vi.fn() as never, mode: 'source' }),
    );
    expect(html).toContain('mode line');
    expect(html).toContain('Suggested sample: CHEER');
    expect(html).toContain('future centerline workflow');
  });

  it('renders digits-style rhinestone fonts as numeric-focused', () => {
    const state = stateWith({
      activeTool: 'rhinestone-font',
      rhinestoneFontTool: {
        ...DEFAULT_EDITOR_STATE.rhinestoneFontTool,
        presentationMode: 'digits',
        rhinestoneFontId: 'huge-numbers-ss10',
        stoneSize: 'SS10',
        text: 'ABC123',
      },
    });
    const html = renderToStaticMarkup(
      createElement(EditorPropertiesPanel, { state, dispatch: vi.fn() as never, mode: 'source' }),
    );
    expect(html).toContain('mode digits');
    expect(html).toContain('Suggested sample: 2026');
    expect(html).toContain('optimized for digits');
  });

  it('uses the authoritative TRW diameter in generated templates and SVG circles', async () => {
    for (const size of ['SS6', 'SS10', 'SS16', 'SS20'] as const) {
      const diameter = TRW_STONE_SIZE_CALIBRATION[size].diameterMm;
      const result = await createRhinestoneFontTemplate({
        text: 'S',
        rhinestoneFontId: TRW_CLEAN_STONE_FONT_ID,
        targetStoneSizeId: size,
        targetStoneSizeMm: diameter,
        letterSpacingMm: 1,
        lineSpacingMm: 0,
      });
      expect(new Set(result.template.stones.map((stone) => stone.holeDiameterMm))).toEqual(new Set([diameter]));
      const svg = createBasicSvgExport(result.template, { paddingMm: 0, decimalPlaces: 3 });
      expect(svg).toContain(`data-hole-diameter-mm="${diameter}"`);
      const exportedRadius = Number(svg.match(/<circle[^>]* r="([^"]+)"/)?.[1]);
      expect(exportedRadius * 2).toBeCloseTo(diameter, 2);
    }
  });

  it('keeps original unsupported text in persistence while reporting unsupported characters', async () => {
    const text = 'SULAY 2026 ÅÄÖ';
    const result = await createRhinestoneFontTemplate({
      text,
      rhinestoneFontId: TRW_CLEAN_STONE_FONT_ID,
      targetStoneSizeId: 'SS10',
      targetStoneSizeMm: TRW_STONE_SIZE_CALIBRATION.SS10.diameterMm,
      letterSpacingMm: 1,
      lineSpacingMm: 0,
    });
    expect(result.unsupportedCharacters).toEqual(expect.arrayContaining(['2', '0', '6', 'Å', 'Ä', 'Ö']));

    const state = stateWith({
      activeTool: 'rhinestone-font',
      template: result.template,
      rhinestoneFontTool: { ...DEFAULT_EDITOR_STATE.rhinestoneFontTool, text },
    });
    const project = buildProjectFileFromEditorState(state);
    expect(project?.generatorState).toMatchObject({ generatorId: 'rhinestone-font', text, presentationMode: 'stones' });
  });

  it('persists line-style rhinestone fonts as a distinct workflow identity', () => {
    const state = stateWith({
      activeTool: 'rhinestone-font',
      rhinestoneFontTool: {
        ...DEFAULT_EDITOR_STATE.rhinestoneFontTool,
        presentationMode: 'line',
        rhinestoneFontId: 'small-line-ss10',
        stoneSize: 'SS10',
        text: 'CHEER',
      },
    });
    const project = buildProjectFileFromEditorState(state);
    expect(project?.generatorState).toMatchObject({ generatorId: 'rhinestone-font-line', presentationMode: 'line' });
  });

  it('makes a font result editable and supports move undo/redo through shared history', async () => {
    const result = await createRhinestoneFontTemplate({
      text: 'S',
      rhinestoneFontId: TRW_CLEAN_STONE_FONT_ID,
      targetStoneSizeId: 'SS10',
      targetStoneSizeMm: TRW_STONE_SIZE_CALIBRATION.SS10.diameterMm,
      letterSpacingMm: 1,
      lineSpacingMm: 0,
    });
    let state = stateWith({ activeTool: 'rhinestone-font', template: result.template });
    state = editorReducer(state, { type: 'CONVERT_TO_EDITABLE' });
    expect(state.editableTemplate.sourceGenerator).toBe('rhinestone-font');
    const stone = state.editableTemplate.stones[0]!;
    const original = { ...stone.center };
    state = editorReducer(state, {
      type: 'MOVE_STONES',
      moves: [{ id: stone.id, toX: original.x + 20, toY: original.y }],
    });
    expect(state.editableTemplate.stones[0]!.center.x).toBe(original.x + 20);
    state = editorReducer(state, { type: 'UNDO' });
    expect(state.editableTemplate.stones[0]!.center).toEqual(original);
    state = editorReducer(state, { type: 'REDO' });
    expect(state.editableTemplate.stones[0]!.center.x).toBe(original.x + 20);
  });

  it('is deterministic for identical font inputs', async () => {
    const options = {
      text: 'Sulay',
      rhinestoneFontId: TRW_CLEAN_STONE_FONT_ID,
      targetStoneSizeId: 'SS10' as const,
      targetStoneSizeMm: TRW_STONE_SIZE_CALIBRATION.SS10.diameterMm,
      letterSpacingMm: 1,
      lineSpacingMm: 0,
    };
    const first = await createRhinestoneFontTemplate(options);
    const second = await createRhinestoneFontTemplate(options);
    expect(first.template).toEqual(second.template);
  });
});

describe('main editor integration — text style policy', () => {
  it('renders outline-only guidance for bundled fonts that should not expose filled typography', () => {
    const state = stateWith({
      activeTool: 'text',
      textTool: {
        ...DEFAULT_EDITOR_STATE.textTool,
        mode: 'outline',
        fontId: 'pacifico-script',
      },
    });
    const html = renderToStaticMarkup(
      createElement(EditorPropertiesPanel, {
        state,
        dispatch: vi.fn() as never,
        mode: 'source',
        outlineFontStatus: { status: 'idle', message: null, fontId: 'pacifico-script' },
      }),
    );
    expect(html).toContain('Text style');
    expect(html).toContain('limited to outline placement');
    expect(html).toContain('Filled typography');
    expect(html).toContain('disabled');
  });
});

describe('main editor integration — existing template import', () => {
  it('renders a separate import source with an explicit confirmation action', () => {
    const state = stateWith({
      activeTool: 'template-import',
      templateImportTool: {
        ...DEFAULT_EDITOR_STATE.templateImportTool,
        pendingSvgText: TWO_COLOR_SVG,
        pendingFileName: 'two-color.svg',
        importSummary: '2 stones ready to import',
        detectedDiameters: [2.5, 3.5],
        detectedColors: ['#ff006e', '#00d4ff'],
      },
    });
    const html = renderToStaticMarkup(
      createElement(EditorPropertiesPanel, { state, dispatch: vi.fn() as never, mode: 'source' }),
    );
    expect(html).toContain('Import Template');
    expect(html).toContain('Import stones to canvas');
    expect(html).toContain('SVG Convert Shape');
  });

  it('preserves imported diameter, color, position, ID, and deterministic template identity', () => {
    const first = createImportedTemplate({ svgText: TWO_COLOR_SVG, defaultStoneSizeId: 'SS10' });
    const second = createImportedTemplate({ svgText: TWO_COLOR_SVG, defaultStoneSizeId: 'SS10' });
    expect(first.template).toEqual(second.template);
    expect(first.template.id).toBe('imported-template');
    expect(first.template.stones.map((stone) => stone.holeDiameterMm)).toEqual([2.5, 3.5]);
    expect(first.template.stones.map((stone) => stone.metadata?.fill)).toEqual(['#ff006e', '#00d4ff']);
    expect(first.template.stones.map((stone) => stone.id)).toEqual(['imp-0', 'imp-1']);
  });

  it('round-trips an editable two-color import with byte-identical SVG export', () => {
    const imported = createImportedTemplate({ svgText: TWO_COLOR_SVG, defaultStoneSizeId: 'SS10' });
    let state = stateWith({
      activeTool: 'template-import',
      template: imported.template,
      templateImportTool: {
        ...DEFAULT_EDITOR_STATE.templateImportTool,
        uploadedSvgText: TWO_COLOR_SVG,
        svgFileName: 'two-color.svg',
        detectedDiameters: imported.detectedDiameters,
        detectedColors: imported.detectedColors,
        ignoredElements: imported.ignoredElements,
      },
    });
    state = editorReducer(state, { type: 'CONVERT_TO_EDITABLE' });
    const before = createBasicSvgExport(buildEffectiveTemplate(state)!, { paddingMm: 5 });
    const project = buildProjectFileFromEditorState(state)!;
    const parsed = parseRhinestoneProject(serializeRhinestoneProject(project));

    const restored = stateWith({
      activeTool: 'template-import',
      template: imported.template,
      templateImportTool: state.templateImportTool,
      editableTemplate: {
        isEditable: true,
        stones: parsed.editableState!.stones.map(savedStoneToEditableStone),
        originalTemplate: imported.template,
        sourceGenerator: 'template-import',
      },
    });
    const after = createBasicSvgExport(buildEffectiveTemplate(restored)!, { paddingMm: 5 });
    expect(after).toBe(before);
    expect(after).toContain('stroke="#ff006e"');
    expect(after).toContain('stroke="#00d4ff"');
  });

  it('exports normalized circles only and excludes raw decorative SVG', () => {
    const imported = createImportedTemplate({ svgText: TWO_COLOR_SVG, defaultStoneSizeId: 'SS10' });
    const svg = createBasicSvgExport(imported.template);
    expect(svg.match(/<circle/g)).toHaveLength(2);
    expect(svg).not.toContain('<rect x="0"');
    expect(svg).not.toContain(TWO_COLOR_SVG);
  });

  it('keeps import and Convert Shape as distinct engine identities', () => {
    const state = stateWith({ activeTool: 'template-import' });
    expect(buildProjectFileFromEditorState(state)).toBeNull();
    expect(state.templateImportTool.uploadedSvgText).toBeNull();
    expect(state.svgTool.uploadedSvgText).toBeNull();
  });
});
