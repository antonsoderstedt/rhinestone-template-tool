import type {
  ContourCoverageSettings,
  ContourDirection,
  FillPlacementPattern,
  RadialPlacementSettings,
  TemplateCoverageMode,
} from '@/src/lib/rhinestone-engine/index';
import NumericInput from './NumericInput';

interface PlacementModeControlProps {
  coverageMode: TemplateCoverageMode;
  availableCoverageModes: readonly TemplateCoverageMode[];
  placementPattern: FillPlacementPattern;
  availablePlacementPatterns: readonly FillPlacementPattern[];
  contourSettings: ContourCoverageSettings;
  radialSettings: RadialPlacementSettings;
  onCoverageModeChange: (value: TemplateCoverageMode) => void;
  onPlacementPatternChange: (value: FillPlacementPattern) => void;
  onContourSettingsChange: (next: ContourCoverageSettings) => void;
  onRadialSettingsChange: (next: RadialPlacementSettings) => void;
}

const COVERAGE_OPTIONS: Array<{ value: TemplateCoverageMode; label: string; help: string }> = [
  { value: 'outline', label: 'Outline', help: 'Place stones along source outlines only.' },
  { value: 'fill', label: 'Fill', help: 'Fill closed regions with the selected placement pattern.' },
  { value: 'outline-fill', label: 'Outline + Fill', help: 'Keep outline stones and add a fill pattern inside.' },
  { value: 'contour', label: 'Contour', help: 'Generate repeated contour rows from closed source shapes.' },
];

const PATTERN_OPTIONS: Array<{ value: FillPlacementPattern; label: string; help: string }> = [
  { value: 'default', label: 'Default', help: 'Regular fill placement using the existing deterministic grid.' },
  { value: 'hexagonal', label: 'Hexagonal', help: 'Stagger every second row for denser hex packing.' },
  { value: 'radial', label: 'Radial', help: 'Generate concentric rings clipped to the source shape.' },
];

const CONTOUR_DIRECTIONS: Array<{ value: ContourDirection; label: string }> = [
  { value: 'inward', label: 'Inward' },
  { value: 'outward', label: 'Outward' },
  { value: 'centered', label: 'Centered' },
];

export default function PlacementModeControl({
  coverageMode,
  availableCoverageModes,
  placementPattern,
  availablePlacementPatterns,
  contourSettings,
  radialSettings,
  onCoverageModeChange,
  onPlacementPatternChange,
  onContourSettingsChange,
  onRadialSettingsChange,
}: PlacementModeControlProps) {
  const visibleCoverage = COVERAGE_OPTIONS.filter((option) => availableCoverageModes.includes(option.value));
  const visiblePatterns = PATTERN_OPTIONS.filter((option) => availablePlacementPatterns.includes(option.value));
  const usesFillPattern = coverageMode === 'fill' || coverageMode === 'outline-fill';
  const usesContour = coverageMode === 'contour';
  const usesRadial = usesFillPattern && placementPattern === 'radial';

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <span className="text-xs font-medium text-ink-secondary">Coverage</span>
        <div className="grid gap-2 sm:grid-cols-2">
          {visibleCoverage.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onCoverageModeChange(option.value)}
              aria-pressed={coverageMode === option.value}
              className={`rounded-xl border px-3 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-accent-400 ${coverageMode === option.value ? 'border-accent-400 bg-accent-50 text-ink' : 'border-border bg-surface-sunken text-ink-secondary hover:border-border hover:bg-surface-raised'}`}
              title={option.help}
            >
              <div className="text-sm font-medium">{option.label}</div>
              <p className="mt-1 text-[11px] text-ink-muted">{option.help}</p>
            </button>
          ))}
        </div>
      </div>

      {usesFillPattern && visiblePatterns.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-medium text-ink-secondary">Placement pattern</span>
          <div className="grid gap-2 sm:grid-cols-3">
            {visiblePatterns.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onPlacementPatternChange(option.value)}
                aria-pressed={placementPattern === option.value}
                className={`rounded-xl border px-3 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-accent-400 ${placementPattern === option.value ? 'border-accent-400 bg-accent-50 text-ink' : 'border-border bg-surface-sunken text-ink-secondary hover:border-border hover:bg-surface-raised'}`}
                title={option.help}
              >
                <div className="text-sm font-medium">{option.label}</div>
                <p className="mt-1 text-[11px] text-ink-muted">{option.help}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {usesContour && (
        <div className="space-y-3 rounded-xl border border-border bg-surface-sunken px-3 py-3">
          <div className="text-xs font-medium text-ink-secondary">Contour rows</div>
          <div className="grid grid-cols-2 gap-3">
            <NumericInput
              label="Rows"
              value={contourSettings.rowCount}
              onChange={(value) => onContourSettingsChange({ ...contourSettings, rowCount: typeof value === 'number' ? value : contourSettings.rowCount })}
              min={1}
              max={12}
              step={1}
            />
            <NumericInput
              label="Row spacing"
              value={contourSettings.rowSpacingMm}
              onChange={(value) => onContourSettingsChange({ ...contourSettings, rowSpacingMm: typeof value === 'number' ? value : contourSettings.rowSpacingMm })}
              min={0.5}
              max={20}
              step={0.5}
              unit="mm"
            />
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ink-secondary">Direction</span>
            <select
              value={contourSettings.direction}
              onChange={(event) => onContourSettingsChange({ ...contourSettings, direction: event.target.value as ContourDirection })}
              className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent-400"
            >
              {CONTOUR_DIRECTIONS.map((direction) => (
                <option key={direction.value} value={direction.value}>{direction.label}</option>
              ))}
            </select>
          </label>
        </div>
      )}

      {usesRadial && (
        <div className="space-y-3 rounded-xl border border-border bg-surface-sunken px-3 py-3">
          <div className="text-xs font-medium text-ink-secondary">Radial placement</div>
          <div className="grid grid-cols-2 gap-3">
            <NumericInput
              label="Ring spacing"
              value={radialSettings.ringSpacingMm}
              onChange={(value) => onRadialSettingsChange({ ...radialSettings, ringSpacingMm: typeof value === 'number' ? value : radialSettings.ringSpacingMm })}
              min={0.5}
              max={20}
              step={0.5}
              unit="mm"
            />
            <label className="flex items-center gap-2 pt-6 text-sm text-ink-secondary">
              <input
                type="checkbox"
                checked={radialSettings.includeCenterStone}
                onChange={(event) => onRadialSettingsChange({ ...radialSettings, includeCenterStone: event.target.checked })}
                className="h-4 w-4 rounded border-border bg-surface-raised"
              />
              Include center stone
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumericInput
              label="Center offset X"
              value={radialSettings.centerOffsetXmm}
              onChange={(value) => onRadialSettingsChange({ ...radialSettings, centerOffsetXmm: typeof value === 'number' ? value : radialSettings.centerOffsetXmm })}
              step={0.5}
              unit="mm"
            />
            <NumericInput
              label="Center offset Y"
              value={radialSettings.centerOffsetYmm}
              onChange={(value) => onRadialSettingsChange({ ...radialSettings, centerOffsetYmm: typeof value === 'number' ? value : radialSettings.centerOffsetYmm })}
              step={0.5}
              unit="mm"
            />
          </div>
        </div>
      )}
    </div>
  );
}
