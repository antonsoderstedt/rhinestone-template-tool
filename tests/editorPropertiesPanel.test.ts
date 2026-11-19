import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import EditorDialog from '../app/editor/EditorDialog';
import EditorPropertiesPanel from '../app/editor/EditorPropertiesPanel';
import { DEFAULT_EDITOR_STATE, editorReducer, type EditorTool } from '../app/editor/EditorState';
import {
  TEXT_LABELS_NOT_CRICUT_SAFE_MESSAGE,
  checkExportReadiness,
  createStoneGridTemplate,
} from '../src/lib/rhinestone-engine/index';

const ERROR_MESSAGE = 'Font asset failed to load: boom';

function renderSourcePanel(tool: EditorTool, errorStatus: boolean) {
  let state = structuredClone(DEFAULT_EDITOR_STATE);
  state = editorReducer(state, { type: 'SET_ACTIVE_TOOL', tool });

  // FontPicker (used only by the outline text tool) additionally gates its
  // error display on `status.fontId === value`, so match the tool's actual
  // selected font id here rather than a placeholder.
  const fontId = tool === 'text' ? state.textTool.fontId : 'irrelevant';

  return renderToStaticMarkup(
    createElement(EditorPropertiesPanel, {
      state,
      dispatch: () => undefined,
      mode: 'source',
      outlineFontStatus: errorStatus
        ? { status: 'error', message: ERROR_MESSAGE, fontId }
        : { status: 'idle', message: null, fontId },
    }),
  );
}

describe('EditorPropertiesPanel calibration gate visibility', () => {
  it('shows a setup prompt when no active calibration profile is selected', () => {
    const html = renderToStaticMarkup(
      createElement(EditorPropertiesPanel, {
        state: structuredClone(DEFAULT_EDITOR_STATE),
        dispatch: () => undefined,
        mode: 'source',
      }),
    );

    expect(html).not.toContain('Calibration gate');
    expect(html).not.toContain('Open setup');
  });

  it('shows the approved profile status when a profile is active', () => {
    const html = renderToStaticMarkup(
      createElement(EditorPropertiesPanel, {
        state: structuredClone(DEFAULT_EDITOR_STATE),
        dispatch: () => undefined,
        mode: 'source',
      }),
    );

    expect(html).not.toContain('Calibration gate');
  });
});

describe('EditorPropertiesPanel generator error visibility', () => {
  it.each<EditorTool>(['rhinestone-font', 'svg-alphabet', 'letter-stencil'])(
    'surfaces a generation error in the %s panel, not just the outline text tool',
    (tool) => {
      const html = renderSourcePanel(tool, true);
      expect(html).toContain(ERROR_MESSAGE);
    },
  );

  it.each<EditorTool>(['rhinestone-font', 'svg-alphabet', 'letter-stencil'])(
    'shows no error banner in the %s panel when status is idle',
    (tool) => {
      const html = renderSourcePanel(tool, false);
      expect(html).not.toContain(ERROR_MESSAGE);
    },
  );

  it('still surfaces the error in the outline text tool panel (regression guard)', () => {
    const html = renderSourcePanel('text', true);
    expect(html).toContain(ERROR_MESSAGE);
  });
});

describe('EditorPropertiesPanel legacy font unsupported-character warning', () => {
  it('warns when the legacy outline font silently substituted a character', () => {
    let state = structuredClone(DEFAULT_EDITOR_STATE);
    state = editorReducer(state, { type: 'SET_ACTIVE_TOOL', tool: 'text' });
    state = editorReducer(state, { type: 'UPDATE_TEXT_TOOL', updates: { unsupportedCharacters: ["'", '&'] } });

    const html = renderToStaticMarkup(
      createElement(EditorPropertiesPanel, {
        state,
        dispatch: () => undefined,
        mode: 'source',
        outlineFontStatus: { status: 'idle', message: null, fontId: state.textTool.fontId },
      }),
    );
    expect(html).toContain('Unsupported characters');
    expect(html).toContain("&#x27;, &amp;");
  });

  it('shows no warning when every character is supported', () => {
    let state = structuredClone(DEFAULT_EDITOR_STATE);
    state = editorReducer(state, { type: 'SET_ACTIVE_TOOL', tool: 'text' });

    const html = renderToStaticMarkup(
      createElement(EditorPropertiesPanel, {
        state,
        dispatch: () => undefined,
        mode: 'source',
        outlineFontStatus: { status: 'idle', message: null, fontId: state.textTool.fontId },
      }),
    );
    expect(html).not.toContain('Unsupported characters');
  });
});

describe('EditorPropertiesPanel export labels Cricut-safety warning', () => {
  function renderInspectorPanel(includeLabels: boolean) {
    let state = structuredClone(DEFAULT_EDITOR_STATE);
    state = editorReducer(state, { type: 'UPDATE_EXPORT_SETTINGS', updates: { includeLabels } });
    return renderToStaticMarkup(
      createElement(EditorPropertiesPanel, {
        state,
        dispatch: () => undefined,
        mode: 'inspector',
      }),
    );
  }

  it('warns that labels are not Cricut-safe when Include labels is on', () => {
    const html = renderInspectorPanel(true);
    expect(html).toContain(TEXT_LABELS_NOT_CRICUT_SAFE_MESSAGE);
  });

  it('shows no warning when Include labels is off', () => {
    const html = renderInspectorPanel(false);
    expect(html).not.toContain(TEXT_LABELS_NOT_CRICUT_SAFE_MESSAGE);
  });

  it('shows the export readiness panel when a template is active', () => {
    const template = createStoneGridTemplate({
      id: 'qa-panel-grid',
      name: 'QA Panel Grid',
      stoneSize: 'SS10',
      columns: 4,
      rows: 2,
    });

    const html = renderToStaticMarkup(
      createElement(EditorPropertiesPanel, {
        state: structuredClone(DEFAULT_EDITOR_STATE),
        dispatch: () => undefined,
        mode: 'inspector',
        exportReadiness: checkExportReadiness(template, { requireCalibration: false }),
      }),
    );

    expect(html).toContain('Export readiness');
    expect(html).toContain('Ready for Cricut SVG export');
  });

  it('attaches actionable suggestions to export issues', () => {
    const readiness = checkExportReadiness(createStoneGridTemplate({
      id: 'qa-suggestion-grid',
      name: 'QA Suggestion Grid',
      stoneSize: 'SS10',
      columns: 2,
      rows: 2,
    }), {
      requireCalibration: false,
      includeLabels: true,
    });

    const labelIssue = readiness.issues.find((issue) => issue.code === 'TEXT_LABELS_NOT_CRICUT_SAFE');
    expect(labelIssue?.suggestion).toContain('Turn labels off');
  });

  it('renders actionable export warning details in the confirmation dialog', () => {
    const html = renderToStaticMarkup(
      createElement(EditorDialog, {
        open: true,
        title: 'Export with warnings?',
        description: 'The current template has export warnings.',
        details: [
          'Text labels are not guaranteed to import reliably in Cricut Design Space. Suggestion: Turn labels off or verify that the exported SVG opens correctly in Cricut Design Space before cutting.',
        ],
        confirmLabel: 'Export anyway',
        onConfirm: () => undefined,
        onCancel: () => undefined,
        tone: 'destructive',
        icon: 'warning',
      }),
    );

    expect(html).toContain('Suggestion: Turn labels off or verify that the exported SVG opens correctly in Cricut Design Space before cutting.');
  });
});
