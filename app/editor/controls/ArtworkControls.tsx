'use client';

import { AlertTriangle, Info } from 'lucide-react';
import type { StoneSizeId } from '@/src/lib/rhinestone-engine/index';
import type { ArtworkLook } from '@/src/lib/rhinestone-engine/index';
import { ARTWORK_LOOKS, type ArtworkInfo } from '../artworkGeneration';
import NumericInput from './NumericInput';
import {
  editorFieldLabelClassName,
  editorSegmentActiveClassName,
  editorSegmentBaseClassName,
  editorSegmentIdleClassName,
} from './controlStyles';

/** How the stones are laid out: one of three looks, each shown with what it does. */
export function ArtworkLookControl({
  look,
  rowCount,
  onLookChange,
  onRowCountChange,
}: {
  look: ArtworkLook;
  rowCount: number;
  onLookChange: (look: ArtworkLook) => void;
  onRowCountChange: (rows: number) => void;
}) {
  const current = ARTWORK_LOOKS.find((option) => option.look === look)!;
  return (
    <div className="space-y-2">
      <div className={editorFieldLabelClassName}>Look</div>
      <div role="group" aria-label="Look" className="grid grid-cols-3 gap-1.5">
        {ARTWORK_LOOKS.map((option) => (
          <button
            key={option.look}
            type="button"
            onClick={() => onLookChange(option.look)}
            aria-pressed={look === option.look}
            className={`${editorSegmentBaseClassName} text-center ${look === option.look ? editorSegmentActiveClassName : editorSegmentIdleClassName}`}
          >
            <span className="text-sm font-medium">{option.label}</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-ink-muted">{current.help}</p>
      {look === 'rows' && (
        <NumericInput
          label="Rows"
          value={rowCount}
          onChange={(value) => onRowCountChange(typeof value === 'number' ? Math.max(1, Math.min(20, Math.round(value))) : 3)}
          min={1}
          max={20}
          step={1}
        />
      )}
    </div>
  );
}

/** The colours found in the artwork. A colour can be left out (a white background is by default). */
export function ArtworkLayersList({
  layers,
  onToggle,
}: {
  layers: ArtworkInfo['layers'];
  onToggle: (colour: string, role: 'stones' | 'ignore') => void;
}) {
  if (layers.length < 2) return null;
  return (
    <div className="space-y-2">
      <div className={editorFieldLabelClassName}>Colours in the artwork</div>
      <ul className="space-y-1.5">
        {layers.map((layer) => (
          <li key={layer.colour}>
            <label className="flex items-center gap-2 text-sm text-ink-secondary">
              <input
                type="checkbox"
                checked={layer.role === 'stones'}
                onChange={(event) => onToggle(layer.colour, event.target.checked ? 'stones' : 'ignore')}
                className="h-3.5 w-3.5 rounded"
              />
              <span
                aria-hidden="true"
                className="h-4 w-4 shrink-0 rounded border border-[var(--studio-border-strong)]"
                style={{ backgroundColor: layer.colour }}
              />
              <span className="min-w-0 flex-1 truncate">
                {layer.colour}
                <span className="ml-1.5 text-xs text-ink-muted">{layer.role === 'stones' ? `${layer.stones} stones` : 'left out'}</span>
              </span>
            </label>
            {layer.reason && layer.role === 'ignore' && <p className="ml-9 mt-0.5 text-xs text-ink-muted">{layer.reason}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

const SIZE_ORDER: StoneSizeId[] = ['SS6', 'SS10', 'SS16'];

/** Whether the artwork is fine enough for the chosen stone at this size, and what to do about it. */
export function ArtworkAdvice({
  info,
  stoneSize,
  onSetWidth,
  onSetStoneSize,
}: {
  info: ArtworkInfo;
  stoneSize: StoneSizeId;
  onSetWidth: (widthMm: number) => void;
  onSetStoneSize: (size: StoneSizeId) => void;
}) {
  const report = info.feasibility;
  const current = report?.perSize.find((entry) => entry.stoneSize === stoneSize);
  if (!report || !current) return null;
  const lines: string[] = [];
  if (current.lostShapes > 0) {
    lines.push(`${current.lostShapes} of ${current.totalShapes} shapes are thinner than one ${stoneSize} stone and get none.`);
  }
  if (current.verdict === 'good' && current.lostShapes === 0) {
    return (
      <p className="flex items-start gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200" data-testid="artwork-advice">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        The detail in this artwork fits {stoneSize} stones at {Math.round(report.widthMm)} mm wide.
      </p>
    );
  }
  const share = Math.round(current.thinAreaShare * 100);
  if (current.verdict !== 'good') {
    lines.unshift(
      current.verdict === 'too-small'
        ? `Too fine for ${stoneSize} at ${Math.round(report.widthMm)} mm: ${share}% of the artwork is thinner than a stone.`
        : `${share}% of the artwork is thinner than a ${stoneSize} stone and will be simplified.`,
    );
  }
  const suggestion = current.suggestedWidthMm !== null ? Math.ceil(current.suggestedWidthMm / 10) * 10 : null;
  const smaller = SIZE_ORDER.slice(0, SIZE_ORDER.indexOf(stoneSize)).reverse().find((size) => report.perSize.find((e) => e.stoneSize === size)?.verdict === 'good');
  return (
    <div className="space-y-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-100" data-testid="artwork-advice">
      <p className="flex items-start gap-1.5">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{lines.join(' ')}</span>
      </p>
      <div className="flex flex-wrap gap-1.5">
        {suggestion !== null && suggestion > report.widthMm && (
          <button
            type="button"
            onClick={() => onSetWidth(suggestion)}
            className="rounded-md border border-amber-400/40 px-2 py-1 font-medium hover:bg-amber-500/20 focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            Make it {suggestion} mm wide
          </button>
        )}
        {smaller && (
          <button
            type="button"
            onClick={() => onSetStoneSize(smaller)}
            className="rounded-md border border-amber-400/40 px-2 py-1 font-medium hover:bg-amber-500/20 focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            Use {smaller} stones
          </button>
        )}
      </div>
    </div>
  );
}
