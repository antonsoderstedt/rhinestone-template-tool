'use client';

import { EditorTool, EditorAction } from './EditorState';

interface EditorToolbarProps {
  activeTool: EditorTool;
  dispatch: React.Dispatch<EditorAction>;
}

const TOOLS: Array<{ id: EditorTool; label: string; icon: string; tooltip: string }> = [
  { id: 'select', label: 'Select', icon: '⌖', tooltip: 'Select and move stones' },
  { id: 'text', label: 'Text', icon: 'T', tooltip: 'Add text (outline or dot-matrix)' },
  { id: 'svg', label: 'SVG', icon: '⬡', tooltip: 'Import SVG file' },
  { id: 'grid', label: 'Grid', icon: '⊞', tooltip: 'Create stone grid' },
  { id: 'manual', label: 'Add', icon: '+', tooltip: 'Add individual stones' },
];

export default function EditorToolbar({ activeTool, dispatch }: EditorToolbarProps) {
  return (
    <aside className="w-16 border-r border-zinc-700 bg-zinc-900 flex flex-col items-center py-4 gap-2">
      {TOOLS.map((tool) => (
        <button
          key={tool.id}
          onClick={() => dispatch({ type: 'SET_ACTIVE_TOOL', tool: tool.id })}
          className={`
            w-12 h-12 rounded flex flex-col items-center justify-center text-xs font-medium transition
            ${
              activeTool === tool.id
                ? 'bg-purple-600 text-white'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
            }
          `}
          title={tool.tooltip}
        >
          <span className="text-lg">{tool.icon}</span>
          <span className="text-[10px] mt-0.5">{tool.label}</span>
        </button>
      ))}
      
      <div className="flex-1" />
      
      {/* Future: Add more tools here */}
    </aside>
  );
}
