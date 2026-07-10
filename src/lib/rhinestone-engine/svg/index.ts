export type { ParsedSvgElement, SvgSafetyResult } from './svgParser';
export {
  parseSvgAttributes,
  validateSafeSvgInput,
  extractSvgElements,
} from './svgParser';

export type { SvgToPolylineOptions } from './svgToPolyline';
export { svgStringToPolylines } from './svgToPolyline';
