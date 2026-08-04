import type { ComponentType } from 'react';
import { Grid3X3, MousePointer2, MousePointerClick, Type, Upload } from 'lucide-react';
import type { GeneratorId } from '@/src/lib/rhinestone-engine/index';
import type { EditorState, EditorTool } from './EditorState';

export type SourcePanelTool = 'text' | 'svg' | 'grid' | 'rhinestone-font' | 'svg-alphabet' | 'letter-stencil' | 'template-import' | 'manual';

export interface EditorToolConfig {
  id: EditorTool;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}

/** The single canonical tool list — drives both the properties-panel switcher and any compact toolbar. */
export const EDITOR_TOOLS: readonly EditorToolConfig[] = [
  { id: 'select', label: 'Select', description: 'Select, move, and box-select stones', icon: MousePointer2 },
  { id: 'text', label: 'Text', description: 'Outline or dot-matrix text', icon: Type },
  { id: 'rhinestone-font', label: 'Stone Font', description: 'Pre-placed stones from a rhinestone font', icon: Type },
  { id: 'svg-alphabet', label: 'Alphabet', description: 'Compose text from a per-letter SVG alphabet', icon: Type },
  { id: 'letter-stencil', label: 'Stencils', description: 'Reusable per-letter stencil cards to spell words', icon: Type },
  { id: 'svg', label: 'Artwork', description: 'Upload SVG or image artwork', icon: Upload },
  { id: 'template-import', label: 'Import', description: 'Keep stones from an existing SVG template', icon: Upload },
  { id: 'grid', label: 'Grid', description: 'Build an even stone grid', icon: Grid3X3 },
  { id: 'manual', label: 'Pen', description: 'Draw with stones directly', icon: MousePointerClick },
];

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
    case 'rhinestone-font-line':
    case 'rhinestone-font-digits':
      return 'rhinestone-font';
    case 'svg-alphabet':
      return 'svg-alphabet';
    case 'letter-stencil':
      return 'letter-stencil';
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
  if (templateId.startsWith('svg-') || templateId.startsWith('image-artwork-')) {
    return 'svg';
  }
  if (templateId.startsWith('grid-')) {
    return 'grid';
  }
  if (templateId.startsWith('rhinestone-font-')) {
    return 'rhinestone-font';
  }
  if (templateId.startsWith('svg-alphabet')) {
    return 'svg-alphabet';
  }
  if (templateId.startsWith('letter-stencil')) {
    return 'letter-stencil';
  }
  if (templateId.startsWith('imported-template')) {
    return 'template-import';
  }
  return null;
}

export function getSourcePanelTool(state: EditorState): SourcePanelTool {
  if (
    state.activeTool === 'text' || 
    state.activeTool === 'svg' || 
    state.activeTool === 'grid' || 
    state.activeTool === 'rhinestone-font' || 
    state.activeTool === 'svg-alphabet' || 
    state.activeTool === 'letter-stencil' || 
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

const TOOL_CANVAS_HINTS: Partial<Record<EditorTool, string>> = {
  select: 'Click a stone to select it, drag a box to select several, or drag a stone to move it. Cmd/Ctrl+A selects the whole design.',
  manual: 'Click or drag to place stones. Hold Space or the middle mouse button to pan.',
  text: 'Adjust the text settings on the left, then Generate to see your design here.',
  'rhinestone-font': 'Pick a rhinestone font and type your word — stones are placed for you.',
  'svg-alphabet': 'Compose a word from the SVG alphabet on the left, then Generate.',
  'letter-stencil': 'Spell a word with letter stencils on the left, then Generate to preview it here.',
  svg: 'Upload artwork on the left, then Generate to fill it with stones.',
  'template-import': 'Import an existing SVG template to bring its stones in here.',
  grid: 'Set rows, columns and spacing on the left, then Generate an even stone grid.',
};

export function getCanvasHint(activeTool: EditorTool): string {
  return TOOL_CANVAS_HINTS[activeTool] ?? 'Pan, zoom, and fit the current design without leaving the editor.';
}
