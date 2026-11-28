'use client';

import { useFontCatalogRevision } from '@/app/lib/useFontCatalog';
import { getOutlineFontDefinition, getSupportedTextCoverageModes } from '@/src/lib/rhinestone-engine/index';
import StoneProfileControl from '../controls/StoneProfileControl';
import DensityControl from '../controls/DensityControl';
import PhysicalDimensionsControl from '../controls/PhysicalDimensionsControl';
import NumericInput from '../controls/NumericInput';
import AdvancedSection from '../controls/AdvancedSection';
import FillModeControl from '../controls/FillModeControl';
import TextStyleGallery from '../controls/TextStyleGallery';
import PlacementModeControl from '../controls/PlacementModeControl';
import { editorFieldLabelClassName, editorSegmentActiveClassName, editorSegmentBaseClassName, editorSegmentIdleClassName, editorSelectClassName, editorTextareaClassName } from '../controls/controlStyles';
import { TEXT_EXAMPLES } from '../editorUi';
import { getGeneratorCapabilityProfile } from '@/src/lib/rhinestone-engine/index';
import { useT } from '../../lib/i18n';
import { ToolPropertiesProps } from './shared';

export function TextToolProperties({ state, dispatch, outlineFontStatus }: ToolPropertiesProps) {
  const t = useT();
  const { textTool } = state;
  useFontCatalogRevision(); // draw again when the font library has loaded
  const textCapabilities = getGeneratorCapabilityProfile('outline-text');
  const selectedFontDefinition = getOutlineFontDefinition(textTool.fontId);
  const supportedCoverageModes = textTool.mode === 'outline'
    ? getSupportedTextCoverageModes(textTool.fontId)
    : ['outline'];
  const visibleCoverageModes = (() => {
    const modes: Array<'outline' | 'fill' | 'outline-fill' | 'contour'> = [];
    if (textTool.mode !== 'outline') {
      modes.push('outline');
      return modes;
    }

    for (const mode of supportedCoverageModes) {
      if (mode === 'contour') {
        modes.push(mode);
        continue;
      }
      if (textTool.outlineTextStyle === 'outline' && mode === 'outline') {
        modes.push(mode);
        continue;
      }
      if (textTool.outlineTextStyle === 'filled-typography' && (mode === 'fill' || mode === 'outline-fill')) {
        modes.push(mode);
      }
    }

    return modes;
  })();
  const fillModes = supportedCoverageModes.filter(
    (mode): mode is 'outline' | 'fill' | 'outline-fill' => mode !== 'contour',
  );
  const visibleFillModes = fillModes.filter((mode) => {
    if (textTool.outlineTextStyle === 'outline') return mode === 'outline';
    return mode === 'fill' || mode === 'outline-fill';
  });

  return (
    <div className="space-y-4">
      {/* Text Input */}
      <label className="flex flex-col gap-1.5">
        <span className={editorFieldLabelClassName}>{t('Text')}</span>
        <textarea
          value={textTool.text}
          onChange={(e) => dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { text: e.target.value } })}
          rows={3}
          placeholder={t('Your name')}
          className={`${editorTextareaClassName} resize-none font-mono`}
        />
      </label>
      <div className="flex flex-wrap items-center gap-1.5" aria-label={t('Try an example')}>
        <span className="text-xs uppercase tracking-[0.14em] text-[var(--studio-ink-muted)]">{t('Try')}</span>
        {TEXT_EXAMPLES.map((example) => (
          <button
            key={example.label}
            type="button"
            onClick={() => dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { text: example.text } })}
            className="rounded-full border border-[var(--studio-border)] bg-[var(--studio-well)] px-2.5 py-1 text-xs text-[var(--studio-ink-secondary)] transition hover:border-violet-400/50 hover:text-[var(--studio-ink)]"
          >
            {example.label}
          </button>
        ))}
      </div>

      <TextStyleGallery state={state} dispatch={dispatch} />
      {textTool.mode === 'outline' && outlineFontStatus && outlineFontStatus.fontId === textTool.fontId && outlineFontStatus.status === 'loading' && (
        <p className="text-xs text-ink-muted" role="status">{outlineFontStatus.message ?? 'Loading font…'}</p>
      )}
      {textTool.mode === 'outline' && outlineFontStatus && outlineFontStatus.fontId === textTool.fontId && outlineFontStatus.status === 'error' && outlineFontStatus.message && (
        <p className="text-xs text-danger-600" role="alert">{outlineFontStatus.message}</p>
      )}

      {textTool.mode === 'outline' && textTool.unsupportedCharacters.length > 0 && (
        <div role="alert" className="rounded-xl border border-warning-500/30 bg-warning-50 px-3 py-3 text-xs text-warning-600">
          Unsupported characters: {textTool.unsupportedCharacters.join(', ')}.
          The built-in simple font doesn&apos;t have a glyph for {textTool.unsupportedCharacters.length === 1 ? 'it' : 'them'} — a &apos;?&apos; is drawn instead. Try a bundled font, or remove {textTool.unsupportedCharacters.length === 1 ? 'it' : 'them'} from the text.
        </div>
      )}

      {textTool.mode === 'outline' && (
        <div className="space-y-2">
          <span className={editorFieldLabelClassName}>{t('Text style')}</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { outlineTextStyle: 'outline' } })}
              className={`${editorSegmentBaseClassName} ${textTool.outlineTextStyle === 'outline' ? editorSegmentActiveClassName : editorSegmentIdleClassName}`}
            >
              <div className="text-sm font-medium">{t('Outline text')}</div>
              <p className="mt-1 text-xs text-ink-muted">{t('Follow the letter contours only.')}</p>
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { outlineTextStyle: 'filled-typography' } })}
              disabled={!fillModes.includes('fill')}
              className={`${editorSegmentBaseClassName} ${textTool.outlineTextStyle === 'filled-typography' ? editorSegmentActiveClassName : editorSegmentIdleClassName} ${!fillModes.includes('fill') ? 'cursor-not-allowed opacity-50 hover:border-border hover:bg-surface' : ''}`}
            >
              <div className="text-sm font-medium">{t('Filled letters')}</div>
              <p className="mt-1 text-xs text-ink-muted">{t('Stones inside the letters as well as on the edge.')}</p>
            </button>
          </div>
        </div>
      )}

      {textTool.mode === 'outline' && selectedFontDefinition.supportedTextCoverageModes.length === 1 && !selectedFontDefinition.isLegacy && (
        <div className="rounded-xl border border-warning-500/30 bg-warning-50 px-3 py-3 text-xs text-warning-600">
          {selectedFontDefinition.displayName} is currently limited to outline placement to avoid poor filled text results.
        </div>
      )}

      {/* Stone Size */}
      <StoneProfileControl
        value={textTool.stoneSize}
        onChange={(size) => dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { stoneSize: size } })}
      />

      {/* Outline-specific controls */}
      {textTool.mode === 'outline' && (
        <>
          <NumericInput
            label={t('Font Size')}
            value={textTool.fontSizeMm}
            onChange={(val) => dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { fontSizeMm: val } })}
            unit="mm"
            min={5}
            max={200}
            step={1}
          />

          <label className="flex flex-col gap-1.5">
            <span className={editorFieldLabelClassName}>{t('Alignment')}</span>
            <select
              value={textTool.align}
              onChange={(e) => dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { align: e.target.value as 'left' | 'center' | 'right' } })}
              className={editorSelectClassName}
            >
              <option value="left">{t('Left')}</option>
              <option value="center">{t('Center')}</option>
              <option value="right">{t('Right')}</option>
            </select>
          </label>

          <NumericInput
            label={t('Letter Spacing')}
            value={textTool.letterSpacingMm}
            onChange={(val) => dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { letterSpacingMm: val } })}
            unit="mm"
            min={0}
            max={50}
            step={0.5}
          />

          <NumericInput
            label={t('Line Spacing')}
            value={textTool.lineSpacingMm}
            onChange={(val) => dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { lineSpacingMm: val } })}
            unit="mm"
            min={0}
            max={100}
            step={1}
          />

          <NumericInput
            label={t('Curve')}
            value={textTool.curveAmount}
            onChange={(val) => dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { curveAmount: typeof val === 'number' ? val : 0 } })}
            min={-1}
            max={1}
            step={0.05}
            helpText="0 is straight. Positive bows text into a dome, negative into a valley."
          />
        </>
      )}

      {/* Dot-matrix-specific controls */}
      {textTool.mode === 'dot-matrix' && (
        <>
          <NumericInput
            label={t('Letter Spacing')}
            value={textTool.letterSpacingColumns}
            onChange={(val) => dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { letterSpacingColumns: typeof val === 'number' ? val : 0 } })}
            unit="cols"
            min={0}
            max={10}
            step={1}
          />

          <NumericInput
            label={t('Line Spacing')}
            value={textTool.lineSpacingRows}
            onChange={(val) => dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { lineSpacingRows: typeof val === 'number' ? val : 0 } })}
            unit="rows"
            min={0}
            max={10}
            step={1}
          />
        </>
      )}

      {/* Target Dimensions */}
      <PhysicalDimensionsControl
        widthMm={textTool.targetWidthMm}
        heightMm={textTool.targetHeightMm}
        preserveAspectRatio={textTool.preserveAspectRatio}
        onWidthChange={(val) => dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { targetWidthMm: val } })}
        onHeightChange={(val) => dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { targetHeightMm: val } })}
        onPreserveAspectRatioChange={(val) => dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { preserveAspectRatio: val } })}
      />

      {/* Density */}
      <DensityControl
        densityPreset={textTool.densityPreset}
        customSpacingMm={textTool.customSpacingMm}
        onDensityChange={(preset) => dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { densityPreset: preset } })}
        onCustomSpacingChange={(val) => dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { customSpacingMm: val } })}
      />

      {/* Advanced */}
      <AdvancedSection>
        <PlacementModeControl
          coverageMode={textTool.coverageMode}
          availableCoverageModes={visibleCoverageModes}
          placementPattern={textTool.placementPattern}
          availablePlacementPatterns={textCapabilities.supportedPlacementPatterns.filter((pattern): pattern is 'default' | 'hexagonal' | 'radial' => pattern === 'default' || pattern === 'hexagonal' || pattern === 'radial')}
          contourSettings={textTool.contourSettings}
          radialSettings={textTool.radialSettings}
          onCoverageModeChange={(coverageMode) => dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { coverageMode } })}
          onPlacementPatternChange={(placementPattern) => dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { placementPattern } })}
          onContourSettingsChange={(contourSettings) => dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { contourSettings } })}
          onRadialSettingsChange={(radialSettings) => dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { radialSettings } })}
        />
        <FillModeControl
          fillMode={textTool.fillMode}
          fillPattern={textTool.fillPattern}
          availableModes={visibleFillModes}
          availablePatterns={textCapabilities.supportedFillPatterns}
          onFillModeChange={(mode) => dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { fillMode: mode } })}
          onFillPatternChange={(pattern) => dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { fillPattern: pattern } })}
        />
      </AdvancedSection>
    </div>
  );
}
