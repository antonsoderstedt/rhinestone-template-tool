'use client';

import { TRW_STONE_SIZE_CALIBRATION, getRhinestoneFontDefinition, getSupportedRhinestoneFontStoneSizes } from '@/src/lib/rhinestone-engine/index';
import NumericInput from '../controls/NumericInput';
import TextStyleGallery from '../controls/TextStyleGallery';
import StoneFontSizeControl from '../controls/StoneFontSizeControl';
import { editorFieldLabelClassName, editorSelectClassName, editorTextareaClassName } from '../controls/controlStyles';
import { useT } from '../../lib/i18n';
import { GeneratorErrorBanner, ToolPropertiesProps } from './shared';

export function RhinestoneFontToolProperties({ state, dispatch, outlineFontStatus }: ToolPropertiesProps) {
  const t = useT();
  const { rhinestoneFontTool } = state;
  const selectedFontDefinition = getRhinestoneFontDefinition(rhinestoneFontTool.rhinestoneFontId as never);
  const supportedStoneSizes = getSupportedRhinestoneFontStoneSizes(rhinestoneFontTool.rhinestoneFontId);
  const getStoneDiameterLabel = (size: typeof rhinestoneFontTool.stoneSize) => {
    return size in TRW_STONE_SIZE_CALIBRATION
      ? TRW_STONE_SIZE_CALIBRATION[size as keyof typeof TRW_STONE_SIZE_CALIBRATION].diameterMm
      : null;
  };
  const calibration = TRW_STONE_SIZE_CALIBRATION[
    rhinestoneFontTool.stoneSize as keyof typeof TRW_STONE_SIZE_CALIBRATION
  ];
  const modeCopy = rhinestoneFontTool.presentationMode === 'line'
    ? 'Line-style rhinestone font using pre-placed stones. This is the bridge to a future centerline workflow.'
    : rhinestoneFontTool.presentationMode === 'digits'
      ? 'Digits-focused rhinestone font using pre-placed stones. Best for numbers and scoreboards.'
      : 'Uses the stones already placed inside the selected rhinestone font. It does not trace letter outlines or generate a new grid.';

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-accent-300 bg-accent-50 px-3 py-3 text-xs leading-6 text-accent-700">
        {modeCopy}
      </div>

      <GeneratorErrorBanner outlineFontStatus={outlineFontStatus} />

      <label className="flex flex-col gap-1.5">
        <span className={editorFieldLabelClassName}>{t('Text')}</span>
        <div className="flex items-center justify-between gap-3 text-xs text-ink-muted">
          <span>Suggested sample: {selectedFontDefinition.suggestedText}</span>
          <button
            type="button"
            onClick={() => dispatch({
              type: 'UPDATE_RHINESTONE_FONT_TOOL',
              updates: { text: selectedFontDefinition.suggestedText },
            })}
            className="rounded-full border border-border px-2 py-1 text-xs text-ink-secondary transition hover:border-border-strong hover:bg-surface-sunken"
          >
            {t('Use sample')}
          </button>
        </div>
        <textarea
          aria-label={t('Rhinestone font text')}
          value={rhinestoneFontTool.text}
          onChange={(e) => dispatch({
            type: 'UPDATE_RHINESTONE_FONT_TOOL',
            updates: { text: e.target.value },
          })}
          rows={3}
          placeholder={selectedFontDefinition.suggestedText}
          className={`${editorTextareaClassName} resize-y`}
        />
      </label>

      <TextStyleGallery state={state} dispatch={dispatch} />

      <label className="flex flex-col gap-1.5">
        <span className={editorFieldLabelClassName}>{t('Stone size')}</span>
        <select
          aria-label={t('Rhinestone font stone size')}
          value={rhinestoneFontTool.stoneSize}
          onChange={(e) => dispatch({
            type: 'UPDATE_RHINESTONE_FONT_TOOL',
            updates: { stoneSize: e.target.value as typeof rhinestoneFontTool.stoneSize },
          })}
          className={editorSelectClassName}
        >
          {supportedStoneSizes.map((size) => (
            <option key={size} value={size}>
              {size}{getStoneDiameterLabel(size) !== null ? ` — ${getStoneDiameterLabel(size)} mm` : ''}
            </option>
          ))}
        </select>
        {calibration && (
          <span className="text-xs text-ink-muted">
            Hole size for this stone: {calibration.diameterMm} mm
          </span>
        )}
        {selectedFontDefinition.limitations && selectedFontDefinition.limitations.length > 0 && (
          <span className="text-xs text-ink-muted">
            {selectedFontDefinition.limitations.join(' · ')}
          </span>
        )}
        {selectedFontDefinition.style === 'Digits' && (
          <span className="text-xs text-ink-muted">
            Best for numeric-only designs.
          </span>
        )}
        {selectedFontDefinition.style === 'Line' && (
          <span className="text-xs text-ink-muted">
            Line-style rhinestone font. Candidate for a future centerline workflow.
          </span>
        )}
      </label>

      <StoneFontSizeControl
        fontId={rhinestoneFontTool.rhinestoneFontId}
        text={rhinestoneFontTool.text}
        stoneSize={rhinestoneFontTool.stoneSize}
        letterSpacingMm={rhinestoneFontTool.letterSpacingMm}
        lineSpacingMm={rhinestoneFontTool.lineSpacingMm}
        onPick={(size) => dispatch({ type: 'UPDATE_RHINESTONE_FONT_TOOL', updates: { stoneSize: size } })}
      />

      <NumericInput
        label={t('Letter spacing')}
        value={rhinestoneFontTool.letterSpacingMm}
        onChange={(value) => dispatch({
          type: 'UPDATE_RHINESTONE_FONT_TOOL',
          updates: { letterSpacingMm: value },
        })}
        unit="mm"
        min={0}
        max={50}
        step={0.25}
      />

      <NumericInput
        label={t('Line spacing')}
        value={rhinestoneFontTool.lineSpacingMm}
        onChange={(value) => dispatch({
          type: 'UPDATE_RHINESTONE_FONT_TOOL',
          updates: { lineSpacingMm: value },
        })}
        unit="mm"
        min={0}
        max={100}
        step={0.5}
      />

      {rhinestoneFontTool.unsupportedCharacters.length > 0 && (
        <div role="alert" className="rounded-xl border border-warning-500/30 bg-warning-50 px-3 py-3 text-xs text-warning-600">
          Unsupported characters: {rhinestoneFontTool.unsupportedCharacters.join(', ')}.
          They remain in the saved original text but do not generate stones.
        </div>
      )}
      {rhinestoneFontTool.presentationMode === 'digits' && /[A-Za-z]/.test(rhinestoneFontTool.text) && (
        <div role="alert" className="rounded-xl border border-warning-500/30 bg-warning-50 px-3 py-3 text-xs text-warning-600">
          {t('This font is optimized for digits. Letter input may be unsupported or incomplete.')}
        </div>
      )}
    </div>
  );
}
