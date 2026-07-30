/**
 * Fill mode and pattern control for SVG and polyline templates
 */

import type { TemplateFillMode, FillPattern } from '@/src/lib/rhinestone-engine/index';

interface FillModeControlProps {
  fillMode: TemplateFillMode;
  fillPattern: FillPattern;
  onFillModeChange: (mode: TemplateFillMode) => void;
  onFillPatternChange: (pattern: FillPattern) => void;
}

const FILL_MODES: { value: TemplateFillMode; label: string }[] = [
  { value: 'outline', label: 'Outline Only' },
  { value: 'fill', label: 'Fill Only' },
  { value: 'outline-fill', label: 'Outline + Fill' },
];

const FILL_PATTERNS: { value: FillPattern; label: string }[] = [
  { value: 'grid', label: 'Grid' },
  { value: 'offset-grid', label: 'Offset Grid' },
];

export default function FillModeControl({
  fillMode,
  fillPattern,
  onFillModeChange,
  onFillPatternChange,
}: FillModeControlProps) {
  const showPatternControl = fillMode === 'fill' || fillMode === 'outline-fill';

  return (
    <div className="space-y-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-zinc-400">Fill Mode</span>
        <select
          value={fillMode}
          onChange={(e) => onFillModeChange(e.target.value as TemplateFillMode)}
          className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
        >
          {FILL_MODES.map((mode) => (
            <option key={mode.value} value={mode.value}>
              {mode.label}
            </option>
          ))}
        </select>
      </label>

      {showPatternControl && (
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-zinc-400">Fill Pattern</span>
          <select
            value={fillPattern}
            onChange={(e) => onFillPatternChange(e.target.value as FillPattern)}
            className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
          >
            {FILL_PATTERNS.map((pattern) => (
              <option key={pattern.value} value={pattern.value}>
                {pattern.label}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
