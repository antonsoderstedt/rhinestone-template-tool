/**
 * Fill mode and pattern control for SVG and polyline templates
 */

import type { TemplateFillMode, FillPattern } from '@/src/lib/rhinestone-engine/index';
import { editorFieldLabelClassName, editorSelectClassName } from './controlStyles';

interface FillModeControlProps {
  fillMode: TemplateFillMode;
  fillPattern: FillPattern;
  availableModes?: readonly TemplateFillMode[];
  availablePatterns?: readonly FillPattern[];
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
  availableModes = ['outline', 'fill', 'outline-fill'],
  availablePatterns = ['grid', 'offset-grid'],
  onFillModeChange,
  onFillPatternChange,
}: FillModeControlProps) {
  const showPatternControl = fillMode === 'fill' || fillMode === 'outline-fill';
  const visibleModes = FILL_MODES.filter((mode) => availableModes.includes(mode.value));
  const visiblePatterns = FILL_PATTERNS.filter((pattern) => availablePatterns.includes(pattern.value));

  return (
    <div className="space-y-3">
      <label className="flex flex-col gap-1.5">
        <span className={editorFieldLabelClassName}>Fill Mode</span>
        <select
          value={fillMode}
          onChange={(e) => onFillModeChange(e.target.value as TemplateFillMode)}
          className={editorSelectClassName}
        >
          {visibleModes.map((mode) => (
            <option key={mode.value} value={mode.value}>
              {mode.label}
            </option>
          ))}
        </select>
      </label>

      {showPatternControl && (
        <label className="flex flex-col gap-1.5">
          <span className={editorFieldLabelClassName}>Fill Pattern</span>
          <select
            value={fillPattern}
            onChange={(e) => onFillPatternChange(e.target.value as FillPattern)}
            className={editorSelectClassName}
          >
            {visiblePatterns.map((pattern) => (
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
