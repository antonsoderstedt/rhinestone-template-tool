/**
 * Reusable width/height control with aspect ratio lock
 */

import NumericInput from './NumericInput';

interface PhysicalDimensionsControlProps {
  widthMm: number | '';
  heightMm: number | '';
  preserveAspectRatio: boolean;
  onWidthChange: (value: number | '') => void;
  onHeightChange: (value: number | '') => void;
  onPreserveAspectRatioChange: (value: boolean) => void;
}

export default function PhysicalDimensionsControl({
  widthMm,
  heightMm,
  preserveAspectRatio,
  onWidthChange,
  onHeightChange,
  onPreserveAspectRatioChange,
}: PhysicalDimensionsControlProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-ink-secondary">Target Dimensions</span>
        <label className="flex items-center gap-1.5 ml-auto">
          <input
            type="checkbox"
            checked={preserveAspectRatio}
            onChange={(e) => onPreserveAspectRatioChange(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-border bg-surface-sunken text-accent-600 focus:ring-1 focus:ring-accent-400"
          />
          <span className="text-xs text-ink-secondary">Lock ratio</span>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <NumericInput
          label="Width"
          value={widthMm}
          onChange={onWidthChange}
          unit="mm"
          min={5}
          max={500}
          step={0.1}
        />
        <NumericInput
          label="Height"
          value={heightMm}
          onChange={onHeightChange}
          unit="mm"
          min={5}
          max={500}
          step={0.1}
        />
      </div>
    </div>
  );
}
