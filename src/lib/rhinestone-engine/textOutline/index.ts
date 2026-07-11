/**
 * Font Outline Text module — public barrel export.
 *
 * Font Outline Foundation v1.
 * Real TTF/OTF font parsing is deferred to a future phase.
 */

export type { VectorGlyph, VectorFont } from './vectorFont';
export {
  BUILT_IN_VECTOR_FONT,
  SUPPORTED_VECTOR_FONT_CHARACTERS,
  getVectorGlyph,
} from './vectorFont';

export type { OutlineTextAlign, CreateOutlineTextTemplateOptions } from './outlineTextTemplate';
export { createOutlineTextTemplate } from './outlineTextTemplate';
