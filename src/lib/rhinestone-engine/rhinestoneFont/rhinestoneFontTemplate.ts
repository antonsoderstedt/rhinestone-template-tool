/**
 * Rhinestone Font Template Generator
 *
 * Creates rhinestone templates from text using fonts where glyphs contain
 * pre-placed rhinestone shapes. Does NOT use outline generation or fill algorithms.
 */

import type { RhinestoneTemplate, Stone, StoneSizeId } from '../types/index';
import { loadRhinestoneFont } from './rhinestoneFontLoader';
import { layoutRhinestoneFontText } from './glyphExtraction';
import { createRhinestoneTemplate } from '../template/createTemplate';
import { getPreferredRhinestoneFontStoneSize } from './rhinestoneFontRegistry';

export interface CreateRhinestoneFontTemplateOptions {
  text: string;
  rhinestoneFontId: string;
  targetStoneSizeId: StoneSizeId;
  targetStoneSizeMm: number;
  letterSpacingMm: number;
  lineSpacingMm: number;
}

export interface RhinestoneFontTemplateResult {
  template: RhinestoneTemplate;
  unsupportedCharacters: string[];
  warnings: string[];
}

export async function createRhinestoneFontTemplate(
  options: CreateRhinestoneFontTemplateOptions
): Promise<RhinestoneFontTemplateResult> {
  const { text, rhinestoneFontId, targetStoneSizeId, targetStoneSizeMm, letterSpacingMm, lineSpacingMm } = options;

  // Load font
  const loaded = await loadRhinestoneFont(rhinestoneFontId);

  if (!loaded.definition.supportedTargetStoneSizeIds.includes(targetStoneSizeId)) {
    throw new Error(
      `Rhinestone font ${loaded.definition.displayName} supports ${loaded.definition.supportedTargetStoneSizeIds.join(', ')}. ` +
      `Requested: ${targetStoneSizeId}. Preferred: ${getPreferredRhinestoneFontStoneSize(loaded.definition.fontId)}.`
    );
  }

  // Layout text
  const layout = layoutRhinestoneFontText({
    text,
    font: loaded.font,
    targetStoneSizeMm,
    targetStoneSizeId,
    letterSpacingMm,
    lineSpacingMm,
  });

  // Convert to stones
  const stones: Stone[] = layout.stones.map((stone, index) => ({
    id: `rf-${index}`,
    center: { x: stone.x, y: stone.y },
    stoneSize: targetStoneSizeId,
    // The TRW physical diameter is authoritative for this source. Generic
    // cutting-profile allowances belong to calibration, not font geometry.
    holeDiameterMm: targetStoneSizeMm,
    metadata: {
      character: stone.character,
      glyphIndex: stone.glyphIndex,
      stoneIndex: stone.stoneIndex,
      presentationMode: loaded.definition.style === 'Line'
        ? 'line'
        : loaded.definition.style === 'Digits'
          ? 'digits'
          : 'stones',
    },
  }));

  const template = createRhinestoneTemplate({
    id: 'rhinestone-font-preview',
    name: `Rhinestone Font: ${text.substring(0, 20)}${text.length > 20 ? '...' : ''}`,
    stones,
    widthMm: layout.widthMm,
    heightMm: layout.heightMm,
    metadata: {
      rhinestoneFontId: loaded.definition.fontId,
      rhinestoneFontStyle: loaded.definition.style,
      presentationMode: loaded.definition.style === 'Line'
        ? 'line'
        : loaded.definition.style === 'Digits'
          ? 'digits'
          : 'stones',
      supportedTargetStoneSizeIds: loaded.definition.supportedTargetStoneSizeIds.join(','),
    },
  });

  const warnings: string[] = [];
  if (layout.unsupportedCharacters.length > 0) {
    warnings.push(
      `The following characters are not supported by ${loaded.definition.displayName}: ${layout.unsupportedCharacters.join(', ')}`
    );
  }

  if (loaded.definition.style === 'Digits') {
    warnings.push(`${loaded.definition.displayName} is a digits-focused rhinestone font. Use it primarily for numeric designs.`);
  }

  if (loaded.definition.style === 'Line') {
    warnings.push(`${loaded.definition.displayName} is a line-style rhinestone font. It works as a pre-placed font here, and is a candidate for a future centerline workflow.`);
  }

  if (loaded.definition.characterCoverage?.digits === false && /\d/.test(text)) {
    warnings.push(`${loaded.definition.displayName} does not include digit coverage.`);
  }

  return {
    template,
    unsupportedCharacters: layout.unsupportedCharacters,
    warnings,
  };
}
