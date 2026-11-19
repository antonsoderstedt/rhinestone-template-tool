import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import EditorTopbar from '../app/editor/EditorTopbar';
import EditorToolbar from '../app/editor/EditorToolbar';
import EditorToast from '../app/editor/EditorToast';
import { DEFAULT_EDITOR_STATE } from '../app/editor/EditorState';
import {
  getEditableStatusCopy,
  getSelectionActionState,
  getSelectionEmptyState,
  getSourcePanelTool,
} from '../app/editor/editorUi';
import { getModeMeta } from '../app/components/GlobalTopNav';

describe('editorUi helpers', () => {
  it('derives the source panel tool from editable source generator', () => {
    const state = {
      ...DEFAULT_EDITOR_STATE,
      activeTool: 'select' as const,
      editableTemplate: {
        ...DEFAULT_EDITOR_STATE.editableTemplate,
        isEditable: true,
        sourceGenerator: 'manual-grid' as const,
      },
    };

    expect(getSourcePanelTool(state)).toBe('grid');
  });

  it('falls back to template id when selection is active but the design is not editable', () => {
    const state = {
      ...DEFAULT_EDITOR_STATE,
      activeTool: 'select' as const,
      template: { id: 'svg-preview', name: 'SVG', unit: 'mm' as const, stones: [] },
    };

    expect(getSourcePanelTool(state)).toBe('svg');
  });

  it('returns clear Generated and Editable status copy', () => {
    expect(getEditableStatusCopy(false)).toEqual({
      label: 'Generated',
      description: 'Driven by generator settings.',
      actionHint: 'Adjust the source settings or make the result editable to fine-tune stones.',
    });

    expect(getEditableStatusCopy(true)).toEqual({
      label: 'Editable',
      description: 'Stones can be edited individually.',
      actionHint: 'Use Select or Add to refine the design stone by stone.',
    });
  });

  it('explains disabled selection actions', () => {
    expect(getSelectionActionState(0)).toMatchObject({
      canDuplicate: false,
      canDelete: false,
      canAlign: false,
      canDistribute: false,
    });
    expect(getSelectionActionState(2)).toMatchObject({
      canAlign: true,
      canDistribute: false,
    });
    expect(getSelectionActionState(3)).toMatchObject({
      canDistribute: true,
    });
  });

  it('returns a useful empty selection state for generated and editable flows', () => {
    expect(getSelectionEmptyState(false).title).toBe('Generated output');
    expect(getSelectionEmptyState(true).title).toBe('Nothing selected');
  });

  it('treats HTV as ready only when the active calibration profile is approved', () => {
    expect(getModeMeta('/htv', null)).toMatchObject({
      studioLabel: 'HTV Studio',
      status: 'Warning',
    });

    expect(getModeMeta('/htv', { id: 'p-1', name: 'Magic Flock', approvedAt: undefined } as never)).toMatchObject({
      studioLabel: 'HTV Studio',
      status: 'Warning',
      statusText: 'Pending calibration: Magic Flock',
    });

    expect(getModeMeta('/htv', { id: 'p-1', name: 'Magic Flock', approvedAt: '2025-01-01T00:00:00.000Z' } as never)).toMatchObject({
      studioLabel: 'HTV Studio',
      status: 'Ready',
      statusText: 'Production ready: Magic Flock',
    });
  });
});

describe('editor UI rendering', () => {
  it('renders export as disabled when no design is available', () => {
    const html = renderToStaticMarkup(
      createElement(EditorTopbar, {
        projectName: 'Test',
        canUndo: false,
        canRedo: false,
        canExport: false,
        exportReady: false,
        exportErrorCount: 0,
        exportWarningCount: 0,
        dispatch: vi.fn() as never,
        onNewProject: vi.fn(),
        onOpenProject: vi.fn(),
        onSave: vi.fn(),
        onExport: vi.fn(),
        onOpenSetup: vi.fn(),
      }),
    );

    expect(html).toContain('Export');
    expect(html).toContain('No template');
    expect(html).toContain('disabled');
  });

  it('shows the export readiness badge in the topbar when warnings or errors exist', () => {
    const html = renderToStaticMarkup(
      createElement(EditorTopbar, {
        projectName: 'Test',
        canUndo: false,
        canRedo: false,
        canExport: true,
        exportReady: false,
        exportErrorCount: 1,
        exportWarningCount: 2,
        dispatch: vi.fn() as never,
      }),
    );

    expect(html).toContain('Blocked (1)');
  });

  it('renders toolbar buttons with accessible labels and active styling', () => {
    const html = renderToStaticMarkup(
      createElement(EditorToolbar, { activeTool: 'select', dispatch: vi.fn() as never, orientation: 'horizontal' }),
    );

    expect(html).toContain('aria-label="Select"');
    expect(html).toContain('Ctrl/Cmd + wheel zooms');
    expect(html).toContain('bg-purple-600');
  });

  it('renders toast feedback with an accessible live region', () => {
    const html = renderToStaticMarkup(
      createElement(EditorToast, { message: 'Project saved.', tone: 'success', onDismiss: vi.fn() }),
    );

    expect(html).toContain('role="status"');
    expect(html).toContain('Project saved.');
  });
});