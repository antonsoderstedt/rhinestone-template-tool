import type { GeneratorId } from '@/src/lib/rhinestone-engine/index';
import type { EditorState, EditorTool } from './EditorState';

export type SourcePanelTool = 'text' | 'svg' | 'grid' | 'rhinestone-font' | 'template-import' | 'manual';

export interface StatusCopy {
  label: 'Generated' | 'Editable';
  description: string;
  actionHint: string;
}

function mapGeneratorToTool(generatorId: GeneratorId | null): SourcePanelTool | null {
  switch (generatorId) {
    case 'outline-text':
    case 'dot-matrix-text':
      return 'text';
    case 'svg-upload':
      return 'svg';
    case 'manual-grid':
      return 'grid';
    case 'rhinestone-font':
      return 'rhinestone-font';
    case 'template-import':
      return 'template-import';
    case 'manual-editor':
      return 'manual';
    default:
      return null;
  }
}

function mapTemplateIdToTool(templateId: string | undefined): SourcePanelTool | null {
  if (!templateId) return null;
  if (templateId.startsWith('text-outline') || templateId.startsWith('text-dotmatrix')) {
    return 'text';
  }
  if (templateId.startsWith('svg-')) {
    return 'svg';
  }
  if (templateId.startsWith('grid-')) {
    return 'grid';
  }
  return null;
}

export function getSourcePanelTool(state: EditorState): SourcePanelTool {
  if (
    state.activeTool === 'text' || 
    state.activeTool === 'svg' || 
    state.activeTool === 'grid' || 
    state.activeTool === 'rhinestone-font' || 
    state.activeTool === 'template-import' || 
    state.activeTool === 'manual'
  ) {
    return state.activeTool;
  }

  const fromEditable = mapGeneratorToTool(state.editableTemplate.sourceGenerator);
  if (fromEditable) return fromEditable;

  const fromTemplateId = mapTemplateIdToTool(state.template?.id);
  return fromTemplateId ?? 'text';
}

export function getEditableStatusCopy(isEditable: boolean): StatusCopy {
  return isEditable
    ? {
        label: 'Editable',
        description: 'Stones can be edited individually.',
        actionHint: 'Use Select or Add to refine the design stone by stone.',
      }
    : {
        label: 'Generated',
        description: 'Driven by generator settings.',
        actionHint: 'Adjust the source settings or make the result editable to fine-tune stones.',
      };
}

export function getSelectionEmptyState(isEditable: boolean) {
  if (!isEditable) {
    return {
      title: 'Generated output',
      description: 'Review the generated result, then make it editable when you need per-stone control.',
      tips: [
        'Switch between Text, SVG, Grid, or Manual to change the source.',
        'Use Make Editable to enable per-stone selection and movement.',
      ],
    };
  }

  return {
    title: 'Nothing selected',
    description: 'Select a stone to edit its properties or drag a box to work with multiple stones.',
    tips: [
      'Click a stone to select it.',
      'Shift-click adds or toggles a stone in the selection.',
      'Drag on empty canvas space to start box selection.',
    ],
  };
}

export function getSelectionActionState(selectedCount: number) {
  return {
    canDuplicate: selectedCount > 0,
    duplicateReason: selectedCount > 0 ? null : 'Select at least one stone to duplicate it.',
    canDelete: selectedCount > 0,
    deleteReason: selectedCount > 0 ? null : 'Select at least one stone to delete it.',
    canAlign: selectedCount >= 2,
    alignReason: selectedCount >= 2 ? null : 'Select at least two stones to align them.',
    canDistribute: selectedCount >= 3,
    distributeReason: selectedCount >= 3 ? null : 'Select at least three stones to distribute spacing.',
  };
}

export function getToolShortcutLabel(tool: EditorTool): string | null {
  switch (tool) {
    case 'select':
      return 'Esc clears selection';
    case 'manual':
      return 'Space pans';
    default:
      return null;
  }
}