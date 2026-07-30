/**
 * Template Import to Template Generator
 *
 * Converts imported stones to a RhinestoneTemplate.
 */

import type { RhinestoneTemplate, Stone, StoneSizeId } from '../types/index';
import { importRhinestoneTemplate, estimateStoneSizeId } from './templateImport';
import { createRhinestoneTemplate } from '../template/createTemplate';
import { assertStoneSizeProfile } from '../profiles/stoneSizes';

export interface CreateImportedTemplateOptions {
  svgText: string;
  defaultStoneSizeId: StoneSizeId;
  deduplicateTolerance?: number;
}

export interface ImportedTemplateResult {
  template: RhinestoneTemplate;
  detectedDiameters: number[];
  detectedColors: string[];
  ignoredElements: number;
  warnings: string[];
}

function getDiameterForStoneSize(sizeId: StoneSizeId): number {
  const profile = assertStoneSizeProfile(sizeId);
  return profile.recommendedHoleDiameterMm;
}

export function createImportedTemplate(options: CreateImportedTemplateOptions): ImportedTemplateResult {
  const { svgText, defaultStoneSizeId, deduplicateTolerance } = options;

  // Import stones from SVG
  const importResult = importRhinestoneTemplate({
    svgText,
    deduplicateTolerance,
  });

  // Convert to stones
  const stones: Stone[] = importResult.stones.map((imported, index) => {
    const estimatedSize = estimateStoneSizeId(imported.diameterMm);
    const sizeId = estimatedSize || defaultStoneSizeId;
    const holeDiameter = getDiameterForStoneSize(sizeId);

    const stone: Stone = {
      id: `imp-${index}`,
      center: imported.center,
      stoneSize: sizeId,
      holeDiameterMm: holeDiameter,
    };

    // Preserve color and group as metadata
    const metadata: Record<string, string | number | boolean> = {
      originalIndex: imported.originalIndex,
      importedDiameterMm: imported.diameterMm,
    };

    if (imported.fill) {
      metadata.fill = imported.fill;
    }
    if (imported.stroke) {
      metadata.stroke = imported.stroke;
    }
    if (imported.group) {
      metadata.group = imported.group;
    }

    stone.metadata = metadata;

    return stone;
  });

  const template = createRhinestoneTemplate({
    id: `imported-template-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    name: 'Imported Template',
    stones,
    widthMm: importResult.widthMm,
    heightMm: importResult.heightMm,
  });

  return {
    template,
    detectedDiameters: importResult.detectedDiameters,
    detectedColors: importResult.detectedColors,
    ignoredElements: importResult.ignoredElements,
    warnings: importResult.warnings,
  };
}
