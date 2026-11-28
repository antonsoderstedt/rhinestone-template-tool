import { type EditorAction } from '../EditorState';
import type { EditorState } from '../EditorState';
import { createStoneGridTemplate, createAllOverTemplate, createOutlineTextTemplateAsync, createDotMatrixTextTemplate, LEGACY_OUTLINE_FONT_ID, createRhinestoneFontTemplate, createSvgAlphabetTemplate, createLetterStencilTemplate, defaultSvgAlphabetGlyphLoader, createImportedTemplate, TRW_STONE_SIZE_CALIBRATION } from '@/src/lib/rhinestone-engine/index';
import type { RhinestoneTemplate } from '@/src/lib/rhinestone-engine/index';
import { generateRasterArtwork, type ArtworkInfo } from '../artworkGeneration';
import { generateSvgArtworkAsync } from '../artworkWorkerClient';
import { getSourcePanelTool } from '../editorUi';
import { decodeRasterImageDataUrl } from '../../lib/rasterImageDecode';

export type OutlineFontStatusState = { status: 'idle' | 'loading' | 'error'; message: string | null; fontId: string };

/** State updater that keeps the current object when nothing changed, so React skips the render. */
export function replaceOutlineFontStatus(next: OutlineFontStatusState) {
  return (current: OutlineFontStatusState): OutlineFontStatusState =>
    current.status === next.status && current.message === next.message && current.fontId === next.fontId ? current : next;
}

/** What a generation request returns when it has nothing to say: the text is empty, the tool makes no stones, or a newer request has taken over. */
export const SKIP_GENERATION = Symbol('skip-generation');

export interface ProduceSourceTemplateInput {
  state: EditorState;
  sourceTool: ReturnType<typeof getSourcePanelTool>;
  gridTool: EditorState['gridTool'];
  textTool: EditorState['textTool'];
  svgTool: EditorState['svgTool'];
  /** The number of this request, and the number of the latest one: when they differ a newer request has started and this one is outdated. */
  requestId: number;
  currentRequestId: () => number;
  setOutlineFontStatus: React.Dispatch<React.SetStateAction<OutlineFontStatusState>>;
  setArtworkInfo: React.Dispatch<React.SetStateAction<ArtworkInfo | null>>;
  dispatch: React.Dispatch<EditorAction>;
}

/**
 * Makes the template of the active source tool (stones from a grid, text, artwork, a font, an alphabet, letter stencils or an import).
 * Moved as it was out of the generation effect of EditorShell (ADR 0070): the effect still owns the request numbers and what is done with
 * the result; this decides what to make and reports font status, artwork info and tool warnings as it goes. After each wait it checks
 * `requestId !== currentRequestId()` where the effect did.
 */
export async function produceSourceTemplate(input: ProduceSourceTemplateInput): Promise<{ template: RhinestoneTemplate | null } | typeof SKIP_GENERATION> {
  const { state, sourceTool, requestId, currentRequestId, setOutlineFontStatus, setArtworkInfo, dispatch } = input;
  const generationGridTool = input.gridTool;
  const generationTextTool = input.textTool;
  const generationSvgTool = input.svgTool;
  let template: RhinestoneTemplate | null = null;

  switch (sourceTool) {
    case 'grid':
      template = generationGridTool.mode === 'area' && typeof generationGridTool.areaWidthMm === 'number' && typeof generationGridTool.areaHeightMm === 'number'
        ? createAllOverTemplate({
            id: 'grid-preview',
            name: 'All over',
            widthMm: generationGridTool.areaWidthMm,
            heightMm: generationGridTool.areaHeightMm,
            stoneSize: generationGridTool.stoneSize,
            pattern: generationGridTool.areaPattern,
            densityPreset: generationGridTool.densityPreset,
            customSpacingMm: typeof generationGridTool.customSpacingMm === 'number' ? generationGridTool.customSpacingMm : undefined,
            seed: generationGridTool.areaSeed,
          })
        : createStoneGridTemplate({
        id: 'grid-preview',
        name: 'Grid Preview',
        stoneSize: generationGridTool.stoneSize,
        columns: generationGridTool.columns,
        rows: generationGridTool.rows,
        densityPreset: generationGridTool.densityPreset,
        customSpacingMm: typeof generationGridTool.customSpacingMm === 'number' ? generationGridTool.customSpacingMm : undefined,
      });
      setOutlineFontStatus((current) => current.status === 'idle' ? current : { status: 'idle', message: null, fontId: generationTextTool.fontId });
      break;

    case 'text':
      if (generationTextTool.text.trim()) {
        if (generationTextTool.mode === 'outline') {
          const usesBundledFont = generationTextTool.fontId !== LEGACY_OUTLINE_FONT_ID;
          setOutlineFontStatus(replaceOutlineFontStatus({
            status: usesBundledFont ? 'loading' : 'idle',
            message: usesBundledFont ? 'Loading font geometry…' : null,
            fontId: generationTextTool.fontId,
          }));
          template = await createOutlineTextTemplateAsync({
            id: 'text-outline-preview',
            name: 'Text Outline Preview',
            text: generationTextTool.text,
            stoneSize: generationTextTool.stoneSize,
            outlineTextStyle: generationTextTool.outlineTextStyle,
            fontId: generationTextTool.fontId,
            fontSizeMm: typeof generationTextTool.fontSizeMm === 'number' ? generationTextTool.fontSizeMm : 25,
            align: generationTextTool.align,
            letterSpacingMm: typeof generationTextTool.letterSpacingMm === 'number' ? generationTextTool.letterSpacingMm : 0,
            lineSpacingMm: typeof generationTextTool.lineSpacingMm === 'number' ? generationTextTool.lineSpacingMm : 10,
            curveAmount: generationTextTool.curveAmount,
            targetWidthMm: typeof generationTextTool.targetWidthMm === 'number' ? generationTextTool.targetWidthMm : undefined,
            targetHeightMm: typeof generationTextTool.targetHeightMm === 'number' ? generationTextTool.targetHeightMm : undefined,
            preserveAspectRatio: generationTextTool.preserveAspectRatio,
            coverageMode: generationTextTool.coverageMode,
            densityPreset: generationTextTool.densityPreset,
            customSpacingMm: typeof generationTextTool.customSpacingMm === 'number' ? generationTextTool.customSpacingMm : undefined,
            fillMode: generationTextTool.fillMode,
            fillPattern: generationTextTool.fillPattern,
            placementPattern: generationTextTool.placementPattern,
            contourSettings: generationTextTool.contourSettings,
            radialSettings: generationTextTool.radialSettings,
          });
          if (requestId !== currentRequestId()) return SKIP_GENERATION;
          setOutlineFontStatus(replaceOutlineFontStatus({ status: 'idle', message: null, fontId: generationTextTool.fontId }));

          // Legacy vector font only: characters with no real glyph
          // silently fell back to '?' — surface that instead of
          // swallowing it (metadata value is comma-joined; see
          // outlineTextTemplate.ts for why it can't be a real array).
          const rawUnsupported = template?.metadata?.['unsupportedCharacters'];
          const unsupportedCharacters = typeof rawUnsupported === 'string' && rawUnsupported.length > 0
            ? rawUnsupported.split(',')
            : [];
          if (JSON.stringify(generationTextTool.unsupportedCharacters) !== JSON.stringify(unsupportedCharacters)) {
            dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { unsupportedCharacters } });
          }
        } else {
          template = createDotMatrixTextTemplate({
            id: 'text-dotmatrix-preview',
            name: 'Dot Matrix Text Preview',
            text: generationTextTool.text,
            stoneSize: generationTextTool.stoneSize,
            letterSpacingColumns: generationTextTool.letterSpacingColumns,
            lineSpacingRows: generationTextTool.lineSpacingRows,
            targetWidthMm: typeof generationTextTool.targetWidthMm === 'number' ? generationTextTool.targetWidthMm : undefined,
            targetHeightMm: typeof generationTextTool.targetHeightMm === 'number' ? generationTextTool.targetHeightMm : undefined,
            preserveAspectRatio: generationTextTool.preserveAspectRatio,
            densityPreset: generationTextTool.densityPreset,
            customSpacingMm: typeof generationTextTool.customSpacingMm === 'number' ? generationTextTool.customSpacingMm : undefined,
          });
          setOutlineFontStatus((current) => current.status === 'idle' ? current : { status: 'idle', message: null, fontId: generationTextTool.fontId });
        }
      }
      break;

    case 'svg':
      if (generationSvgTool.assetKind === 'image' && generationSvgTool.uploadedImageDataUrl) {
        const rasterImage = await decodeRasterImageDataUrl(generationSvgTool.uploadedImageDataUrl);
        if (requestId !== currentRequestId()) return SKIP_GENERATION;
        const generated = generateRasterArtwork(generationSvgTool, rasterImage);
        template = generated.template;
        if (requestId === currentRequestId()) setArtworkInfo(generated.info);
      } else if (generationSvgTool.uploadedSvgText) {
        const generated = await generateSvgArtworkAsync(generationSvgTool);
        if (requestId !== currentRequestId()) return SKIP_GENERATION;
        template = generated.template;
        if (requestId === currentRequestId()) setArtworkInfo(generated.info);
      }
      setOutlineFontStatus((current) => current.status === 'idle' ? current : { status: 'idle', message: null, fontId: generationTextTool.fontId });
      break;

    case 'rhinestone-font':
      if (!state.rhinestoneFontTool.text.trim()) {
        return SKIP_GENERATION;
      }
      {
        const defaultLetterSpacingMm = state.rhinestoneFontTool.presentationMode === 'stones' ? 1 : 0;
        const defaultLineSpacingMm = 0;
        // Get diameter for stone size - TRW calibration only supports SS6, SS10, SS16, SS20
        let targetDiameterMm = 3.429; // Default SS10
        const sizeId = state.rhinestoneFontTool.stoneSize;
        if (sizeId in TRW_STONE_SIZE_CALIBRATION) {
          targetDiameterMm = TRW_STONE_SIZE_CALIBRATION[sizeId as keyof typeof TRW_STONE_SIZE_CALIBRATION].diameterMm;
        }
        
        const result = await createRhinestoneFontTemplate({
          text: state.rhinestoneFontTool.text,
          rhinestoneFontId: state.rhinestoneFontTool.rhinestoneFontId,
          targetStoneSizeId: sizeId,
          targetStoneSizeMm: targetDiameterMm,
          letterSpacingMm: typeof state.rhinestoneFontTool.letterSpacingMm === 'number' ? state.rhinestoneFontTool.letterSpacingMm : defaultLetterSpacingMm,
          lineSpacingMm: typeof state.rhinestoneFontTool.lineSpacingMm === 'number' ? state.rhinestoneFontTool.lineSpacingMm : defaultLineSpacingMm,
        });
        template = result.template;
        // Update unsupported characters and warnings in tool state
        if (
          JSON.stringify(state.rhinestoneFontTool.unsupportedCharacters) !== JSON.stringify(result.unsupportedCharacters) ||
          JSON.stringify(state.rhinestoneFontTool.warnings) !== JSON.stringify(result.warnings)
        ) {
          dispatch({
            type: 'UPDATE_RHINESTONE_FONT_TOOL',
            updates: {
              unsupportedCharacters: result.unsupportedCharacters,
              warnings: result.warnings,
            },
          });
        }
      }
      setOutlineFontStatus((current) => current.status === 'idle' ? current : { status: 'idle', message: null, fontId: generationTextTool.fontId });
      break;

    case 'svg-alphabet':
      if (!state.svgAlphabetTool.text.trim()) {
        return SKIP_GENERATION;
      }
      {
        let targetDiameterMm = 3.429;
        const sizeId = state.svgAlphabetTool.stoneSize;
        if (sizeId in TRW_STONE_SIZE_CALIBRATION) {
          targetDiameterMm = TRW_STONE_SIZE_CALIBRATION[sizeId as keyof typeof TRW_STONE_SIZE_CALIBRATION].diameterMm;
        }
        const result = await createSvgAlphabetTemplate({
          text: state.svgAlphabetTool.text,
          alphabetId: state.svgAlphabetTool.svgAlphabetId,
          targetStoneSizeId: sizeId,
          targetStoneSizeMm: targetDiameterMm,
          letterSpacingMm: typeof state.svgAlphabetTool.letterSpacingMm === 'number' ? state.svgAlphabetTool.letterSpacingMm : 2,
          lineSpacingMm: typeof state.svgAlphabetTool.lineSpacingMm === 'number' ? state.svgAlphabetTool.lineSpacingMm : 0,
          glyphLoader: defaultSvgAlphabetGlyphLoader,
        });
        template = result.template;
        if (
          JSON.stringify(state.svgAlphabetTool.unsupportedCharacters) !== JSON.stringify(result.unsupportedCharacters) ||
          JSON.stringify(state.svgAlphabetTool.warnings) !== JSON.stringify(result.warnings)
        ) {
          dispatch({
            type: 'UPDATE_SVG_ALPHABET_TOOL',
            updates: {
              unsupportedCharacters: result.unsupportedCharacters,
              warnings: result.warnings,
            },
          });
        }
      }
      break;

    case 'letter-stencil':
      if (!state.letterStencilTool.text.trim()) {
        return SKIP_GENERATION;
      }
      {
        let targetDiameterMm = 3.429;
        const sizeId = state.letterStencilTool.stoneSize;
        if (sizeId in TRW_STONE_SIZE_CALIBRATION) {
          targetDiameterMm = TRW_STONE_SIZE_CALIBRATION[sizeId as keyof typeof TRW_STONE_SIZE_CALIBRATION].diameterMm;
        }
        const result = await createLetterStencilTemplate({
          text: state.letterStencilTool.text,
          source: state.letterStencilTool.sourceType === 'rhinestone-font'
            ? {
                type: 'rhinestone-font',
                rhinestoneFontId: state.letterStencilTool.rhinestoneFontId,
              }
            : {
                type: 'svg-alphabet',
                alphabetId: state.letterStencilTool.svgAlphabetId,
                glyphLoader: defaultSvgAlphabetGlyphLoader,
              },
          targetStoneSizeId: sizeId,
          targetStoneSizeMm: targetDiameterMm,
          cardPaddingMm: typeof state.letterStencilTool.cardPaddingMm === 'number' ? state.letterStencilTool.cardPaddingMm : 3,
          cardCornerRadiusMm: typeof state.letterStencilTool.cardCornerRadiusMm === 'number' ? state.letterStencilTool.cardCornerRadiusMm : 2,
          minCardWidthMm: typeof state.letterStencilTool.minCardWidthMm === 'number' ? state.letterStencilTool.minCardWidthMm : 12,
          layoutMode: state.letterStencilTool.layoutMode,
          cutSheetGapMm: typeof state.letterStencilTool.cutSheetGapMm === 'number' ? state.letterStencilTool.cutSheetGapMm : 3,
        });
        template = result.template;
        if (
          JSON.stringify(state.letterStencilTool.unsupportedCharacters) !== JSON.stringify(result.unsupportedCharacters) ||
          JSON.stringify(state.letterStencilTool.warnings) !== JSON.stringify(result.warnings)
        ) {
          dispatch({
            type: 'UPDATE_LETTER_STENCIL_TOOL',
            updates: {
              unsupportedCharacters: result.unsupportedCharacters,
              warnings: result.warnings,
            },
          });
        }
      }
      break;

    case 'template-import':
      if (state.templateImportTool.uploadedSvgText) {
        const importResult = createImportedTemplate({
          svgText: state.templateImportTool.uploadedSvgText,
          defaultStoneSizeId: state.templateImportTool.defaultStoneSize,
          deduplicateTolerance: 0.01,
        });
        template = importResult.template;
        // Update import summary in tool state
        const summary = `Imported ${importResult.template.stones.length} stones. ` +
          `Detected ${importResult.detectedDiameters.length} diameter(s), ${importResult.detectedColors.length} color(s).`;
        if (
          state.templateImportTool.importSummary !== summary ||
          state.templateImportTool.ignoredElements !== importResult.ignoredElements ||
          JSON.stringify(state.templateImportTool.warnings) !== JSON.stringify(importResult.warnings)
        ) {
          dispatch({
            type: 'UPDATE_TEMPLATE_IMPORT_TOOL',
            updates: {
              detectedDiameters: importResult.detectedDiameters,
              detectedColors: importResult.detectedColors,
              ignoredElements: importResult.ignoredElements,
              warnings: importResult.warnings,
              importSummary: summary,
            },
          });
        }
      }
      setOutlineFontStatus((current) => current.status === 'idle' ? current : { status: 'idle', message: null, fontId: generationTextTool.fontId });
      break;

    default:
      return SKIP_GENERATION;
  }

  return { template };
}
