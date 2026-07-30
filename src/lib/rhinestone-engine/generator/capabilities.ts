import type { FillPattern } from '../fill/polygonFill';
import type { TemplateFillMode } from '../fill/fillTemplate';

export type DesignSource = 'grid' | 'outline-text' | 'dot-matrix-text' | 'svg' | 'manual';
export type CoverageMode = TemplateFillMode | 'contour';
export type PlacementPattern = 'default' | 'hexagonal' | 'radial' | 'scatter' | 'spray';
export type StyleTreatment = 'single-color' | 'two-color' | 'color-gradient' | 'size-gradient' | 'density-gradient';

export interface GeneratorCapabilityProfile {
  designSource: DesignSource;
  supportedCoverageModes: readonly CoverageMode[];
  supportedPlacementPatterns: readonly PlacementPattern[];
  supportedStyleTreatments: readonly StyleTreatment[];
  supportedFillPatterns: readonly FillPattern[];
  supportsGeneratorCoverage: boolean;
  supportsEditableSnapshot: boolean;
}

export const IMPLEMENTED_GENERATOR_CAPABILITIES: Readonly<Record<DesignSource, GeneratorCapabilityProfile>> = {
  'grid': {
    designSource: 'grid',
    supportedCoverageModes: ['outline'],
    supportedPlacementPatterns: ['default'],
    supportedStyleTreatments: ['single-color'],
    supportedFillPatterns: [],
    supportsGeneratorCoverage: false,
    supportsEditableSnapshot: true,
  },
  'outline-text': {
    designSource: 'outline-text',
    supportedCoverageModes: ['outline', 'fill', 'outline-fill', 'contour'],
    supportedPlacementPatterns: ['default', 'hexagonal', 'radial'],
    supportedStyleTreatments: ['single-color'],
    supportedFillPatterns: ['grid', 'offset-grid'],
    supportsGeneratorCoverage: true,
    supportsEditableSnapshot: true,
  },
  'dot-matrix-text': {
    designSource: 'dot-matrix-text',
    supportedCoverageModes: ['outline'],
    supportedPlacementPatterns: ['default'],
    supportedStyleTreatments: ['single-color'],
    supportedFillPatterns: [],
    supportsGeneratorCoverage: false,
    supportsEditableSnapshot: true,
  },
  'svg': {
    designSource: 'svg',
    supportedCoverageModes: ['outline', 'fill', 'outline-fill', 'contour'],
    supportedPlacementPatterns: ['default', 'hexagonal', 'radial'],
    supportedStyleTreatments: ['single-color'],
    supportedFillPatterns: ['grid', 'offset-grid'],
    supportsGeneratorCoverage: true,
    supportsEditableSnapshot: true,
  },
  'manual': {
    designSource: 'manual',
    supportedCoverageModes: [],
    supportedPlacementPatterns: [],
    supportedStyleTreatments: ['single-color'],
    supportedFillPatterns: [],
    supportsGeneratorCoverage: false,
    supportsEditableSnapshot: true,
  },
} as const;

export function getGeneratorCapabilityProfile(designSource: DesignSource): GeneratorCapabilityProfile {
  return IMPLEMENTED_GENERATOR_CAPABILITIES[designSource];
}

export function listImplementedCoverageModes(designSource: DesignSource): readonly CoverageMode[] {
  return getGeneratorCapabilityProfile(designSource).supportedCoverageModes;
}

export function listImplementedFillPatterns(designSource: DesignSource): readonly FillPattern[] {
  return getGeneratorCapabilityProfile(designSource).supportedFillPatterns;
}
