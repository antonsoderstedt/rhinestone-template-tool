import { TemplateFillMode, TemplateCoverageMode, type GeneratorId, suggestSvgUploadMode, getPreferredTextCoverageMode, getSupportedTextCoverageModes, getPreferredRhinestoneFontStoneSize, getSupportedRhinestoneFontStoneSizes, getRhinestoneFontDefinition, isKnownRhinestoneFontId } from '@/src/lib/rhinestone-engine/index';
import { EditorState, OutlineTextStyle, RhinestoneFontPresentationMode, RhinestoneFontToolState, SvgToolState, TextToolState } from './types';
import { DEFAULT_RHINESTONE_FONT_TOOL_STATE, getDefaultSvgUploadTargetDimensions } from './defaults';

export function preferredTextCoverageForFont(fontId: string): TemplateFillMode {
  return getPreferredTextCoverageMode(fontId);
}

export function inferOutlineTextStyle(coverageMode: TemplateCoverageMode, fillMode: TemplateFillMode): OutlineTextStyle {
  if (coverageMode === 'fill' || coverageMode === 'outline-fill' || fillMode === 'fill' || fillMode === 'outline-fill') {
    return 'filled-typography';
  }
  return 'outline';
}

export function clampTextCoverageForFont(next: TextToolState): void {
  const supportedCoverageModes = getSupportedTextCoverageModes(next.fontId);
  const preferredMode = preferredTextCoverageForFont(next.fontId);

  if (!supportedCoverageModes.includes(next.coverageMode)) {
    next.coverageMode = preferredMode;
  }

  if (next.coverageMode === 'contour') {
    if (!supportedCoverageModes.includes(next.fillMode)) {
      next.fillMode = preferredMode;
    }
    return;
  }

  next.fillMode = next.coverageMode;
  next.outlineTextStyle = inferOutlineTextStyle(next.coverageMode, next.fillMode);
}

export function normalizeTextToolUpdate(current: TextToolState, updates: Partial<TextToolState>): TextToolState {
  const next: TextToolState = { ...current, ...updates };
  const styleChanged = updates.outlineTextStyle !== undefined;
  const changesFontOnly =
    updates.fontId !== undefined &&
    updates.outlineTextStyle === undefined &&
    updates.coverageMode === undefined &&
    updates.fillMode === undefined;

  if (styleChanged && next.mode === 'outline') {
    const desiredMode = next.outlineTextStyle === 'filled-typography' ? 'outline-fill' : 'outline';
    next.coverageMode = desiredMode;
    next.fillMode = desiredMode;
  }

  if (changesFontOnly) {
    const preferredMode = preferredTextCoverageForFont(next.fontId);
    next.coverageMode = preferredMode;
    next.fillMode = preferredMode;
  } else if (updates.coverageMode !== undefined && updates.coverageMode !== 'contour' && updates.fillMode === undefined) {
    next.fillMode = updates.coverageMode;
  } else if (updates.fillMode !== undefined && updates.coverageMode === undefined) {
    next.coverageMode = updates.fillMode;
  }

  clampTextCoverageForFont(next);

  return next;
}

export function normalizeSvgToolUpdate(current: SvgToolState, updates: Partial<SvgToolState>): SvgToolState {
  const next: SvgToolState = { ...current, ...updates };

  const applyVectorLayoutPreset = () => {
    next.coverageMode = 'outline-fill';
    next.fillMode = 'outline-fill';
    next.placementPattern = 'default';
  };

  const applyArtworkDotsPreset = () => {
    next.coverageMode = 'fill';
    next.fillMode = 'fill';
    next.placementPattern = 'hexagonal';
    // Standard, not Dense: dense is tighter than the recommended distance and needs calibration first. A caller that says which
    // spacing it wants (a ready-made shape asks for Airy) keeps it.
    next.densityPreset = updates.densityPreset ?? 'standard';
  };

  // A render mode brings its preset along unless the same update says how to cover the shape: restoring a saved design
  // passes both, and the saved choice (for example Rows) must win.
  if (updates.coverageMode === undefined) {
    if (updates.renderMode === 'vector-layout') {
      applyVectorLayoutPreset();
    } else if (updates.renderMode === 'artwork-dots') {
      applyArtworkDotsPreset();
    }
  }

  if (
    updates.uploadedSvgText !== undefined
    && updates.renderMode === undefined
    && typeof updates.uploadedSvgText === 'string'
    && updates.uploadedSvgText.trim().length > 0
  ) {
    if (suggestSvgUploadMode(updates.uploadedSvgText) === 'outline-fill') {
      next.renderMode = 'artwork-dots';
      applyArtworkDotsPreset();
    }
    const defaults = getDefaultSvgUploadTargetDimensions(updates.uploadedSvgText, next.uploadLongestSideMm);
    next.targetWidthMm = defaults.widthMm;
    next.targetHeightMm = defaults.heightMm;
  }

  // A picture is usually a logo to fill, so a newly chosen image starts as Solid (a restored design brings its own mode).
  if (
    typeof updates.uploadedImageDataUrl === 'string'
    && updates.uploadedImageDataUrl.length > 0
    && updates.renderMode === undefined
    && updates.coverageMode === undefined
  ) {
    next.renderMode = 'artwork-dots';
    applyArtworkDotsPreset();
  }

  if (updates.coverageMode !== undefined && updates.coverageMode !== 'contour' && updates.fillMode === undefined) {
    next.fillMode = updates.coverageMode;
  } else if (updates.fillMode !== undefined && updates.coverageMode === undefined) {
    next.coverageMode = updates.fillMode;
  }

  return next;
}

export function inferEditableSourceGenerator(state: EditorState): GeneratorId | null {
  switch (state.activeTool) {
    case 'grid':
      return 'manual-grid';
    case 'text':
      return state.textTool.mode === 'outline' ? 'outline-text' : 'dot-matrix-text';
    case 'svg':
      return 'svg-upload';
    case 'rhinestone-font':
      return 'rhinestone-font';
    case 'template-import':
      return 'template-import';
    case 'manual':
      return 'manual-editor';
    default:
      return state.editableTemplate.sourceGenerator;
  }
}

export function resolveRhinestoneFontPresentationMode(style: string): RhinestoneFontPresentationMode {
  if (style === 'Line') return 'line';
  if (style === 'Digits') return 'digits';
  return 'stones';
}

export function normalizeRhinestoneFontToolUpdate(
  current: RhinestoneFontToolState,
  updates: Partial<RhinestoneFontToolState>,
): RhinestoneFontToolState {
  const next: RhinestoneFontToolState = { ...current, ...updates };

  if (updates.rhinestoneFontId !== undefined) {
    const nextStyle = isKnownRhinestoneFontId(updates.rhinestoneFontId)
      ? getRhinestoneFontDefinition(updates.rhinestoneFontId).style
      : 'Script';
    const nextMode = resolveRhinestoneFontPresentationMode(nextStyle);
    next.presentationMode = nextMode;

    const supportedSizes = getSupportedRhinestoneFontStoneSizes(updates.rhinestoneFontId);
    if (!supportedSizes.includes(next.stoneSize)) {
      next.stoneSize = getPreferredRhinestoneFontStoneSize(updates.rhinestoneFontId);
    }

    const usedDefaultSpacing =
      current.letterSpacingMm === DEFAULT_RHINESTONE_FONT_TOOL_STATE.letterSpacingMm
      && current.lineSpacingMm === DEFAULT_RHINESTONE_FONT_TOOL_STATE.lineSpacingMm;
    if (usedDefaultSpacing && nextMode !== 'stones') {
      next.letterSpacingMm = 0;
      next.lineSpacingMm = 0;
    }
  }

  if (updates.stoneSize !== undefined) {
    const supportedSizes = getSupportedRhinestoneFontStoneSizes(next.rhinestoneFontId);
    if (!supportedSizes.includes(updates.stoneSize)) {
      next.stoneSize = getPreferredRhinestoneFontStoneSize(next.rhinestoneFontId);
    }
  }

  return next;
}
