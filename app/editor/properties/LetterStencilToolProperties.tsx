'use client';

import { TRW_STONE_SIZE_CALIBRATION, listRhinestoneFonts, getRhinestoneFontDefinition, listSvgAlphabets, getSvgAlphabetDefinition } from '@/src/lib/rhinestone-engine/index';
import NumericInput from '../controls/NumericInput';
import { useT } from '../../lib/i18n';
import { GeneratorErrorBanner, ToolPropertiesProps } from './shared';

export function LetterStencilToolProperties({ state, dispatch, outlineFontStatus }: ToolPropertiesProps) {
  const t = useT();
  const { letterStencilTool } = state;
  const availableAlphabets = listSvgAlphabets();
  // The test fixture is for the test suite; it has no font file in the browser and must not be offered to users.
  const availableFonts = listRhinestoneFonts().filter((font) => font.fontId !== 'test-fixture');
  const selectedAlphabet = getSvgAlphabetDefinition(letterStencilTool.svgAlphabetId as never);
  const selectedFont = getRhinestoneFontDefinition(letterStencilTool.rhinestoneFontId as never);
  const activeSource = letterStencilTool.sourceType === 'rhinestone-font'
    ? {
        displayName: selectedFont.displayName,
        category: selectedFont.category,
        style: selectedFont.style,
        supportedStoneSizes: selectedFont.supportedTargetStoneSizeIds,
        suggestedText: selectedFont.suggestedText,
      }
    : {
        displayName: selectedAlphabet.displayName,
        category: selectedAlphabet.category,
        style: selectedAlphabet.style,
        supportedStoneSizes: selectedAlphabet.supportedTargetStoneSizeIds,
        suggestedText: selectedAlphabet.suggestedText,
      };
  const calibration = TRW_STONE_SIZE_CALIBRATION[
    letterStencilTool.stoneSize as keyof typeof TRW_STONE_SIZE_CALIBRATION
  ];
  const supportedStoneSizes = activeSource.supportedStoneSizes;
  const cardCount = letterStencilTool.text.replace(/[\s\n]/g, '').length;
  const modeCopy = letterStencilTool.layoutMode === 'preview'
    ? 'Preview mode places cards edge-to-edge so you can read the assembled word. Use this for on-screen layout only, not as the final Cricut cut file.'
    : 'Cut-sheet mode keeps an equal-height frame around every letter and inserts a cut gap between cards — this is the layout you send to Cricut.';

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-accent-300 bg-accent-50 px-3 py-3 text-xs text-accent-700">
        {t('Generates a reusable stencil card per letter with an outer cut frame. I stays narrow, W stays wide, and every card keeps the same height so the machine cuts the card and the rhinestone holes together.')}
      </div>

      <GeneratorErrorBanner outlineFontStatus={outlineFontStatus} />

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink-secondary">{t('Glyph source')}</span>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => dispatch({
              type: 'UPDATE_LETTER_STENCIL_TOOL',
              updates: {
                sourceType: 'svg-alphabet',
                stoneSize: selectedAlphabet.supportedTargetStoneSizeIds[0] ?? 'SS10',
              },
            })}
            className={`rounded-xl border px-3 py-2 text-left text-xs transition focus:outline-none focus:ring-2 focus:ring-accent-400 ${letterStencilTool.sourceType === 'svg-alphabet' ? 'border-accent-400 bg-accent-50 text-ink' : 'border-border bg-surface-sunken text-ink-secondary hover:border-border hover:bg-surface-raised'}`}
          >
            <div className="font-medium">{t('SVG Alphabet')}</div>
            <div className="mt-1 text-xs text-ink-muted">{t('Curated per-letter SVG glyphs')}</div>
          </button>
          <button
            type="button"
            onClick={() => dispatch({
              type: 'UPDATE_LETTER_STENCIL_TOOL',
              updates: {
                sourceType: 'rhinestone-font',
                stoneSize: selectedFont.supportedTargetStoneSizeIds[0] ?? 'SS10',
              },
            })}
            className={`rounded-xl border px-3 py-2 text-left text-xs transition focus:outline-none focus:ring-2 focus:ring-accent-400 ${letterStencilTool.sourceType === 'rhinestone-font' ? 'border-accent-400 bg-accent-50 text-ink' : 'border-border bg-surface-sunken text-ink-secondary hover:border-border hover:bg-surface-raised'}`}
          >
            <div className="font-medium">{t('Rhinestone Font')}</div>
            <div className="mt-1 text-xs text-ink-muted">{t('Any registered OpenType rhinestone font')}</div>
          </button>
        </div>
      </div>

      {letterStencilTool.sourceType === 'svg-alphabet' ? (
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-secondary">{t('Alphabet')}</span>
          <select
            aria-label={t('Stencil alphabet')}
            value={letterStencilTool.svgAlphabetId}
            onChange={(e) => {
              const next = getSvgAlphabetDefinition(e.target.value as never);
              dispatch({
                type: 'UPDATE_LETTER_STENCIL_TOOL',
                updates: {
                  svgAlphabetId: next.alphabetId,
                  stoneSize: next.supportedTargetStoneSizeIds[0] ?? 'SS10',
                },
              });
            }}
            className="rounded border border-border bg-surface-sunken px-2 py-2 text-sm text-ink"
          >
            {availableAlphabets.map((alphabet) => (
              <option key={alphabet.alphabetId} value={alphabet.alphabetId}>
                {alphabet.displayName} — {alphabet.style}
              </option>
            ))}
          </select>
          <span className="text-xs text-ink-muted">
            {selectedAlphabet.category} · {selectedAlphabet.style} · supports {selectedAlphabet.supportedTargetStoneSizeIds.join(', ')}
          </span>
        </label>
      ) : (
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-secondary">{t('Rhinestone font')}</span>
          <select
            aria-label={t('Stencil rhinestone font')}
            value={letterStencilTool.rhinestoneFontId}
            onChange={(e) => {
              const next = getRhinestoneFontDefinition(e.target.value as never);
              dispatch({
                type: 'UPDATE_LETTER_STENCIL_TOOL',
                updates: {
                  rhinestoneFontId: next.fontId,
                  stoneSize: next.supportedTargetStoneSizeIds[0] ?? 'SS10',
                },
              });
            }}
            className="rounded border border-border bg-surface-sunken px-2 py-2 text-sm text-ink"
          >
            {availableFonts.map((font) => (
              <option key={font.fontId} value={font.fontId}>
                {font.displayName} — {font.style}
              </option>
            ))}
          </select>
          <span className="text-xs text-ink-muted">
            {selectedFont.category} · {selectedFont.style} · supports {selectedFont.supportedTargetStoneSizeIds.join(', ')}
          </span>
        </label>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink-secondary">{t('Text')}</span>
        <div className="flex items-center justify-between gap-3 text-xs text-ink-muted">
          <span>{cardCount} card{cardCount === 1 ? '' : 's'} · Suggested: {activeSource.suggestedText}</span>
          <button
            type="button"
            onClick={() => dispatch({
              type: 'UPDATE_LETTER_STENCIL_TOOL',
              updates: { text: activeSource.suggestedText },
            })}
            className="rounded-full border border-border px-2 py-1 text-xs text-ink-secondary transition hover:border-border-strong hover:bg-surface-sunken"
          >
            {t('Use sample')}
          </button>
        </div>
        <textarea
          aria-label={t('Stencil text')}
          value={letterStencilTool.text}
          onChange={(e) => dispatch({
            type: 'UPDATE_LETTER_STENCIL_TOOL',
            updates: { text: e.target.value },
          })}
          rows={3}
          placeholder={selectedAlphabet.suggestedText}
          className="resize-y rounded border border-border bg-surface-sunken px-2 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent-400"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink-secondary">{t('Stone size')}</span>
        <select
          aria-label={t('Stencil stone size')}
          value={letterStencilTool.stoneSize}
          onChange={(e) => dispatch({
            type: 'UPDATE_LETTER_STENCIL_TOOL',
            updates: { stoneSize: e.target.value as typeof letterStencilTool.stoneSize },
          })}
          className="rounded border border-border bg-surface-sunken px-2 py-2 text-sm text-ink"
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
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink-secondary">{t('Layout mode')}</span>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => dispatch({ type: 'UPDATE_LETTER_STENCIL_TOOL', updates: { layoutMode: 'preview' } })}
            className={`rounded-xl border px-3 py-2 text-left text-xs transition focus:outline-none focus:ring-2 focus:ring-accent-400 ${letterStencilTool.layoutMode === 'preview' ? 'border-accent-400 bg-accent-50 text-ink' : 'border-border bg-surface-sunken text-ink-secondary hover:border-border hover:bg-surface-raised'}`}
          >
            <div className="font-medium">{t('Preview')}</div>
            <div className="mt-1 text-xs text-ink-muted">{t('Cards edge-to-edge, for visual word preview only')}</div>
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'UPDATE_LETTER_STENCIL_TOOL', updates: { layoutMode: 'cut-sheet' } })}
            className={`rounded-xl border px-3 py-2 text-left text-xs transition focus:outline-none focus:ring-2 focus:ring-accent-400 ${letterStencilTool.layoutMode === 'cut-sheet' ? 'border-accent-400 bg-accent-50 text-ink' : 'border-border bg-surface-sunken text-ink-secondary hover:border-border hover:bg-surface-raised'}`}
          >
            <div className="font-medium">{t('Cut sheet')}</div>
            <div className="mt-1 text-xs text-ink-muted">{t('Framed cards with cut spacing, ready to cut')}</div>
          </button>
        </div>
        <span className="text-xs text-ink-muted">{modeCopy}</span>
      </div>

      <NumericInput
        label={t('Card padding')}
        value={letterStencilTool.cardPaddingMm}
        onChange={(value) => dispatch({
          type: 'UPDATE_LETTER_STENCIL_TOOL',
          updates: { cardPaddingMm: value },
        })}
        unit="mm"
        min={0}
        max={20}
        step={0.5}
      />

      <NumericInput
        label={t('Card corner radius')}
        value={letterStencilTool.cardCornerRadiusMm}
        onChange={(value) => dispatch({
          type: 'UPDATE_LETTER_STENCIL_TOOL',
          updates: { cardCornerRadiusMm: value },
        })}
        unit="mm"
        min={0}
        max={15}
        step={0.5}
      />

      <NumericInput
        label={t('Minimum card width')}
        value={letterStencilTool.minCardWidthMm}
        onChange={(value) => dispatch({
          type: 'UPDATE_LETTER_STENCIL_TOOL',
          updates: { minCardWidthMm: value },
        })}
        unit="mm"
        min={0}
        max={50}
        step={1}
      />

      {letterStencilTool.layoutMode === 'cut-sheet' && (
        <NumericInput
          label={t('Gap between cards')}
          value={letterStencilTool.cutSheetGapMm}
          onChange={(value) => dispatch({
            type: 'UPDATE_LETTER_STENCIL_TOOL',
            updates: { cutSheetGapMm: value },
          })}
          unit="mm"
          min={0}
          max={20}
          step={0.5}
        />
      )}

      {letterStencilTool.unsupportedCharacters.length > 0 && (
        <div role="alert" className="rounded-xl border border-warning-500/30 bg-warning-50 px-3 py-3 text-xs text-warning-600">
          {letterStencilTool.warnings.length > 0
            ? letterStencilTool.warnings.join(' ')
            : `Unsupported characters: ${letterStencilTool.unsupportedCharacters.join(', ')}`}
        </div>
      )}
    </div>
  );
}
