'use client';

import { Hand } from 'lucide-react';
import { EditorTool, EditorAction } from './EditorState';
import { EDITOR_TOOLS, getToolShortcutLabel } from './editorUi';

interface EditorToolbarProps {
  activeTool: EditorTool;
  dispatch: React.Dispatch<EditorAction>;
  orientation?: 'horizontal' | 'vertical';
}

export default function EditorToolbar({ activeTool, dispatch, orientation = 'vertical' }: EditorToolbarProps) {
  const isHorizontal = orientation === 'horizontal';

  return (
    <aside
      className={
        isHorizontal
          ? 'flex items-center gap-2 rounded-xl border border-border bg-surface-raised/95 px-2 py-2 shadow-sm backdrop-blur-sm'
          : 'flex flex-col gap-2 rounded-xl border border-border bg-surface-raised/90 p-2'
      }
      aria-label={isHorizontal ? 'Canvas and source tools' : 'Source tools'}
    >
      {EDITOR_TOOLS.map((tool) => (
        <button
          key={tool.id}
          onClick={() => dispatch({ type: 'SET_ACTIVE_TOOL', tool: tool.id })}
          aria-label={tool.label}
          className={`group flex ${isHorizontal ? 'h-11 min-w-[72px] flex-col px-3' : 'h-14 w-full'} items-center justify-center rounded-lg text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-accent-400 ${
            activeTool === tool.id
              ? 'bg-accent-500 text-ink-inverse shadow-sm'
              : 'text-ink-secondary hover:bg-sand-100 hover:text-ink'
          }`}
          title={[tool.description, getToolShortcutLabel(tool.id)].filter(Boolean).join(' • ')}
        >
          <tool.icon className="h-4 w-4" />
          <span className="mt-1 text-[11px]">{tool.label}</span>
        </button>
      ))}

      {isHorizontal && (
        <div className="ml-2 flex items-center gap-2 rounded-lg border border-border bg-surface-sunken px-3 py-2 text-xs text-ink-secondary">
          <Hand className="h-3.5 w-3.5 text-ink-muted" />
          <span>Pan with Space or middle mouse</span>
        </div>
      )}
    </aside>
  );
}
