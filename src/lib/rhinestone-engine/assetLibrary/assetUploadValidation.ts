import { svgStringToPolylines } from '../svg/svgToPolyline';

export type AssetUploadValidationCode =
  | 'ok'
  | 'file_too_large'
  | 'not_a_valid_svg'
  | 'no_supported_shapes';

export interface AssetUploadValidationInput {
  fileName: string;
  mimeType?: string;
  sizeBytes: number;
  svgText?: string | null;
  maxSizeBytes?: number;
}

export interface AssetUploadValidationResult {
  valid: boolean;
  code: AssetUploadValidationCode;
  message: string;
}

export const DEFAULT_ASSET_UPLOAD_MAX_SIZE_BYTES = 5 * 1024 * 1024;

function isSvgAsset(input: AssetUploadValidationInput): boolean {
  const lowerName = input.fileName.toLowerCase();
  return input.mimeType === 'image/svg+xml'
    || lowerName.endsWith('.svg')
    || typeof input.svgText === 'string';
}

export function validateAssetUpload(input: AssetUploadValidationInput): AssetUploadValidationResult {
  const maxSizeBytes = input.maxSizeBytes ?? DEFAULT_ASSET_UPLOAD_MAX_SIZE_BYTES;
  if (input.sizeBytes > maxSizeBytes) {
    const maxSizeMb = Number((maxSizeBytes / (1024 * 1024)).toFixed(1));
    return {
      valid: false,
      code: 'file_too_large',
      message: `File exceeds the ${maxSizeMb} MB upload size limit.`,
    };
  }

  if (!isSvgAsset(input)) {
    return { valid: true, code: 'ok', message: 'Asset is valid.' };
  }

  const svgText = typeof input.svgText === 'string' ? input.svgText : '';
  if (svgText.trim().length === 0) {
    return {
      valid: false,
      code: 'not_a_valid_svg',
      message: 'Not a valid SVG.',
    };
  }
  if (!/<svg\b/i.test(svgText)) {
    return {
      valid: false,
      code: 'not_a_valid_svg',
      message: 'Not a valid SVG.',
    };
  }

  try {
    const polylines = svgStringToPolylines(svgText);
    if (polylines.length === 0) {
      return {
        valid: false,
        code: 'no_supported_shapes',
        message: 'SVG contains no supported shapes.',
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes('no supported svg shapes')) {
      return {
        valid: false,
        code: 'no_supported_shapes',
        message: 'SVG contains no supported shapes.',
      };
    }

    return {
      valid: false,
      code: 'not_a_valid_svg',
      message: 'Not a valid SVG.',
    };
  }

  return { valid: true, code: 'ok', message: 'Asset is valid.' };
}
