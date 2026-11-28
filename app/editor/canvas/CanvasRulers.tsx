'use client';

import { mmToRulerPercent } from '../canvasCoordinates';
import { buildRulerTickValues } from './canvasHelpers';

interface CanvasRulersProps {
  viewBox: { x: number; y: number; width: number; height: number };
  tickStepMm: number;
  labelStepMm: number;
}

/** The top and left rulers (and their corner) of the canvas; a grid cell each, placed by the parent grid. */
export function CanvasRulers({ viewBox, tickStepMm: rulerTickStepMm, labelStepMm: rulerLabelStepMm }: CanvasRulersProps) {
  return (
    <>
            <div className="border-b border-r border-[var(--studio-border)] bg-[var(--studio-well)]" style={{ gridColumn: 1, gridRow: 1 }} />
            <div
              className="relative overflow-hidden border-b border-[var(--studio-border)] bg-[var(--studio-well)]"
              style={{ gridColumn: 2, gridRow: 1 }}
            >
              {buildRulerTickValues(viewBox.x, viewBox.x + viewBox.width, rulerTickStepMm).map((tick) => (
                <div
                  key={`overlay-top-${tick}`}
                  className="pointer-events-none absolute inset-y-0"
                  style={{ left: mmToRulerPercent(tick, viewBox.x, viewBox.width) }}
                >
                  <div className={`w-px bg-[var(--studio-surface-hover)] ${tick % rulerLabelStepMm === 0 ? 'h-full' : 'h-2.5'} self-end`} />
                  {tick % rulerLabelStepMm === 0 && (
                    <span className="absolute left-1 top-1 text-xs font-medium leading-none text-[var(--studio-ink-subtle)]">
                      {Math.round(tick)}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div
              className="relative overflow-hidden border-r border-[var(--studio-border)] bg-[var(--studio-well)]"
              style={{ gridColumn: 1, gridRow: 2 }}
            >
              {buildRulerTickValues(viewBox.y, viewBox.y + viewBox.height, rulerTickStepMm).map((tick) => (
                <div
                  key={`overlay-left-${tick}`}
                  className="pointer-events-none absolute inset-x-0"
                  style={{ top: mmToRulerPercent(tick, viewBox.y, viewBox.height) }}
                >
                  <div className={`h-px bg-[var(--studio-surface-hover)] ${tick % rulerLabelStepMm === 0 ? 'w-full' : 'w-2.5'} justify-self-end`} />
                  {tick % rulerLabelStepMm === 0 && (
                    <span className="absolute left-1 top-1/2 -translate-y-1/2 text-xs font-medium leading-none text-[var(--studio-ink-subtle)]">
                      {Math.round(tick)}
                    </span>
                  )}
                </div>
              ))}
            </div>
    </>
  );
}
