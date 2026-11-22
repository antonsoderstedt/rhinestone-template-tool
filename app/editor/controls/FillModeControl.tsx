/**
 * Fill mode and pattern control for SVG and polyline templates
 */

import { useId } from 'react';
import type { TemplateFillMode, FillPattern } from '@/src/lib/rhinestone-engine/index';
import { editorSelectClassName } from './controlStyles';
import FieldHeader from './FieldHeader';

import { useT } from '../../lib/i18n';
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
  const t = useT();
  const modeId = useId();
  const patternId = useId();
  const showPatternControl = fillMode === 'fill' || fillMode === 'outline-fill';
  const visibleModes = FILL_MODES.filter((mode) => availableModes.includes(mode.value));
  const visiblePatterns = FILL_PATTERNS.filter((pattern) => availablePatterns.includes(pattern.value));

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-1.5">
        <FieldHeader
          label={t('Fill mode')}
          htmlFor={modeId}
          help="Outline puts stones along the edges only. Fill covers the inside. Outline + Fill does both."
        />
        <select
          id={modeId}
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
      </div>

      {showPatternControl && (
        <div className="flex flex-col gap-1.5">
          <FieldHeader
            label={t('Fill pattern')}
            htmlFor={patternId}
            help="Grid lines stones up in rows and columns. Offset grid staggers every other row so stones pack closer together."
          />
          <select
            id={patternId}
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
        </div>
      )}
    </div>
  );
}
