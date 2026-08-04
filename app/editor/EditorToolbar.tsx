'use client';

import { Grid3X3, Hand, MousePointerClick, MousePointer2, Type, Upload } from 'lucide-react';
import { EditorTool, EditorAction } from './EditorState';
import { getToolShortcutLabel } from './editorUi';

interface EditorToolbarProps {
  activeTool: EditorTool;
  dispatch: React.Dispatch<EditorAction>;
  orientation?: 'horizontal' | 'vertical';
}

const TOOLS: Array<{
  id: EditorTool;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tooltip: string;
}> = [
  { id: 'select', label: 'Select', icon: MousePointer2, tooltip: 'Select, move, and box-select stones' },
  { id: 'manual', label: 'Pen', icon: MousePointerClick, tooltip: 'Draw and erase stones directly on the canvas' },
  { id: 'text', label: 'Text', icon: Type, tooltip: 'Generate stones from outline or dot-matrix text' },
  { id: 'rhinestone-font', label: 'Stone Font', icon: Type, tooltip: 'Use a font that contains pre-placed rhinestones' },
  { id: 'svg-alphabet', label: 'Alphabet', icon: Type, tooltip: 'Compose text from a per-letter SVG alphabet library' },
  { id: 'letter-stencil', label: 'Stencils', icon: Type, tooltip: 'Generate reusable per-letter stencil cards you can arrange to spell words' },
  { id: 'svg', label: 'Artwork', icon: Upload, tooltip: 'Generate a template from uploaded SVG or image artwork' },
  { id: 'template-import', label: 'Import', icon: Upload, tooltip: 'Import an existing SVG rhinestone template' },
  { id: 'grid', label: 'Grid', icon: Grid3X3, tooltip: 'Generate an evenly spaced stone grid' },
];

export default function EditorToolbar({ activeTool, dispatch, orientation = 'vertical' }: EditorToolbarProps) {
  const isHorizontal = orientation === 'horizontal';

  return (
    <aside
      className={
        isHorizontal
          ? 'flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/90 px-2 py-2 shadow-sm backdrop-blur-sm'
          : 'flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-950/70 p-2'
      }
      aria-label={isHorizontal ? 'Canvas and source tools' : 'Source tools'}
    >
      {TOOLS.map((tool) => (
        <button
          key={tool.id}
          onClick={() => dispatch({ type: 'SET_ACTIVE_TOOL', tool: tool.id })}
          aria-label={tool.label}
          className={`group flex ${isHorizontal ? 'h-11 min-w-[72px] flex-col px-3' : 'h-14 w-full'} items-center justify-center rounded-lg text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-purple-500 ${
            activeTool === tool.id
              ? 'bg-purple-600 text-white shadow-md shadow-purple-950/50'
              : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
          }`}
          title={[tool.tooltip, getToolShortcutLabel(tool.id)].filter(Boolean).join(' • ')}
        >
          <tool.icon className="h-4 w-4" />
          <span className="mt-1 text-[11px]">{tool.label}</span>
        </button>
      ))}

      {isHorizontal && (
        <div className="ml-2 flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-400">
          <Hand className="h-3.5 w-3.5 text-zinc-500" />
          <span>Pan with Space or middle mouse</span>
        </div>
      )}
    </aside>
  );
}
