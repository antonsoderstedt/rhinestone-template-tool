'use client';

import { TRW_STONE_SIZE_CALIBRATION, getSvgAlphabetDefinition } from '@/src/lib/rhinestone-engine/index';
import NumericInput from '../controls/NumericInput';
import TextStyleGallery from '../controls/TextStyleGallery';
import { editorFieldLabelClassName, editorSelectClassName, editorTextareaClassName } from '../controls/controlStyles';
import { useT } from '../../lib/i18n';
import { GeneratorErrorBanner, ToolPropertiesProps } from './shared';

export function SvgAlphabetToolProperties({ state, dispatch, outlineFontStatus }: ToolPropertiesProps) {
  const t = useT();
  const { svgAlphabetTool } = state;
  const selectedAlphabet = getSvgAlphabetDefinition(svgAlphabetTool.svgAlphabetId as never);
  const supportedStoneSizes = selectedAlphabet.supportedTargetStoneSizeIds;
  const calibration = TRW_STONE_SIZE_CALIBRATION[
    svgAlphabetTool.stoneSize as keyof typeof TRW_STONE_SIZE_CALIBRATION
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-accent-300 bg-accent-50 px-3 py-3 text-xs leading-6 text-accent-700">
        {t('Composes text from a curated SVG alphabet where each letter is a separate glyph SVG. Each letter is a ready-made drawing, used as it is.')}
      </div>

      <GeneratorErrorBanner outlineFontStatus={outlineFontStatus} />

      <label className="flex flex-col gap-1.5">
        <span className={editorFieldLabelClassName}>{t('Text')}</span>
        <div className="flex items-center justify-between gap-3 text-xs text-ink-muted">
          <span>Suggested sample: {selectedAlphabet.suggestedText}</span>
          <button
            type="button"
            onClick={() => dispatch({
              type: 'UPDATE_SVG_ALPHABET_TOOL',
              updates: { text: selectedAlphabet.suggestedText },
            })}
            className="rounded-full border border-border px-2 py-1 text-xs text-ink-secondary transition hover:border-border-strong hover:bg-surface-sunken"
          >
            {t('Use sample')}
          </button>
        </div>
        <textarea
          aria-label={t('SVG alphabet text')}
          value={svgAlphabetTool.text}
          onChange={(e) => dispatch({
            type: 'UPDATE_SVG_ALPHABET_TOOL',
            updates: { text: e.target.value },
          })}
          rows={3}
          placeholder={selectedAlphabet.suggestedText}
          className={`${editorTextareaClassName} resize-y`}
        />
      </label>

      <TextStyleGallery state={state} dispatch={dispatch} />

      <label className="flex flex-col gap-1.5">
        <span className={editorFieldLabelClassName}>{t('Stone size')}</span>
        <select
          aria-label={t('SVG alphabet stone size')}
          value={svgAlphabetTool.stoneSize}
          onChange={(e) => dispatch({
            type: 'UPDATE_SVG_ALPHABET_TOOL',
            updates: { stoneSize: e.target.value as typeof svgAlphabetTool.stoneSize },
          })}
          className={editorSelectClassName}
        >
          {supportedStoneSizes.map((size) => (
            <option key={size} value={size}>
              {size}{size in TRW_STONE_SIZE_CALIBRATION ? ` — ${TRW_STONE_SIZE_CALIBRATION[size as keyof typeof TRW_STONE_SIZE_CALIBRATION].diameterMm} mm` : ''}
            </option>
          ))}
        </select>
        {calibration && (
          <span className="text-xs text-ink-muted">
            Hole size for this stone: {calibration.diameterMm} mm
          </span>
        )}
        {selectedAlphabet.limitations && selectedAlphabet.limitations.length > 0 && (
          <span className="text-xs text-ink-muted">
            {selectedAlphabet.limitations.join(' · ')}
          </span>
        )}
      </label>

      <NumericInput
        label={t('Letter spacing')}
        value={svgAlphabetTool.letterSpacingMm}
        onChange={(value) => dispatch({
          type: 'UPDATE_SVG_ALPHABET_TOOL',
          updates: { letterSpacingMm: value },
        })}
        unit="mm"
        min={0}
        max={50}
        step={0.25}
      />

      <NumericInput
        label={t('Line spacing')}
        value={svgAlphabetTool.lineSpacingMm}
        onChange={(value) => dispatch({
          type: 'UPDATE_SVG_ALPHABET_TOOL',
          updates: { lineSpacingMm: value },
        })}
        unit="mm"
        min={0}
        max={100}
        step={0.5}
      />

      {svgAlphabetTool.unsupportedCharacters.length > 0 && (
        <div role="alert" className="rounded-xl border border-warning-500/30 bg-warning-50 px-3 py-3 text-xs text-warning-600">
          {svgAlphabetTool.warnings.length > 0
            ? svgAlphabetTool.warnings.join(' ')
            : `Unsupported characters: ${svgAlphabetTool.unsupportedCharacters.join(', ')}`}
        </div>
      )}
    </div>
  );
}
