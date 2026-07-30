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
    },
  }));

  const template = createRhinestoneTemplate({
    id: 'rhinestone-font-preview',
    name: `Rhinestone Font: ${text.substring(0, 20)}${text.length > 20 ? '...' : ''}`,
    stones,
    widthMm: layout.widthMm,
    heightMm: layout.heightMm,
  });

  const warnings: string[] = [];
  if (layout.unsupportedCharacters.length > 0) {
    warnings.push(
      `The following characters are not supported by ${loaded.definition.displayName}: ${layout.unsupportedCharacters.join(', ')}`
    );
  }

  return {
    template,
    unsupportedCharacters: layout.unsupportedCharacters,
    warnings,
  };
}
