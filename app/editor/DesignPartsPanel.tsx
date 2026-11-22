'use client';

import { Copy, FlipHorizontal2, FlipVertical2, Plus, Redo2, RotateCw, Trash2, Undo2 } from 'lucide-react';
import type { Stone } from '@/src/lib/rhinestone-engine/index';
import type { EditorAction, EditorState } from './EditorState';
import { boundsOfStones, nextPartId, offsetBelow, partsStones, translateStones } from './designParts';
import NumericInput from './controls/NumericInput';

function suggestName(state: EditorState): string {
  const firstLine = (text: string) => text.split('\n')[0]!.trim().slice(0, 24);
  switch (state.activeTool) {
    case 'text': return firstLine(state.textTool.text) || 'Text';
    case 'svg': return (state.svgTool.assetKind === 'image' ? state.svgTool.imageFileName : state.svgTool.svgFileName)?.replace(/\.[a-z0-9]+$/i, '') || 'Artwork';
    case 'rhinestone-font': return firstLine(state.rhinestoneFontTool.text) || 'Stone font';
    case 'svg-alphabet': return firstLine(state.svgAlphabetTool.text) || 'Alphabet';
    case 'letter-stencil': return firstLine(state.letterStencilTool.text) || 'Stencil';
    case 'grid': return 'Grid';
    default: return 'Part';
  }
}

/** The piece being worked on as stones: the editable ones when it has been made editable, else what the tool generated. */
function workingStones(state: EditorState): Stone[] {
  return state.editableTemplate.isEditable ? (state.editableTemplate.stones as Stone[]) : state.template?.stones ?? [];
}

function IconButton({ label, onClick, disabled = false, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="rounded-md p-1.5 text-[var(--studio-ink-muted)] hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)] focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

/**
 * Keeping several pieces in one design: "Add to design" freezes what is on the canvas as a part and the tool carries on with
 * the next piece, placed below. Each part can be renamed, moved by its offset and removed.
 */
export default function DesignPartsPanel({ state, dispatch }: { state: EditorState; dispatch: React.Dispatch<EditorAction> }) {
  const working = workingStones(state);
  const canAdd = working.length > 0 && state.activeTool !== 'select';

  const addPart = () => {
    const stones = working;
    // Frozen at the origin of its own coordinates so that moving it later is just an offset.
    const part = {
      id: nextPartId(state.parts),
      name: suggestName(state),
      offsetX: 0,
      offsetY: 0,
      stones: translateStones(stones, 0, 0).map((stone, i) => ({ ...stone, id: stones[i]!.id, metadata: undefined })),
    };
    dispatch({ type: 'ADD_PART', part });
    if (state.editableTemplate.isEditable) dispatch({ type: 'DISCARD_EDITABLE_CHANGES' });
    // The next piece starts below everything kept so far, left edges aligned.
    const kept = [...partsStones(state.parts), ...translateStones(stones, 0, 0)];
    const natural = boundsOfStones(translateStones(stones, -state.workingOffset.x, -state.workingOffset.y));
    const next = offsetBelow(kept, natural?.minY ?? 0, natural?.minX ?? 0);
    dispatch({ type: 'SET_WORKING_OFFSET', x: next.x, y: next.y });
  };

  return (
    <div className="flex flex-col gap-3" data-testid="design-parts">
      {state.parts.length > 0 && (
        <section aria-label="Parts of this design" className="rounded-md border border-[var(--studio-border)] bg-[var(--studio-surface)] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--studio-ink-muted)]">Parts of this design</h3>
            <div className="flex gap-1">
              <IconButton label="Undo change to parts" disabled={state.partsHistory.past.length === 0} onClick={() => dispatch({ type: 'UNDO_PARTS' })}>
                <Undo2 className="h-4 w-4" aria-hidden="true" />
              </IconButton>
              <IconButton label="Redo change to parts" disabled={state.partsHistory.future.length === 0} onClick={() => dispatch({ type: 'REDO_PARTS' })}>
                <Redo2 className="h-4 w-4" aria-hidden="true" />
              </IconButton>
            </div>
          </div>
          <ul className="flex flex-col gap-3">
            {state.parts.map((part) => (
              <li key={part.id} className="flex flex-col gap-1.5 border-b border-[var(--studio-border)] pb-3 last:border-0 last:pb-0">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={part.name}
                    aria-label={`Name of ${part.name}`}
                    onChange={(event) => dispatch({ type: 'UPDATE_PART', id: part.id, updates: { name: event.target.value } })}
                    className="min-w-0 flex-1 rounded-md border border-[var(--studio-border)] bg-[var(--studio-well)] px-2 py-1 text-sm text-[var(--studio-ink)]"
                  />
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'REMOVE_PART', id: part.id })}
                    aria-label={`Remove ${part.name}`}
                    className="rounded-md p-1.5 text-[var(--studio-ink-muted)] hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)] focus:outline-none focus:ring-2 focus:ring-violet-400"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  <p className="mr-auto text-xs text-[var(--studio-ink-muted)]">{part.stones.length} stones</p>
                  <IconButton label={`Rotate ${part.name} a quarter turn`} onClick={() => dispatch({ type: 'TRANSFORM_PART', id: part.id, op: 'rotate-cw' })}>
                    <RotateCw className="h-4 w-4" aria-hidden="true" />
                  </IconButton>
                  <IconButton label={`Flip ${part.name} left to right`} onClick={() => dispatch({ type: 'TRANSFORM_PART', id: part.id, op: 'flip-horizontal' })}>
                    <FlipHorizontal2 className="h-4 w-4" aria-hidden="true" />
                  </IconButton>
                  <IconButton label={`Flip ${part.name} top to bottom`} onClick={() => dispatch({ type: 'TRANSFORM_PART', id: part.id, op: 'flip-vertical' })}>
                    <FlipVertical2 className="h-4 w-4" aria-hidden="true" />
                  </IconButton>
                  <IconButton label={`Duplicate ${part.name}`} onClick={() => dispatch({ type: 'DUPLICATE_PART', id: part.id })}>
                    <Copy className="h-4 w-4" aria-hidden="true" />
                  </IconButton>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <NumericInput label="Move right" value={part.offsetX} unit="mm" step={0.5} onChange={(value) => typeof value === 'number' && dispatch({ type: 'UPDATE_PART', id: part.id, updates: { offsetX: value } })} />
                  <NumericInput label="Move down" value={part.offsetY} unit="mm" step={0.5} onChange={(value) => typeof value === 'number' && dispatch({ type: 'UPDATE_PART', id: part.id, updates: { offsetY: value } })} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {state.parts.length > 0 && working.length > 0 && (
        <section aria-label="Position of this piece" className="rounded-md border border-[var(--studio-border)] bg-[var(--studio-surface)] p-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--studio-ink-muted)]">Position of this piece</h3>
          <div className="grid grid-cols-2 gap-2">
            <NumericInput label="Move right" value={state.workingOffset.x} unit="mm" step={0.5} onChange={(value) => typeof value === 'number' && dispatch({ type: 'SET_WORKING_OFFSET', x: value, y: state.workingOffset.y })} />
            <NumericInput label="Move down" value={state.workingOffset.y} unit="mm" step={0.5} onChange={(value) => typeof value === 'number' && dispatch({ type: 'SET_WORKING_OFFSET', x: state.workingOffset.x, y: value })} />
          </div>
        </section>
      )}

      {canAdd && (
        <button
          type="button"
          onClick={addPart}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-violet-400/50 bg-violet-500/15 px-3 py-2 text-sm font-medium text-[var(--studio-ink)] hover:bg-violet-500/25 focus:outline-none focus:ring-2 focus:ring-violet-400"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add to design
        </button>
      )}
      {canAdd && state.parts.length === 0 && (
        <p className="-mt-1 text-xs text-[var(--studio-ink-muted)]">Keeps this piece and starts the next one below it: a name and a number, or text and a logo.</p>
      )}
    </div>
  );
}
